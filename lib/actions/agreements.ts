"use server"

import { createSupabaseServer } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"
import { createNotification } from "./notifications"

export interface DealAgreementData {
  id?: string
  deal_id: string
  seller_signature: string | null
  seller_signed_at: string | null
  buyer_signature: string | null
  buyer_signed_at: string | null
  lawyer_signature: string | null
  lawyer_signed_at: string | null
  created_at?: string
  updated_at?: string
}

/**
 * Retrieves or initializes agreement for a deal.
 * Falls back to deal.ocr_data.agreement if deal_agreements table is missing.
 */
export async function getDealAgreement(dealId: string): Promise<DealAgreementData | null> {
  const serviceClient = getServiceRoleClient() as any

  // 1. Try querying deal_agreements table
  try {
    const { data, error } = await serviceClient
      .from("deal_agreements")
      .select("*")
      .eq("deal_id", dealId)
      .maybeSingle()

    if (!error && data) {
      return data as DealAgreementData
    }
  } catch (err) {
    console.warn("[getDealAgreement] Table query warning:", err)
  }

  // 2. Fallback: check deal.ocr_data.agreement
  const { data: deal } = await serviceClient
    .from("deals")
    .select("ocr_data")
    .eq("id", dealId)
    .maybeSingle()

  if (deal?.ocr_data?.agreement) {
    return {
      deal_id: dealId,
      ...deal.ocr_data.agreement,
    }
  }

  // 3. Return default empty agreement state
  return {
    deal_id: dealId,
    seller_signature: null,
    seller_signed_at: null,
    buyer_signature: null,
    buyer_signed_at: null,
    lawyer_signature: null,
    lawyer_signed_at: null,
  }
}

/**
 * Signs agreement as current authenticated user (Seller, Buyer, or Lawyer).
 * Triggers real-time notifications to all other parties on the deal.
 */
export async function signAgreement(
  dealId: string,
  signatureBase64: string,
  saveAsLawyerDefault: boolean = false
) {
  const supabase = await createSupabaseServer()
  const serviceClient = getServiceRoleClient() as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "משתמש לא מחובר" }

  // 1. Fetch deal details
  const { data: deal, error: dealError } = await serviceClient
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle()

  if (dealError || !deal) return { error: "עסקה לא נמצאה" }

  // 2. Fetch current user profile to determine role
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle()

  const userRole = profile?.role || (user as any).role || "buyer"

  const isSeller = deal.seller_id === user.id
  const isBuyer = deal.buyer_id === user.id
  const isLawyerOrAdmin = userRole === "lawyer" || userRole === "admin"

  if (!isSeller && !isBuyer && !isLawyerOrAdmin) {
    return { error: "אין לך הרשאה לחתום על הסכם בעסקה זו" }
  }

  const nowIso = new Date().toISOString()
  const existingAgreement = await getDealAgreement(dealId)

  // 3. Determine signature column & notification content
  let updateFields: Partial<DealAgreementData> = {}
  let partyRoleLabel = ""

  if (isLawyerOrAdmin) {
    updateFields = {
      lawyer_signature: signatureBase64,
      lawyer_signed_at: nowIso,
    }
    partyRoleLabel = "עורך הדין"
  } else if (isSeller) {
    updateFields = {
      seller_signature: signatureBase64,
      seller_signed_at: nowIso,
    }
    partyRoleLabel = "המוכר"
  } else if (isBuyer) {
    updateFields = {
      buyer_signature: signatureBase64,
      buyer_signed_at: nowIso,
    }
    partyRoleLabel = "הקונה"
  }

  const mergedAgreement: DealAgreementData = {
    deal_id: dealId,
    seller_signature: existingAgreement?.seller_signature || null,
    seller_signed_at: existingAgreement?.seller_signed_at || null,
    buyer_signature: existingAgreement?.buyer_signature || null,
    buyer_signed_at: existingAgreement?.buyer_signed_at || null,
    lawyer_signature: existingAgreement?.lawyer_signature || null,
    lawyer_signed_at: existingAgreement?.lawyer_signed_at || null,
    ...updateFields,
    updated_at: nowIso,
  }

  // 4. Save to deal_agreements table (primary)
  try {
    const { error: upsertError } = await serviceClient
      .from("deal_agreements")
      .upsert(
        {
          deal_id: dealId,
          ...updateFields,
          updated_at: nowIso,
        },
        { onConflict: "deal_id" }
      )

    if (upsertError) {
      console.warn("[signAgreement] Table upsert warning:", upsertError.message)
    }
  } catch (err) {
    console.warn("[signAgreement] Table upsert catch:", err)
  }

  // 5. Save to deal.ocr_data.agreement (fallback & redundancy)
  const currentOcr = deal.ocr_data || {}
  await serviceClient
    .from("deals")
    .update({
      ocr_data: {
        ...currentOcr,
        agreement: mergedAgreement,
      },
      updated_at: nowIso,
    })
    .eq("id", dealId)

  // 6. Save lawyer signature as default profile signature if requested
  if (isLawyerOrAdmin && saveAsLawyerDefault) {
    await saveLawyerSignature(signatureBase64)
  }

  // 7. Notify other parties
  const partiesToNotify: string[] = []
  if (deal.seller_id && deal.seller_id !== user.id) partiesToNotify.push(deal.seller_id)
  if (deal.buyer_id && deal.buyer_id !== user.id) partiesToNotify.push(deal.buyer_id)

  // Notify lawyers if buyer/seller signed
  if (!isLawyerOrAdmin) {
    const { data: lawyers } = await serviceClient
      .from("profiles")
      .select("id")
      .in("role", ["lawyer", "admin"])

    lawyers?.forEach((l: any) => {
      if (l.id !== user.id && !partiesToNotify.includes(l.id)) {
        partiesToNotify.push(l.id)
      }
    })
  }

  for (const recipientId of partiesToNotify) {
    await createNotification({
      userId: recipientId,
      dealId,
      type: "STATUS_CHANGE",
      title: "חתימה חדשה על הסכם העסקה ✍️",
      message: `${partyRoleLabel} (${profile?.full_name || "משתמש"}) חתם/ה על הסכם הרכישה עבור עסקה ${deal.title || dealId.slice(0, 8)}`,
    })
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath(`/lawyer/${dealId}`)
  revalidatePath("/dashboard")
  revalidatePath("/lawyer")

  return { success: true, agreement: mergedAgreement }
}

/**
 * Saves lawyer default signature to profile.
 */
export async function saveLawyerSignature(signatureBase64: string) {
  const supabase = await createSupabaseServer()
  const serviceClient = getServiceRoleClient() as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "משתמש לא מחובר" }

  // Primary update to saved_signature column
  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({ saved_signature: signatureBase64 })
    .eq("id", user.id)

  if (profileError && profileError.code === "42703") {
    // If saved_signature column is missing, update metadata
    await supabase.auth.updateUser({
      data: { saved_signature: signatureBase64 },
    })
  }

  return { success: true }
}

/**
 * Gets lawyer default saved signature from profile or auth metadata.
 */
export async function getSavedLawyerSignature(): Promise<string | null> {
  const supabase = await createSupabaseServer()
  const serviceClient = getServiceRoleClient() as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("saved_signature")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.saved_signature) {
    return profile.saved_signature
  }

  // Check auth user_metadata fallback
  if (user.user_metadata?.saved_signature) {
    return user.user_metadata.saved_signature
  }

  return null
}
