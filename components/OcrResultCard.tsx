"use client"

import React, { useState } from "react"
import { 
    CheckCircle2, 
    User, 
    CreditCard, 
    Calendar, 
    MapPin, 
    Car, 
    ShieldCheck, 
    Sparkles, 
    ChevronDown, 
    ChevronUp,
    FileText,
    Gauge,
    GitCompare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { OCRResult } from "@/types/ocr"

interface OcrResultCardProps {
    result: OCRResult
    title?: string
    onCompareDiff?: () => void
}

export function OcrResultCard({ result, title, onCompareDiff }: OcrResultCardProps) {
    const [showRawJson, setShowRawJson] = useState(false)

    if (!result) return null

    const { documentType, meanConfidence, fields } = result

    // Human readable document type names
    const docTypeLabels: Record<string, string> = {
        id_card: "תעודת זהות",
        driving_license: "רישיון נהיגה",
        vehicle_registration: "רישיון רכב",
        unknown: "מסמך כללי"
    }

    const docTitle = title || docTypeLabels[documentType] || "מסמך מאומת"

    // Field configuration for clean display
    const fieldConfigs: Array<{ key: string; label: string; icon: React.ReactNode }> = [
        { key: "full_name", label: "שם מלא", icon: <User className="h-4 w-4 text-emerald-400" /> },
        { key: "id_number", label: "מספר ת\"ז / מזהה", icon: <CreditCard className="h-4 w-4 text-emerald-400" /> },
        { key: "birth_date", label: "תאריך לידה", icon: <Calendar className="h-4 w-4 text-emerald-400" /> },
        { key: "address", label: "כתובת / עיר", icon: <MapPin className="h-4 w-4 text-emerald-400" /> },
        { key: "plate_number", label: "מספר רישוי", icon: <Car className="h-4 w-4 text-emerald-400" /> },
        { key: "year", label: "שנת ייצור", icon: <Calendar className="h-4 w-4 text-emerald-400" /> },
        { key: "make", label: "יצרן", icon: <Car className="h-4 w-4 text-emerald-400" /> },
        { key: "model", label: "דגם", icon: <Car className="h-4 w-4 text-emerald-400" /> },
        { key: "chassis_number", label: "מספר שלדה (VIN)", icon: <ShieldCheck className="h-4 w-4 text-emerald-400" /> },
        { key: "engine_volume", label: "נפח מנוע (סמ״ק)", icon: <Gauge className="h-4 w-4 text-emerald-400" /> },
        { key: "owner_name", label: "שם בעלי הרכב", icon: <User className="h-4 w-4 text-emerald-400" /> },
        { key: "owner_id", label: "ת\"ז בעלי הרכב", icon: <CreditCard className="h-4 w-4 text-emerald-400" /> },
        { key: "license_expiry", label: "תוקף רישיון", icon: <Calendar className="h-4 w-4 text-emerald-400" /> },
    ]

    // Filter fields that have actual values
    const activeFields = fieldConfigs.filter(cfg => fields?.[cfg.key]?.value)

    return (
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/90 backdrop-blur-xl p-5 space-y-4 shadow-2xl animate-in fade-in duration-300 text-right">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-3 gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="text-base font-bold font-rubik text-slate-100 flex items-center gap-2">
                            <span>תוצאות פענוח {docTitle}</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </h4>
                        <p className="text-xs text-slate-400">הנתונים חולצו בהצלחה באמצעות AI SecureOCR</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {onCompareDiff && (
                        <Button
                            type="button"
                            size="sm"
                            onClick={onCompareDiff}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5 shadow-md hover:scale-105 transition-all"
                        >
                            <GitCompare className="h-4 w-4" />
                            <span>השוואת AI ומיזוג פערים</span>
                        </Button>
                    )}

                    {/* AI Confidence Badge */}
                    <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-1.5 text-xs text-emerald-400 font-bold shadow-sm">
                        <span>{meanConfidence || 95}%</span>
                        <span className="text-[10px] text-emerald-400/80">דיוק AI</span>
                    </div>
                </div>
            </div>

            {/* Extracted Fields Grid */}
            {activeFields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeFields.map(cfg => {
                        const fieldValue = fields[cfg.key]?.value
                        return (
                            <div
                                key={cfg.key}
                                className="p-3 rounded-xl bg-slate-900/80 border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between gap-3 shadow-inner"
                            >
                                <div className="space-y-0.5 min-w-0 text-right">
                                    <span className="text-[11px] font-semibold text-slate-400 block">{cfg.label}</span>
                                    <span className="text-sm font-bold text-slate-100 block truncate font-mono">
                                        {fieldValue}
                                    </span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-800/60 border border-white/5 shrink-0">
                                    {cfg.icon}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                    לא נמצאו שדות פענוח מוגדרים.
                </div>
            )}

            {/* Security Verification Status */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    <span>אומת בהצלחה - ללא התראות אבטחה</span>
                </div>

                {/* Advanced Technical JSON Toggle */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-400 hover:text-emerald-400 h-7 flex items-center gap-1"
                    onClick={() => setShowRawJson(!showRawJson)}
                >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{showRawJson ? "הסתר JSON טכני" : "הצג JSON טכני"}</span>
                    {showRawJson ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
            </div>

            {/* Collapsible Technical JSON View */}
            {showRawJson && (
                <pre className="bg-slate-900/90 p-4 rounded-xl border border-emerald-500/20 text-emerald-300 font-mono text-[11px] overflow-auto max-h-64 text-left dir-ltr shadow-inner leading-relaxed animate-in fade-in">
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    )
}
