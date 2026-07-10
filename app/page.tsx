import React from "react"
import Link from "next/link"
import { MessageCircle, Bot, Zap, BarChart3, Users, ArrowRight, Shield, CheckCircle } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans selection:bg-pink-500 selection:text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">InstaSponder</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors px-3 py-1.5">
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-white text-black hover:bg-zinc-200 transition-colors px-4 py-2 rounded-xl"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden">
        {/* Gradients */}
        <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] rounded-full bg-pink-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-400 text-xs font-semibold tracking-wide uppercase mb-6 animate-pulse-slow">
            <CheckCircle className="w-3.5 h-3.5" />
            Official Meta Graph API Integration
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight md:leading-none text-white max-w-4xl mx-auto">
            Automate Your Instagram DMs with{" "}
            <span className="instagram-gradient-text">AI & Keywords</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mt-6">
            Instantly reply to customer queries, configure rich keyword logic, train custom AI support bots, and centralize DMs in a powerful team inbox.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-xl instagram-gradient-bg text-white font-semibold text-base shadow-lg shadow-pink-500/20 hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
            >
              Start Automating Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-zinc-800 bg-zinc-900/30 text-white font-semibold text-base hover:bg-zinc-800 transition-colors flex items-center justify-center"
            >
              Demo Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 border-t border-white/5 bg-[#0b0b0e]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Everything you need to automate your social support
            </h2>
            <p className="text-zinc-400 mt-4">
              Deploy automation rules and custom AI models in minutes. Compliant with Meta's developer guidelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="glass-panel rounded-3xl p-8 bg-[#121217]/50 border-white/5">
              <div className="p-3 rounded-2xl bg-pink-500/10 text-pink-500 w-fit mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Keyword Rules</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Define trigger word rules like "price" or "order info" to reply with structured menus, URLs, or custom text instantly.
              </p>
            </div>

            {/* Card 2 */}
            <div className="glass-panel rounded-3xl p-8 bg-[#121217]/50 border-white/5">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500 w-fit mb-6">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">AI FAQ Assistant</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Connect OpenAI models trained on your workspace knowledge base to answer complex customer FAQs when keyword rules don't match.
              </p>
            </div>

            {/* Card 3 */}
            <div className="glass-panel rounded-3xl p-8 bg-[#121217]/50 border-white/5">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 w-fit mb-6">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Shared Inbox</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Collaborate with your team. Star, archive, filter conversations, write private notes, and assign chats to specific agents.
              </p>
            </div>

            {/* Card 4 */}
            <div className="glass-panel rounded-3xl p-8 bg-[#121217]/50 border-white/5">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 w-fit mb-6">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Detailed Analytics</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Track incoming volume, response times, AI resolution rates, and automation logs on beautiful interactive dashboards.
              </p>
            </div>

            {/* Card 5 */}
            <div className="glass-panel rounded-3xl p-8 bg-[#121217]/50 border-white/5">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-6">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Safe & Compliant</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Built strictly using official Meta Graph endpoints. Ensures zero rate-limiting bans or scraping risks.
              </p>
            </div>

            {/* Card 6 */}
            <div className="glass-panel rounded-3xl p-8 bg-[#121217]/50 border-white/5 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Ready to scale?</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  Join hundreds of businesses scaling operations with InstaSponder.
                </p>
              </div>
              <Link
                href="/register"
                className="w-full py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center text-zinc-500 text-xs">
        <p>© 2026 InstaSponder. All rights reserved. Compliant with Meta Platform Policies.</p>
      </footer>
    </div>
  )
}
