"use server"

import { db } from "@/lib/prisma"
import { auth } from "@/auth"
import { InstagramService } from "@/services/instagram"
import { SenderType, ConversationStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

/**
 * Helper to fetch session user and their active workspace
 */
async function getSessionWorkspace() {
  const session = await auth()
  if (!session?.user?.id || !(session as any).user.workspaceId) {
    throw new Error("Unauthorized access. No session workspace found.")
  }
  return {
    userId: session.user.id,
    workspaceId: (session as any).user.workspaceId as string,
    role: (session as any).user.role as string,
  }
}

/**
 * Fetches conversations matching active filters
 */
export async function getConversations(filters?: {
  status?: ConversationStatus
  starred?: boolean
  archived?: boolean
  search?: string
}) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    // 1. Get Instagram account IDs associated with workspace
    const accounts = await db.instagramAccount.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true }
    })

    const accountIds = accounts.map(a => a.id)
    if (accountIds.length === 0) return []

    // 2. Build Query Filters
    const where: any = {
      instagramAccountId: { in: accountIds }
    }

    if (filters?.status) {
      where.status = filters.status
    }
    
    if (filters?.starred !== undefined) {
      where.isStarred = filters.starred
    }

    if (filters?.archived !== undefined) {
      where.isArchived = filters.archived
    } else {
      where.isArchived = false // Default to showing unarchived only
    }

    if (filters?.search) {
      where.contact = {
        OR: [
          { username: { contains: filters.search, mode: "insensitive" } },
          { name: { contains: filters.search, mode: "insensitive" } },
        ]
      }
    }

    const conversations = await db.conversation.findMany({
      where,
      include: {
        contact: true,
        instagramAccount: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    })

    return conversations
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return []
  }
}

/**
 * Fetches full message log for a single conversation
 */
export async function getConversationMessages(conversationId: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    // Validate ownership
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { instagramAccount: true }
    })

    if (!conversation || conversation.instagramAccount.workspaceId !== workspaceId) {
      throw new Error("Conversation not found or unauthorized.")
    }

    const messages = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" }
    })

    return messages
  } catch (error) {
    console.error("Error fetching conversation messages:", error)
    return []
  }
}

/**
 * Sends a message to a customer and updates local database
 */
export async function sendDirectMessage(conversationId: string, text: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    // Fetch conversation and accounts details
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        instagramAccount: true,
        contact: true,
      }
    })

    if (!conversation || conversation.instagramAccount.workspaceId !== workspaceId) {
      return { error: "Conversation not found" }
    }

    const igAccount = conversation.instagramAccount
    const contact = conversation.contact

    // Send through API
    await InstagramService.sendMessage(
      igAccount.instagramAccountId,
      contact.instagramUserId,
      text
    )

    // Update conversation timestamp
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    })

    revalidatePath("/inbox")
    return { success: true }
  } catch (error: any) {
    console.error("Error in sendDirectMessage Action:", error)
    return { error: error.message || "Failed to send message" }
  }
}

/**
 * Toggle conversation star status
 */
export async function toggleStarConversation(conversationId: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { instagramAccount: true }
    })

    if (!conversation || conversation.instagramAccount.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    const updated = await db.conversation.update({
      where: { id: conversationId },
      data: { isStarred: !conversation.isStarred }
    })

    return { success: true, isStarred: updated.isStarred }
  } catch (error) {
    return { error: "Failed to star conversation" }
  }
}

/**
 * Toggle conversation archive status
 */
export async function toggleArchiveConversation(conversationId: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { instagramAccount: true }
    })

    if (!conversation || conversation.instagramAccount.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    const updated = await db.conversation.update({
      where: { id: conversationId },
      data: { isArchived: !conversation.isArchived }
    })

    return { success: true, isArchived: updated.isArchived }
  } catch (error) {
    return { error: "Failed to archive conversation" }
  }
}

/**
 * Update conversation status
 */
export async function changeConversationStatus(conversationId: string, status: ConversationStatus) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { instagramAccount: true }
    })

    if (!conversation || conversation.instagramAccount.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    await db.conversation.update({
      where: { id: conversationId },
      data: { status }
    })

    return { success: true }
  } catch (error) {
    return { error: "Failed to change status" }
  }
}

/**
 * Update contact attributes (labels, name, notes)
 */
export async function updateContactDetails(
  contactId: string,
  updates: { name?: string; notes?: string; labels?: string[] }
) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const contact = await db.contact.findUnique({
      where: { id: contactId },
      include: { instagramAccount: true }
    })

    if (!contact || contact.instagramAccount.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    await db.contact.update({
      where: { id: contactId },
      data: {
        name: updates.name !== undefined ? updates.name : contact.name,
        notes: updates.notes !== undefined ? updates.notes : contact.notes,
        labels: (updates.labels !== undefined ? updates.labels : contact.labels) as any,
      }
    })

    return { success: true }
  } catch (error) {
    return { error: "Failed to update contact" }
  }
}

/**
 * Assign conversation to agent
 */
export async function assignConversation(conversationId: string, assignedToId: string | null) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: { instagramAccount: true }
    })

    if (!conversation || conversation.instagramAccount.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    if (assignedToId) {
      // Validate that target user belongs to this workspace
      const member = await db.teamMember.findFirst({
        where: { workspaceId, userId: assignedToId }
      })
      if (!member) return { error: "Target agent is not a member of this workspace" }
    }

    await db.conversation.update({
      where: { id: conversationId },
      data: { assignedToId }
    })

    return { success: true }
  } catch (error) {
    return { error: "Failed to assign conversation" }
  }
}

/**
 * Fetch all team members in the active workspace
 */
export async function getTeamMembers() {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const members = await db.teamMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    })

    return members.map(m => ({
      id: m.user.id,
      name: m.user.name || "Agent",
      email: m.user.email,
      role: m.role,
      image: m.user.image,
    }))
  } catch (error) {
    console.error("Error fetching workspace team members:", error)
    return []
  }
}
