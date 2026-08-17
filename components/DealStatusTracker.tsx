"use client"

import React from "react"
import { CheckCircle2, Clock, ShieldCheck, CreditCard, ArrowRightLeft, AlertCircle } from "lucide-react"

interface DealStatusTrackerProps {
    status: string
}

const statusConfig: Record<string, { label: string; step: number; color: string; bg: string; border: string; pulse: string; description: string }> = {
    DRAFT: {
        label: "טיוטת עסקה - ממתין לאישור קונה",
        step: 1,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
        pulse: "bg-amber-400",
        description: "המוכר יצר את הצעת העסקה. ממתין לאישור הקונה להמשך התהליך.",
    },
    SUBMITTED: {
        label: "הוגשה - ממתין לתחילת בדיקת עו״ד",
        step: 1,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
        pulse: "bg-blue-400",
        description: "העסקה אושרה על ידי הקונה והועברה לצוות המשפטי לבדיקת מסמכים.",
    },
    UNDER_REVIEW: {
        label: "בבדיקת עורך דין פעילה ⚖️",
        step: 2,
        color: "text-amber-400",
        bg: "bg-amber-500/15",
        border: "border-amber-500/40",
        pulse: "bg-amber-400",
        description: "עורך הדין בודק את תעודות הזהות, רישיון הרכב והתאמת הפרטים.",
    },
    AWAITING_PAYMENT: {
        label: "אושר משפטית! ממתין להפקדת נאמנות 🔒",
        step: 3,
        color: "text-purple-400",
        bg: "bg-purple-500/15",
        border: "border-purple-500/40",
        pulse: "bg-purple-400",
        description: "הבדיקה המשפטית הושלמה בהצלחה. הקונה מתבקש להפקיד את סכום העסקה לחשבון הנאמנות המוגן.",
    },
    PAYMENT_VERIFICATION: {
        label: "באימות הפקדת נאמנות ⏳",
        step: 3,
        color: "text-amber-300",
        bg: "bg-amber-500/15",
        border: "border-amber-500/40",
        pulse: "bg-amber-400",
        description: "התשלום נקלט במערכת ונבדק על ידי עורך הדין לאישור סופי.",
    },
    OWNERSHIP_TRANSFER_PENDING: {
        label: "כספי הנאמנות מוגנים! ממתין להעברת בעלות 🚗",
        step: 4,
        color: "text-teal-300",
        bg: "bg-teal-500/15",
        border: "border-teal-500/40",
        pulse: "bg-teal-400",
        description: "הכסף מופקד בבטחה בנאמנות. הצדדים יכולים לבצע העברת בעלות בדואר / באזור האישי.",
    },
    COMPLETED: {
        label: "העסקה הושלמה בהצלחה! 🎉",
        step: 5,
        color: "text-emerald-400",
        bg: "bg-emerald-500/20",
        border: "border-emerald-500/50",
        pulse: "bg-emerald-400",
        description: "הבעלות הועברה והכספים שוחררו למוכר. העסקה סגורה בבטחה.",
    },
    CANCELLED: {
        label: "העסקה בוטלה ❌",
        step: 0,
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        pulse: "bg-red-500",
        description: "העסקה בוטלה. במידה והופקדו כספים, יבוצע החזר לפי הנחיות עורך הדין.",
    },
}

const pipelineSteps = [
    { num: 1, name: "הצעה ואישור", icon: Clock },
    { num: 2, name: "בדיקת עו״ד", icon: ShieldCheck },
    { num: 3, name: "הפקדת נאמנות", icon: CreditCard },
    { num: 4, name: "העברת בעלות", icon: ArrowRightLeft },
    { num: 5, name: "עסקה הושלמה", icon: CheckCircle2 },
]

export function DealStatusTracker({ status }: DealStatusTrackerProps) {
    const current = statusConfig[status] || {
        label: status,
        step: 1,
        color: "text-slate-300",
        bg: "bg-slate-800",
        border: "border-slate-700",
        pulse: "bg-slate-400",
        description: "",
    }

    return (
        <div className="w-full space-y-4 text-right" dir="rtl">
            {/* Prominent High-Visibility Status Banner */}
            <div className={`p-4 sm:p-5 rounded-2xl border ${current.bg} ${current.border} shadow-xl backdrop-blur-xl transition-all`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-4 w-4 shrink-0">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.pulse}`} />
                            <span className={`relative inline-flex rounded-full h-4 w-4 ${current.pulse}`} />
                        </span>
                        <div>
                            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block">סטטוס עסקה בזמן אמת</span>
                            <h2 className={`text-lg sm:text-xl font-black font-rubik ${current.color} flex items-center gap-2`}>
                                {current.label}
                            </h2>
                        </div>
                    </div>

                    <div className={`px-4 py-1.5 rounded-full border text-xs font-extrabold ${current.color} ${current.border} ${current.bg} shrink-0 shadow-sm`}>
                        שלב {current.step > 0 ? `${current.step} מתוך 5` : "מבוטל"}
                    </div>
                </div>

                {current.description && (
                    <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed font-medium">
                        {current.description}
                    </p>
                )}
            </div>

            {/* Visual 5-Step Pipeline Progress Bar */}
            {current.step > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 shadow-lg backdrop-blur-md">
                    <div className="grid grid-cols-5 gap-1 relative">
                        {pipelineSteps.map((s) => {
                            const isPassed = current.step > s.num
                            const isCurrent = current.step === s.num
                            const Icon = s.icon

                            return (
                                <div key={s.num} className="flex flex-col items-center text-center space-y-1.5 group">
                                    <div
                                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-300 font-bold shadow-md ${
                                            isPassed
                                                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20"
                                                : isCurrent
                                                ? "bg-primary text-slate-950 ring-4 ring-primary/30 scale-110 shadow-primary/30"
                                                : "bg-slate-900 text-slate-500 border border-white/10"
                                        }`}
                                    >
                                        {isPassed ? (
                                            <CheckCircle2 className="w-5 h-5" />
                                        ) : (
                                            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                        )}
                                    </div>

                                    <span
                                        className={`text-[10px] sm:text-xs font-bold leading-tight ${
                                            isCurrent
                                                ? "text-primary font-black"
                                                : isPassed
                                                ? "text-emerald-400"
                                                : "text-slate-500"
                                        }`}
                                    >
                                        {s.name}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
