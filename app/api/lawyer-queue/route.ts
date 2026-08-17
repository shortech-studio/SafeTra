import { NextRequest, NextResponse } from "next/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const serviceClient = getServiceRoleClient()

    // Fetch latest updated non-DRAFT deal
    const { data: latestDeal } = await (serviceClient.from("deals") as any)
      .select("id, updated_at, status, vehicle_make, vehicle_model, price_ils")
      .neq("status", "DRAFT")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch count of non-DRAFT deals
    const { count } = await (serviceClient.from("deals") as any)
      .select("id", { count: "exact", head: true })
      .neq("status", "DRAFT")

    return NextResponse.json(
      {
        count: count || 0,
        latestId: latestDeal?.id || null,
        latestUpdatedAt: latestDeal?.updated_at || null,
        latestStatus: latestDeal?.status || null,
        latestTitle: latestDeal ? `${latestDeal.vehicle_make || ""} ${latestDeal.vehicle_model || ""}`.trim() : null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 })
  }
}
