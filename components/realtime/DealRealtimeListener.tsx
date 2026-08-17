"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const statusHebrewMap: Record<string, string> = {
    DRAFT: "טיוטה - ממתין לקונה",
    SUBMITTED: "הוגשה - בבדיקת עו״ד",
    UNDER_REVIEW: "בבדיקת עו״ד מקצועית",
    AWAITING_PAYMENT: "מאושרת - ממתינה להפקדה בבנק",
    PAYMENT_VERIFICATION: "אימות אסמכתת תשלום בנאמנות",
    OWNERSHIP_TRANSFER_PENDING: "כספים נעולים בנאמנות - ממתין למסירה",
    COMPLETED: "הושלמה בהצלחה 💸",
    CANCELLED: "בוטלה ❌",
}

interface DealRealtimeListenerProps {
    dealId: string
    currentStatus?: string
    currentPaymentProofUrl?: string
}

async function fetchDealStatusApi(dealId: string) {
    try {
        const res = await fetch(`/api/deal-status?dealId=${dealId}&t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
            },
        })
        if (!res.ok) return null
        return (await res.json()) as {
            status: string | null
            updatedAt?: string
            paymentProofUrl?: string | null
        }
    } catch (err) {
        console.error("[DealRT Fetch API Error]:", err)
        return null
    }
}

export function DealRealtimeListener({ dealId, currentStatus, currentPaymentProofUrl }: DealRealtimeListenerProps) {
    const router = useRouter()
    const [wsStatus, setWsStatus] = useState<string>("INITIALIZING")
    const [lastCheckTime, setLastCheckTime] = useState<string>("")
    const [dbStatus, setDbStatus] = useState<string>(currentStatus || "")

    // Refs to track known baseline state and prevent initial/repeated reload loops
    const knownStatusRef = useRef<string>(currentStatus?.toUpperCase() || "")
    const knownProofRef = useRef<string>(currentPaymentProofUrl || "")
    const knownUpdatedAtRef = useRef<string>("")
    const isInitializedRef = useRef<boolean>(false)

    useEffect(() => {
        if (!dealId) return

        const supabase = createSupabaseClient()
        let isSubscribed = true

        // Sync initial refs on mount
        knownStatusRef.current = currentStatus?.toUpperCase() || ""
        knownProofRef.current = currentPaymentProofUrl || ""
        knownUpdatedAtRef.current = ""
        isInitializedRef.current = false

        console.log("%c[DealRT] 🚀 Mounted for deal:", "color: #00ffff; font-weight: bold", dealId, "Status:", currentStatus)

        // ============================================================
        // 1. UNCACHED API ROUTE POLL — Uses service-role backend route
        // ============================================================
        const pollInterval = setInterval(async () => {
            if (!isSubscribed) return
            try {
                const now = new Date().toLocaleTimeString("he-IL")
                setLastCheckTime(now)

                const result = await fetchDealStatusApi(dealId)
                if (!result || !result.status) return

                const liveStatus = result.status.toUpperCase()
                const liveProof = result.paymentProofUrl || ""

                setDbStatus(result.status)

                // First poll after mount: seed baseline refs without triggering reloads
                if (!isInitializedRef.current) {
                    if (currentStatus) knownStatusRef.current = currentStatus.toUpperCase()
                    else knownStatusRef.current = liveStatus

                    if (currentPaymentProofUrl !== undefined) knownProofRef.current = currentPaymentProofUrl
                    else knownProofRef.current = liveProof

                    if (result.updatedAt) knownUpdatedAtRef.current = result.updatedAt

                    isInitializedRef.current = true
                    console.log("%c[DealRT] Baseline initialized:", "color: #00ffaa", {
                        status: knownStatusRef.current,
                        proof: !!knownProofRef.current,
                        updatedAt: knownUpdatedAtRef.current
                    })
                    return
                }

                // Subsequent polls: detect actual runtime changes from baseline
                const isStatusChanged = Boolean(knownStatusRef.current && liveStatus !== knownStatusRef.current)
                const isProofUploaded = Boolean(liveProof && !knownProofRef.current)
                const isUpdatedAtChanged = Boolean(
                    knownUpdatedAtRef.current &&
                    result.updatedAt &&
                    result.updatedAt !== knownUpdatedAtRef.current
                )

                if (isStatusChanged || isProofUploaded || isUpdatedAtChanged) {
                    console.log("%c[DealRT] ⚡ RUNTIME CHANGE DETECTED!", "color: #ff0055; font-weight: bold", {
                        from: knownStatusRef.current,
                        to: liveStatus,
                        proofUploaded: isProofUploaded,
                        updatedAtChanged: isUpdatedAtChanged
                    })

                    const hebrewStatus = statusHebrewMap[result.status] || result.status
                    toast.success("עדכון חי בעסקה ⚡", {
                        description: isUpdatedAtChanged && !isStatusChanged && !isProofUploaded
                            ? "עודכנו חתימות או נתונים בהסכם העסקה ✍️"
                            : isProofUploaded
                            ? "הועלתה אסמכתת תשלום חדשה לבדיקה 💳"
                            : `הסטטוס השתנה ל: ${hebrewStatus}`,
                        duration: 4000,
                    })

                    // Lock refs to new state to prevent duplicate triggers
                    knownStatusRef.current = liveStatus
                    knownProofRef.current = liveProof
                    if (result.updatedAt) knownUpdatedAtRef.current = result.updatedAt

                    // Hard reload to render fresh server components
                    window.location.reload()
                    return
                }
            } catch (err) {
                console.error("[DealRT Poll Error]:", err)
            }
        }, 1500)

        // ============================================================
        // 2. WebSocket (instant push broadcast from Supabase Realtime)
        // ============================================================
        const setupWs = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.access_token) {
                    supabase.realtime.setAuth(session.access_token)
                }

                const channel = supabase
                    .channel(`deal-room-${dealId}`)
                    .on("postgres_changes", {
                        event: "*",
                        schema: "public",
                        table: "deals",
                        filter: `id=eq.${dealId}`,
                    }, (payload: any) => {
                        if (!isSubscribed) return
                        console.log("%c[DealRT WS]", "color: #00ff00; font-weight: bold", payload.eventType)
                        if (isInitializedRef.current) {
                            window.location.reload()
                        }
                    })
                    .on("postgres_changes", {
                        event: "*",
                        schema: "public",
                        table: "deal_agreements",
                        filter: `deal_id=eq.${dealId}`,
                    }, (payload: any) => {
                        if (!isSubscribed) return
                        console.log("%c[DealRT Agreement WS]", "color: #00ff00; font-weight: bold", payload.eventType)
                        if (isInitializedRef.current) {
                            toast.success("חתימה חדשה נקלטה בהסכם ✍️")
                            window.location.reload()
                        }
                    })
                    .subscribe((status: string) => {
                        console.log("%c[DealRT WS Status]:", "color: #00aaff; font-weight: bold", status)
                        if (isSubscribed) setWsStatus(status)
                    })

                return () => { supabase.removeChannel(channel) }
            } catch (err) {
                console.error("[DealRT WS Error]:", err)
            }
        }

        let cleanup: any = null
        setupWs().then((c) => { cleanup = c })

        return () => {
            isSubscribed = false
            clearInterval(pollInterval)
            if (cleanup) cleanup()
        }
    }, [dealId]) // Only re-mount when dealId changes

    return (
        <div className="fixed bottom-3 left-3 z-50 bg-black/80 backdrop-blur-md border border-emerald-500/40 text-emerald-400 rounded-full px-3 py-1.5 text-xs font-mono flex items-center gap-2 shadow-xl opacity-80 hover:opacity-100 transition-opacity" title="Realtime Deal Sync Engine Active">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>RT: <strong className="text-white">{wsStatus}</strong></span>
            <span className="text-gray-500">|</span>
            <span>UI: <strong className="text-yellow-300">{currentStatus}</strong></span>
            {dbStatus && dbStatus.toUpperCase() !== currentStatus?.toUpperCase() && (
                <>
                    <span className="text-gray-500">|</span>
                    <span className="text-red-400 animate-pulse">DB: <strong>{dbStatus}</strong></span>
                </>
            )}
            {lastCheckTime && <span className="text-[10px] text-gray-400 font-sans">({lastCheckTime})</span>}
        </div>
    )
}
