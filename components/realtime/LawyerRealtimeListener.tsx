"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseClient } from "@/lib/supabase/client"
import { toast } from "sonner"

async function fetchLawyerQueueApi() {
    try {
        const res = await fetch(`/api/lawyer-queue?t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
            },
        })
        if (!res.ok) return null
        return (await res.json()) as {
            count: number
            latestId: string | null
            latestUpdatedAt: string | null
            latestStatus: string | null
            latestTitle: string | null
        }
    } catch (err) {
        console.error("[LawyerRealtimePoll Error]:", err)
        return null
    }
}

export function LawyerRealtimeListener() {
    const router = useRouter()
    const lastUpdatedAtRef = useRef<string>("")
    const lastCountRef = useRef<number>(-1)
    const isInitializedRef = useRef<boolean>(false)

    useEffect(() => {
        const supabase = createSupabaseClient()
        let isSubscribed = true

        console.log("%c[LawyerRT] 🚀 Listener Mounted for Lawyer Queue", "color: #00ffff; font-weight: bold")

        // 1. Uncached Active Poll for Lawyer Console (Every 2 seconds)
        const pollInterval = setInterval(async () => {
            if (!isSubscribed) return
            try {
                const data = await fetchLawyerQueueApi()
                if (!data) return

                const currentUpdatedAt = data.latestUpdatedAt || ""
                const currentCount = data.count || 0

                // Seed baseline state on first poll after mount
                if (!isInitializedRef.current) {
                    lastUpdatedAtRef.current = currentUpdatedAt
                    lastCountRef.current = currentCount
                    isInitializedRef.current = true
                    return
                }

                // Detect changes in queue count or latest deal timestamp
                const isCountChanged = lastCountRef.current !== -1 && currentCount !== lastCountRef.current
                const isTimestampChanged = lastUpdatedAtRef.current && currentUpdatedAt !== lastUpdatedAtRef.current

                if (isCountChanged || isTimestampChanged) {
                    console.log("%c[LawyerRT] ⚡ QUEUE CHANGE DETECTED!", "color: #ff0055; font-weight: bold", {
                        prevCount: lastCountRef.current,
                        newCount: currentCount,
                        prevUpdate: lastUpdatedAtRef.current,
                        newUpdate: currentUpdatedAt
                    })

                    toast.info("⚖️ עדכון בתור עסקאות", {
                        description: `עסקה ${data.latestTitle || ""} עודכנה (סטטוס: ${data.latestStatus || ""})`,
                        duration: 5000,
                    })

                    lastUpdatedAtRef.current = currentUpdatedAt
                    lastCountRef.current = currentCount

                    // Hard reload to refresh server components and queue list
                    window.location.reload()
                }
            } catch (err) {
                console.error("[LawyerRealtimePoll Error]:", err)
            }
        }, 2000)

        // 2. Realtime WebSocket Push Stream
        const setupLawyerChannel = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session?.access_token) {
                    supabase.realtime.setAuth(session.access_token)
                }

                const channel = supabase
                    .channel("lawyer-live-queue")
                    .on(
                        "postgres_changes",
                        {
                            event: "*",
                            schema: "public",
                            table: "deals",
                        },
                        (payload: any) => {
                            if (!isSubscribed) return
                            const newDeal = payload.new as any
                            console.log("[Lawyer Realtime WS Event]:", payload.eventType, newDeal)

                            if (payload.eventType === "INSERT") {
                                toast.info("⚖️ עסקה חדשה במערכת!", {
                                    description: `${newDeal.vehicle_make || "רכב"} ${newDeal.vehicle_model || ""} - ₪${Number(newDeal.price_ils || 0).toLocaleString("he-IL")}`,
                                    duration: 6000,
                                })
                            } else if (payload.eventType === "UPDATE") {
                                toast.info("⚖️ עדכון בתור עסקאות", {
                                    description: `סטטוס: ${newDeal.status}`,
                                    duration: 4000,
                                })
                            }

                            window.location.reload()
                        }
                    )
                    .subscribe()

                return () => {
                    supabase.removeChannel(channel)
                }
            } catch (err) {
                console.error("[LawyerRealtimeListener Error]:", err)
            }
        }

        let cleanup: any = null
        setupLawyerChannel().then((clean) => { cleanup = clean })

        return () => {
            isSubscribed = false
            clearInterval(pollInterval)
            if (cleanup) cleanup()
        }
    }, [router])

    return null
}
