import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { matchesKeyword } from "@/lib/fuzzy-match"
import { InstagramService } from "@/services/instagram"

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "instagram_dm_automation_webhook_verify_token"

// ─── Webhook Verification (GET) ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    console.log("[Webhook] Verification successful")
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

// ─── Webhook Events (POST) ─────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.object !== "instagram" && body.object !== "page") {
      return NextResponse.json({ status: "ignored" })
    }

    for (const entry of body.entry || []) {
      // ── DIRECT MESSAGE events ──
      for (const messagingEvent of entry.messaging || []) {
        await handleDmEvent(entry.id, messagingEvent)
      }

      // ── COMMENT events (via changes) ──
      for (const change of entry.changes || []) {
        if (change.field === "comments") {
          await handleCommentEvent(entry.id, change.value)
        }
        if (change.field === "story_insights") {
          await handleStoryEvent(entry.id, change.value)
        }
      }
    }

    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("[Webhook] POST error:", err)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}

// ─── Handle DM (Direct Message) ────────────────────────────────────────────
async function handleDmEvent(pageId: string, event: any) {
  if (!event.message || event.message.is_echo) return

  const senderId = event.sender?.id
  const messageText = event.message?.text || ""

  if (!senderId || !messageText) return

  try {
    const igAccount = await db.instagramAccount.findFirst({
      where: { pageId }
    })
    if (!igAccount) return

    // Find active automations for this workspace with DM triggers
    const automations = await db.automation.findMany({
      where: { workspaceId: igAccount.workspaceId, isActive: true },
      include: { rules: true },
      orderBy: { priority: "desc" }
    })

    let matched = false
    for (const automation of automations) {
      for (const rule of automation.rules) {
        if (
          rule.triggerType !== "KEYWORD" &&
          rule.triggerType !== "AI_FALLBACK"
        ) continue

        if (
          rule.triggerType === "KEYWORD" &&
          matchesKeyword(messageText, rule.triggerValue, rule.smartMatch)
        ) {
          // Follow-gate check
          if (rule.requireFollow) {
            const follows = await checkFollows(igAccount.instagramAccountId, senderId, igAccount.pageAccessToken || igAccount.accessToken)
            if (!follows) continue
          }

          await saveAndSendDm(igAccount, senderId, rule.replyText, automation.delaySeconds)
          matched = true
          break
        }
      }
      if (matched) break
    }

    // Save incoming message regardless of match
    await saveIncomingMessage(igAccount, senderId, messageText)
  } catch (err) {
    console.error("[handleDmEvent] Error:", err)
  }
}

// ─── Handle Comment Event ───────────────────────────────────────────────────
async function handleCommentEvent(pageId: string, commentData: any) {
  const commentText: string = commentData?.text || ""
  const commenterId: string = commentData?.from?.id || ""
  const postId: string = commentData?.media?.id || ""

  if (!commenterId || !postId) return

  try {
    const igAccount = await db.instagramAccount.findFirst({
      where: { pageId }
    })
    if (!igAccount) return

    const automations = await db.automation.findMany({
      where: { workspaceId: igAccount.workspaceId, isActive: true },
      include: { rules: true },
      orderBy: { priority: "desc" }
    })

    for (const automation of automations) {
      for (const rule of automation.rules) {
        if (
          rule.triggerType !== "COMMENT" &&
          rule.triggerType !== "ALL_COMMENTS"
        ) continue

        // Check post scope
        if (rule.postTriggerScope === "SPECIFIC_POST" && rule.postId && rule.postId !== postId) continue

        // For COMMENT type, check keyword match
        if (rule.triggerType === "COMMENT" && rule.triggerValue) {
          if (!matchesKeyword(commentText, rule.triggerValue, rule.smartMatch)) continue
        }

        // Follow-gate check
        if (rule.requireFollow) {
          const follows = await checkFollows(igAccount.instagramAccountId, commenterId, igAccount.pageAccessToken || igAccount.accessToken)
          if (!follows) continue
        }

        // Send DM to commenter
        await saveAndSendDm(igAccount, commenterId, rule.replyText, automation.delaySeconds)

        // Optional: reply to comment publicly
        if (rule.commentReply && igAccount.pageAccessToken) {
          try {
            await fetch(
              `https://graph.facebook.com/v19.0/${commentData.id}/replies?message=${encodeURIComponent(rule.commentReply)}&access_token=${igAccount.pageAccessToken}`,
              { method: "POST" }
            )
          } catch (err) {
            console.error("[handleCommentEvent] Public reply error:", err)
          }
        }

        break // One rule match per comment
      }
    }
  } catch (err) {
    console.error("[handleCommentEvent] Error:", err)
  }
}

// ─── Handle Story Reply/Mention ─────────────────────────────────────────────
async function handleStoryEvent(pageId: string, storyData: any) {
  const senderId: string = storyData?.sender?.id || ""
  const replyText: string = storyData?.message?.text || ""

  if (!senderId) return

  try {
    const igAccount = await db.instagramAccount.findFirst({
      where: { pageId }
    })
    if (!igAccount) return

    const automations = await db.automation.findMany({
      where: { workspaceId: igAccount.workspaceId, isActive: true },
      include: { rules: true },
      orderBy: { priority: "desc" }
    })

    for (const automation of automations) {
      for (const rule of automation.rules) {
        if (rule.triggerType !== "STORY_REPLY") continue
        await saveAndSendDm(igAccount, senderId, rule.replyText, automation.delaySeconds)
        break
      }
    }
  } catch (err) {
    console.error("[handleStoryEvent] Error:", err)
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function checkFollows(igAccountId: string, userId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/followers?user_id=${userId}&access_token=${token}`
    )
    const data = await res.json()
    return Array.isArray(data.data) && data.data.length > 0
  } catch {
    return false
  }
}

async function saveAndSendDm(igAccount: any, recipientId: string, replyText: string, delaySeconds: number = 0) {
  if (delaySeconds > 0) {
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
  }

  // Save or get contact
  let contact = await db.contact.findUnique({
    where: {
      instagramAccountId_instagramUserId: {
        instagramAccountId: igAccount.id,
        instagramUserId: recipientId
      }
    }
  })

  if (!contact) {
    contact = await db.contact.create({
      data: {
        instagramAccountId: igAccount.id,
        instagramUserId: recipientId,
        username: `ig_user_${recipientId.slice(-6)}`,
      }
    })
  }

  // Save or get conversation
  let conversation = await db.conversation.findFirst({
    where: { instagramAccountId: igAccount.id, contactId: contact.id }
  })

  if (!conversation) {
    conversation = await db.conversation.create({
      data: { instagramAccountId: igAccount.id, contactId: contact.id }
    })
  }

  // Send DM via Meta API
  if (igAccount.pageAccessToken) {
    try {
      await fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${igAccount.pageAccessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text: replyText }
          })
        }
      )
    } catch (err) {
      console.error("[saveAndSendDm] Meta API error:", err)
    }
  }

  // Save reply message in DB
  await db.message.create({
    data: {
      conversationId: conversation.id,
      senderId: igAccount.instagramAccountId,
      senderType: "USER",
      text: replyText,
    }
  })

  // Update contact last message timestamp
  await db.contact.update({
    where: { id: contact.id },
    data: { lastMessageAt: new Date() }
  })
}

async function saveIncomingMessage(igAccount: any, senderId: string, text: string) {
  try {
    let contact = await db.contact.findUnique({
      where: {
        instagramAccountId_instagramUserId: {
          instagramAccountId: igAccount.id,
          instagramUserId: senderId
        }
      }
    })

    if (!contact) {
      contact = await db.contact.create({
        data: {
          instagramAccountId: igAccount.id,
          instagramUserId: senderId,
          username: `ig_user_${senderId.slice(-6)}`,
        }
      })
    }

    let conversation = await db.conversation.findFirst({
      where: { instagramAccountId: igAccount.id, contactId: contact.id }
    })

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { instagramAccountId: igAccount.id, contactId: contact.id }
      })
    }

    await db.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        senderType: "INSTAGRAM_USER",
        text,
      }
    })

    await db.contact.update({
      where: { id: contact.id },
      data: { lastMessageAt: new Date() }
    })
  } catch (err) {
    console.error("[saveIncomingMessage] Error:", err)
  }
}
