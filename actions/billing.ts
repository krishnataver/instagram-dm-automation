"use server"

import { db } from "@/lib/prisma"
import { auth } from "@/auth"
import { StripeService } from "@/services/stripe"
import { PlanType } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

async function getSessionWorkspace() {
  const session = await auth()
  if (!session?.user?.id || !(session as any).user.workspaceId) {
    throw new Error("Unauthorized access. No session workspace found.")
  }
  return {
    userId: session.user.id,
    workspaceId: (session as any).user.workspaceId as string,
  }
}

function getOrigin(headersList: any): string {
  const origin = headersList.get("origin") || headersList.get("x-forwarded-proto")
  if (origin) return origin.startsWith("http") ? origin : `https://${headersList.get("host") || "localhost:3000"}`
  const host = headersList.get("host") || "localhost:3000"
  const proto = host.includes("localhost") ? "http" : "https"
  return `${proto}://${host}`
}

export async function getSubscription() {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const subscription = await db.subscription.findFirst({
      where: { workspaceId }
    })
    return subscription
  } catch (error) {
    console.error("Error fetching subscription:", error)
    return null
  }
}

export async function subscribeToPlan(plan: PlanType, billingCycle: "monthly" | "yearly" = "monthly") {
  try {
    const { workspaceId } = await getSessionWorkspace()
    let origin = process.env.NEXTAUTH_URL || "http://localhost:3000"
    try {
      const headersList = await headers()
      origin = getOrigin(headersList)
    } catch {}
    const returnUrl = `${origin}/settings`

    const isSandbox = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true"

    if (isSandbox) {
      // Sandbox: instantly activate plan without Stripe
      const currentPeriodEnd = new Date()
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30)
      await db.subscription.upsert({
        where: { stripeSubscriptionId: `sub_sandbox_${workspaceId}` },
        create: {
          workspaceId,
          stripeSubscriptionId: `sub_sandbox_${workspaceId}`,
          stripeCustomerId: `cust_sandbox_${workspaceId}`,
          plan,
          status: "active",
          currentPeriodEnd,
        },
        update: { plan, status: "active", currentPeriodEnd },
      })
      try { revalidatePath("/settings") } catch {}
      return { success: true, url: null, sandbox: true }
    }

    const sessionResult = await StripeService.createCheckoutSession(workspaceId, plan, returnUrl, billingCycle)
    return { success: true, url: sessionResult.url }
  } catch (error: any) {
    console.error("Billing Checkout Error:", error)
    return { error: error.message || "Checkout session generation failed." }
  }
}

/**
 * UPI / Manual payment — activates 7-day trial
 */
export async function processMockUpiPayment(plan: PlanType, billingCycle: "monthly" | "yearly", transactionId: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    if (!transactionId || transactionId.trim().length < 4) {
      return { error: "Please enter a valid UPI Transaction ID / Ref No (at least 4 characters)." }
    }

    // 7-day trial from now
    const currentPeriodEnd = new Date()
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 7)

    await db.subscription.upsert({
      where: { stripeSubscriptionId: `sub_upi_${workspaceId}` },
      create: {
        workspaceId,
        stripeSubscriptionId: `sub_upi_${workspaceId}`,
        stripeCustomerId: `cust_upi_${workspaceId}`,
        plan,
        status: "trialing",
        currentPeriodEnd,
      },
      update: {
        plan,
        status: "trialing",
        currentPeriodEnd,
      }
    })

    await db.activityLog.create({
      data: {
        workspaceId,
        action: "upi_payment_confirmed",
        details: `UPI Payment for ${plan} (${billingCycle}). TransID: ${transactionId}. 7-day trial activated.`,
      }
    })

    try { revalidatePath("/settings") } catch {}
    return { success: true }
  } catch (error: any) {
    console.error("UPI Payment Error:", error)
    return { error: error.message || "Failed to process UPI payment." }
  }
}

export async function redirectToPortal() {
  try {
    const { workspaceId } = await getSessionWorkspace()
    let origin = process.env.NEXTAUTH_URL || "http://localhost:3000"
    try {
      const headersList = await headers()
      origin = getOrigin(headersList)
    } catch {}
    const returnUrl = `${origin}/settings`

    const portalResult = await StripeService.createPortalSession(workspaceId, returnUrl)
    return { success: true, url: portalResult.url }
  } catch (error: any) {
    return { error: error.message || "Failed to direct user to billing portal." }
  }
}
