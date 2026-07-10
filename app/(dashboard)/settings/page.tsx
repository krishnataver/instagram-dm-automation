import React from "react"
import { auth } from "@/auth"
import { getAiPrompt } from "@/actions/ai"

export const dynamic = "force-dynamic"

import { getSubscription } from "@/actions/billing"
import { getTeamMembers } from "@/actions/conversations"
import { db } from "@/lib/prisma"
import SettingsClient from "@/components/SettingsClient"

export default async function SettingsPage() {
  const session = await auth()
  const workspaceId = (session as any).user?.workspaceId

  // Fetch all initial configurations on the server
  const [prompt, subscription, teamMembers, accounts] = await Promise.all([
    getAiPrompt(),
    getSubscription(),
    getTeamMembers(),
    db.instagramAccount.findMany({
      where: { workspaceId },
      select: {
        id: true,
        username: true,
        displayName: true,
        instagramAccountId: true,
        pageId: true,
      }
    })
  ])

  // Convert subscription Date objects to strings/dates before passing down if needed
  const formattedSubscription = subscription ? {
    plan: subscription.plan,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  } : null

  return (
    <SettingsClient
      initialPrompt={prompt}
      initialSubscription={formattedSubscription}
      initialTeamMembers={teamMembers}
      workspaceId={workspaceId}
      connectedAccounts={accounts}
    />
  )
}
