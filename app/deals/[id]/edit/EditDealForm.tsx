"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateDeal } from "@/lib/actions/deals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Save, X } from "lucide-react"
import { toast } from "sonner"

interface EditDealFormProps {
    deal: any
}

export function EditDealForm({ deal }: EditDealFormProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [title, setTitle] = useState(deal.title || "")
    const [priceILS, setPriceILS] = useState(String(deal.price_ils || ""))
    const [licensePlate, setLicensePlate] = useState(deal.license_plate || "")
    const [vehicleMake, setVehicleMake] = useState(deal.vehicle_make || "")
    const [vehicleModel, setVehicleModel] = useState(deal.vehicle_model || "")
    const [vehicleYear, setVehicleYear] = useState(String(deal.vehicle_year || ""))
    const [kilometers, setKilometers] = useState(String(deal.kilometers || ""))
    const [engineVolume, setEngineVolume] = useState(String(deal.engine_volume || ""))
    const [chassisNumber, setChassisNumber] = useState(deal.chassis_number || "")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            try {
                const formData = new FormData()
                formData.append("title", title)
                formData.append("priceILS", priceILS)
                formData.append("licensePlate", licensePlate)
                formData.append("vehicleMake", vehicleMake)
                formData.append("vehicleModel", vehicleModel)
                formData.append("vehicleYear", vehicleYear)
                formData.append("kilometers", kilometers)
                formData.append("engineVolume", engineVolume)
                formData.append("chassisNumber", chassisNumber)

                toast.loading("שומר שינויים בעסקה...", { id: "edit-deal-toast" })
                const res = await updateDeal(deal.id, formData)

                if (res?.error) {
                    toast.error(`שגיאה: ${res.error}`, { id: "edit-deal-toast" })
                } else {
                    toast.success("פרטי העסקה עודכנו בהצלחה! ⚡", { id: "edit-deal-toast" })
                    router.push(`/deals/${deal.id}`)
                    router.refresh()
                }
            } catch (err: any) {
                toast.error(`שגיאת תקשורת: ${err?.message || "נסה שוב"}`, { id: "edit-deal-toast" })
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 text-right" dir="rtl">
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">כותרת העסקה</label>
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="bg-surface-container-lowest border-outline-variant font-semibold"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">מחיר מכירה מוסכם (₪)</label>
                    <Input
                        type="number"
                        value={priceILS}
                        onChange={(e) => setPriceILS(e.target.value)}
                        required
                        className="bg-surface-container-lowest border-outline-variant font-mono font-bold text-primary"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">מספר רישוי</label>
                    <Input
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value)}
                        className="bg-surface-container-lowest border-outline-variant font-mono"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">יצרן</label>
                    <Input
                        value={vehicleMake}
                        onChange={(e) => setVehicleMake(e.target.value)}
                        className="bg-surface-container-lowest border-outline-variant"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">דגם</label>
                    <Input
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="bg-surface-container-lowest border-outline-variant"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">שנת ייצור</label>
                    <Input
                        type="number"
                        value={vehicleYear}
                        onChange={(e) => setVehicleYear(e.target.value)}
                        className="bg-surface-container-lowest border-outline-variant"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">קילומטראז'</label>
                    <Input
                        type="number"
                        value={kilometers}
                        onChange={(e) => setKilometers(e.target.value)}
                        className="bg-surface-container-lowest border-outline-variant"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">נפח מנוע (סמ״ק)</label>
                    <Input
                        type="number"
                        value={engineVolume}
                        onChange={(e) => setEngineVolume(e.target.value)}
                        className="bg-surface-container-lowest border-outline-variant"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-muted-foreground">מספר שלדה (VIN)</label>
                    <Input
                        value={chassisNumber}
                        onChange={(e) => setChassisNumber(e.target.value)}
                        className="bg-surface-container-lowest border-outline-variant font-mono"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push(`/deals/${deal.id}`)}
                    className="flex items-center gap-1.5"
                >
                    <X className="w-4 h-4" />
                    <span>ביטול</span>
                </Button>
                <Button
                    type="submit"
                    disabled={isPending}
                    className="bg-primary hover:bg-primary-fixed-dim text-on-primary font-bold px-6 flex items-center gap-2"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>שומר...</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            <span>שמור שינויים</span>
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}
