import { NextResponse } from "next/server"
import { POST as processWebhook } from "../../webhooks/instagram/route"
import { db } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { instagramAccountId, instagramUserId, text } = body

    if (!instagramAccountId || !instagramUserId || !text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Retrieve username from target account to match
    const account = await db.instagramAccount.findUnique({
      where: { instagramAccountId }
    })

    if (!account) {
      return NextResponse.json({ error: "Instagram account not found in database." }, { status: 404 })
    }

    // Construct Meta Webhook Payload
    const webhookPayload = {
      object: "instagram",
      entry: [
        {
          id: instagramAccountId,
          time: Date.now(),
          messaging: [
            {
              sender: { id: instagramUserId },
              recipient: { id: instagramAccountId },
              timestamp: Date.now(),
              message: {
                mid: `mid.sandbox_inbound_${Math.random().toString(36).substr(2, 9)}`,
                text: text,
              }
            }
          ]
        }
      ]
    }

    // Construct a mock Request to pass directly to our webhook POST handler
    const mockRequest = new Request("http://localhost/api/webhooks/instagram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload)
    })

    // Dispatch webhook flow
    const response = await processWebhook(mockRequest)
    const data = await response.json()

    return NextResponse.json({ success: true, webhookProcessed: data })
  } catch (error: any) {
    console.error("[SANDBOX SIMULATOR ERROR]", error)
    return NextResponse.json({ error: error.message || "Simulation failed" }, { status: 500 })
  }
}
