"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, FileText, CheckCircle2, Clock, PenTool, Printer, Sparkles } from "lucide-react"
import { DealAgreementData, getDealAgreement, signAgreement } from "@/lib/actions/agreements"
import { SignaturePadModal } from "./SignaturePadModal"
import { format } from "date-fns"
import { he } from "date-fns/locale"

interface DealAgreementWidgetProps {
    deal: any
    currentUserId: string
    userRole?: "seller" | "buyer" | "lawyer" | "admin"
    userName?: string
}

export function DealAgreementWidget({
    deal,
    currentUserId,
    userRole = "buyer",
    userName,
}: DealAgreementWidgetProps) {
    const [agreement, setAgreement] = useState<DealAgreementData | null>(null)
    const [isPadOpen, setIsPadOpen] = useState(false)
    const [loading, setLoading] = useState(true)

    const isLawyerOrAdmin = userRole === "lawyer" || userRole === "admin"
    const isSeller = deal.seller_id === currentUserId
    const isBuyer = deal.buyer_id === currentUserId

    useEffect(() => {
        let isMounted = true

        const fetchAgreement = async () => {
            const data = await getDealAgreement(deal.id)
            if (isMounted && data) {
                setAgreement(data)
                setLoading(false)
            }
        }

        fetchAgreement()

        const interval = setInterval(() => {
            fetchAgreement()
        }, 2000)

        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [deal.id])

    // Calculate signed count
    const sellerSigned = Boolean(agreement?.seller_signature)
    const buyerSigned = Boolean(agreement?.buyer_signature)
    const lawyerSigned = Boolean(agreement?.lawyer_signature)

    const signedCount = (sellerSigned ? 1 : 0) + (buyerSigned ? 1 : 0) + (lawyerSigned ? 1 : 0)
    const isFullySigned = signedCount === 3

    // Check if current user has signed
    const currentUserHasSigned =
        (isSeller && sellerSigned) ||
        (isBuyer && buyerSigned) ||
        (isLawyerOrAdmin && lawyerSigned)

    const handleSaveSignature = async (signatureBase64: string, saveAsLawyerDefault?: boolean) => {
        const result = await signAgreement(deal.id, signatureBase64, saveAsLawyerDefault)
        if (result.agreement) {
            setAgreement(result.agreement)
        }
    }

    const handlePrintAgreement = () => {
        if (typeof window !== "undefined") {
            window.print()
        }
    }

    const formatSignedDate = (dateStr: string | null) => {
        if (!dateStr) return null
        try {
            return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: he })
        } catch {
            return dateStr
        }
    }

    return (
        <>
            <Card className="glass-panel p-6 rounded-2xl border border-primary/30 shadow-2xl backdrop-blur-xl space-y-6 text-right font-sans my-6" dir="rtl">
                {/* Agreement Header Banner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center shrink-0 shadow-lg">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                                    #הסכם-{deal.id.slice(0, 8).toUpperCase()}
                                </span>
                                <h2 className="text-xl sm:text-2xl font-black text-foreground">הסכם מכר ואימות נאמנות SafeTra 📜</h2>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">חוזה משפטי מחייב למכירת רכב והפקדת כספי נאמנות מוגנים</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isFullySigned ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>הסכם חתום ומאושר כחוק (3/3)</span>
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-400" />
                                <span>נחתמו {signedCount} מתוך 3 חתימות</span>
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Agreement Summary Box */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-xl border border-white/10 text-xs">
                    <div>
                        <span className="text-slate-400 font-medium block mb-1">המוכר:</span>
                        <strong className="text-white text-sm font-bold block">{deal.seller?.full_name || `${deal.first_name || ""} ${deal.last_name || ""}`.trim() || "מוכר רכב"}</strong>
                        <span className="text-slate-400 font-mono">ת.ז: {deal.seller?.id_number || deal.owner_id_number || "מאומת במערכת"}</span>
                    </div>

                    <div>
                        <span className="text-slate-400 font-medium block mb-1">הקונה:</span>
                        <strong className="text-white text-sm font-bold block">{deal.buyer?.full_name || "קונה מאומת"}</strong>
                        <span className="text-slate-400 font-mono">טלפון/מזהה: {deal.buyer?.phone || "רשום ב-SafeTra"}</span>
                    </div>

                    <div>
                        <span className="text-slate-400 font-medium block mb-1">סכום העסקה בנאמנות:</span>
                        <strong className="text-primary text-base font-black font-mono block">₪{Number(deal.price_ils || 0).toLocaleString("he-IL")}</strong>
                        <span className="text-slate-400 font-mono">רכב: {deal.vehicle_make} {deal.vehicle_model} ({deal.vehicle_year})</span>
                    </div>
                </div>

                {/* Contract Key Terms & Conditions */}
                <div className="p-4 bg-surface-container-low/80 rounded-xl border border-white/5 space-y-2 text-xs text-slate-300 leading-relaxed">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary" />
                        עיקרי הסכם הנאמנות והעברת הבעלות:
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-slate-300">
                        <li>המוכר מצהיר כי הרכב הנמכר (מספר רישוי <strong className="text-white font-mono">{deal.license_plate}</strong>) נקי מכל שעבוד או עיקול.</li>
                        <li>הקונה מתחייב להפקיד את מלוא סכום העסקה בסך <strong className="text-primary font-mono font-bold">₪{Number(deal.price_ils || 0).toLocaleString("he-IL")}</strong> בחשבון הנאמנות המוגן של SafeTra.</li>
                        <li>כספי הנאמנות יינעלו בבטחה ולא ישוחררו למוכר אלא לאחר ביצוע אישור העברת בעלות תקני ברשות הדואר / האזור האישי ובדיקת עורך הדין המפקח.</li>
                    </ul>
                </div>

                {/* Signatures Display Grid (3 Parties) */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">חתימות הצדדים ועורך הדין:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Seller Signature Slot */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col justify-between items-center text-center space-y-2 min-h-[140px]">
                            <span className="text-xs font-bold text-slate-300">חתימת המוכר 👤</span>
                            {sellerSigned ? (
                                <div className="space-y-1 flex flex-col items-center">
                                    <img src={agreement!.seller_signature!} alt="חתימת מוכר" className="h-16 max-w-full object-contain filter invert opacity-90" />
                                    <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        נחתם: {formatSignedDate(agreement!.seller_signed_at)}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center my-auto py-3 text-slate-500 text-xs">
                                    <Clock className="w-5 h-5 mb-1 text-slate-600 animate-pulse" />
                                    <span>ממתין לחתימת המוכר</span>
                                </div>
                            )}
                        </div>

                        {/* 2. Buyer Signature Slot */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col justify-between items-center text-center space-y-2 min-h-[140px]">
                            <span className="text-xs font-bold text-slate-300">חתימת הקונה 🛒</span>
                            {buyerSigned ? (
                                <div className="space-y-1 flex flex-col items-center">
                                    <img src={agreement!.buyer_signature!} alt="חתימת קונה" className="h-16 max-w-full object-contain filter invert opacity-90" />
                                    <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        נחתם: {formatSignedDate(agreement!.buyer_signed_at)}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center my-auto py-3 text-slate-500 text-xs">
                                    <Clock className="w-5 h-5 mb-1 text-slate-600 animate-pulse" />
                                    <span>ממתין לחתימת הקונה</span>
                                </div>
                            )}
                        </div>

                        {/* 3. Lawyer Signature Slot */}
                        <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col justify-between items-center text-center space-y-2 min-h-[140px]">
                            <span className="text-xs font-bold text-slate-300">חתימת עורך דין מפקח ⚖️</span>
                            {lawyerSigned ? (
                                <div className="space-y-1 flex flex-col items-center">
                                    <img src={agreement!.lawyer_signature!} alt="חתימת עורך דין" className="h-16 max-w-full object-contain filter invert opacity-90" />
                                    <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        אושר ונחתם: {formatSignedDate(agreement!.lawyer_signed_at)}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center my-auto py-3 text-slate-500 text-xs">
                                    <Clock className="w-5 h-5 mb-1 text-slate-600 animate-pulse" />
                                    <span>ממתין לאישור וחתימת עו״ד</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        {!currentUserHasSigned && (
                            <Button
                                type="button"
                                onClick={() => setIsPadOpen(true)}
                                className="bg-primary hover:bg-primary-fixed-dim text-on-primary font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
                            >
                                <PenTool className="w-4 h-4" />
                                <span>חתום על ההסכם ✍️</span>
                            </Button>
                        )}

                        {currentUserHasSigned && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 rounded-xl">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>חתמת על ההסכם בהצלחה!</span>
                            </div>
                        )}
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handlePrintAgreement}
                        className="bg-surface-container-high hover:bg-surface-bright text-foreground border-white/10 font-bold text-xs h-10 px-4 rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                        <Printer className="w-3.5 h-3.5 text-primary" />
                        <span>הצג / הדפס הסכם מלא 📄</span>
                    </Button>
                </div>
            </Card>

            {/* Interactive Signature Pad Modal */}
            <SignaturePadModal
                isOpen={isPadOpen}
                onClose={() => setIsPadOpen(false)}
                onSaveSignature={handleSaveSignature}
                userRole={userRole}
                userName={userName}
            />
        </>
    )
}
