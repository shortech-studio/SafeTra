"use client"

import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Eraser, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { getSavedLawyerSignature } from "@/lib/actions/agreements"

import SignatureCanvas from "react-signature-canvas"

interface SignaturePadModalProps {
    isOpen: boolean
    onClose: () => void
    onSaveSignature: (signatureBase64: string, saveAsLawyerDefault?: boolean) => Promise<void>
    userRole?: "seller" | "buyer" | "lawyer" | "admin"
    userName?: string
}

export function SignaturePadModal({
    isOpen,
    onClose,
    onSaveSignature,
    userRole = "buyer",
    userName,
}: SignaturePadModalProps) {
    const sigCanvasRef = useRef<any>(null)
    const [isPending, setIsPending] = useState(false)
    const [savedLawyerSig, setSavedLawyerSig] = useState<string | null>(null)
    const [saveAsDefault, setSaveAsDefault] = useState(false)
    const [hasDrawn, setHasDrawn] = useState(false)
    const isLawyerOrAdmin = userRole === "lawyer" || userRole === "admin"

    // Load saved lawyer signature on mount/open
    useEffect(() => {
        if (isOpen && isLawyerOrAdmin) {
            getSavedLawyerSignature().then((sig) => {
                if (sig) setSavedLawyerSig(sig)
            })
        }
    }, [isOpen, isLawyerOrAdmin])

    const handleClear = () => {
        if (sigCanvasRef.current) {
            sigCanvasRef.current.clear()
            setHasDrawn(false)
        }
    }

    const handleUseSavedLawyerSig = async () => {
        if (!savedLawyerSig) return
        try {
            setIsPending(true)
            toast.loading("מחיל חתימה שמורה...", { id: "sig-save-toast" })
            await onSaveSignature(savedLawyerSig, false)
            toast.success("נחתם בהצלחה עם החתימה השמורה ⚡", { id: "sig-save-toast" })
            onClose()
        } catch (err: any) {
            toast.error(`שגיאה בשמירת חתימה: ${err?.message || "נסה שוב"}`, { id: "sig-save-toast" })
        } finally {
            setIsPending(false)
        }
    }

    const handleConfirmSignature = async () => {
        if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
            toast.error("אנא חתום בתוך המסגרת לפני השמירה")
            return
        }

        try {
            setIsPending(true)
            toast.loading("שומר חתימה דיגיטלית...", { id: "sig-save-toast" })
            // Trim whitespace and get PNG data URL
            const signatureBase64 = sigCanvasRef.current.getTrimmedCanvas().toDataURL("image/png")
            await onSaveSignature(signatureBase64, saveAsDefault)
            toast.success("חתימתך נקלטה ונשמרה בהצלחה ⚡", { id: "sig-save-toast" })
            onClose()
        } catch (err: any) {
            toast.error(`שגיאה בשמירת חתימה: ${err?.message || "נסה שוב"}`, { id: "sig-save-toast" })
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg glass-card border-white/10 p-6 text-right font-sans" dir="rtl">
                <DialogHeader className="text-right space-y-2">
                    <DialogTitle className="text-xl font-black text-primary flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        חתימה דיגיטלית על הסכם SafeTra
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-300">
                        {userName ? `${userName}, ` : ""}אנא חתום בתוך המסגרת להלן בעזרת העכבר או האצבע. חתימתך תצורף להסכם הרכישה הרשמי.
                    </DialogDescription>
                </DialogHeader>

                {/* Saved Lawyer Quick-Sign Option */}
                {isLawyerOrAdmin && savedLawyerSig && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 my-2 animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-emerald-400">חתימה שמורה זמינה ⚡</p>
                                <p className="text-[10px] text-slate-300">יש לך חתימת עורך דין שמורה במערכת</p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleUseSavedLawyerSig}
                            disabled={isPending}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs h-8 px-3 rounded-lg cursor-pointer"
                        >
                            שתמש בחתימה השמורה ⚡
                        </Button>
                    </div>
                )}

                {/* Signature Pad Drawing Area */}
                <div className="space-y-2 my-3">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span>משטח חתימה:</span>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                            <Eraser className="w-3.5 h-3.5" />
                            <span>נקה משטח</span>
                        </button>
                    </div>

                    <div className="w-full rounded-xl border border-primary/30 bg-slate-950/90 overflow-hidden shadow-inner relative group">
                        <SignatureCanvas
                            ref={sigCanvasRef}
                            canvasProps={{
                                className: "w-full h-44 cursor-crosshair",
                            }}
                            penColor="#10b981"
                            onBegin={() => setHasDrawn(true)}
                        />
                        {!hasDrawn && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-500 font-mono opacity-60">
                                ✍️ חתום כאן בעזרת העכבר או האצבע
                            </div>
                        )}
                    </div>
                </div>

                {/* Lawyer Save Default Option */}
                {isLawyerOrAdmin && (
                    <div className="flex items-center gap-2 my-1">
                        <Checkbox
                            id="save-default-sig"
                            checked={saveAsDefault}
                            onCheckedChange={(checked) => setSaveAsDefault(Boolean(checked))}
                            className="border-primary/50 text-primary"
                        />
                        <label htmlFor="save-default-sig" className="text-xs text-slate-300 cursor-pointer font-medium">
                            שמור חתימה זו כברירת מחדל לעסקאות עתידיות
                        </label>
                    </div>
                )}

                <DialogFooter className="flex flex-row-reverse justify-start gap-2 pt-3 border-t border-white/10">
                    <Button
                        type="button"
                        onClick={handleConfirmSignature}
                        disabled={isPending}
                        className="bg-primary hover:bg-primary-fixed-dim text-on-primary font-black px-6 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>מעבד חתימה...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>אישור וחתימה על ההסכם ✍️</span>
                            </>
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isPending}
                        className="text-slate-400 hover:text-white text-xs rounded-xl"
                    >
                        ביטול
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
