import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { InstagramService } from "@/services/instagram"
import { OpenAiService } from "@/services/openai"
import { SenderType, TriggerType, ConversationStatus } from "@prisma/client"

/**
 * GET - Webhook Handshake Verification (Meta Graph API)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.META_VERIFY_TOKEN || "instagram_dm_automation_webhook_verify_token"

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[INSTAGRAM WEBHOOK] Handshake verified successfully.")
    return new Response(challenge, { status: 200 })
  }

  console.warn("[INSTAGRAM WEBHOOK] Handshake verification failed. Token mismatch.")
  return new Response("Forbidden", { status: 403 })
}

/**
 * POST - Processes Incoming Instagram Webhook Events (DMs)
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json()
    console.log("[INSTAGRAM WEBHOOK] Incoming payload:", JSON.stringify(payload, null, 2))

    // Ensure it's an Instagram object webhook
    if (payload.object !== "instagram") {
      return NextResponse.json({ status: "ignored", reason: "not_instagram_object" }, { status: 200 })
    }

    const entries = payload.entry || []

    for (const entry of entries) {
      const igAccountId = entry.id // Connected IG Business Account ID
      const messaging = entry.messaging || []

      // 1. Find the connected Instagram account in database
      const instagramAccount = await db.instagramAccount.findUnique({
        where: { instagramAccountId: igAccountId },
        include: { workspace: true }
      })

      if (!instagramAccount) {
        console.warn(`[INSTAGRAM WEBHOOK] Connected account not found for IG Account ID: ${igAccountId}`)
        continue
      }

      for (const messageEvent of messaging) {
        const senderId = messageEvent.sender?.id // Customer's Instagram Scoped ID
        const recipientId = messageEvent.recipient?.id // Business's ID
        const message = messageEvent.message

        // Skip echos (messages sent by the business page itself)
        if (message?.is_echo) {
          console.log("[INSTAGRAM WEBHOOK] Skipping echo message.")
          continue
        }

        if (!message || !message.text) {
          console.log("[INSTAGRAM WEBHOOK] Received non-text message event. Ignoring.")
          continue
        }

        const messageText = message.text
        const attachments = message.attachments || null

        // 2. Create or Find Contact
        let contact = await db.contact.findUnique({
          where: {
            instagramAccountId_instagramUserId: {
              instagramAccountId: instagramAccount.id,
              instagramUserId: senderId,
            }
          }
        })

        if (!contact) {
          // Fetch profile details via API or mock
          const profile = await InstagramService.fetchContactProfile(igAccountId, senderId)
          
          contact = await db.contact.create({
            data: {
              instagramAccountId: instagramAccount.id,
              instagramUserId: senderId,
              username: profile.username,
              name: profile.name,
              labels: ["new"],
            }
          })
        } else {
          // Update contact last active
          contact = await db.contact.update({
            where: { id: contact.id },
            data: { lastMessageAt: new Date() }
          })
        }

        // 3. Create or Find Conversation
        let conversation = await db.conversation.findFirst({
          where: {
            instagramAccountId: instagramAccount.id,
            contactId: contact.id,
          }
        })

        if (!conversation) {
          conversation = await db.conversation.create({
            data: {
              instagramAccountId: instagramAccount.id,
              contactId: contact.id,
              status: ConversationStatus.OPEN,
            }
          })
        } else if (conversation.status === ConversationStatus.RESOLVED) {
          // Re-open conversation on new inbound message
          conversation = await db.conversation.update({
            where: { id: conversation.id },
            data: { status: ConversationStatus.OPEN }
          })
        }

        // 4. Save Inbound Message in DB
        await db.message.create({
          data: {
            conversationId: conversation.id,
            senderId,
            senderType: SenderType.INSTAGRAM_USER,
            text: messageText,
            attachments: (attachments ? JSON.stringify(attachments) : null) as any,
          }
        })

        // 5. Check if Automations match incoming text
        const automations = await db.automation.findMany({
          where: {
            workspaceId: instagramAccount.workspaceId,
            isActive: true
          },
          include: { rules: true },
          orderBy: { priority: "desc" }
        })

        let matchedAutomation = false
        let replyText = ""
        let delaySeconds = 0

        for (const auto of automations) {
          // Check keyword rule
          const keywordRule = auto.rules.find(r => r.triggerType === TriggerType.KEYWORD)
          if (keywordRule) {
            const triggerKeywords = keywordRule.triggerValue
              .split(",")
              .map(kw => kw.trim().toLowerCase())
            
            const matchesKeyword = triggerKeywords.some(kw => 
              messageText.toLowerCase().includes(kw)
            )

            if (matchesKeyword) {
              matchedAutomation = true
              replyText = keywordRule.replyText
              delaySeconds = auto.delaySeconds
              
              await db.activityLog.create({
                data: {
                  workspaceId: instagramAccount.workspaceId,
                  action: "automation_triggered",
                  details: `Automation "${auto.name}" matched keyword trigger for contact "${contact.username}".`
                }
              })
              break // Higher priority matches first, so stop searching
            }
          }
        }

        // 6. Handle automation reply or fallback to AI Assistant
        if (matchedAutomation && replyText) {
          if (delaySeconds > 0) {
            // In a production app, we would defer this with a queue (e.g. BullMQ / Redis)
            // Here, we simulate/dispatch the delayed message.
            console.log(`[INSTAGRAM WEBHOOK] Delaying reply for ${delaySeconds}s...`)
          }
          
          await InstagramService.sendMessage(igAccountId, senderId, replyText)
        } else {
          // Check if AI prompt is active for this workspace
          const activePrompt = await db.aiPrompt.findFirst({
            where: { workspaceId: instagramAccount.workspaceId, isActive: true }
          })

          if (activePrompt) {
            // Retrieve recent message history (last 8 messages) for AI context
            const pastMessages = await db.message.findMany({
              where: { conversationId: conversation.id },
              orderBy: { createdAt: "desc" },
              take: 8
            })

            const history = pastMessages
              .reverse()
              .map(msg => ({
                role: msg.senderType === SenderType.INSTAGRAM_USER ? ("user" as const) : ("assistant" as const),
                content: msg.text
              }))

            // Generate AI Response
            const aiReply = await OpenAiService.generateAiReply(instagramAccount.workspaceId, messageText, history)
            
            if (aiReply) {
              await InstagramService.sendMessage(igAccountId, senderId, aiReply)
              
              await db.activityLog.create({
                data: {
                  workspaceId: instagramAccount.workspaceId,
                  action: "ai_reply_triggered",
                  details: `AI response sent to contact "${contact.username}".`
                }
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "success" }, { status: 200 })
  } catch (error) {
    console.error("[INSTAGRAM WEBHOOK] Error processing event:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
