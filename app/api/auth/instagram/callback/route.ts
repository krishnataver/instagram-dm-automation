import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const stateParam = searchParams.get("state")

  const host = request.headers.get("host") || "localhost:3000"
  const proto = host.includes("localhost") ? "http" : "https"
  const appUrl = process.env.NEXTAUTH_URL || `${proto}://${host}`

  // User denied permission
  if (error || !code) {
    console.error("Instagram OAuth error:", error)
    return NextResponse.redirect(new URL("/settings?error=instagram_denied", appUrl))
  }

  try {
    // Decode state to get workspaceId
    let workspaceId = ""
    try {
      const stateData = JSON.parse(Buffer.from(stateParam || "", "base64url").toString())
      workspaceId = stateData.workspaceId
    } catch {
      return NextResponse.redirect(new URL("/settings?error=invalid_state", appUrl))
    }

    if (!workspaceId) {
      return NextResponse.redirect(new URL("/settings?error=no_workspace", appUrl))
    }

    const META_APP_ID = process.env.META_APP_ID!
    const META_APP_SECRET = process.env.META_APP_SECRET!
    const redirectUri = `${appUrl}/api/auth/instagram/callback`

    // Step 1: Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      console.error("Token exchange error:", tokenData.error)
      return NextResponse.redirect(new URL("/settings?error=token_failed", appUrl))
    }

    const shortLivedToken = tokenData.access_token

    // Step 2: Exchange for long-lived token
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
    )
    const longTokenData = await longTokenRes.json()
    const userAccessToken = longTokenData.access_token || shortLivedToken

    // Step 3: Get user's Facebook Pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
    )
    const pagesData = await pagesRes.json()

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.redirect(new URL("/settings?error=no_pages", appUrl))
    }

    // Step 4: Find page with Instagram Business Account linked
    let connectedCount = 0
    for (const page of pagesData.data) {
      if (!page.instagram_business_account) continue

      const pageAccessToken = page.access_token
      const pageId = page.id
      const igAccountId = page.instagram_business_account.id

      // Step 5: Get Instagram profile details
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}?fields=username,name,profile_picture_url&access_token=${pageAccessToken}`
      )
      const igData = await igRes.json()

      // Step 6: Save to database
      await db.instagramAccount.upsert({
        where: { instagramAccountId: igAccountId },
        create: {
          workspaceId,
          instagramAccountId: igAccountId,
          username: igData.username || "unknown",
          displayName: igData.name || page.name,
          accessToken: userAccessToken,
          pageId,
          pageAccessToken,
        },
        update: {
          accessToken: userAccessToken,
          pageAccessToken,
          displayName: igData.name || page.name,
          username: igData.username || "unknown",
        },
      })

      // Step 7: Subscribe page to Instagram webhooks
      try {
        await fetch(
          `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,comments,feed&access_token=${pageAccessToken}`,
          { method: "POST" }
        )
      } catch (webhookErr) {
        console.error("Webhook subscription failed:", webhookErr)
      }

      connectedCount++
    }

    if (connectedCount === 0) {
      return NextResponse.redirect(new URL("/settings?error=no_instagram_business", appUrl))
    }

    // Success!
    return NextResponse.redirect(new URL("/settings?success=instagram_connected", appUrl))
  } catch (err) {
    console.error("Instagram OAuth callback error:", err)
    return NextResponse.redirect(new URL("/settings?error=server_error", appUrl))
  }
}
