import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const userCount = await db.user.count()
    return NextResponse.json({
      status: "ok",
      database: "connected",
      userCount,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET || !!process.env.AUTH_SECRET,
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        sandboxMode: process.env.NEXT_PUBLIC_SANDBOX_MODE,
        nodeEnv: process.env.NODE_ENV,
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      database: "disconnected",
      error: error?.message || "Unknown error",
      code: error?.code,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET || !!process.env.AUTH_SECRET,
        nodeEnv: process.env.NODE_ENV,
      }
    }, { status: 500 })
  }
}
