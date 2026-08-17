import { getDealById } from "@/lib/actions/deals"
import { getCurrentUser } from "@/lib/actions/auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { BackButton } from "@/components/BackButton"
import JoinDealForm from "./join-deal-form"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, Handshake, Landmark, Car, UserCheck, Camera } from "lucide-react"
import { DealRealtimeListener } from "@/components/realtime/DealRealtimeListener"

export default async function JoinDealPage(props: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ invite?: string }>
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const invitationId = searchParams.invite;

    const user = await getCurrentUser()
    if (!user) {
        redirect(`/auth/login?next=/deals/${params.id}/join${invitationId ? `?invite=${invitationId}` : ""}`)
    }

    const deal = await getDealById(params.id)

    if (!deal) {
        return (
            <>
                <Navbar user={user} />
                <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir="rtl">
                    <Card className="glass-card max-w-md w-full p-8 text-center rounded-2xl border-white/10">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-on-surface mb-2">עסקה לא נמצאה</h1>
                        <p className="text-xs text-on-surface-variant mb-6">העסקה המבוקשת לא נמצאה במערכת או שפג תוקפה.</p>
                        <BackButton href="/dashboard" className="mx-auto" />
                    </Card>
                </div>
            </>
        )
    }

    if (deal.status !== "DRAFT" && deal.buyer_id !== user.id) {
        return (
            <>
                <Navbar user={user} />
                <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4" dir="rtl">
                    <Card className="glass-card max-w-md w-full p-8 text-center rounded-2xl border-white/10">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                            <Handshake className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-bold text-on-surface mb-2">העסקה אינה ממתינה להצטרפות</h1>
                        <p className="text-xs text-on-surface-variant mb-6">עסקה זו כבר שויכה לקונה או שהיא נמצאת בשלב מתקדם.</p>
                        <BackButton href={`/deals/${deal.id}`} label="עבור לעמוד העסקה" className="mx-auto" />
                    </Card>
                </div>
            </>
        )
    }

    return (
        <>
            <Navbar user={user} />
            <DealRealtimeListener dealId={deal.id} currentStatus={deal.status} currentPaymentProofUrl={deal.payment_proof_url} />
            <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
                <div className="max-w-xl mx-auto space-y-6">
                    <BackButton href="/dashboard" label="חזור ללוח הבקרה" className="text-on-surface-variant hover:text-primary transition-colors" />

                    <div className="glass-card rounded-2xl border border-white/10 p-6 md:p-8 backdrop-blur-2xl bg-surface-container-lowest/80 text-right shadow-[0_0_50px_rgba(16,185,129,0.08)] space-y-6">
                        {/* Header Badge & Title */}
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-bold px-3 py-1 text-xs">
                                        הזמנת קונה רשמית
                                    </Badge>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">הוזמנת להצטרף לעסקה 🚗</h1>
                                <p className="text-xs text-on-surface-variant mt-1">אשר את פרטי העסקה כדי להיכנס למתחם הנאמנות המאובטח.</p>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                                <Handshake className="h-7 w-7" />
                            </div>
                        </div>

                        {/* Vehicle Hero Image & Photo Gallery */}
                        {(() => {
                            const heroImg = deal.thumbnail_url || (deal.vehicle_images && deal.vehicle_images.length > 0 ? deal.vehicle_images[0] : null)
                            const allImages: string[] = deal.vehicle_images && deal.vehicle_images.length > 0
                                ? deal.vehicle_images
                                : (deal.thumbnail_url ? [deal.thumbnail_url] : [])

                            if (!heroImg) return null

                            return (
                                <div className="space-y-3">
                                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                        <img src={heroImg} alt={deal.title} className="w-full h-full object-cover" />
                                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5 shadow-md">
                                            <Camera className="h-3.5 w-3.5 text-primary" />
                                            <span>תמונות הרכב שהועלו ע״י המוכר ({allImages.length})</span>
                                        </div>
                                    </div>

                                    {allImages.length > 1 && (
                                        <div className="grid grid-cols-4 gap-2">
                                            {allImages.map((imgUrl, iIdx) => (
                                                <div key={iIdx} className="aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-primary transition-all">
                                                    <img src={imgUrl} alt={`תמונת רכב ${iIdx + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Deal Summary Container */}
                        <div className="p-5 rounded-xl bg-surface-container-low border border-white/10 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-0.5">כותרת העסקה</span>
                                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                                        <Car className="h-5 w-5 text-primary" />
                                        {deal.title}
                                    </h2>
                                </div>
                                <div className="text-left">
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-0.5">מחיר העסקה</span>
                                    <span className="text-2xl font-black text-emerald-400 font-mono">₪{Number(deal.price_ils).toLocaleString("he-IL")}</span>
                                </div>
                            </div>

                            {/* Seller & Details Grid */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant">
                                    <span className="text-on-surface-variant text-[10px] block mb-1">מוכר הרכב</span>
                                    <div className="flex items-center gap-1.5 font-bold text-on-surface">
                                        <UserCheck className="h-4 w-4 text-primary" />
                                        <span>{deal.first_name} {deal.last_name || ""}</span>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant">
                                    <span className="text-on-surface-variant text-[10px] block mb-1">מספר רישוי (לוחית)</span>
                                    <span className="font-mono font-bold text-primary dir-ltr block text-left">{deal.license_plate}</span>
                                </div>
                            </div>

                            {deal.chassis_number && (
                                <div className="pt-2 border-t border-white/5 flex justify-between text-xs text-on-surface-variant font-mono">
                                    <span>מספר שלדה (VIN):</span>
                                    <span className="font-bold text-on-surface dir-ltr">{deal.chassis_number}</span>
                                </div>
                            )}
                        </div>

                        {/* Escrow Guarantee Banner */}
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                            <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
                            <div className="leading-relaxed">
                                <span className="font-bold block text-emerald-300">הגנה מוסדית בנאמנות SafeTra 🔒</span>
                                <span>הצטרפות לעסקה שומרת את כספי הרכישה בחשבון נאמנות מבוטח בפיקוח עורכי דין, עד להשלמה מלאה של העברת הבעלות.</span>
                            </div>
                        </div>

                        {/* Action Component */}
                        <JoinDealForm dealId={deal.id} invitationId={invitationId} />
                    </div>
                </div>
            </div>
        </>
    )
}
