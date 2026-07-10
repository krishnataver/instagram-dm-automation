import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import { Providers } from "@/components/Providers"
import "./globals.css"

const fontSans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "InstaSponder | Instagram DM Automation & AI Customer Support SaaS",
  description: "Automate your Instagram Direct Messages, configure keyword triggers, build custom AI FAQ support agents, and streamline conversations with your team in a unified collaborative inbox.",
  keywords: ["instagram", "dm automation", "chatbot", "ai assistant", "saas", "social media manager"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${fontSans.variable} h-full antialiased dark`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-full flex flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-pink-500 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
