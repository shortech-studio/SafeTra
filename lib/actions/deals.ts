"use server"

import { createServerClient } from "@supabase/ssr"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getCurrentUser } from "@/lib/actions/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { Profile, ProfileModel, Database } from "@/lib/types/database"
import { normalizePhone } from "@/lib/normalize-phone"
import { createNotification } from "@/lib/actions/notifications"

const statusLabels: Record<string, string> = {
  DRAFT: "טיוטה",
  SUBMITTED: "הוגשה",
  UNDER_REVIEW: "בבדיקה",
  AWAITING_PAYMENT: "ממתין לתשלום",
  PAYMENT_VERIFICATION: "אימות תשלום",
  OWNERSHIP_TRANSFER_PENDING: "העברת בעלות",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל",
  EXPIRED: "פג תוקף",
}

async function getSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookies) => {
          try {
            cookies.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Component context
          }
        },
      },
    }
  )
}

export async function inviteBuyer(dealId: string, buyerPhone: string) {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient() as any

  // 1. Validate Current User (Seller)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "התחברות נדרשת" }

  // 2. Validate Deal Ownership (using serviceClient to bypass RLS)
  const { data: deal, error: dealError } = await (serviceClient
    .from("deals") as any)
    .select("*")
    .eq("id", dealId)
    .maybeSingle()

  if (dealError || !deal) return { error: "עסקה לא נמצאה" }

  const isSeller = deal.seller_id === user.id
  if (!isSeller) {
    return { error: "אין הרשאה להזמין קונה לעסקה זו" }
  }

  if ((deal as any).status === "EXPIRED") return { error: "לא ניתן להזמין קונה לעסקה שפגה" }
  if ((deal as any).buyer_id || (deal as any).status !== "DRAFT") {
    return { error: "קונה כבר הצטרף לעסקה זו. לא ניתן להזמין קונים נוספים." }
  }

  // 3. Normalize Input (Can be Phone or Email)
  const rawInput = buyerPhone.trim().toLowerCase()
  const isEmailInput = rawInput.includes("@")
  const cleanContact = normalizePhone(rawInput)

  // 4. Fetch all profiles & auth users to locate registered user
  const { data: existingProfiles } = await serviceClient
    .from("profiles")
    .select("id, full_name, phone, email")

  const { data: { users: authUsers } } = await serviceClient.auth.admin.listUsers()

  let registeredUser = (existingProfiles as any[])?.find((p: any) => {
    if (isEmailInput && p.email?.toLowerCase() === rawInput) return true
    if (p.email?.toLowerCase() === rawInput) return true
    if (p.phone && (p.phone === cleanContact || normalizePhone(p.phone) === cleanContact || p.phone === buyerPhone)) return true
    return false
  })

  // If not found in profiles, check auth users list by email or phone in metadata
  if (!registeredUser && authUsers) {
    const matchedAuthUser = authUsers.find((u: any) => {
      if (u.email?.toLowerCase() === rawInput) return true
      if (u.phone && normalizePhone(u.phone) === cleanContact) return true
      if (u.user_metadata?.phone && normalizePhone(u.user_metadata.phone) === cleanContact) return true
      return false
    })

    if (matchedAuthUser) {
      const existingProf = existingProfiles?.find((p: any) => p.id === matchedAuthUser.id)
      registeredUser = {
        id: matchedAuthUser.id,
        full_name: existingProf?.full_name || matchedAuthUser.user_metadata?.full_name || "משתמש רשום",
        email: matchedAuthUser.email,
        phone: cleanContact
      }

      await serviceClient
        .from("profiles")
        .upsert({
          id: matchedAuthUser.id,
          email: matchedAuthUser.email,
          full_name: registeredUser.full_name,
          phone: cleanContact
        } as any, { onConflict: "id" })
    }
  }

  let targetUserId: string

  if (registeredUser) {
    targetUserId = registeredUser.id
    // Update phone on profile if missing so future lookups succeed instantly
    if (!registeredUser.phone && cleanContact) {
      await serviceClient
        .from("profiles")
        .update({ phone: cleanContact })
        .eq("id", registeredUser.id)
    }
  } else {
    // Fallback: Find or Create Buyer (Shadow User)
    const shadowEmail = isEmailInput ? rawInput : `${cleanContact}@autotrust-demo.com`
    const shadowPassword = `AutoTrust_Secret_${cleanContact}!`

    let authUser = (authUsers as any[])?.find((u: any) => u.email === shadowEmail)

    if (!authUser) {
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email: shadowEmail,
        password: shadowPassword,
        email_confirm: true,
        user_metadata: { original_contact: buyerPhone }
      })

      if (createError) return { error: "שגיאה ביצירת קונה" }
      authUser = newUser.user
    }

    if (!authUser) return { error: "שגיאה באיתור משתמש" }
    targetUserId = authUser.id

    // Ensure Profile Exists for Shadow User
    await serviceClient
      .from("profiles")
      .upsert({
        id: targetUserId,
        email: shadowEmail,
        full_name: "קונה מוזמן",
        phone: cleanContact,
        invited_by: user.id
      } as any, { onConflict: "id" })
  }

  // 5. Create Invitation RECORD
  const { data: invitation, error: inviteError } = await serviceClient
    .from("deal_invitations")
    .insert({
      deal_id: dealId,
      buyer_id: targetUserId,
      phone: cleanContact,
      status: "PENDING"
    })
    .select()
    .single()

  if (inviteError) {
    console.error("Create invitation error:", inviteError)
    return { error: "שגיאה ביצירת הזמנה" }
  }

  // 6. Notify Buyer (Registered user or shadow user)
  await createNotification({
    userId: targetUserId,
    dealId: dealId,
    type: "NEW_INVITATION",
    title: "הזמנה לעסקה חדשה 🚗",
    message: `הוזמנת לעסקה חדשה עבור "${deal.title}". לחץ כאן לאישור והצטרפות.`
  })

  // 7. Generate UNIQUE Link
  const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/deals/${dealId}/join?invite=${invitation.id}`

  revalidatePath("/dashboard")
  revalidatePath("/deals")
  revalidatePath(`/deals/${dealId}`)
  revalidatePath("/lawyer")
  return { success: true, link: inviteLink, dealId: dealId }
}

export async function getDealInvitations(dealId: string) {
  const serviceClient = getServiceRoleClient()
  const { data, error } = await (serviceClient
    .from("deal_invitations") as any)
    .select(`
            *,
            buyer:profiles!buyer_id(full_name, phone)
        `)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Get invitations error:", error)
    return []
  }
  return data || []
}

export async function createDeal(formData: FormData) {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login")
  }

  // Check Profile Completeness (service client to bypass RLS + fallback check)
  const { data: profile } = await (serviceClient
    .from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  const profileFullName = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name
  const profileIdNumber = profile?.id_number || profile?.teudat_zehut || user.user_metadata?.id_number || user.user_metadata?.teudat_zehut
  const profileContact = profile?.email || profile?.phone || user.email || user.user_metadata?.phone

  const isProfileComplete = Boolean(profileFullName && profileIdNumber && profileContact)

  if (!isProfileComplete) {
    redirect("/auth/complete-profile")
  }

  const title = formData.get("title") as string
  const priceILS = Number.parseFloat(formData.get("priceILS") as string)
  const licensePlate = formData.get("licensePlate") as string
  const vehicleMake = formData.get("vehicleMake") as string
  const vehicleModel = formData.get("vehicleModel") as string
  const vehicleYear = parseInt(formData.get("vehicleYear") as string) || null
  const idDocUrl = formData.get("idDocUrl") as string
  const vehicleRegDocUrl = formData.get("vehicleRegDocUrl") as string

  // Optional: Update profile if AI found data and it was missing
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const idNumber = formData.get("idNumber") as string

  // New fields
  const engineVolume = parseInt(formData.get("engineVolume") as string) || null
  const licenseExpiry = formData.get("licenseExpiry") as string || null
  const previousOwners = parseInt(formData.get("previousOwners") as string) || null
  const chassisNumber = formData.get("chassisNumber") as string || null
  const kilometers = parseInt(formData.get("kilometers") as string) || null
  const vehicleRegOwnerName = formData.get("vehicleRegOwnerName") as string || null
  const vehicleRegOwnerId = formData.get("vehicleRegOwnerId") as string || null
  const thumbnailUrl = formData.get("thumbnailUrl") as string || null
  const vehicleImagesJson = formData.get("vehicleImages") as string
  let vehicleImages: string[] = []
  if (vehicleImagesJson) {
    try {
      vehicleImages = JSON.parse(vehicleImagesJson)
    } catch {
      vehicleImages = []
    }
  }

  const ocrDataJson = formData.get("ocrData") as string
  let ocrData: any = {}
  if (ocrDataJson) {
    try {
      ocrData = JSON.parse(ocrDataJson)
    } catch {
      ocrData = {}
    }
  }

  if (firstName && lastName && idNumber) {
    await (serviceClient.from("profiles") as any).upsert({
      id: user.id,
      full_name: `${firstName} ${lastName}`.trim(),
      id_number: idNumber,
      // email: profile.email // already there
    }, { onConflict: "id" })
    revalidatePath("/", "layout")
  }

  if (!title || !priceILS || priceILS <= 0) {
    return { error: "כל השדות נדרשים" }
  }

  const { data, error } = await (serviceClient
    .from("deals") as any)
    .insert([
      {
        seller_id: user.id,
        title,
        price_ils: priceILS,
        status: "DRAFT",
        license_plate: licensePlate,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_year: vehicleYear,
        id_doc_url: idDocUrl,
        vehicle_reg_doc_url: vehicleRegDocUrl,
        first_name: firstName,
        last_name: lastName,
        owner_id_number: idNumber,
        engine_volume: engineVolume,
        license_expiry_date: licenseExpiry,
        previous_owners: previousOwners,
        chassis_number: chassisNumber,
        kilometers: kilometers,
        vehicle_reg_owner_name: vehicleRegOwnerName,
        vehicle_reg_owner_id: vehicleRegOwnerId,
        thumbnail_url: thumbnailUrl,
        vehicle_images: vehicleImages,
        ocr_data: ocrData,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error("[v0] Create deal error:", error)
    return { error: "שגיאה ביצירת עסקה" }
  }

  // Notify Lawyers & Admins
  const { data: staff } = await (serviceClient.from("profiles") as any)
    .select("id")
    .in("role", ["lawyer", "admin"])
  for (const member of (staff || [])) {
    await createNotification({
      userId: member.id,
      dealId: data.id,
      type: "NEW_DEAL",
      title: "עסקה חדשה במערכת",
      message: `נוצרה עסקה חדשה: ${title}. נדרשת בדיקה.`
    })
  }

  redirect(`/deals/${data.id}`)
}

export async function getDealById(dealId: string) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/login")
  }

  const serviceClient = getServiceRoleClient()

  // 1. Fetch deal WITHOUT joins to avoid FK errors
  const { data: deal, error } = await (serviceClient
    .from("deals") as any)
    .select("*")
    .eq("id", dealId)
    .maybeSingle()

  if (error) {
    console.error("[v0] Get deal error:", error)
    return null
  }

  if (!deal) return null

  // 2. Manually fetch related profiles (Application-Side Join)
  const sellerId = deal.seller_id
  const buyerId = deal.buyer_id

  const profileIds = [sellerId]
  if (buyerId) profileIds.push(buyerId)

  const { data: profiles } = await (serviceClient
    .from("profiles") as any)
    .select("*")
    .in("id", profileIds)

  // 3. Attach profiles to deal object
  const seller = profiles?.find((p: any) => p.id === sellerId)
  const buyer = profiles?.find((p: any) => p.id === buyerId)

  const sellerConfirmed = deal.seller_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("SELLER_CONFIRMED")
  const buyerConfirmed = deal.buyer_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("BUYER_CONFIRMED")

  const enrichedDeal = {
    ...deal,
    payment_proof_url: deal.payment_proof_url || (deal.vehicle_reg_owner_id?.startsWith("http") ? deal.vehicle_reg_owner_id : null),
    seller_confirmed_delivery: !!sellerConfirmed,
    buyer_confirmed_delivery: !!buyerConfirmed,
    seller: seller || null,
    buyer: buyer || null
  }

  // Permission Check
  const isLawyerOrAdmin = (user as any).role === 'lawyer' || (user as any).role === 'admin'
  if (!isLawyerOrAdmin && enrichedDeal.seller_id !== user.id && enrichedDeal.buyer_id !== user.id) {
    // Check if user has an invitation (by buyer_id or phone match)
    const { data: invitations } = await (serviceClient
      .from("deal_invitations") as any)
      .select("id")
      .eq("deal_id", dealId)
      .eq("buyer_id", user.id)
      .limit(1)

    const invitation = invitations && invitations.length > 0 ? invitations[0] : null

    if (!invitation) {
      const { data: userProfile } = await (serviceClient.from("profiles") as any)
        .select("phone, email")
        .eq("id", user.id)
        .maybeSingle()

      let phoneMatchedInvite = null
      if (userProfile?.phone) {
        const cleanPhone = normalizePhone(userProfile.phone)
        const { data: matched } = await (serviceClient.from("deal_invitations") as any)
          .select("id")
          .eq("deal_id", dealId)
          .or(`phone.eq.${cleanPhone},phone.eq.${userProfile.phone}`)
          .limit(1)
        phoneMatchedInvite = matched && matched.length > 0 ? matched[0] : null
      }

      if (phoneMatchedInvite) {
        // Auto-claim invitation for user
        await (serviceClient.from("deal_invitations") as any)
          .update({ buyer_id: user.id })
          .eq("id", phoneMatchedInvite.id)
      } else {
        console.warn(`[v0] User ${user.id} attempted to access deal ${dealId} without permission`)
        return null
      }
    }
  }

  return enrichedDeal
}

export async function joinDeal(dealId: string, invitationId?: string) {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // 1. Fetch deal (using service client to bypass RLS before join)
  const { data: deal } = await (serviceClient
    .from("deals") as any)
    .select("*")
    .eq("id", dealId)
    .single()

  if (!deal) return { error: "עסקה לא נמצאה" }
  if ((deal as any).status === "EXPIRED") return { error: "העסקה פגה" }
  if ((deal as any).buyer_id && (deal as any).buyer_id !== user.id) {
    return { error: "העסקה כבר משויכת לקונה אחר" }
  }

  // 2. Validate Invitation if provided
  if (invitationId) {
    const { data: invitation, error: inviteError } = await (supabase
      .from("deal_invitations") as any)
      .select("*")
      .eq("id", invitationId)
      .eq("deal_id", dealId)
      .single()

    if (inviteError || !invitation) return { error: "הזמנה לא תקינה" }

    const { data: userProfile } = await (serviceClient.from("profiles") as any)
      .select("phone, email")
      .eq("id", user.id)
      .maybeSingle()

    const cleanPhone = userProfile?.phone ? normalizePhone(userProfile.phone) : null

    const isMatch = invitation.buyer_id === user.id ||
      (cleanPhone && (invitation.phone === cleanPhone || normalizePhone(invitation.phone) === cleanPhone)) ||
      (userProfile?.email && invitation.phone === userProfile.email)

    if (!isMatch) {
      return { error: "הזמנה זו אינה מיועדת לחשבון זה" }
    }

    // Mark invitation as accepted and reassign to current user
    await serviceClient
      .from("deal_invitations")
      .update({ status: "ACCEPTED", buyer_id: user.id })
      .eq("id", invitationId)
  }

  // 3. Link Buyer to Deal and update status to SUBMITTED
  const { error: updateError } = await serviceClient
    .from("deals")
    .update({
      buyer_id: user.id,
      // status: "SUBMITTED" // Removed: Buyer must manually approve first (remains DRAFT)
    })
    .eq("id", dealId)

  if (updateError) {
    console.error("Join deal error:", updateError)
    return { error: "שגיאה בעדכון העסקה" }
  }

  revalidatePath(`/deals/${dealId}`)
  redirect(`/deals/${dealId}`)
}

export async function approveDeal(dealId: string) {
  const supabase = await getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "נדרשת התחברות" }

  const serviceClient = getServiceRoleClient()

  // Verify it's the buyer
  const { data: deal } = await (serviceClient.from("deals") as any)
    .select("seller_id, buyer_id, status, title")
    .eq("id", dealId)
    .single()

  if (!deal) return { error: "עסקה לא נמצאה" }
  if (deal.buyer_id !== user.id) return { error: "אין הרשאה לאשר עסקה זו" }
  if (deal.status !== "DRAFT") return { error: "העסקה כבר אושרה או שאינה במצב טיוטה" }

  const { error } = await (serviceClient.from("deals") as any)
    .update({
      status: "SUBMITTED",
      updated_at: new Date().toISOString()
    })
    .eq("id", dealId)

  if (error) {
    console.error("Approve deal error:", error)
    return { error: "שגיאה באישור העסקה" }
  }

  // Notify seller that buyer approved the proposal
  if (deal.seller_id) {
    await createNotification({
      userId: deal.seller_id,
      dealId: dealId,
      type: "DEAL_APPROVED",
      title: "הקונה אישר את הצעת הרכישה! 🤝",
      message: `הקונה אישר את התנאים עבור העסקה "${deal.title || 'הרכב'}". העסקה עברה לבדיקת עורך דין.`
    })
  }

  // Notify lawyers
  const { data: staff } = await (serviceClient.from("profiles") as any)
    .select("id")
    .in("role", ["lawyer", "admin"])
  for (const member of (staff || [])) {
    await createNotification({
      userId: member.id,
      dealId: dealId,
      type: "STATUS_CHANGE",
      title: "עסקה אושרה ע״י הקונה",
      message: `העסקה "${deal.title || 'הרכב'}" אושרה ע״י הקונה ומוכנה לבדיקת עורך דין.`
    })
  }

  revalidatePath("/dashboard")
  revalidatePath("/deals")
  revalidatePath(`/deals/${dealId}`)
  revalidatePath("/lawyer")
}

export async function rejectDeal(dealId: string) {
  const supabase = await getSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "נדרשת התחברות" }

  const serviceClient = getServiceRoleClient()

  // Verify it's the buyer
  const { data: deal } = await (serviceClient.from("deals") as any)
    .select("buyer_id, status")
    .eq("id", dealId)
    .single()

  if (!deal) return { error: "עסקה לא נמצאה" }
  if (deal.buyer_id !== user.id) return { error: "אין הרשאה לדחות עסקה זו" }
  if (deal.status !== "DRAFT") return { error: "לא ניתן לדחות עסקה שאינה בסטטוס טיוטה" }

  const { error } = await (serviceClient.from("deals") as any)
    .update({
      status: "CANCELLED",
      updated_at: new Date().toISOString()
    })
    .eq("id", dealId)

  if (error) {
    console.error("Reject deal error:", error)
    return { error: "שגיאה בדחיית העסקה" }
  }

  revalidatePath(`/deals/${dealId}`)
}

export async function updateDealStatus(dealId: string, newStatus: string) {
  const supabase = await getSupabaseClient()

  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/login")
  }

  const validTransitions: Record<string, string[]> = {
    DRAFT: ["SUBMITTED", "EXPIRED", "CANCELLED"],
    SUBMITTED: ["UNDER_REVIEW", "EXPIRED", "CANCELLED"],
    UNDER_REVIEW: ["AWAITING_PAYMENT", "EXPIRED", "CANCELLED"],
    AWAITING_PAYMENT: ["PAYMENT_VERIFICATION", "EXPIRED", "CANCELLED"],
    PAYMENT_VERIFICATION: ["OWNERSHIP_TRANSFER_PENDING", "EXPIRED", "CANCELLED"],
    OWNERSHIP_TRANSFER_PENDING: ["COMPLETED", "EXPIRED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: [],
    READY_FOR_NEXT_STAGE: ["EXPIRED", "CANCELLED"]
  }

  // Get current deal status
  const deal = await getDealById(dealId)
  if (!deal) {
    return { error: "עסקה לא נמצאה" }
  }

  /* Method updated to use Service Role + Manual Permission Checks */
  const serviceClient = getServiceRoleClient()

  // Lawyer/Admin Override: Allow Lawyer/Admin to move to ANY status
  const isLawyerOrAdmin = (user as any).role === 'lawyer' || (user as any).role === 'admin'

  const currentStatusUpper = (deal.status || "").toUpperCase()
  const newStatusUpper = (newStatus || "").toUpperCase()

  if (!isLawyerOrAdmin && !validTransitions[currentStatusUpper]?.includes(newStatusUpper)) {
    return { error: `מעבר לא חוקי מ-${deal.status} ל-${newStatus}` }
  }

  /* 
     Dynamic Query Construction:
     If lawyer/admin, update by ID only.
     If seller, enforce seller_id match to prevent unauthorized updates.
  */
  let query = (serviceClient.from("deals") as any)
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", dealId)

  if (!isLawyerOrAdmin) {
    query = query.eq("seller_id", user.id)
  }

  const { data, error } = await query
    .select()
    .single()

  if (error) {
    console.error("Update status error:", error)
    return { error: "שגיאה בעדכון הסטטוס" }
  }

  // 4. Notify Parties
  const partiesToNotify = []
  if (deal.seller_id && deal.seller_id !== user.id) partiesToNotify.push(deal.seller_id)
  if (deal.buyer_id && deal.buyer_id !== user.id) partiesToNotify.push(deal.buyer_id)

  // Also notify lawyers and admins if appropriate (e.g., when submitted or ready for review)
  if (newStatus === 'SUBMITTED' || newStatus === 'UNDER_REVIEW') {
    const { data: staff } = await (serviceClient.from("profiles") as any)
      .select("id")
      .in("role", ["lawyer", "admin"])
    staff?.forEach((l: any) => partiesToNotify.push(l.id))
  }

  for (const userId of partiesToNotify) {
    await createNotification({
      userId,
      dealId,
      type: "STATUS_CHANGE",
      title: "עדכון בסטטוס העסקה",
      message: `סטטוס העסקה "${deal.title}" עודכן ל-${statusLabels[newStatus] || newStatus}`
    })
  }

  revalidatePath("/dashboard")
  revalidatePath("/deals")
  revalidatePath(`/deals/${dealId}`)
  revalidatePath("/lawyer")

  return { data }
}

export async function getLatestDealStatus(dealId: string) {
  const serviceClient = getServiceRoleClient()
  const { data, error } = await (serviceClient.from("deals") as any)
    .select("status, updated_at, vehicle_reg_owner_id")
    .eq("id", dealId)
    .maybeSingle()

  if (error || !data) {
    return { status: null, error: error?.message || "Not found" }
  }
  const paymentProof = data.vehicle_reg_owner_id?.startsWith("http") ? data.vehicle_reg_owner_id : null
  return { status: data.status, updatedAt: data.updated_at, paymentProofUrl: paymentProof }
}


export async function getUserDeals() {
  const supabase = await getSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login")
  }

  const serviceClient = getServiceRoleClient()

  // 1. Auto-claim pending invitations/notifications matching user's phone
  const { data: userProfile } = await (serviceClient.from("profiles") as any)
    .select("phone, email")
    .eq("id", user.id)
    .maybeSingle()

  if (userProfile && (userProfile.phone || userProfile.email)) {
    const cleanPhone = userProfile.phone ? normalizePhone(userProfile.phone) : null

    if (cleanPhone) {
      const { data: orphanInvites } = await (serviceClient.from("deal_invitations") as any)
        .select("id, buyer_id")
        .or(`phone.eq.${cleanPhone},phone.eq.${userProfile.phone}`)
        .neq("buyer_id", user.id)

      if (orphanInvites && orphanInvites.length > 0) {
        const orphanBuyerIds = orphanInvites.map((i: any) => i.buyer_id)
        
        await (serviceClient.from("deal_invitations") as any)
          .update({ buyer_id: user.id })
          .in("id", orphanInvites.map((i: any) => i.id))

        await (serviceClient.from("notifications") as any)
          .update({ user_id: user.id })
          .in("user_id", orphanBuyerIds)
      }
    }
  }

  // 2. Get deals where user is seller or buyer
  const { data: directDeals, error: directError } = await (serviceClient
    .from("deals") as any)
    .select("*")
    .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  if (directError) {
    console.error("[v0] Get direct deals error:", directError)
    return []
  }

  // 3. Also get deals where user has an invitation
  const { data: invites, error: inviteError } = await (serviceClient
    .from("deal_invitations") as any)
    .select("deal_id")
    .eq("buyer_id", user.id)

  if (inviteError) {
    console.error("[v0] Get invitation deals error:", inviteError)
    return directDeals || []
  }

  if (invites && invites.length > 0) {
    const invitedDealIds = invites.map((i: any) => i.deal_id)
    const { data: invitedDeals } = await (serviceClient
      .from("deals") as any)
      .select("*")
      .in("id", invitedDealIds)

    // Merge unique deals
    const allDeals = [...(directDeals || [])]
    invitedDeals?.forEach((deal: any) => {
      if (!allDeals.find(d => d.id === deal.id)) {
        allDeals.push(deal)
      }
    })
    return allDeals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return directDeals || []
}

export async function uploadPaymentProofAction(dealId: string, formData: FormData) {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "משתמש לא מחובר" }

  const file = formData.get("file") as File
  if (!file) return { error: "קובץ אסמכתא חסר" }

  const fileExt = file.name.split(".").pop() || "jpg"
  const fileName = `payment_proof_${Date.now()}.${fileExt}`
  const filePath = `${user.id}/${fileName}`

  // Convert File to Buffer to ensure correct MIME handling in Node environment
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await serviceClient.storage
    .from("documents")
    .upload(filePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true
    })

  if (uploadError) {
    console.error("Upload payment proof error:", uploadError)
    return { error: `שגיאה בהעלאת אסמכתא: ${uploadError.message}` }
  }

  const { data: { publicUrl } } = serviceClient.storage
    .from("documents")
    .getPublicUrl(filePath)

  // Primary update with guaranteed-existing columns only
  const { error: updateError } = await (serviceClient.from("deals") as any)
    .update({
      status: "PAYMENT_VERIFICATION",
      vehicle_reg_owner_id: publicUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", dealId)

  if (updateError) {
    console.error("Update deal payment status error:", updateError)
    return { error: `שגיאה בעדכון סטטוס עסקה: ${updateError.message}` }
  }

  // Optional: try adding payment_proof_url if the column exists (non-blocking)
  await (serviceClient.from("deals") as any)
    .update({ payment_proof_url: publicUrl })
    .eq("id", dealId)
    .then(() => {})
    .catch(() => {})


  // Create notification for lawyers / admin
  const { data: lawyerProfiles } = await (serviceClient.from("profiles") as any)
    .select("id")
    .eq("role", "lawyer")

  if (lawyerProfiles && lawyerProfiles.length > 0) {
    for (const lawyer of lawyerProfiles) {
      await createNotification({
        userId: lawyer.id,
        title: "אסמכתת הפקדת נאמנות חדשה 💳",
        message: `הועלתה אסמכתת תשלום חדשה לבדיקה עבור עסקה ${dealId.slice(0, 8)}`,
        dealId,
        type: "PAYMENT_VERIFICATION"
      })
    }
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath("/dashboard")
  revalidatePath("/lawyer")

  return { success: true, proofUrl: publicUrl }
}

export async function verifyEscrowDepositAction(dealId: string) {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "משתמש לא מחובר" }

  // Check deal details
  const { data: deal } = await (serviceClient.from("deals") as any)
    .select("seller_id, buyer_id, title")
    .eq("id", dealId)
    .maybeSingle()

  if (!deal) return { error: "עסקה לא נמצאה" }

  // Update status to OWNERSHIP_TRANSFER_PENDING (Escrow Locked)
  await (serviceClient.from("deals") as any)
    .update({
      status: "OWNERSHIP_TRANSFER_PENDING",
      updated_at: new Date().toISOString()
    })
    .eq("id", dealId)

  // Notify both Seller and Buyer
  if (deal.seller_id) {
    await createNotification({
      userId: deal.seller_id,
      title: "כספי הנאמנות אושרו ונעולים בכספת! 🔒",
      message: `עורך הדין אימת את הפקדת הנאמנות עבור "${deal.title}". ניתן להמשיך להעברת בעלות.`,
      dealId,
      type: "ESCROW_LOCKED"
    })
  }

  if (deal.buyer_id) {
    await createNotification({
      userId: deal.buyer_id,
      title: "כספי הנאמנות אושרו ונעולים בכספת! 🔒",
      message: `עורך הדין אימת את העברת הכספים. הכספים מוגנים בנאמנות SafeTra.`,
      dealId,
      type: "ESCROW_LOCKED"
    })
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath("/dashboard")
  revalidatePath("/lawyer")

  return { success: true }
}

export async function confirmHandoverAction(dealId: string, role: "seller" | "buyer") {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "משתמש לא מחובר" }

  const { data: deal } = await (serviceClient.from("deals") as any)
    .select("*")
    .eq("id", dealId)
    .maybeSingle()

  if (!deal) return { error: "עסקה לא נמצאה" }

  const currentNotes = deal.vehicle_reg_owner_name || ""
  const isSeller = role === "seller"

  const sellerConfirmed = isSeller ? true : currentNotes.includes("SELLER_CONFIRMED") || !!deal.seller_confirmed_delivery
  const buyerConfirmed = !isSeller ? true : currentNotes.includes("BUYER_CONFIRMED") || !!deal.buyer_confirmed_delivery

  const isBothConfirmed = sellerConfirmed && buyerConfirmed
  const newStatus = isBothConfirmed ? "COMPLETED" : "OWNERSHIP_TRANSFER_PENDING"

  const flags = []
  if (sellerConfirmed) flags.push("SELLER_CONFIRMED")
  if (buyerConfirmed) flags.push("BUYER_CONFIRMED")
  const newOwnerName = flags.join(",")

  const updateData: any = {
    updated_at: new Date().toISOString(),
    status: newStatus,
    vehicle_reg_owner_name: newOwnerName
  }

  if (isSeller) updateData.seller_confirmed_delivery = true
  if (!isSeller) updateData.buyer_confirmed_delivery = true

  let { error: updateError } = await (serviceClient.from("deals") as any)
    .update(updateData)
    .eq("id", dealId)

  if (updateError && updateError.code === "PGRST204") {
    await (serviceClient.from("deals") as any)
      .update({
        status: newStatus,
        vehicle_reg_owner_name: newOwnerName,
        updated_at: new Date().toISOString()
      })
      .eq("id", dealId)
  }

  if (isBothConfirmed) {
    // Notify both parties of completed deal & payout
    if (deal.seller_id) {
      await createNotification({
        userId: deal.seller_id,
        title: "העסקה הושלמה בהצלחה! 💸",
        message: `אישור מסירה דו-צדדי התקבל. כספי הנאמנות בסך ₪${Number(deal.price_ils).toLocaleString("he-IL")} שוחררו לחשבונך.`,
        dealId,
        type: "COMPLETED"
      })
    }
    if (deal.buyer_id) {
      await createNotification({
        userId: deal.buyer_id,
        title: "תתחדש! העסקה הושלמה בהצלחה 🚗",
        message: `אישור המסירה הדו-צדדי הושלם. תודה שהשתמשת ב-SafeTra!`,
        dealId,
        type: "COMPLETED"
      })
    }
  } else {
    // Notify the other party of handover signoff
    const otherUserId = isSeller ? deal.buyer_id : deal.seller_id
    if (otherUserId) {
      await createNotification({
        userId: otherUserId,
        title: "אישור מסירת רכב חדש 🔑",
        message: `${isSeller ? "המוכר" : "הקונה"} אישר את מסירת הרכב. אנא אשר גם אתה להשלמת העסקה ושחרור הכספים.`,
        dealId,
        type: "HANDOVER_UPDATE"
      })
    }
    // Notify lawyers of handover signoff
    const { data: lawyers } = await (serviceClient.from("profiles") as any)
      .select("id")
      .in("role", ["lawyer", "admin"])

    if (lawyers && lawyers.length > 0) {
      for (const lawyer of lawyers) {
        await createNotification({
          userId: lawyer.id,
          title: "אישור מסירה והעברת בעלות חדש 🚗",
          message: `${isSeller ? "המוכר" : "הקונה"} אישר את מסירת הרכב עבור עסקה ${dealId.slice(0, 8)}. ${isBothConfirmed ? "אישור דו-צדדי הושלם במלואו!" : "ממתין לאישור הצד השני."}`,
          dealId,
          type: "HANDOVER_UPDATE"
        })
      }
    }
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath(`/lawyer/${dealId}`)
  revalidatePath("/dashboard")
  revalidatePath("/lawyer")

  return { success: true, completed: isBothConfirmed }
}

export async function processRefundAction(dealId: string) {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "משתמש לא מחובר" }

  const { data: deal } = await (serviceClient.from("deals") as any)
    .select("buyer_id, seller_id, title, price_ils")
    .eq("id", dealId)
    .maybeSingle()

  if (!deal) return { error: "עסקה לא נמצאה" }

  await (serviceClient.from("deals") as any)
    .update({
      status: "CANCELLED",
      updated_at: new Date().toISOString()
    })
    .eq("id", dealId)

  if (deal.buyer_id) {
    await createNotification({
      userId: deal.buyer_id,
      title: "החזר כספי אושר 🔄",
      message: `עורך הדין אישר את החזר כספי הנאמנות בסך ₪${Number(deal.price_ils).toLocaleString("he-IL")} לחשבונך עבור "${deal.title}".`,
      dealId,
      type: "REFUND_PROCESSED"
    })
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath("/dashboard")
  revalidatePath("/lawyer")

  return { success: true }
}

export async function updateDealOcrField(dealId: string, fieldName: string, newValue: any) {
  const user = await getCurrentUser()
  if (!user) return { error: "נדרשת התחברות" }

  const serviceClient = getServiceRoleClient()

  const { data: deal, error: fetchErr } = await (serviceClient.from("deals") as any)
    .select("seller_id, buyer_id, ocr_data, first_name, last_name, owner_id_number, license_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_reg_owner_name, vehicle_reg_owner_id")
    .eq("id", dealId)
    .single()

  if (fetchErr || !deal) return { error: "עסקה לא נמצאה" }

  const isAuthorized = deal.seller_id === user.id || deal.buyer_id === user.id || user.role === "lawyer" || user.role === "admin"
  if (!isAuthorized) return { error: "אין הרשאה לעדכן עסקה זו" }

  const fieldColumnMap: Record<string, string> = {
    firstName: "first_name",
    lastName: "last_name",
    idNumber: "owner_id_number",
    licensePlate: "license_plate",
    vehicleMake: "vehicle_make",
    vehicleModel: "vehicle_model",
    vehicleYear: "vehicle_year",
    vehicleRegOwnerName: "vehicle_reg_owner_name",
    vehicleRegOwnerId: "vehicle_reg_owner_id",
  }

  const dbColumn = fieldColumnMap[fieldName] || fieldName

  const updatedOcrData = {
    ...(deal.ocr_data || {}),
    fields: {
      ...(deal.ocr_data?.fields || {}),
      [fieldName]: {
        ...(deal.ocr_data?.fields?.[fieldName] || {}),
        value: newValue,
        userOverridden: true,
      }
    }
  }

  const { error: updateErr } = await (serviceClient.from("deals") as any)
    .update({
      [dbColumn]: newValue,
      ocr_data: updatedOcrData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)

  if (updateErr) {
    console.error("Update OCR field error:", updateErr)
    return { error: "שגיאה בעדכון השדה" }
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath(`/lawyer/${dealId}`)
  revalidatePath("/lawyer")
  revalidatePath("/dashboard")

  return { success: true }
}

export async function updateDeal(dealId: string, formData: FormData) {
  const supabase = await getSupabaseClient()
  const serviceClient = getServiceRoleClient() as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "התחברות נדרשת" }

  // Check deal ownership & permissions
  const { data: deal } = await (serviceClient.from("deals") as any)
    .select("seller_id, status, buyer_id")
    .eq("id", dealId)
    .maybeSingle()

  if (!deal) return { error: "עסקה לא נמצאה" }
  if (deal.seller_id !== user.id) return { error: "אין הרשאה לערוך עסקה זו" }

  // Verify no invitations have been sent & no buyer is attached
  const { data: invites } = await (serviceClient.from("deal_invitations") as any)
    .select("id")
    .eq("deal_id", dealId)

  if ((invites && invites.length > 0) || deal.buyer_id) {
    return { error: "לא ניתן לערוך עסקה לאחר שנשלחו הזמנות או שקונה הצטרף" }
  }

  const title = formData.get("title") as string
  const priceILS = Number.parseFloat(formData.get("priceILS") as string)
  const licensePlate = formData.get("licensePlate") as string
  const vehicleMake = formData.get("vehicleMake") as string
  const vehicleModel = formData.get("vehicleModel") as string
  const vehicleYear = parseInt(formData.get("vehicleYear") as string) || null
  const kilometers = parseInt(formData.get("kilometers") as string) || null
  const engineVolume = parseInt(formData.get("engineVolume") as string) || null
  const chassisNumber = formData.get("chassisNumber") as string || null

  if (!title || !priceILS || priceILS <= 0) {
    return { error: "כותרת ומחיר תקני נדרשים" }
  }

  const { error: updateError } = await (serviceClient.from("deals") as any)
    .update({
      title,
      price_ils: priceILS,
      license_plate: licensePlate,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      vehicle_year: vehicleYear,
      kilometers: kilometers,
      engine_volume: engineVolume,
      chassis_number: chassisNumber,
      updated_at: new Date().toISOString()
    })
    .eq("id", dealId)

  if (updateError) {
    console.error("Update deal error:", updateError)
    return { error: "שגיאה בעדכון העסקה" }
  }

  revalidatePath(`/deals/${dealId}`)
  revalidatePath("/dashboard")
  revalidatePath("/deals")
  revalidatePath("/lawyer")

  return { success: true }
}

