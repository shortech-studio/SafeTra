"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { approveDeal, rejectDeal } from "@/lib/actions/deals"
import { toast } from "sonner"

interface BuyerDealApprovalButtonsProps {
    dealId: string
}

export function BuyerDealApprovalButtons({ dealId }: BuyerDealApprovalButtonsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null)

    const handleApprove = () => {
        setActiveAction("approve")
        startTransition(async () => {
            try {
                toast.loading("מאשר את הצעת הרכישה...", { id: "buyer-approval-toast" })
                const result = await approveDeal(dealId) as any
                if (result?.error) {
                    toast.error(`שגיאה באישור העסקה: ${result.error}`, { id: "buyer-approval-toast" })
                } else {
                    toast.success("אישרת את הצעת הרכישה בהצלחה! 🤝", { id: "buyer-approval-toast" })
                    router.refresh()
                    setTimeout(() => {
                        if (typeof window !== "undefined") {
                            window.location.reload()
                        }
                    }, 150)
                }
            } catch (err: any) {
                toast.error(`שגיאת תקשורת: ${err?.message || "נסה שוב"}`, { id: "buyer-approval-toast" })
            } finally {
                setActiveAction(null)
            }
        })
    }

    const handleReject = () => {
        setActiveAction("reject")
        startTransition(async () => {
            try {
                toast.loading("דוחה את הצעת הרכישה...", { id: "buyer-approval-toast" })
                const result = await rejectDeal(dealId) as any
                if (result?.error) {
                    toast.error(`שגיאה בדחיית העסקה: ${result.error}`, { id: "buyer-approval-toast" })
                } else {
                    toast.info("העסקה נדחתה ובוטלה.", { id: "buyer-approval-toast" })
                    router.refresh()
                }
            } catch (err: any) {
                toast.error(`שגיאת תקשורת: ${err?.message || "נסה שוב"}`, { id: "buyer-approval-toast" })
            } finally {
                setActiveAction(null)
            }
        })
    }

    return (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="flex-1 h-12 rounded-xl font-bold bg-primary hover:bg-primary-fixed-dim text-on-primary shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all flex items-center gap-2 justify-center cursor-pointer"
            >
                {isPending && activeAction === "approve" ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>מאשר עסקה...</span>
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="h-5 w-5" />
                        <span>אשר הצעה והתחל תהליך</span>
                    </>
                )}
            </Button>

            <Button
                type="button"
                variant="ghost"
                onClick={handleReject}
                disabled={isPending}
                className="sm:w-auto h-12 px-6 rounded-xl font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex items-center gap-2 justify-center cursor-pointer"
            >
                {isPending && activeAction === "reject" ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                        <span>דוחה...</span>
                    </>
                ) : (
                    <>
                        <XCircle className="h-5 w-5" />
                        <span>דחה הצעה</span>
                    </>
                )}
            </Button>
        </div>
    )
}
