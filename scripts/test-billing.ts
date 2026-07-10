import { db } from "../lib/prisma"
import { subscribeToPlan, processMockUpiPayment } from "../actions/billing"
import { PlanType } from "@prisma/client"

async function runBillingTests() {
  console.log("=== STARTING MOCK BILLING INTEGRATION TESTS ===")

  const email = "billing-auto-tester@domain.com"
  const workspaceName = "Billing Automated Test Workspace"

  // 1. Database Cleanup
  console.log("1. Cleaning up existing test records...")
  const existingUser = await db.user.findUnique({ where: { email } })
  if (existingUser) {
    const members = await db.teamMember.findMany({ where: { userId: existingUser.id } })
    for (const member of members) {
      await db.workspace.delete({ where: { id: member.workspaceId } }).catch(() => {})
    }
    await db.user.delete({ where: { email } }).catch(() => {})
  }

  // 2. Setup mock user & workspace
  console.log("2. Setting up test user and workspace...")
  const user = await db.user.create({
    data: {
      name: "Billing Automated Tester",
      email,
      password: "test_password_hash",
      teamMembers: {
        create: {
          role: "OWNER",
          workspace: {
            create: {
              name: workspaceName
            }
          }
        }
      }
    },
    include: {
      teamMembers: {
        include: { workspace: true }
      }
    }
  })

  const workspace = user.teamMembers[0].workspace
  const workspaceId = workspace.id

  // Mock server action session context
  process.env.MOCK_AUTH_SESSION = JSON.stringify({
    user: {
      id: user.id,
      email: user.email,
      workspaceId: workspaceId
    }
  })
  process.env.NEXT_PUBLIC_SANDBOX_MODE = "true"

  // 3. Test Stripe Trial Billing Cycle Flow
  console.log("3. Testing Stripe 3-day free trial checkout...")
  const stripeResponse = await subscribeToPlan(PlanType.PRO, "yearly")
  if (!stripeResponse.success || !stripeResponse.url) {
    throw new Error(`FAIL: Stripe checkout flow initiation failed: ${JSON.stringify(stripeResponse)}`)
  }

  const stripeSub = await db.subscription.findFirst({
    where: { workspaceId }
  })
  if (!stripeSub) {
    throw new Error("FAIL: Stripe subscription not found in DB.")
  }

  const expectedPeriodEnd = new Date()
  expectedPeriodEnd.setDate(expectedPeriodEnd.getDate() + 3)
  const diffTimeMs = Math.abs(stripeSub.currentPeriodEnd.getTime() - expectedPeriodEnd.getTime())
  
  if (stripeSub.plan !== PlanType.PRO || stripeSub.status !== "trialing" || diffTimeMs > 5000) {
    throw new Error(`FAIL: Stripe trial subscription state mismatch. Got: ${JSON.stringify(stripeSub)}`)
  }
  console.log(`- SUCCESS: Stripe 3-day trial registered. Expiration: ${stripeSub.currentPeriodEnd}`)

  // Delete stripe subscription for next test
  await db.subscription.delete({ where: { id: stripeSub.id } })

  // 4. Test UPI / QR Checkout Flow
  console.log("4. Testing UPI / QR Code billing flow...")
  const upiTxnId = "TXN_UPI_8899001122"
  const upiResponse = await processMockUpiPayment(PlanType.PRO, "monthly", upiTxnId)
  if (!upiResponse.success) {
    throw new Error(`FAIL: UPI mock payment confirmation failed: ${JSON.stringify(upiResponse)}`)
  }

  const upiSub = await db.subscription.findUnique({
    where: { stripeSubscriptionId: `sub_upi_${workspaceId}` }
  })
  if (!upiSub) {
    throw new Error("FAIL: UPI subscription not found in DB.")
  }

  const diffTimeUpiMs = Math.abs(upiSub.currentPeriodEnd.getTime() - expectedPeriodEnd.getTime())
  if (upiSub.plan !== PlanType.PRO || upiSub.status !== "trialing" || diffTimeUpiMs > 5000) {
    throw new Error(`FAIL: UPI subscription trial state mismatch. Got: ${JSON.stringify(upiSub)}`)
  }
  console.log(`- SUCCESS: UPI 3-day trial registered. Expiration: ${upiSub.currentPeriodEnd}`)

  // 5. Verify transaction is logged in ActivityLog
  console.log("5. Auditing activity logs for UPI transaction registration...")
  const log = await db.activityLog.findFirst({
    where: {
      workspaceId,
      action: "upi_payment_confirmed"
    }
  })

  if (!log || !log.details?.includes(upiTxnId)) {
    throw new Error(`FAIL: UPI activity log confirmation audit failed. Got: ${JSON.stringify(log)}`)
  }
  console.log(`- SUCCESS: Verified activity log audit record: "${log.details}"`)

  // Cleanup DB
  console.log("6. Cleaning up database seeding...")
  await db.workspace.delete({ where: { id: workspaceId } })
  await db.user.delete({ where: { email } })
  console.log("- DB Cleaned.")
  console.log("=== ALL BILLING INTEGRATION TESTS PASSED SUCCESSFULLY ===")
}

runBillingTests().catch((err) => {
  console.error("TEST RUN FAILED:", err)
  process.exit(1)
})
