import { POST as processWebhook } from "../app/api/webhooks/instagram/route"
import { db } from "../lib/prisma"
import { TriggerType, PlanType, Role } from "@prisma/client"

async function runTest() {
  console.log("=== STARTING INTEGRATION AUTOMATION TEST ===")

  // 1. Setup Test Workspace & User
  console.log("1. Setting up mock user & workspace...")
  const email = "tester@domain.com"
  
  // Clean up previous runs
  const existingUser = await db.user.findUnique({ where: { email } })
  if (existingUser) {
    const members = await db.teamMember.findMany({
      where: { userId: existingUser.id }
    })
    for (const member of members) {
      await db.workspace.delete({ where: { id: member.workspaceId } }).catch(() => {})
    }
    await db.user.delete({ where: { email } }).catch(() => {})
  }
  // Explicitly remove subscription and workspace with test IDs in case they are orphaned
  await db.subscription.deleteMany({ where: { stripeSubscriptionId: "sub_test_123" } })
  await db.workspace.deleteMany({ where: { name: "Test automation workspace" } })


  const user = await db.user.create({
    data: {
      name: "Test Engineer",
      email,
      password: "mock_password_hash",
      teamMembers: {
        create: {
          role: Role.OWNER,
          workspace: {
            create: {
              name: "Test automation workspace",
              subscriptions: {
                create: {
                  stripeSubscriptionId: "sub_test_123",
                  stripeCustomerId: "cust_test_123",
                  plan: PlanType.FREE,
                  status: "active",
                  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
              }
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
  console.log(`- Created user: ${user.name}`)
  console.log(`- Created workspace: ${workspace.name} (${workspace.id})`)

  // 2. Connect mock Instagram account
  console.log("2. Mock connecting Instagram business account...")
  const igAccountId = "ig_acc_test_999"
  const igAccount = await db.instagramAccount.create({
    data: {
      workspaceId: workspace.id,
      instagramAccountId: igAccountId,
      username: "sandbox_test_insta",
      displayName: "Mock Testing Insta",
      accessToken: "test_token_abc"
    }
  })
  console.log(`- Connected account: @${igAccount.username}`)

  // 3. Create Keyword Automation Rule
  console.log("3. Creating keyword automation trigger rule...")
  const automation = await db.automation.create({
    data: {
      workspaceId: workspace.id,
      name: "Pricing Rule Test",
      isActive: true,
      priority: 10,
      rules: {
        create: {
          triggerType: TriggerType.KEYWORD,
          triggerValue: "price, cost, rate",
          replyText: "Test Reply: Pricing starts at $29/mo."
        }
      }
    },
    include: { rules: true }
  })
  console.log(`- Created rule: "${automation.name}" targeting keywords: "${automation.rules[0].triggerValue}"`)

  // 4. Simulate Inbound DM Webhook Request
  console.log("4. Dispatching simulated customer inbound webhook...")
  const webhookPayload = {
    object: "instagram",
    entry: [
      {
        id: igAccountId,
        time: Date.now(),
        messaging: [
          {
            sender: { id: "customer_tester_99" },
            recipient: { id: igAccountId },
            timestamp: Date.now(),
            message: {
              mid: "mid.test_customer_inbound_message_1",
              text: "Hi, how much does the product cost?"
            }
          }
        ]
      }
    ]
  }

  const mockRequest = new Request("http://localhost/api/webhooks/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload)
  })

  // Run the webhook handler
  const response = await processWebhook(mockRequest)
  const result = await response.json()
  console.log("- Webhook processor returned status:", result.status)

  // 5. Verify database updates
  console.log("5. Auditing database state verification...")
  
  // Find conversation
  const contact = await db.contact.findUnique({
    where: {
      instagramAccountId_instagramUserId: {
        instagramAccountId: igAccount.id,
        instagramUserId: "customer_tester_99"
      }
    }
  })

  if (!contact) {
    throw new Error("FAIL: Contact was not created in database.")
  }
  console.log(`- SUCCESS: Contact "${contact.username}" was created successfully.`)

  const conversation = await db.conversation.findFirst({
    where: {
      instagramAccountId: igAccount.id,
      contactId: contact.id
    },
    include: { messages: true }
  })

  if (!conversation) {
    throw new Error("FAIL: Conversation record not created.")
  }
  console.log(`- SUCCESS: Conversation created, containing ${conversation.messages.length} messages.`)

  // Verify inbound and outbound message texts
  const inboundMsg = conversation.messages.find(m => m.senderType === "INSTAGRAM_USER")
  const outboundMsg = conversation.messages.find(m => m.senderType === "USER")

  if (!inboundMsg || inboundMsg.text !== "Hi, how much does the product cost?") {
    throw new Error("FAIL: Inbound message mismatch or missing.")
  }
  console.log("- SUCCESS: Inbound message verified in logs.")

  if (!outboundMsg || outboundMsg.text !== "Test Reply: Pricing starts at $29/mo.") {
    throw new Error("FAIL: Outbound automated reply mismatch or not sent.")
  }
  console.log("- SUCCESS: Outbound automation reply matched and verified in logs.")

  // Clean up
  console.log("6. Cleaning up database seeding...")
  await db.user.delete({ where: { email } })
  console.log("- DB Cleaned.")
  console.log("=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===")
}

runTest().catch((err) => {
  console.error("TEST RUN FAILED:", err)
  process.exit(1)
})
