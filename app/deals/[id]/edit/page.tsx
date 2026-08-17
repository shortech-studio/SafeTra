import { getDealById, updateDeal } from "@/lib/actions/deals"
import { getCurrentUser } from "@/lib/actions/auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { BackButton } from "@/components/BackButton"
import { Card } from "@/components/ui/card"
import { EditDealForm } from "./EditDealForm"
import { getDealInvitations } from "@/lib/actions/deals"

interface EditDealPageProps {
  params: Promise<{ id: string }>
}

export default async function EditDealPage({ params }: EditDealPageProps) {
  const { id } = await params
  const [deal, user, invitations] = await Promise.all([
    getDealById(id),
    getCurrentUser(),
    getDealInvitations(id)
  ])

  if (!user) redirect("/auth/login")
  if (!deal) redirect("/deals")

  if (deal.seller_id !== user.id) redirect(`/deals/${id}`)

  // Verify business rules: edit available ONLY if no invitations sent & no buyer joined & status is DRAFT
  const hasInvites = Boolean(invitations && invitations.length > 0)
  const hasBuyer = Boolean(deal.buyer_id)
  const isDraft = deal.status === "DRAFT"

  if (!isDraft || hasInvites || hasBuyer) {
    redirect(`/deals/${id}`)
  }

  return (
    <>
      <Navbar user={user} />
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <BackButton href={`/deals/${id}`} label="חזור לפרטי העסקה" />
            <h1 className="text-3xl font-extrabold text-foreground mt-2">עריכת עסקה: {deal.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">עדכן את פרטי העסקה. אפשרות זו זמינה כיוון שטרם נשלחו הזמנות לקונה.</p>
          </div>

          <Card className="p-6 bg-slate-950/60 border-white/10 shadow-xl rounded-2xl">
            <EditDealForm deal={deal} />
          </Card>
        </div>
      </div>
    </>
  )
}
