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

/**
 * Fetch subscription status for workspace
 */
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

/**
 * Initiates Stripe plan checkout session
 */
export async function subscribeToPlan(plan: PlanType, billingCycle: "monthly" | "yearly" = "monthly") {
  try {
    const { workspaceId } = await getSessionWorkspace()
    let origin = "http://localhost:3000"
    try {
      const headersList = await headers()
      origin = headersList.get("origin") || "http://localhost:3000"
    } catch {
      // Fallback for offline/test script execution where Next request store is unavailable
    }
    const returnUrl = `${origin}/dashboard/settings`

    const sessionResult = await StripeService.createCheckoutSession(workspaceId, plan, returnUrl, billingCycle)

    if (process.env.NEXT_PUBLIC_SANDBOX_MODE === "true") {
      // Instantly fulfill mock checkouts locally
      const sessionId = sessionResult.url?.split("session_id=")[1]
      if (sessionId) {
        await StripeService.processMockCheckout(sessionId)
      }
    }

    return { success: true, url: sessionResult.url }
  } catch (error: any) {
    console.error("Billing Checkout Actions Error:", error)
    return { error: error.message || "Checkout session generation failed." }
  }
}

/**
 * Process mock UPI / QR code payment confirmation
 */
export async function processMockUpiPayment(plan: PlanType, billingCycle: "monthly" | "yearly", transactionId: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    if (!transactionId || transactionId.trim().length < 4) {
      return { error: "Please enter a valid UPI Transaction ID / Ref No (at least 4 characters)." }
    }

    // Set trial expiration for 3 days from now
    const currentPeriodEnd = new Date()
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 3) // 3 days free trial

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

    // Log the transaction in activity logs
    await db.activityLog.create({
      data: {
        workspaceId,
        action: "upi_payment_confirmed",
        details: `UPI Payment Confirmed for ${plan} (${billingCycle}). TransID: ${transactionId}. Activated 3-day free trial.`,
      }
    })

    return { success: true }
  } catch (error: any) {
    console.error("UPI Payment Server Action Error:", error)
    return { error: error.message || "Failed to process UPI payment." }
  }
}

/**
 * Redirect user to billing portals (Stripe dashboard panel)
 */
export async function redirectToPortal() {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const headersList = await headers()
    const origin = headersList.get("origin") || "http://localhost:3000"
    const returnUrl = `${origin}/dashboard/settings`

    const portalResult = await StripeService.createPortalSession(workspaceId, returnUrl)
    return { success: true, url: portalResult.url }
  } catch (error: any) {
    return { error: error.message || "Failed to direct user to billing portal." }
  }
}
