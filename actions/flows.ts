"use server"

import { db } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

async function getSessionWorkspace() {
  const session = await auth()
  if (!session?.user?.id || !(session as any).user.workspaceId) {
    throw new Error("Unauthorized")
  }
  return {
    userId: session.user.id,
    workspaceId: (session as any).user.workspaceId as string,
  }
}

export async function getFlows() {
  try {
    const { workspaceId } = await getSessionWorkspace()
    return await db.conversationFlow.findMany({
      where: { workspaceId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    })
  } catch { return [] }
}

export async function createFlow(data: { name: string }) {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const flow = await db.conversationFlow.create({
      data: { workspaceId, name: data.name }
    })
    try { revalidatePath("/flows") } catch {}
    return { success: true, flow }
  } catch (e: any) {
    return { error: e.message || "Failed to create flow" }
  }
}

export async function toggleFlow(id: string, isActive: boolean) {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const flow = await db.conversationFlow.findUnique({ where: { id } })
    if (!flow || flow.workspaceId !== workspaceId) return { error: "Unauthorized" }
    await db.conversationFlow.update({ where: { id }, data: { isActive } })
    try { revalidatePath("/flows") } catch {}
    return { success: true }
  } catch { return { error: "Failed to update flow" } }
}

export async function deleteFlow(id: string) {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const flow = await db.conversationFlow.findUnique({ where: { id } })
    if (!flow || flow.workspaceId !== workspaceId) return { error: "Unauthorized" }
    await db.conversationFlow.delete({ where: { id } })
    try { revalidatePath("/flows") } catch {}
    return { success: true }
  } catch { return { error: "Failed to delete flow" } }
}

export async function addFlowStep(data: {
  flowId: string
  stepOrder: number
  message: string
  waitForReply: boolean
  matchValue?: string
}) {
  try {
    const { workspaceId } = await getSessionWorkspace()
    const flow = await db.conversationFlow.findUnique({ where: { id: data.flowId } })
    if (!flow || flow.workspaceId !== workspaceId) return { error: "Unauthorized" }
    const step = await db.flowStep.create({
      data: {
        flowId: data.flowId,
        stepOrder: data.stepOrder,
        message: data.message,
        waitForReply: data.waitForReply,
        matchValue: data.matchValue || null,
      }
    })
    try { revalidatePath("/flows") } catch {}
    return { success: true, step }
  } catch { return { error: "Failed to add step" } }
}

export async function deleteFlowStep(id: string) {
  try {
    await getSessionWorkspace()
    await db.flowStep.delete({ where: { id } })
    try { revalidatePath("/flows") } catch {}
    return { success: true }
  } catch { return { error: "Failed to delete step" } }
}
