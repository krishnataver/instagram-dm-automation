import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.user?.workspaceId

    if (!workspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accounts = await db.instagramAccount.findMany({
      where: { workspaceId },
      select: {
        id: true,
        username: true,
        displayName: true,
        instagramAccountId: true
      }
    })

    return NextResponse.json(accounts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch accounts" }, { status: 500 })
  }
}
