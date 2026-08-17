"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { updateDealStatus } from "@/lib/actions/deals"
import { toast } from "sonner"

interface LawyerActionHeaderProps {
    dealId: string
    nextAction: {
        label: string
        nextStatus: string
        color: string
    } | null
}

export function LawyerActionHeader({ dealId, nextAction }: LawyerActionHeaderProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [activeAction, setActiveAction] = useState<string | null>(null)

    const handleUpdateStatus = (targetStatus: string, label: string) => {
        setActiveAction(targetStatus)
        startTransition(async () => {
            try {
                toast.loading(`מעדכן סטטוס ל-${label}...`, { id: "lawyer-status-toast" })
                const result = await updateDealStatus(dealId, targetStatus)
                if (result?.error) {
                    toast.error(`שגיאה בעדכון הסטטוס: ${result.error}`, { id: "lawyer-status-toast" })
                } else {
                    toast.success(`הסטטוס עודכן בהצלחה ל: ${label} ⚡`, { id: "lawyer-status-toast" })
                    router.refresh()
                    setTimeout(() => {
                        if (typeof window !== "undefined") {
                            window.location.reload()
                        }
                    }, 150)
                }
            } catch (err: any) {
                toast.error(`שגיאה תקשורת: ${err?.message || "נסה שוב"}`, { id: "lawyer-status-toast" })
            } finally {
                setActiveAction(null)
            }
        })
    }

    return (
        <div className="flex gap-2">
            {nextAction && (
                <Button
                    type="button"
                    onClick={() => handleUpdateStatus(nextAction.nextStatus, nextAction.label)}
                    disabled={isPending}
                    className={`${nextAction.color} text-white font-bold flex items-center gap-2 transition-all cursor-pointer`}
                    size="lg"
                >
                    {isPending && activeAction === nextAction.nextStatus ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>מעבד...</span>
                        </>
                    ) : (
                        <span>{nextAction.label}</span>
                    )}
                </Button>
            )}

            {/* Cancel Button always available */}
            <Button
                type="button"
                variant="destructive"
                onClick={() => handleUpdateStatus("CANCELLED", "ביטול עסקה")}
                disabled={isPending}
                className="font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
                {isPending && activeAction === "CANCELLED" ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>מבטל...</span>
                    </>
                ) : (
                    <span>בטל עסקה</span>
                )}
            </Button>
        </div>
    )
}
