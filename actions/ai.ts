"use server"

import { db } from "@/lib/prisma"
import { auth } from "@/auth"
import { OpenAiService } from "@/services/openai"
import { revalidatePath } from "next/cache"

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
 * Fetch the workspace AI prompt configuration
 */
export async function getAiPrompt() {
  try {
    const { workspaceId } = await getSessionWorkspace()
    let prompt = await db.aiPrompt.findFirst({
      where: { workspaceId }
    })

    if (!prompt) {
      // Lazy create one if it doesn't exist
      prompt = await db.aiPrompt.create({
        data: {
          workspaceId,
          name: "Default Assistant",
          promptText: "You are an AI support agent for our Instagram store. Help users politely and answer questions concisely.",
          tone: "helpful",
          isActive: true
        }
      })
    }

    return prompt
  } catch (error) {
    console.error("Error fetching AI prompt:", error)
    return null
  }
}

/**
 * Edit AI prompt settings (tone, knowledge details)
 */
export async function updateAiPrompt(updates: {
  promptText?: string
  tone?: string
  isActive?: boolean
}) {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const prompt = await db.aiPrompt.findFirst({
      where: { workspaceId }
    })

    if (!prompt) {
      const newPrompt = await db.aiPrompt.create({
        data: {
          workspaceId,
          name: "Default Assistant",
          promptText: updates.promptText || "",
          tone: updates.tone || "helpful",
          isActive: updates.isActive ?? true
        }
      })
      revalidatePath("/settings")
      return { success: true, prompt: newPrompt }
    }

    const updated = await db.aiPrompt.update({
      where: { id: prompt.id },
      data: updates
    })

    revalidatePath("/settings")
    return { success: true, prompt: updated }
  } catch (error) {
    return { error: "Failed to update AI configuration" }
  }
}

/**
 * Rewrite message action (for live agents drafting replies)
 */
export async function rewriteMessage(text: string, tone: string) {
  try {
    await getSessionWorkspace() // Validate auth
    const rewritten = await OpenAiService.rewriteResponse(text, tone)
    return { success: true, rewritten }
  } catch (error: any) {
    return { error: error.message || "Failed to rewrite message" }
  }
}

/**
 * Generates an summary for conversation logs
 */
export async function summarizeConversationLog(conversationId: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { instagramAccount: true }
    })

    if (!conversation || conversation.instagramAccount.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    // Retrieve last 15 messages
    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 15
    })

    if (messages.length === 0) {
      return { summary: "No message logs found." }
    }

    const formattedMessages = messages.reverse().map(m => ({
      sender: m.senderType,
      text: m.text
    }))

    const summary = await OpenAiService.summarizeConversation(formattedMessages)
    return { success: true, summary }
  } catch (error: any) {
    return { error: error.message || "Failed to generate conversation summary" }
  }
}
