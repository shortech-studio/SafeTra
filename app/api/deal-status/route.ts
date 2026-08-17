import { NextRequest, NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

// Force no caching on this route
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  const dealId = request.nextUrl.searchParams.get("dealId")

  if (!dealId) {
    return NextResponse.json({ error: "Missing dealId" }, { status: 400 })
  }

  const serviceClient = getServiceRoleClient()
  const { data, error } = await (serviceClient.from("deals") as any)
    .select("status, updated_at, vehicle_reg_owner_id")
    .eq("id", dealId)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { status: null, error: error?.message || "Not found" },
      { status: error ? 500 : 404 }
    )
  }

  const paymentProof =
    data.vehicle_reg_owner_id?.startsWith("http")
      ? data.vehicle_reg_owner_id
      : null

  return NextResponse.json(
    {
      status: data.status,
      updatedAt: data.updated_at,
      paymentProofUrl: paymentProof,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    }
  )
}
