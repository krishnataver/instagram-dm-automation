"use client"

import React, { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Play, MessageCircle, X, Send, Loader2, Sparkles, HelpCircle } from "lucide-react"

interface InstagramAccount {
  id: string
  username: string
  displayName: string | null
  instagramAccountId: string
}

export default function SandboxSimulator() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  
  // Form states
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [customerId, setCustomerId] = useState("customer_sam_77")
  const [messageText, setMessageText] = useState("")
  
  // Status states
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  // Fetch accounts list to choose recipient
  const { data: accounts = [] } = useQuery<InstagramAccount[]>({
    queryKey: ["connectedAccounts"],
    queryFn: async () => {
      // Direct call to fetch connected accounts from database
      const res = await fetch("/api/sandbox/accounts")
      if (!res.ok) return []
      return res.json()
    }
  })

  // Set default account when accounts list loads
  React.useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].instagramAccountId)
    }
  }, [accounts, selectedAccountId])

  const handleSimulate = async () => {
    if (!selectedAccountId || !messageText.trim()) return
    setLoading(true)
    setStatusMsg("Simulating customer message...")

    try {
      const res = await fetch("/api/sandbox/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          instagramUserId: customerId.trim(),
          text: messageText,
        })
      })

      if (res.ok) {
        setStatusMsg("DM delivered. Inbound webhook processed!")
        setMessageText("")
        
        // Refresh TanStack queries for real-time live inbox updates
        queryClient.invalidateQueries({ queryKey: ["conversations"] })
        queryClient.invalidateQueries({ queryKey: ["messages"] })
        
        setTimeout(() => setStatusMsg(null), 2500)
      } else {
        setStatusMsg("Failed to simulate webhook event.")
      }
    } catch {
      setStatusMsg("Network error simulating webhook.")
    } finally {
      setLoading(false)
    }
  }

  // Render nothing if sandbox is disabled
  if (process.env.NEXT_PUBLIC_SANDBOX_MODE !== "true") {
    return null
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-600 hover:scale-105 active:scale-95 text-white font-bold text-xs shadow-lg shadow-pink-500/20 transition-all cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          DM Simulator (Sandbox)
        </button>
      )}

      {/* Simulator Panel */}
      {isOpen && (
        <div className="w-80 glass-panel rounded-3xl p-5 bg-[#0b0b0e] border border-white/10 shadow-2xl space-y-4 animate-scale-up">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-400" />
              Instagram DM Simulator
            </span>
            <button 
              onClick={() => setIsOpen(false)} 
              className="p-1 text-zinc-500 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[10px] text-zinc-400 leading-normal">
            Simulate a message sent from an Instagram customer account. Observe automation matching or AI replies.
          </p>

          <hr className="border-white/5" />

          {/* Form */}
          <div className="space-y-3">
            {/* Recipient Account select */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block">Recipient Instagram Business</label>
              {accounts.length === 0 ? (
                <span className="text-[10px] text-red-400 italic block">No accounts linked. Please go to settings first.</span>
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.instagramAccountId}>
                      @{acc.username}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sender Scoped ID */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block">Customer Instagram User ID</label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="e.g. customer_jane_12"
                className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider block">Message Content</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Try writing: 'What is the price?' or 'hello'"
                rows={3}
                className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none resize-none"
              />
            </div>

            {/* Status alerts */}
            {statusMsg && (
              <p className="text-[10px] text-pink-400 font-medium italic flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                {statusMsg}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSimulate}
              disabled={loading || accounts.length === 0 || !messageText.trim()}
              className="w-full py-2.5 bg-gradient-to-tr from-pink-500 to-indigo-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-pink-500/10 cursor-pointer hover:opacity-95"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Deliver Simulator DM
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
