
import { getDealById, updateDealStatus, updateDealOcrField } from "@/lib/actions/deals"
import { getCurrentUser } from "@/lib/actions/auth"
import { Navbar } from "@/components/Navbar"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ComparisonField } from "../ComparisonField"
import { DealStatusTracker } from "@/components/DealStatusTracker"
import { BackButton } from "@/components/BackButton"
import { DealRealtimeListener } from "@/components/realtime/DealRealtimeListener"
import Image from "next/image"

import { LawyerActionHeader } from "../LawyerActionHeader"
import { DealAgreementWidget } from "@/components/agreements/DealAgreementWidget"

interface LawyerDealPageProps {
    params: Promise<{ id: string }>
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
}

// Map the next logical step for each status
const nextStepMap: Record<string, { label: string; nextStatus: string; color: string }> = {
    SUBMITTED: { label: "התחל בדיקה", nextStatus: "UNDER_REVIEW", color: "bg-blue-600" },
    UNDER_REVIEW: { label: "אשר ושלח לתשלום", nextStatus: "AWAITING_PAYMENT", color: "bg-green-600" },
    // AWAITING_PAYMENT is usually waiting for Buyer action, but Lawyer can force push if needed? 
    // Probably lawyer waits here until buyer uploads proof, moving it to PAYMENT_VERIFICATION automatically?
    // Or manual toggle? Let's assume manual for now or "Check Bank".
    AWAITING_PAYMENT: { label: "אושר תשלום ידנית", nextStatus: "PAYMENT_VERIFICATION", color: "bg-purple-600" },
    PAYMENT_VERIFICATION: { label: "אשר קבלת כספים", nextStatus: "OWNERSHIP_TRANSFER_PENDING", color: "bg-teal-600" },
    OWNERSHIP_TRANSFER_PENDING: { label: "אשר העברת בעלות ושחרר כספים", nextStatus: "COMPLETED", color: "bg-green-700" },
}

export default async function LawyerDealPage({ params }: LawyerDealPageProps) {
    const { id } = await params
    const [deal, user] = await Promise.all([
        getDealById(id),
        getCurrentUser()
    ])

    if (!user || user.role !== "lawyer") {
        redirect("/")
    }

    if (!deal) {
        return <div>עסקה לא נמצאה</div>
    }

    // TODO: Fetch OCR Data if stored separately (currently assumed strictly in Deal or we need a way to get the "Raw OCR" result if we want side-by-side).
    // For now, we compare Deal columns vs Profile columns or just show them.
    // Ideally, we stored the OCR result in `deal.ocr_data` jsonb column? 
    // Wait, the current implementation maps OCR directly to the form. 
    // So "User Entered" IS the OCR data unless they edited it. 
    // We might want to see the "Original Document" vs "Current Data".

    const nextAction = nextStepMap[deal.status]

    return (
        <>
            <Navbar user={user} />
            <DealRealtimeListener dealId={deal.id} currentStatus={deal.status} currentPaymentProofUrl={deal.payment_proof_url} />
            <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8" dir="rtl">
                <div className="max-w-[96%] xl:max-w-[1600px] mx-auto space-y-6">
                    {/* Payment Proof Notification Alert Banner */}
                    {deal.payment_proof_url && (
                        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-2xl">description</span>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">התראת מסמך חדש 💳</span>
                                    <h3 className="text-base font-extrabold text-white">אסמכתת העברה בנקאית הועלתה ע״י הקונה לבדיקה</h3>
                                    <p className="text-xs text-slate-300">הקונה העלה קובץ אסמכתא. אנא עיין בקובץ ואשר את הפקדת הנאמנות.</p>
                                </div>
                            </div>

                            <a
                                href={deal.payment_proof_url}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-lg transition-all active:scale-95"
                            >
                                <span>📄 לצפייה בקובץ האסמכתא</span>
                            </a>
                        </div>
                    )}

                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <BackButton href="/lawyer" label="חזור ללוח הבקרה" />
                            <div className="flex items-center gap-3 flex-wrap mt-2">
                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                                    #עסקה-{deal.id.slice(0, 8).toUpperCase()}
                                </span>
                                <h1 className="text-3xl font-extrabold text-foreground">בדיקת עסקה: {deal.title}</h1>
                            </div>
                        </div>

                        <LawyerActionHeader dealId={deal.id} nextAction={nextAction} />
                    </div>

                    {/* High Visibility Status Tracker & 5-Step Pipeline Banner */}
                    <DealStatusTracker status={deal.status} />

                    {/* Real-time Car Ownership Transfer & Handover Approvals (Prominent Top Position) */}
                    <Card className="p-6 border border-teal-500/30 bg-teal-500/5 shadow-lg">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <span className="material-symbols-outlined text-teal-400">directions_car</span>
                                <span>אישורי העברת בעלות ומסירת רכב (בזמן אמת) 🚗</span>
                            </h2>
                            {(deal.seller_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("SELLER_CONFIRMED")) &&
                            (deal.buyer_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("BUYER_CONFIRMED")) ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 px-3 py-1 font-bold text-xs">
                                    ✨ אישור מסירה דו-צדדי הושלם במלואו
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/30 px-3 py-1 font-bold text-xs">
                                    ⏳ ממתין לאישורי מסירה מהצדדים
                                </Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Seller Confirmation Card */}
                            <div className={`p-4 rounded-xl border transition-all ${
                                deal.seller_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("SELLER_CONFIRMED")
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-md"
                                    : "bg-slate-900/60 border-white/10 text-slate-400"
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base">
                                            {(deal.seller_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("SELLER_CONFIRMED")) ? "check_circle" : "hourglass_empty"}
                                        </span>
                                        <span>אישור מסירת מוכר (מפתחות ומסמכים)</span>
                                    </span>
                                    <span className="text-xs font-mono font-bold">
                                        {(deal.seller_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("SELLER_CONFIRMED")) ? "מאושר 🟢" : "ממתין ⏳"}
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed text-slate-300">
                                    {(deal.seller_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("SELLER_CONFIRMED"))
                                        ? "המוכר אישר במערכת כי מסר את המפתחות, רישיון הרכב וביצע העברת בעלות"
                                        : "טרם התקבל אישור מסירת רכב מהמוכר במערכת"}
                                </p>
                            </div>

                            {/* Buyer Confirmation Card */}
                            <div className={`p-4 rounded-xl border transition-all ${
                                deal.buyer_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("BUYER_CONFIRMED")
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-md"
                                    : "bg-slate-900/60 border-white/10 text-slate-400"
                            }`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base">
                                            {(deal.buyer_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("BUYER_CONFIRMED")) ? "check_circle" : "hourglass_empty"}
                                        </span>
                                        <span>אישור קבלת קונה (מפתחות ורכב)</span>
                                    </span>
                                    <span className="text-xs font-mono font-bold">
                                        {(deal.buyer_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("BUYER_CONFIRMED")) ? "מאושר 🟢" : "ממתין ⏳"}
                                    </span>
                                </div>
                                <p className="text-xs leading-relaxed text-slate-300">
                                    {(deal.buyer_confirmed_delivery || deal.vehicle_reg_owner_name?.includes("BUYER_CONFIRMED"))
                                        ? "הקונה אישר במערכת כי קיבל לידיו את הרכב, המפתחות ואישור העברת הבעלות"
                                        : "טרם התקבל אישור קבלת רכב מהקונה במערכת"}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Digital Legal Agreement & Multi-Party Signature Widget */}
                    <DealAgreementWidget
                        deal={deal}
                        currentUserId={user.id}
                        userRole="lawyer"
                        userName={user.full_name}
                    />

                    <div className="grid gap-6">
                        {/* 1. Vehicle Verification */}
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4">פרטי רכב</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-4 lg:sticky lg:top-24">
                                    <h3 className="font-semibold mb-2">מסמך רכב</h3>
                                    {deal.vehicle_reg_doc_url ? (
                                        <div className="relative aspect-[3/4] w-full border rounded-xl overflow-hidden shadow-lg bg-slate-950">
                                            <Image
                                                src={deal.vehicle_reg_doc_url}
                                                alt="רישיון רכב"
                                                fill
                                                className="object-contain p-2"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-red-500 p-4 border border-dashed rounded-xl text-center">חסר מסמך</div>
                                    )}
                                </div>
                                <div className="lg:col-span-8 space-y-1">
                                    <ComparisonField
                                        label="מספר רכב"
                                        userValue={deal.license_plate}
                                        extractedValue={deal.ocr_data?.fields?.licensePlate?.value || deal.ocr_data?.vehicleOcr?.fields?.plate_number?.value || deal.license_plate}
                                        confidence={deal.ocr_data?.fields?.licensePlate?.confidence || deal.ocr_data?.vehicleOcr?.fields?.plate_number?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "licensePlate", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "licensePlate", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="יצרן"
                                        userValue={deal.vehicle_make}
                                        extractedValue={deal.ocr_data?.fields?.vehicleMake?.value || deal.ocr_data?.vehicleOcr?.fields?.make?.value || deal.vehicle_make}
                                        confidence={deal.ocr_data?.fields?.vehicleMake?.confidence || deal.ocr_data?.vehicleOcr?.fields?.make?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleMake", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleMake", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="דגם"
                                        userValue={deal.vehicle_model}
                                        extractedValue={deal.ocr_data?.fields?.vehicleModel?.value || deal.ocr_data?.vehicleOcr?.fields?.model?.value || deal.vehicle_model}
                                        confidence={deal.ocr_data?.fields?.vehicleModel?.confidence || deal.ocr_data?.vehicleOcr?.fields?.model?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleModel", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleModel", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="שנה"
                                        userValue={deal.vehicle_year}
                                        extractedValue={deal.ocr_data?.fields?.vehicleYear?.value || deal.ocr_data?.vehicleOcr?.fields?.year?.value || deal.vehicle_year}
                                        confidence={deal.ocr_data?.fields?.vehicleYear?.confidence || deal.ocr_data?.vehicleOcr?.fields?.year?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleYear", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleYear", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="מספר שלדה (VIN)"
                                        userValue={deal.chassis_number}
                                        extractedValue={deal.ocr_data?.fields?.chassisNumber?.value || deal.ocr_data?.vehicleOcr?.fields?.chassis_number?.value || deal.chassis_number}
                                        confidence={deal.ocr_data?.fields?.chassisNumber?.confidence || deal.ocr_data?.vehicleOcr?.fields?.chassis_number?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "chassisNumber", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "chassisNumber", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="נפח מנוע (סמ״ק)"
                                        userValue={deal.engine_volume}
                                        extractedValue={deal.ocr_data?.fields?.engineVolume?.value || deal.ocr_data?.vehicleOcr?.fields?.engine_volume?.value || deal.engine_volume}
                                        confidence={deal.ocr_data?.fields?.engineVolume?.confidence || deal.ocr_data?.vehicleOcr?.fields?.engine_volume?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "engineVolume", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "engineVolume", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="תוקף רישיון"
                                        userValue={deal.license_expiry_date}
                                        extractedValue={deal.ocr_data?.fields?.licenseExpiry?.value || deal.ocr_data?.vehicleOcr?.fields?.license_expiry?.value || deal.license_expiry_date}
                                        confidence={deal.ocr_data?.fields?.licenseExpiry?.confidence || deal.ocr_data?.vehicleOcr?.fields?.license_expiry?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "licenseExpiry", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "licenseExpiry", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="בעלויות קודמות"
                                        userValue={deal.previous_owners}
                                        extractedValue={deal.ocr_data?.fields?.previousOwners?.value || deal.ocr_data?.vehicleOcr?.fields?.previous_owners?.value || deal.previous_owners}
                                        confidence={deal.ocr_data?.fields?.previousOwners?.confidence || deal.ocr_data?.vehicleOcr?.fields?.previous_owners?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "previousOwners", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "previousOwners", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="שם בעל הרכב ברשיון"
                                        userValue={deal.vehicle_reg_owner_name}
                                        extractedValue={deal.ocr_data?.fields?.vehicleRegOwnerName?.value || deal.ocr_data?.vehicleOcr?.fields?.owner_name?.value || deal.vehicle_reg_owner_name}
                                        confidence={deal.ocr_data?.fields?.vehicleRegOwnerName?.confidence || deal.ocr_data?.vehicleOcr?.fields?.owner_name?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleRegOwnerName", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleRegOwnerName", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label={'ת"ז בעל הרכב ברשיון'}
                                        userValue={deal.vehicle_reg_owner_id}
                                        extractedValue={deal.ocr_data?.vehicleOcr?.fields?.owner_id?.value || deal.vehicle_reg_owner_id}
                                        confidence={deal.ocr_data?.vehicleOcr?.fields?.owner_id?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleRegOwnerId", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "vehicleRegOwnerId", val)
                                        }}
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* 2. Seller Verification */}
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4">מוכר</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-4 lg:sticky lg:top-24">
                                    <h3 className="font-semibold mb-2">תעודה מזהה</h3>
                                    {deal.id_doc_url ? (
                                        <div className="relative aspect-[3/4] w-full border rounded-xl overflow-hidden shadow-lg bg-slate-950">
                                            <Image
                                                src={deal.id_doc_url}
                                                alt="תעודת זהות"
                                                fill
                                                className="object-contain p-2"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-red-500 p-4 border border-dashed rounded-xl text-center">חסר מסמך</div>
                                    )}
                                </div>
                                <div className="lg:col-span-8 space-y-1">
                                    <ComparisonField
                                        label="שם מלא"
                                        userValue={deal.seller?.full_name || `${deal.first_name || ""} ${deal.last_name || ""}`.trim()}
                                        extractedValue={deal.ocr_data?.idOcr?.fields?.full_name?.value || (deal.first_name && deal.last_name ? `${deal.first_name} ${deal.last_name}` : null)}
                                        confidence={deal.ocr_data?.idOcr?.fields?.full_name?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            const parts = String(val).trim().split(/\s+/)
                                            await updateDealOcrField(deal.id, "firstName", parts[0] || "")
                                            await updateDealOcrField(deal.id, "lastName", parts.slice(1).join(" ") || "")
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            const parts = String(val).trim().split(/\s+/)
                                            await updateDealOcrField(deal.id, "firstName", parts[0] || "")
                                            await updateDealOcrField(deal.id, "lastName", parts.slice(1).join(" ") || "")
                                        }}
                                    />
                                    <ComparisonField
                                        label="ת.ז."
                                        userValue={deal.seller?.id_number || deal.owner_id_number}
                                        extractedValue={deal.ocr_data?.idOcr?.fields?.id_number?.value || deal.owner_id_number}
                                        confidence={deal.ocr_data?.idOcr?.fields?.id_number?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "idNumber", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "idNumber", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="תאריך לידה"
                                        userValue={deal.seller?.birth_date || deal.ocr_data?.idOcr?.fields?.birth_date?.value}
                                        extractedValue={deal.ocr_data?.idOcr?.fields?.birth_date?.value}
                                        confidence={deal.ocr_data?.idOcr?.fields?.birth_date?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "birthDate", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "birthDate", val)
                                        }}
                                    />
                                    <ComparisonField
                                        label="כתובת"
                                        userValue={deal.seller?.address || deal.ocr_data?.idOcr?.fields?.address?.value}
                                        extractedValue={deal.ocr_data?.idOcr?.fields?.address?.value}
                                        confidence={deal.ocr_data?.idOcr?.fields?.address?.confidence}
                                        onApplyAiValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "address", val)
                                        }}
                                        onUpdateUserValue={async (val) => {
                                            "use server"
                                            await updateDealOcrField(deal.id, "address", val)
                                        }}
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* 3. Escrow Payment & Verification */}
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4">אימות הפקדת נאמנות 🔒</h2>
                            <div className="space-y-4">
                                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground">קוד ייחוס להעברה:</p>
                                        <p className="font-mono text-lg font-bold text-primary dir-ltr">
                                            ST-{deal.id.slice(0, 4).toUpperCase()}-{deal.id.slice(-4).toUpperCase()}
                                        </p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground">סכום העסקה בנאמנות:</p>
                                        <p className="text-lg font-bold text-foreground">₪{Number(deal.price_ils).toLocaleString()}</p>
                                    </div>
                                </div>
                                {deal.payment_proof_url ? (
                                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                        <span className="text-sm font-medium">אסמכתת העברה בנקאית:</span>
                                        <a
                                            href={deal.payment_proof_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                                        >
                                            📄 לצפייה בקובץ האסמכתא
                                        </a>
                                    </div>
                                ) : (
                                    <p className="text-xs text-amber-500 font-semibold">טרם הועלתה אסמכתת העברה בנקאית ע״י הקונה</p>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    )
}
