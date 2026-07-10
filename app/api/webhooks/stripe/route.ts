import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { StripeService } from "@/services/stripe"
import { db } from "@/lib/prisma"
import { PlanType } from "@prisma/client"

export async function POST(request: Request) {
  const body = await request.text()
  const signature = (await headers()).get("Stripe-Signature") || ""

  let event;
  try {
    event = StripeService.verifyWebhook(body, signature)
  } catch (error: any) {
    console.error(`[STRIPE WEBHOOK ERROR] Verification failed: ${error.message}`)
    return new Response(`Webhook Error: ${error.message}`, { status: 400 })
  }

  const session = event.data.object as any
  const eventType = event.type

  console.log(`[STRIPE WEBHOOK] Received event: ${eventType}`)

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const workspaceId = session.metadata?.workspaceId
        const plan = (session.metadata?.plan || "PRO").toUpperCase() as PlanType
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (!workspaceId) {
          console.warn("[STRIPE WEBHOOK] Checkout session missing workspaceId metadata.")
          break
        }

        // Fetch subscription period details from Stripe if not in sandbox
        let currentPeriodEnd = new Date()
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30) // Fallback to +30 days

        await db.subscription.upsert({
          where: { stripeSubscriptionId: subscriptionId || `sub_mock_${workspaceId}` },
          create: {
            workspaceId,
            stripeSubscriptionId: subscriptionId || `sub_mock_${workspaceId}`,
            stripeCustomerId: customerId,
            plan,
            status: "active",
            currentPeriodEnd,
          },
          update: {
            plan,
            status: "active",
            currentPeriodEnd,
          }
        })

        await db.activityLog.create({
          data: {
            workspaceId,
            action: "billing_checkout_success",
            details: `Checkout session completed. Upgraded to ${plan} plan.`,
          }
        })

        break
      }

      case "customer.subscription.updated": {
        const subscriptionId = session.id as string
        const status = session.status as string
        const planPriceId = session.items?.data[0]?.price?.id as string

        // Find existing subscription by ID
        const subscription = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId }
        })

        if (!subscription) {
          console.warn(`[STRIPE WEBHOOK] Subscription update target not found: ${subscriptionId}`)
          break
        }

        // Map Price ID to PlanType (in production these would map to your Stripe Dashboard prices)
        let plan: PlanType = PlanType.FREE
        if (planPriceId === process.env.STRIPE_PRO_PRICE_ID) {
          plan = PlanType.PRO
        } else if (planPriceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
          plan = PlanType.ENTERPRISE
        } else {
          // Keep current plan if unrecognized, or evaluate based on metadata
          plan = subscription.plan
        }

        const periodEnd = new Date(session.current_period_end * 1000)

        await db.subscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            status,
            plan,
            currentPeriodEnd: periodEnd
          }
        })

        await db.activityLog.create({
          data: {
            workspaceId: subscription.workspaceId,
            action: "billing_subscription_updated",
            details: `Subscription status updated to: ${status}. Plan: ${plan}.`,
          }
        })

        break
      }

      case "customer.subscription.deleted": {
        const subscriptionId = session.id as string

        const subscription = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId }
        })

        if (!subscription) {
          console.warn(`[STRIPE WEBHOOK] Subscription delete target not found: ${subscriptionId}`)
          break
        }

        // Downgrade to FREE plan
        await db.subscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            plan: PlanType.FREE,
            status: "canceled",
          }
        })

        await db.activityLog.create({
          data: {
            workspaceId: subscription.workspaceId,
            action: "billing_subscription_canceled",
            details: "Subscription canceled. Workspace downgraded to FREE plan.",
          }
        })

        break
      }

      case "invoice.payment_succeeded": {
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string
        const invoiceId = session.id as string
        const amountPaid = session.amount_paid
        const currency = session.currency
        const pdfUrl = session.invoice_pdf

        const subscription = await db.subscription.findFirst({
          where: {
            OR: [
              { stripeSubscriptionId: subscriptionId },
              { stripeCustomerId: customerId }
            ]
          }
        })

        if (subscription) {
          await db.invoice.create({
            data: {
              workspaceId: subscription.workspaceId,
              stripeInvoiceId: invoiceId || `inv_mock_${Math.random().toString(36).substr(2, 9)}`,
              amount: amountPaid,
              currency,
              status: "paid",
              pdfUrl,
            }
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error: any) {
    console.error("[STRIPE WEBHOOK] Execution error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
