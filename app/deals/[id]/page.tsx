import { redirect } from "next/navigation"
import { getDealById, updateDealStatus, approveDeal, rejectDeal, getDealInvitations } from "@/lib/actions/deals"
import { InviteBuyerForm } from "./InviteBuyerForm"
import { BuyerDealApprovalButtons } from "../BuyerDealApprovalButtons"
import { SellerDealHeaderActions } from "../SellerDealHeaderActions"
import { EscrowVaultWidget } from "@/components/EscrowVaultWidget"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { he } from "date-fns/locale"

import { Handshake, CheckCircle2, XCircle, ShieldCheck, Camera } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata = {
  title: "פרטי עסקה - AutoTrust",
  description: "צפייה בפרטי עסקה וניהול סטטוס",
}

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
  READY_FOR_NEXT_STAGE: "מוכנה לשלב הבא", // Keeping legacy just in case
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SUBMITTED: "bg-blue-500",
  UNDER_REVIEW: "bg-yellow-500",
  AWAITING_PAYMENT: "bg-purple-500",
  PAYMENT_VERIFICATION: "bg-orange-500",
  OWNERSHIP_TRANSFER_PENDING: "bg-teal-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
  EXPIRED: "bg-gray-700",
  READY_FOR_NEXT_STAGE: "bg-green-500",
}

interface DealPageProps {
  params: Promise<{ id: string }>
}

import { getCurrentUser } from "@/lib/actions/auth"
import { Navbar } from "@/components/Navbar"
import { BackButton } from "@/components/BackButton"
import { DealRealtimeListener } from "@/components/realtime/DealRealtimeListener"

import { DealStatusTracker } from "@/components/DealStatusTracker"
import { DealAgreementWidget } from "@/components/agreements/DealAgreementWidget"

export default async function DealPage({ params }: DealPageProps) {
  const { id } = await params
  const [deal, user, invitations] = await Promise.all([
    getDealById(id),
    getCurrentUser(),
    getDealInvitations(id)
  ])

  if (user?.role === "lawyer" || user?.role === "admin") {
    redirect(`/lawyer/${id}`)
  }

  if (!deal) {
    return (
      <>
        <Navbar user={user} />
        <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
          <Card className="w-full max-w-md p-6 text-center">
            <h1 className="text-xl font-bold text-foreground">עסקה לא נמצאה</h1>
            <BackButton href="/deals" label="חזור לעסקאות שלי" className="mt-4 mx-auto" />
          </Card>
        </div>
      </>
    )
  }

  // ... (transitions logic stays the same)

  const validTransitions: Record<string, string[]> = {
    DRAFT: ["SUBMITTED", "EXPIRED"],
    SUBMITTED: ["UNDER_REVIEW", "AWAITING_PAYMENT", "EXPIRED"],
    UNDER_REVIEW: ["AWAITING_PAYMENT", "EXPIRED"],
    AWAITING_PAYMENT: ["PAYMENT_VERIFICATION"],
    PAYMENT_VERIFICATION: ["OWNERSHIP_TRANSFER_PENDING"],
    OWNERSHIP_TRANSFER_PENDING: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: [],
  }

  const availableTransitions = validTransitions[deal.status] || []

  return (
    <>
      <Navbar user={user} />
      <DealRealtimeListener dealId={deal.id} currentStatus={deal.status} currentPaymentProofUrl={deal.payment_proof_url} />
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8" dir="rtl">
        <div className="max-w-[96%] xl:max-w-[1600px] mx-auto space-y-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <BackButton href="/deals" className="mb-2 text-muted-foreground" />
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                  #עסקה-{deal.id.slice(0, 8).toUpperCase()}
                </span>
                <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{deal.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user?.id === deal.seller_id && (
                <SellerDealHeaderActions
                  dealId={deal.id}
                  dealStatus={deal.status}
                  hasInvitations={Boolean(invitations && invitations.length > 0)}
                  hasBuyer={Boolean(deal.buyer_id)}
                />
              )}

              <div className="flex items-center gap-3 font-mono bg-slate-900/80 p-3.5 rounded-2xl border border-white/10 shadow-xl">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-sans">מחיר מכירה מוסכם</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">₪{Number(deal.price_ils).toLocaleString("he-IL")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* High Visibility Status Tracker & 5-Step Pipeline Banner */}
          <DealStatusTracker status={deal.status} />

          {/* Digital Legal Agreement & Multi-Party Signature Widget (Full Width) */}
          {deal.status !== "DRAFT" && (
            <DealAgreementWidget
              deal={deal}
              currentUserId={user.id}
              userRole={user.id === deal.seller_id ? "seller" : "buyer"}
              userName={user.full_name}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Content Column (Images & Full Specs) */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="p-6 border-white/10 bg-slate-950/60 backdrop-blur-xl shadow-xl">
                <div className="space-y-6">
                  {/* Vehicle Hero Image & Photo Gallery */}
                  {(() => {
                    const heroImg = deal.thumbnail_url || (deal.vehicle_images && deal.vehicle_images.length > 0 ? deal.vehicle_images[0] : null)
                    const allImages: string[] = deal.vehicle_images && deal.vehicle_images.length > 0
                      ? deal.vehicle_images
                      : (deal.thumbnail_url ? [deal.thumbnail_url] : [])

                    if (!heroImg) return null

                    return (
                      <div className="space-y-3 pb-4 border-b border-white/10">
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                          <img src={heroImg} alt={deal.title} className="w-full h-full object-cover" />
                          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-md">
                            <Camera className="h-4 w-4 text-primary" />
                            <span>תמונות הרכב ({allImages.length})</span>
                          </div>
                        </div>

                        {allImages.length > 1 && (
                          <div className="grid grid-cols-4 gap-3">
                            {allImages.map((imgUrl: string, iIdx: number) => (
                              <div key={iIdx} className="aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-primary transition-all shadow-sm">
                                <img src={imgUrl} alt={`תמונת רכב ${iIdx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Header Info */}
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <div>
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase">מחיר מוסכם</h2>
                      <p className="text-3xl font-extrabold text-primary">₪{Number(deal.price_ils).toLocaleString("he-IL")}</p>
                    </div>
                    <div className="text-right font-mono bg-muted/40 px-4 py-2 rounded-xl border border-border/50">
                      <p className="text-muted-foreground mb-0.5 text-[11px] font-sans">מספר רישוי</p>
                      <p className="font-bold text-base text-foreground">{deal.license_plate}</p>
                    </div>
                  </div>

                  {/* Seller & Buyer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl border border-border/40">
                    <div>
                      <h2 className="text-xs font-bold text-muted-foreground uppercase mb-1">מוכר הרכב</h2>
                      <p className="text-base font-bold text-foreground">
                        {deal.first_name} {deal.last_name || ""}
                      </p>
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-muted-foreground uppercase mb-1">סטטוס עסקה נוכחי</h2>
                      <p className="text-base font-bold text-foreground">{statusLabels[deal.status] || deal.status}</p>
                    </div>
                  </div>

                  {/* Full Vehicle Specifications Grid */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span>מפרט טכני ורישומים משפטיים</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-900/60 rounded-xl border border-white/5">
                      <div>
                        <h2 className="text-xs font-medium text-muted-foreground">יצרן</h2>
                        <p className="text-sm font-bold text-foreground">{deal.vehicle_make || "לא צוין"}</p>
                      </div>
                      <div>
                        <h2 className="text-xs font-medium text-muted-foreground">דגם</h2>
                        <p className="text-sm font-bold text-foreground">{deal.vehicle_model || "לא צוין"}</p>
                      </div>
                      <div>
                        <h2 className="text-xs font-medium text-muted-foreground">שנת ייצור</h2>
                        <p className="text-sm font-bold text-foreground">{deal.vehicle_year || "לא צוין"}</p>
                      </div>
                      <div>
                        <h2 className="text-xs font-medium text-muted-foreground">קילומטראז'</h2>
                        <p className="text-sm font-bold text-foreground">{deal.kilometers ? `${Number(deal.kilometers).toLocaleString()} ק"מ` : 'לא צוין'}</p>
                      </div>
                      <div>
                        <h2 className="text-xs font-medium text-muted-foreground">נפח מנוע (סמ״ק)</h2>
                        <p className="text-sm font-bold text-foreground">{deal.engine_volume ? `${deal.engine_volume} סמ״ק` : 'לא צוין'}</p>
                      </div>
                      <div>
                        <h2 className="text-xs font-medium text-muted-foreground">בעלויות קודמות</h2>
                        <p className="text-sm font-bold text-foreground">{deal.previous_owners !== null && deal.previous_owners !== undefined ? deal.previous_owners : 'לא צוין'}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-3 pt-2 border-t border-white/5">
                        <h2 className="text-xs font-medium text-muted-foreground">מספר שלדה (VIN)</h2>
                        <p className="text-sm font-mono font-bold text-emerald-400 break-all">{deal.chassis_number || "טרם הוזן"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs text-muted-foreground">
                    <div>
                      <p>נוצרה ב: {format(new Date(deal.created_at || Date.now()), "dd/MM/yyyy HH:mm", { locale: he })}</p>
                    </div>
                    <div className="text-left">
                      <p>עודכנה ב: {format(new Date(deal.updated_at || Date.now()), "dd/MM/yyyy HH:mm", { locale: he })}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar Column (Actions, Buyer Approval & Escrow) */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              {/* Buyer Approval Section */}
              {deal.status === "DRAFT" && user?.id === deal.buyer_id && (
                <Card className="glass-card p-6 rounded-2xl border border-primary/40 bg-primary/10 backdrop-blur-2xl text-right shadow-[0_0_35px_rgba(16,185,129,0.15)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 text-primary flex items-center justify-center shrink-0">
                        <Handshake className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-on-surface">אישור הצעת רכישה 🤝</h2>
                        <p className="text-xs text-on-surface-variant">הזמנה רשמית מהמוכר לעסקת SafeTra</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 font-bold text-xs px-3 py-1">
                      ממתין לאישורך
                    </Badge>
                  </div>

                  <p className="text-xs text-on-surface-variant leading-relaxed my-4">
                    המוכר הזמין אותך לעסקה זו. אנא עיין בקפדנות בפרטי הרכב והמחיר, ולאחר מכן אישר את ההצעה כדי להעביר את העסקה לבדיקת עורך הדין ופתיחת הפקדת הנאמנות.
                  </p>

                  <BuyerDealApprovalButtons dealId={deal.id} />
                </Card>
              )}

              {/* Escrow Vault Widget */}
              <EscrowVaultWidget deal={deal} currentUserId={user.id} />

              {/* Invite Buyer Form */}
              {!["EXPIRED", "COMPLETED", "CANCELLED"].includes(deal.status) && user?.id === deal.seller_id && (
                <InviteBuyerForm dealId={deal.id} hasBuyer={Boolean(deal.buyer_id)} dealStatus={deal.status} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
