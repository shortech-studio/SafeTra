"use client"

import { useState, useEffect } from "react"
import { Check, X, Sparkles, Loader2, Pencil, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ComparisonFieldProps {
    label: string
    userValue?: string | number | null
    extractedValue?: string | number | null
    fieldName?: string
    confidence?: number
    onApplyAiValue?: (value: string | number) => Promise<void> | void
    onUpdateUserValue?: (value: string | number) => Promise<void> | void
}

export function ComparisonField({
    label,
    userValue,
    extractedValue,
    confidence,
    onApplyAiValue,
    onUpdateUserValue
}: ComparisonFieldProps) {
    const [loading, setLoading] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editVal, setEditVal] = useState<string>(String(userValue || ""))

    useEffect(() => {
        setEditVal(String(userValue || ""))
    }, [userValue])

    const hasUser = userValue !== undefined && userValue !== null && String(userValue).trim() !== ""
    const hasAi = extractedValue !== undefined && extractedValue !== null && String(extractedValue).trim() !== ""

    const mismatch = hasUser && hasAi && String(userValue).trim() !== String(extractedValue).trim()
    const isMatch = hasUser && hasAi && !mismatch

    const handleApplyAi = async () => {
        if (!onApplyAiValue || !hasAi) return
        try {
            setLoading(true)
            await onApplyAiValue(extractedValue)
            setIsEditing(false)
        } catch (e) {
            console.error("Failed to apply AI value:", e)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveCustom = async () => {
        if (!onUpdateUserValue) return
        try {
            setLoading(true)
            await onUpdateUserValue(editVal)
            setIsEditing(false)
        } catch (e) {
            console.error("Failed to update custom value:", e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 border-b border-border/40 last:border-0 hover:bg-muted/20 items-center">
            {/* Label */}
            <div className="sm:col-span-3 lg:col-span-2 font-bold text-xs md:text-sm text-foreground/90 leading-snug">
                {label}
            </div>
            
            {/* User Value Column */}
            <div className={`sm:col-span-4 lg:col-span-4 p-2.5 rounded-xl border transition-all ${mismatch ? "bg-red-500/10 border-red-500/40" : "bg-muted/40 border-border/50"}`}>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">הוזן ע״י משתמש</span>
                    {onUpdateUserValue && !isEditing && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded transition-all"
                            title="ערוך ערך"
                        >
                            <Pencil className="w-3 h-3" />
                            <span>ערוך</span>
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <div className="flex items-center gap-1.5 mt-1">
                        <Input
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            className="h-8 text-xs bg-background text-right font-mono"
                            autoFocus
                        />
                        <Button
                            size="sm"
                            type="button"
                            onClick={handleSaveCustom}
                            disabled={loading}
                            className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
                        >
                            <Save className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            size="sm"
                            type="button"
                            variant="ghost"
                            onClick={() => setIsEditing(false)}
                            className="h-8 px-1.5 text-xs shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                ) : (
                    <div className="font-bold text-xs md:text-sm font-mono text-foreground break-all" title={String(userValue || "")}>
                        {userValue || <span className="text-muted-foreground font-normal italic font-sans">ריק</span>}
                    </div>
                )}
            </div>

            {/* AI Extracted Value Column */}
            <div className={`sm:col-span-4 lg:col-span-4 p-2.5 rounded-xl border transition-all ${mismatch ? "bg-red-500/10 border-red-500/40" : isMatch ? "bg-emerald-500/10 border-emerald-500/40" : "bg-muted/40 border-border/50"}`}>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">זוהה ע״י AI</span>
                    {confidence && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {Math.round(confidence * 100)}%
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-center gap-1.5">
                    <span className="font-bold text-xs md:text-sm font-mono text-foreground break-all" title={String(extractedValue || "")}>
                        {extractedValue || <span className="text-muted-foreground font-normal italic font-sans">לא זוהה</span>}
                    </span>
                    {mismatch ? (
                        <X className="w-4 h-4 text-red-400 shrink-0" />
                    ) : isMatch ? (
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : null}
                </div>
            </div>

            {/* Action Column */}
            <div className="sm:col-span-1 lg:col-span-2 flex justify-end">
                {hasAi && onApplyAiValue && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={handleApplyAi}
                        className={`text-xs h-8 px-3 gap-1.5 transition-all shadow-sm shrink-0 whitespace-nowrap ${
                            mismatch
                                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 font-bold"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                        }`}
                        title="העתק את ערך ה-AI לשדה"
                    >
                        {loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span>{mismatch ? "החל AI ⚡" : "העתק AI"}</span>
                    </Button>
                )}
            </div>
        </div>
    )
}
