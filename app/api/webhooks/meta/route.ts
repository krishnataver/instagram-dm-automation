import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "instagram_dm_automation_webhook_verify_token"

// ─── Webhook Verification ───────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (
    searchParams.get("hub.mode") === "subscribe" &&
    searchParams.get("hub.verify_token") === META_VERIFY_TOKEN
  ) {
    return new NextResponse(searchParams.get("hub.challenge"), { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

// ─── Webhook Events ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.object !== "instagram" && body.object !== "page") {
      return NextResponse.json({ status: "ignored" })
    }

    for (const entry of body.entry || []) {
      // DM messages
      for (const event of entry.messaging || []) {
        if (!event.message?.is_echo) await handleDM(entry.id, event)
      }
      // Comment & Story via changes
      for (const change of entry.changes || []) {
        if (change.field === "comments") await handleComment(entry.id, change.value)
        if (change.field === "feed" && change.value?.item === "status") continue
        if (change.field === "messages") await handleDM(entry.id, change.value)
      }
    }
    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("[Webhook] Error:", err)
    return NextResponse.json({ status: "error" }, { status: 500 })
  }
}

// ─── Fuzzy match inline (no import needed) ──────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 0; j <= a.length; j++) m[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1)
    }
  }
  return m[b.length][a.length]
}

function smartMatch(message: string, keyword: string): boolean {
  const msg = message.toLowerCase().trim()
  const kw = keyword.toLowerCase().trim()
  if (msg.includes(kw)) return true
  for (const word of msg.split(/\s+/)) {
    if (Math.abs(word.length - kw.length) <= 3) {
      const maxLen = Math.max(word.length, kw.length)
      if (maxLen > 0 && 1 - levenshtein(word, kw) / maxLen >= 0.8) return true
    }
  }
  return false
}

// ─── Handle DM ──────────────────────────────────────────────────────────────
async function handleDM(pageId: string, event: any) {
  const senderId: string = event.sender?.id || event.from?.id || ""
  const text: string = event.message?.text || event.text || ""
  if (!senderId || !text) return

  const igAccount = await db.instagramAccount.findFirst({ where: { pageId } })
  if (!igAccount) return

  const automations = await db.automation.findMany({
    where: { workspaceId: igAccount.workspaceId, isActive: true },
    include: { rules: true },
    orderBy: { priority: "desc" }
  })

  let replied = false
  for (const auto of automations) {
    if (replied) break
    for (const rule of auto.rules) {
      if (rule.triggerType !== "KEYWORD" && rule.triggerType !== "AI_FALLBACK") continue
      if (rule.triggerType === "KEYWORD") {
        const matched = rule.smartMatch
          ? smartMatch(text, rule.triggerValue)
          : text.toLowerCase().includes(rule.triggerValue.toLowerCase())
        if (!matched) continue
      }
      if (rule.requireFollow && igAccount.pageAccessToken) {
        const follows = await checkFollows(igAccount.instagramAccountId, senderId, igAccount.pageAccessToken)
        if (!follows) continue
      }
      await sendDM(igAccount, senderId, rule.replyText, auto.delaySeconds)
      replied = true
      break
    }
  }
  await saveMessage(igAccount, senderId, text, "INSTAGRAM_USER")
}

// ─── Handle Comment ─────────────────────────────────────────────────────────
async function handleComment(pageId: string, data: any) {
  const commenterId: string = data?.from?.id || ""
  const commentText: string = data?.message || data?.text || ""
  const mediaId: string = data?.media?.id || data?.post_id || ""
  if (!commenterId) return

  const igAccount = await db.instagramAccount.findFirst({ where: { pageId } })
  if (!igAccount) return

  const automations = await db.automation.findMany({
    where: { workspaceId: igAccount.workspaceId, isActive: true },
    include: { rules: true },
    orderBy: { priority: "desc" }
  })

  for (const auto of automations) {
    for (const rule of auto.rules) {
      if (rule.triggerType !== "COMMENT" && rule.triggerType !== "ALL_COMMENTS") continue
      if (rule.postTriggerScope === "SPECIFIC_POST" && rule.postId && rule.postId !== mediaId) continue
      if (rule.triggerType === "COMMENT" && rule.triggerValue) {
        if (!smartMatch(commentText, rule.triggerValue)) continue
      }
      if (rule.requireFollow && igAccount.pageAccessToken) {
        const follows = await checkFollows(igAccount.instagramAccountId, commenterId, igAccount.pageAccessToken)
        if (!follows) continue
      }
      await sendDM(igAccount, commenterId, rule.replyText, auto.delaySeconds)
      // Public comment reply
      if (rule.commentReply && igAccount.pageAccessToken && data?.id) {
        try {
          await fetch(
            `https://graph.facebook.com/v19.0/${data.id}/replies?message=${encodeURIComponent(rule.commentReply)}&access_token=${igAccount.pageAccessToken}`,
            { method: "POST" }
          )
        } catch (e) { console.error("[Comment Reply]", e) }
      }
      break
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
async function checkFollows(igId: string, userId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${igId}/followers?user_id=${userId}&access_token=${token}`)
    const data = await res.json()
    return Array.isArray(data.data) && data.data.length > 0
  } catch { return false }
}

async function sendDM(igAccount: any, recipientId: string, text: string, delay = 0) {
  if (delay > 0) await new Promise(r => setTimeout(r, delay * 1000))
  if (igAccount.pageAccessToken) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${igAccount.pageAccessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text } })
      })
    } catch (e) { console.error("[sendDM]", e) }
  }
  await saveMessage(igAccount, recipientId, text, "USER")
}

async function saveMessage(igAccount: any, userId: string, text: string, senderType: "USER" | "INSTAGRAM_USER") {
  try {
    let contact = await db.contact.findUnique({
      where: { instagramAccountId_instagramUserId: { instagramAccountId: igAccount.id, instagramUserId: userId } }
    })
    if (!contact) {
      contact = await db.contact.create({
        data: { instagramAccountId: igAccount.id, instagramUserId: userId, username: `user_${userId.slice(-6)}` }
      })
    }
    let conv = await db.conversation.findFirst({ where: { instagramAccountId: igAccount.id, contactId: contact.id } })
    if (!conv) {
      conv = await db.conversation.create({ data: { instagramAccountId: igAccount.id, contactId: contact.id } })
    }
    await db.message.create({
      data: { conversationId: conv.id, senderId: senderType === "USER" ? igAccount.instagramAccountId : userId, senderType, text }
    })
    await db.contact.update({ where: { id: contact.id }, data: { lastMessageAt: new Date() } })
  } catch (e) { console.error("[saveMessage]", e) }
}
