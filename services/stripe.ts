import Stripe from "stripe"
import { db } from "@/lib/prisma"
import { PlanType } from "@prisma/client"

export class StripeService {
  private static isSandbox = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true"

  private static getClient() {
    return new Stripe(process.env.STRIPE_API_KEY || "mock-key", {
      apiVersion: "2023-10-16" as any,
    })
  }

  /**
   * Generates checkout URL for Stripe subscriptions
   */
  static async createCheckoutSession(workspaceId: string, plan: PlanType, returnUrl: string, billingCycle: "monthly" | "yearly" = "monthly") {
    if (this.isSandbox) {
      console.log(`[SANDBOX STRIPE] Creating checkout session for workspace: ${workspaceId}, plan: ${plan}, cycle: ${billingCycle}`)
      
      // Return a local URL with mock query params to simulate returning from Stripe checkout
      const mockCheckoutUrl = `${returnUrl}?session_id=mock_stripe_checkout_${plan.toLowerCase()}-${billingCycle}_${workspaceId}`
      return { url: mockCheckoutUrl }
    }

    try {
      const stripe = this.getClient()
      
      // Get price ID based on plan and cycle
      let priceId = ""
      if (plan === PlanType.PRO) {
        priceId = billingCycle === "yearly"
          ? (process.env.STRIPE_PRO_YEARLY_PRICE_ID || "price_pro_yearly_default")
          : (process.env.STRIPE_PRO_PRICE_ID || "price_pro_default")
      } else if (plan === PlanType.ENTERPRISE) {
        priceId = billingCycle === "yearly"
          ? (process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || "price_enterprise_yearly_default")
          : (process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise_default")
      } else {
        throw new Error("Free plan does not require a checkout session.")
      }

      // Check if workspace already has a stripe customer ID
      const subscription = await db.subscription.findFirst({
        where: { workspaceId }
      })

      let customerId = subscription?.stripeCustomerId

      if (!customerId) {
        // Find owner email
        const workspaceOwner = await db.teamMember.findFirst({
          where: { workspaceId, role: "OWNER" },
          include: { user: true }
        })
        
        const customer = await stripe.customers.create({
          email: workspaceOwner?.user.email || undefined,
          metadata: { workspaceId }
        })
        customerId = customer.id
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 3, // 3 day free trial as requested
        },
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?canceled=true`,
        metadata: {
          workspaceId,
          plan,
          billingCycle,
        }
      })

      return { url: session.url }
    } catch (error) {
      console.error("Stripe Checkout Error:", error)
      throw error
    }
  }

  /**
   * Generates Stripe customer portal URL for subscription management (upgrade, cancellation, cards)
   */
  static async createPortalSession(workspaceId: string, returnUrl: string) {
    if (this.isSandbox) {
      console.log(`[SANDBOX STRIPE] Creating portal session for workspace: ${workspaceId}`)
      return { url: `${returnUrl}?portal_session=mock_portal` }
    }

    try {
      const stripe = this.getClient()
      const subscription = await db.subscription.findFirst({
        where: { workspaceId }
      })

      if (!subscription?.stripeCustomerId) {
        throw new Error("No Stripe customer ID associated with this workspace.")
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
      })

      return { url: session.url }
    } catch (error) {
      console.error("Stripe Portal Error:", error)
      throw error
    }
  }

  /**
   * Verify webhook events from Stripe
   */
  static verifyWebhook(body: string, sig: string): Stripe.Event {
    if (this.isSandbox) {
      // Simulate/construct mock Stripe event for testing
      try {
        const parsed = JSON.parse(body)
        return parsed as Stripe.Event
      } catch {
        throw new Error("Invalid mock Stripe webhook body")
      }
    }

    const stripe = this.getClient()
    return stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || "")
  }

  /**
   * Handles mock checkout session completions to update subscription state in sandbox
   */
  static async processMockCheckout(sessionId: string) {
    if (!this.isSandbox) return

    // Format: mock_stripe_checkout_<plan>-<cycle>_<workspaceId>
    const parts = sessionId.split("_")
    if (parts.length < 5) return

    const planPart = parts[3].toLowerCase()
    const workspaceId = parts[4]

    let planName = PlanType.FREE
    if (planPart.startsWith("pro")) {
      planName = PlanType.PRO
    } else if (planPart.startsWith("enterprise")) {
      planName = PlanType.ENTERPRISE
    }

    // Create or update subscription with a 3-day free trial
    const currentPeriodEnd = new Date()
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 3) // 3 days trial/period

    await db.subscription.upsert({
      where: { stripeSubscriptionId: `sub_mock_${workspaceId}` },
      create: {
        workspaceId,
        stripeSubscriptionId: `sub_mock_${workspaceId}`,
        stripeCustomerId: `cust_mock_${workspaceId}`,
        plan: planName,
        status: "trialing",
        currentPeriodEnd,
      },
      update: {
        plan: planName,
        status: "trialing",
        currentPeriodEnd,
      }
    })

    // Log action
    await db.activityLog.create({
      data: {
        workspaceId,
        action: "subscription_updated",
        details: `Upgraded to sandbox ${planName} plan (trialing, 3 days free).`
      }
    })
  }
}
