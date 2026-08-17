"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, XCircle, Pencil } from "lucide-react"
import { updateDealStatus } from "@/lib/actions/deals"
import { toast } from "sonner"
import Link from "next/link"

interface SellerDealHeaderActionsProps {
    dealId: string
    dealStatus: string
    hasInvitations: boolean
    hasBuyer: boolean
}

export function SellerDealHeaderActions({
    dealId,
    dealStatus,
    hasInvitations,
    hasBuyer
}: SellerDealHeaderActionsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    // 1. Edit deal rule: Available ONLY if no invites have been sent and no buyer attached (and status is DRAFT)
    const canEdit = dealStatus === "DRAFT" && !hasInvitations && !hasBuyer

    // 2. Cancel deal rule: Available until deal has been approved by lawyer (before UNDER_REVIEW / AWAITING_PAYMENT)
    // Lawyer approval moves status to AWAITING_PAYMENT.
    const isLawyerApproved = ["AWAITING_PAYMENT", "PAYMENT_VERIFICATION", "OWNERSHIP_TRANSFER_PENDING", "COMPLETED"].includes(dealStatus)
    const isAlreadyCancelledOrCompleted = ["CANCELLED", "COMPLETED", "EXPIRED"].includes(dealStatus)
    const canCancel = !isLawyerApproved && !isAlreadyCancelledOrCompleted

    const handleCancel = () => {
        startTransition(async () => {
            try {
                toast.loading("מבטל את העסקה...", { id: "seller-cancel-toast" })
                const result = await updateDealStatus(dealId, "CANCELLED") as any
                if (result?.error) {
                    toast.error(`שגיאה בביטול העסקה: ${result.error}`, { id: "seller-cancel-toast" })
                } else {
                    toast.success("העסקה בוטלה בהצלחה.", { id: "seller-cancel-toast" })
                    router.refresh()
                }
            } catch (err: any) {
                toast.error(`שגיאת תקשורת: ${err?.message || "נסה שוב"}`, { id: "seller-cancel-toast" })
            }
        })
    }

    if (!canEdit && !canCancel) {
        return null
    }

    return (
        <div className="flex items-center gap-2">
            {canEdit && (
                <Link href={`/deals/${dealId}/edit`}>
                    <Button
                        type="button"
                        variant="outline"
                        className="bg-surface-container-high hover:bg-surface-bright text-foreground border-white/10 font-bold flex items-center gap-1.5 text-xs h-10 px-4 rounded-xl cursor-pointer transition-all"
                    >
                        <Pencil className="w-3.5 h-3.5 text-amber-400" />
                        <span>ערוך עסקה</span>
                    </Button>
                </Link>
            )}

            {canCancel && (
                <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold flex items-center gap-1.5 text-xs h-10 px-4 rounded-xl cursor-pointer transition-all"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            <span>מבטל...</span>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>בטל עסקה</span>
                        </>
                    )}
                </Button>
            )}
        </div>
    )
}
