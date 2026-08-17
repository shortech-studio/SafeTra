"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ComparisonField } from "@/app/lawyer/ComparisonField"
import { Sparkles, CheckCheck, ShieldAlert } from "lucide-react"

export interface OcrFieldDiff {
    label: string
    fieldName: string
    userValue: string | number | null
    extractedValue: string | number | null
    confidence?: number
}

interface OcrDiffModalProps {
    isOpen: boolean
    onClose: () => void
    diffs: OcrFieldDiff[]
    onApplyField: (fieldName: string, value: string | number) => Promise<void> | void
    onApplyAll?: (updates: Record<string, string | number>) => Promise<void> | void
}

export function OcrDiffModal({
    isOpen,
    onClose,
    diffs,
    onApplyField,
    onApplyAll
}: OcrDiffModalProps) {
    const [loadingAll, setLoadingAll] = useState(false)

    const mismatches = diffs.filter(
        d => d.userValue && d.extractedValue && String(d.userValue).trim() !== String(d.extractedValue).trim()
    )

    const handleApplyAll = async () => {
        if (!onApplyAll) return
        try {
            setLoadingAll(true)
            const updates: Record<string, string | number> = {}
            mismatches.forEach(m => {
                if (m.extractedValue !== null && m.extractedValue !== undefined) {
                    updates[m.fieldName] = m.extractedValue
                }
            })
            await onApplyAll(updates)
            onClose()
        } catch (err) {
            console.error("Failed to apply all AI values:", err)
        } finally {
            setLoadingAll(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-background/95 backdrop-blur-xl border border-border/80 text-foreground" dir="rtl">
                <DialogHeader className="text-right">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                        <ShieldAlert className="w-5 h-5 text-amber-400" />
                        <span>אימות נתוני מסמכים (AI vs מוזן)</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-sm mt-1">
                        המערכת זיהתה פערים בין הפרטים המוזנים לבין המסמכים המקוריים. ניתן לעדכן כל שדה בלחיצה אחת.
                    </DialogDescription>
                </DialogHeader>

                <div className="my-4 max-h-[60vh] overflow-y-auto space-y-1 rounded-xl border border-border/50 p-2 bg-muted/10">
                    {diffs.map((diff) => (
                        <ComparisonField
                            key={diff.fieldName}
                            label={diff.label}
                            fieldName={diff.fieldName}
                            userValue={diff.userValue}
                            extractedValue={diff.extractedValue}
                            confidence={diff.confidence}
                            onApplyAiValue={async (val) => {
                                await onApplyField(diff.fieldName, val)
                            }}
                            onUpdateUserValue={async (val) => {
                                await onApplyField(diff.fieldName, val)
                            }}
                        />
                    ))}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 border-t border-border/40">
                    <div className="text-xs text-muted-foreground">
                        {mismatches.length > 0 ? (
                            <span className="text-amber-400 font-semibold">נמצאו {mismatches.length} פערים לתיקון</span>
                        ) : (
                            <span className="text-emerald-400 font-semibold">כל הנתונים תואמים לחלוטין!</span>
                        )}
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="ghost" onClick={onClose} size="sm">
                            סגור
                        </Button>
                        {mismatches.length > 0 && onApplyAll && (
                            <Button
                                size="sm"
                                disabled={loadingAll}
                                onClick={handleApplyAll}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-md"
                            >
                                <CheckCheck className="w-4 h-4" />
                                <span>החל את כל ערכי ה-AI ({mismatches.length})</span>
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
