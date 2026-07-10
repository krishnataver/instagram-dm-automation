"use server"

import { db } from "@/lib/prisma"
import { auth } from "@/auth"
import { TriggerType } from "@prisma/client"
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
 * Fetch all automations for active workspace
 */
export async function getAutomations() {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const automations = await db.automation.findMany({
      where: { workspaceId },
      include: { rules: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
    })
    return automations
  } catch (error) {
    console.error("Error fetching automations:", error)
    return []
  }
}

/**
 * Creates a new keyword automation container
 */
export async function createAutomation(data: { name: string; delaySeconds: number; priority: number }) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const automation = await db.automation.create({
      data: {
        workspaceId,
        name: data.name,
        delaySeconds: data.delaySeconds,
        priority: data.priority,
      }
    })

    revalidatePath("/automations")
    return { success: true, automation }
  } catch (error) {
    return { error: "Failed to create automation" }
  }
}

/**
 * Update general automation attributes (status, name, priority)
 */
export async function updateAutomation(
  id: string,
  updates: { name?: string; isActive?: boolean; delaySeconds?: number; priority?: number }
) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    // Validate ownership
    const existing = await db.automation.findUnique({
      where: { id }
    })

    if (!existing || existing.workspaceId !== workspaceId) {
      return { error: "Automation rule not found" }
    }

    const updated = await db.automation.update({
      where: { id },
      data: updates
    })

    revalidatePath("/automations")
    return { success: true, automation: updated }
  } catch (error) {
    return { error: "Failed to update automation" }
  }
}

/**
 * Delete automation block and cascade its rules
 */
export async function deleteAutomation(id: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const existing = await db.automation.findUnique({
      where: { id }
    })

    if (!existing || existing.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    await db.automation.delete({
      where: { id }
    })

    revalidatePath("/automations")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete automation" }
  }
}

/**
 * Creates a trigger action rule linked to an automation block
 */
export async function addAutomationRule(data: {
  automationId: string
  triggerType: TriggerType
  triggerValue: string
  replyText: string
}) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    // Validate automation belongs to workspace
    const automation = await db.automation.findUnique({
      where: { id: data.automationId }
    })

    if (!automation || automation.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    const rule = await db.automationRule.create({
      data: {
        automationId: data.automationId,
        triggerType: data.triggerType,
        triggerValue: data.triggerValue,
        replyText: data.replyText,
      }
    })

    revalidatePath("/automations")
    return { success: true, rule }
  } catch (error) {
    return { error: "Failed to add automation rule" }
  }
}

/**
 * Edit rule triggers and answers
 */
export async function updateAutomationRule(
  ruleId: string,
  updates: { triggerValue?: string; replyText?: string }
) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const rule = await db.automationRule.findUnique({
      where: { id: ruleId },
      include: { automation: true }
    })

    if (!rule || rule.automation.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    const updated = await db.automationRule.update({
      where: { id: ruleId },
      data: updates
    })

    revalidatePath("/automations")
    return { success: true, rule: updated }
  } catch (error) {
    return { error: "Failed to update rule" }
  }
}

/**
 * Delete rule from block
 */
export async function deleteAutomationRule(ruleId: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()

    const rule = await db.automationRule.findUnique({
      where: { id: ruleId },
      include: { automation: true }
    })

    if (!rule || rule.automation.workspaceId !== workspaceId) {
      return { error: "Unauthorized" }
    }

    await db.automationRule.delete({
      where: { id: ruleId }
    })

    revalidatePath("/automations")
    return { success: true }
  } catch (error) {
    return { error: "Failed to delete rule" }
  }
}
