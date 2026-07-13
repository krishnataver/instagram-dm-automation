import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const workspaceId = (session as any).user.workspaceId
  if (!workspaceId) {
    return NextResponse.redirect(new URL("/settings?error=no_workspace", request.url))
  }

  const META_APP_ID = process.env.META_APP_ID
  if (!META_APP_ID) {
    return NextResponse.redirect(new URL("/settings?error=meta_not_configured", request.url))
  }

  // Auto-detect production URL
  const host = request.headers.get("host") || "localhost:3000"
  const proto = host.includes("localhost") ? "http" : "https"
  const appUrl = process.env.NEXTAUTH_URL || `${proto}://${host}`
  const redirectUri = `${appUrl}/api/auth/instagram/callback`

  // Required permissions for Instagram DM automation
  const scopes = [
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_comments",
    "pages_show_list",
    "pages_manage_metadata",
    "pages_read_engagement",
    "business_management",
  ].join(",")

  const state = Buffer.from(JSON.stringify({ workspaceId })).toString("base64url")

  const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`

  return NextResponse.redirect(oauthUrl)
}
