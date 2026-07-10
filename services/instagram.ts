import { db } from "@/lib/prisma"

export interface InstagramProfile {
  id: string
  username: string
  name: string
}

export class InstagramService {
  private static isSandbox = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true"

  /**
   * Exchanges code or token to connect an Instagram Business Account
   */
  static async connectAccount(workspaceId: string, pageAccessToken: string, pageId: string) {
    if (this.isSandbox) {
      // Return a simulated connected account
      const igAccountId = "ig_acc_" + Math.random().toString(36).substr(2, 9)
      const username = "sandbox_biz_insta"
      
      const account = await db.instagramAccount.create({
        data: {
          workspaceId,
          instagramAccountId: igAccountId,
          username,
          displayName: "Sandbox Business Instagram",
          accessToken: pageAccessToken || "mock_access_token",
          pageId: pageId || "mock_page_id",
          pageAccessToken: pageAccessToken || "mock_page_access_token",
        }
      })
      return account
    }

    // Official Graph API request to get page details and connected Instagram account
    try {
      const pageRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account,name&access_token=${pageAccessToken}`
      )
      const pageData = await pageRes.json()
      
      if (!pageData.instagram_business_account) {
        throw new Error("No Instagram Business Account linked to this Facebook Page.")
      }

      const igAccountId = pageData.instagram_business_account.id
      
      // Fetch Instagram profile info
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}?fields=username,name&access_token=${pageAccessToken}`
      )
      const igData = await igRes.json()

      const account = await db.instagramAccount.upsert({
        where: { instagramAccountId: igAccountId },
        create: {
          workspaceId,
          instagramAccountId: igAccountId,
          username: igData.username || "unknown",
          displayName: igData.name || "Instagram Account",
          accessToken: pageAccessToken,
          pageId,
          pageAccessToken,
        },
        update: {
          accessToken: pageAccessToken,
          pageAccessToken,
          displayName: igData.name,
          username: igData.username,
        }
      })
      
      // Subscribe Facebook Page to Instagram Webhooks
      await this.subscribeWebhooks(pageId, pageAccessToken)
      
      return account
    } catch (error) {
      console.error("Error connecting Instagram account:", error)
      throw error
    }
  }

  /**
   * Subscribe Meta Webhooks for Page events
   */
  private static async subscribeWebhooks(pageId: string, pageAccessToken: string) {
    const url = `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageAccessToken}`
    const res = await fetch(url, { method: "POST" })
    const data = await res.json()
    return data.success
  }

  /**
   * Send a Direct Message to a user
   */
  static async sendMessage(instagramAccountId: string, recipientInstagramUserId: string, text: string) {
    // Find the IG account and its tokens
    const account = await db.instagramAccount.findUnique({
      where: { instagramAccountId }
    })

    if (!account) {
      throw new Error(`Instagram account ${instagramAccountId} not found in database.`)
    }

    if (this.isSandbox) {
      console.log(`[SANDBOX INSTAGRAM] Sending message to ${recipientInstagramUserId}: "${text}"`)
      
      // Write message to the database directly (simulating successful webhook/API echo)
      const contact = await db.contact.findUnique({
        where: {
          instagramAccountId_instagramUserId: {
            instagramAccountId: account.id,
            instagramUserId: recipientInstagramUserId
          }
        }
      })

      if (contact) {
        const conversation = await db.conversation.findFirst({
          where: {
            instagramAccountId: account.id,
            contactId: contact.id
          }
        })

        if (conversation) {
          await db.message.create({
            data: {
              conversationId: conversation.id,
              senderId: instagramAccountId,
              senderType: "USER",
              text,
            }
          })
          
          await db.contact.update({
            where: { id: contact.id },
            data: { lastMessageAt: new Date() }
          })
        }
      }

      return { message_id: "mid.sandbox_msg_" + Math.random().toString(36).substr(2, 9) }
    }

    // Call the actual Meta Send API
    try {
      const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${account.pageAccessToken || account.accessToken}`
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientInstagramUserId },
          message: { text: text }
        })
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message)
      }

      // Record the sent message in database
      const contact = await db.contact.findUnique({
        where: {
          instagramAccountId_instagramUserId: {
            instagramAccountId: account.id,
            instagramUserId: recipientInstagramUserId
          }
        }
      })

      if (contact) {
        const conversation = await db.conversation.findFirst({
          where: {
            instagramAccountId: account.id,
            contactId: contact.id
          }
        })

        if (conversation) {
          await db.message.create({
            data: {
              conversationId: conversation.id,
              senderId: instagramAccountId,
              senderType: "USER",
              text,
            }
          })
        }
      }

      return data
    } catch (error) {
      console.error("Error sending Meta message:", error)
      throw error
    }
  }

  /**
   * Fetch customer profile (name, profile picture, etc.)
   */
  static async fetchContactProfile(instagramAccountId: string, contactInstagramUserId: string): Promise<InstagramProfile> {
    const account = await db.instagramAccount.findUnique({
      where: { instagramAccountId }
    })

    if (this.isSandbox || !account) {
      return {
        id: contactInstagramUserId,
        username: `sandbox_user_${contactInstagramUserId.slice(-4)}`,
        name: `Sandbox Client (${contactInstagramUserId.slice(-4)})`
      }
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${contactInstagramUserId}?fields=username,name&access_token=${account.pageAccessToken || account.accessToken}`
      const response = await fetch(url)
      const data = await response.json()
      
      return {
        id: contactInstagramUserId,
        username: data.username || `ig_user_${contactInstagramUserId}`,
        name: data.name || "Instagram User"
      }
    } catch (error) {
      console.error("Error fetching Meta contact profile:", error)
      return {
        id: contactInstagramUserId,
        username: `ig_user_${contactInstagramUserId}`,
        name: "Instagram User"
      }
    }
  }
}
