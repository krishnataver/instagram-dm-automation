"use server"

import { InstagramService } from "@/services/instagram"
import { revalidatePath } from "next/cache"

export async function connectInstagramAccount(workspaceId: string, pageAccessToken: string, pageId: string) {
  try {
    const account = await InstagramService.connectAccount(workspaceId, pageAccessToken, pageId)
    try {
      revalidatePath("/settings")
    } catch {
      // revalidatePath may fail outside of a Next.js request context — safe to ignore
    }
    return { success: true, account }
  } catch (error: any) {
    return { error: error.message || "Failed to connect Instagram account" }
  }
}
