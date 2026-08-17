"use client"

import { useState, useEffect } from "react"
import { inviteBuyer, getDealInvitations } from "@/lib/actions/deals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clipboard, UserPlus, CheckCircle2, Clock, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createSupabaseClient } from "@/lib/supabase/client"

interface InviteBuyerFormProps {
    dealId: string
    hasBuyer?: boolean
    dealStatus?: string
}

export function InviteBuyerForm({ dealId, hasBuyer, dealStatus }: InviteBuyerFormProps) {
    const [phone, setPhone] = useState("")
    const [lastInviteLink, setLastInviteLink] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const [invitations, setInvitations] = useState<any[]>([])
    const supabase = createSupabaseClient()

    const hasAcceptedInvitation = invitations.some((inv) => inv.status === "ACCEPTED")
    const isInviteDisabled = (hasBuyer && hasAcceptedInvitation) || (dealStatus && dealStatus !== "DRAFT")

    // Load invitations on mount
    useEffect(() => {
        refreshInvitations()

        // Real-time subscription for invitation updates
        const channel = supabase
            .channel(`deal-invitations-${dealId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'deal_invitations',
                    filter: `deal_id=eq.${dealId}`,
                },
                () => {
                    refreshInvitations()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dealId, supabase])

    const copyToClipboard = async (text: string) => {
        if (typeof window !== "undefined" && navigator?.clipboard) {
            try {
                await navigator.clipboard.writeText(text)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            } catch (err) {
                console.error("Failed to copy:", err)
            }
        }
    }

    async function refreshInvitations() {
        const data = await getDealInvitations(dealId)
        setInvitations(data)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (isInviteDisabled) return
        setLoading(true)
        setError("")
        setLastInviteLink("")

        const result = await inviteBuyer(dealId, phone)

        if (result.error) {
            setError(result.error)
        } else if (result.link) {
            setLastInviteLink(result.link)
            setPhone("") // Clear for next invite
            refreshInvitations()
        }

        setLoading(false)
    }

    return (
        <Card className="glass-card rounded-2xl border-white/10 p-6 mt-6 overflow-hidden" dir="rtl">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl font-bold text-primary flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    הזמנת קונים
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
                {isInviteDisabled ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 animate-in fade-in">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-emerald-400">קונה הצטרף לעסקה זו 👤</p>
                            <p className="text-xs text-slate-300">העסקה אושרה ע״י הקונה והועברה להמשך טיפול. האפשרות להזמנת קונים נוספים הופסקה.</p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <Input
                            placeholder="מספר טלפון של הקונה (050...)"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                            className="flex-1 bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary text-right"
                        />
                        <Button type="submit" disabled={loading} className="whitespace-nowrap font-bold bg-primary text-on-primary hover:bg-primary-fixed-dim">
                            {loading ? "מייצר..." : "שלח הזמנה"}
                        </Button>
                    </form>
                )}

                {lastInviteLink && (
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-3 animate-in fade-in duration-300">
                        <p className="text-xs text-primary font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            הזמנה חדשה נוצרה! שלח את הקישור לקונה:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant text-xs font-mono text-on-surface text-left dir-ltr overflow-hidden text-ellipsis whitespace-nowrap">
                                {lastInviteLink}
                            </code>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(lastInviteLink)}
                                className="shrink-0 bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 font-bold flex items-center gap-1.5"
                            >
                                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Clipboard className="h-4 w-4" />}
                                {copied ? "הועתק!" : "העתק"}
                            </Button>
                        </div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {invitations.length > 0 && (
                    <div className="pt-4 border-t border-white/10">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">הזמנות שנשלחו:</h3>
                        <div className="space-y-3">
                            {invitations.map((invite) => (
                                <div key={invite.id} className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-xl border border-white/5 hover:border-primary/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                                            {invite.buyer?.full_name?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-on-surface">{invite.buyer?.full_name || "קונה מוזמן"}</p>
                                            <p className="text-xs text-on-surface-variant font-mono">{invite.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {invite.status === "ACCEPTED" ? (
                                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 flex gap-1 items-center font-bold">
                                                <CheckCircle2 className="h-3 w-3" />
                                                התקבל
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex gap-1 items-center font-bold">
                                                <Clock className="h-3 w-3" />
                                                ממתין
                                            </Badge>
                                        )}
                                        {invite.status === "PENDING" && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                                                onClick={() => {
                                                    const link = `${window.location.origin}/deals/${dealId}/join?invite=${invite.id}`
                                                    copyToClipboard(link)
                                                }}
                                                title="העתק קישור שוב"
                                            >
                                                <Clipboard className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
