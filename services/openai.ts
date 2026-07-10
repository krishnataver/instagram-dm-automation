import OpenAI from "openai"
import { db } from "@/lib/prisma"

export class OpenAiService {
  private static isSandbox = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true"

  private static getClient() {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "mock-key",
    })
  }

  /**
   * Generates automated replies based on workspace AI prompts (knowledge base) and conversation context
   */
  static async generateAiReply(workspaceId: string, messageText: string, conversationHistory: { role: "user" | "assistant"; content: string }[] = []) {
    // Retrieve workspace AI prompt
    const aiPrompt = await db.aiPrompt.findFirst({
      where: { workspaceId, isActive: true }
    })

    const systemPrompt = aiPrompt?.promptText || "You are a helpful customer support agent for our Instagram account. Keep responses concise, friendly, and under 2-3 sentences."
    const tone = aiPrompt?.tone || "helpful"

    if (this.isSandbox) {
      console.log(`[SANDBOX OPENAI] Generating AI reply for: "${messageText}" using prompt "${systemPrompt.slice(0, 40)}..." and tone "${tone}"`)
      
      // Simple mock heuristics
      const lowerText = messageText.toLowerCase()
      if (lowerText.includes("price") || lowerText.includes("cost") || lowerText.includes("how much")) {
        return "Hi there! Our pricing starts at $29/month for the Pro Plan. You can view all pricing details on our website or type 'agent' to speak with a human."
      }
      if (lowerText.includes("hours") || lowerText.includes("open")) {
        return "We are open Monday to Friday from 9 AM to 6 PM. Feel free to leave a message and our team will get back to you during work hours!"
      }
      if (lowerText.includes("hello") || lowerText.includes("hi") || lowerText.includes("hey")) {
        return `Hello! Thanks for reaching out. How can I assist you today?`
      }
      
      return `Thank you for your message! This is a mock response from our AI Assistant trained to be ${tone}. We've received your query: "${messageText}" and will help you shortly.`
    }

    try {
      const openai = this.getClient()
      
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `${systemPrompt}\n\nRespond in a ${tone} tone. Keep responses short and optimized for Instagram DM layout (under 280 characters if possible). Do not use placeholders.`
        },
        ...conversationHistory.map(h => ({
          role: h.role === "user" ? "user" as const : "assistant" as const,
          content: h.content
        })),
        { role: "user", content: messageText }
      ]

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages,
        max_tokens: 150,
      })

      return completion.choices[0]?.message?.content || "Thank you for reaching out. We will get back to you shortly."
    } catch (error) {
      console.error("OpenAI Service Error:", error)
      return "Thanks for your message. We've received your inquiry and our team will get back to you soon!"
    }
  }

  /**
   * Rewrites draft response based on selected tone (professional, friendly, casual, witty, formal)
   */
  static async rewriteResponse(draftText: string, tone: string) {
    if (this.isSandbox) {
      const tonePrefixes: Record<string, string> = {
        professional: "Dear customer, thank you for contacting us. We would like to inform you that: ",
        friendly: "Hey there! 😊 Just wanted to let you know: ",
        casual: "Hey! Heads up: ",
        witty: "Plot twist! 🎬 Here is the scoop: ",
        formal: "We hereby confirm the following details: "
      }
      const prefix = tonePrefixes[tone.toLowerCase()] || "Here is a revision: "
      return `${prefix}${draftText}`
    }

    try {
      const openai = this.getClient()
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant. Rewrite the user's draft response to sound more ${tone}. Keep it extremely concise and direct, maintaining the original meaning.`
          },
          { role: "user", content: draftText }
        ],
        max_tokens: 150,
      })
      return completion.choices[0]?.message?.content || draftText
    } catch (error) {
      console.error("OpenAI Rewrite Error:", error)
      return draftText
    }
  }

  /**
   * Summarizes conversational context into a single concise description
   */
  static async summarizeConversation(messages: { sender: string; text: string }[]) {
    if (this.isSandbox) {
      if (messages.length === 0) return "No messages yet."
      const lastMsg = messages[messages.length - 1]
      return `User is asking about "${lastMsg.text.slice(0, 30)}..."`
    }

    try {
      const openai = this.getClient()
      const convoDump = messages.map(m => `${m.sender}: ${m.text}`).join("\n")
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Analyze the conversation transcript below. Summarize the user's intent or primary question in 10 words or less.`
          },
          { role: "user", content: convoDump }
        ],
        max_tokens: 50,
      })
      return completion.choices[0]?.message?.content || "Conversation summary unavailable"
    } catch (error) {
      console.error("OpenAI Summary Error:", error)
      return "Conversation summary unavailable"
    }
  }
}
