"use client"

import React, { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getConversations, 
  getConversationMessages, 
  sendDirectMessage, 
  toggleStarConversation,
  toggleArchiveConversation,
  changeConversationStatus,
  updateContactDetails,
  assignConversation
} from "@/actions/conversations"
import { rewriteMessage, summarizeConversationLog } from "@/actions/ai"
import { 
  Star, 
  Archive, 
  Search, 
  Send, 
  User, 
  Bot, 
  Sparkles, 
  CheckCircle,
  FileText,
  Tag,
  Clock,
  ChevronRight,
  MessageSquare,
  AlertCircle,
  FolderArchive,
  UserCheck
} from "lucide-react"
import { ConversationStatus } from "@prisma/client"

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  image: string | null
}

export default function InboxClient({ teamMembers }: { teamMembers: TeamMember[] }) {
  const queryClient = useQueryClient()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  
  // Search & Filter State
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ConversationStatus>("OPEN")
  const [starredFilter, setStarredFilter] = useState(false)
  const [archivedFilter, setArchivedFilter] = useState(false)

  // Message Send & AI rewrite states
  const [messageInput, setMessageInput] = useState("")
  const [selectedTone, setSelectedTone] = useState("friendly")
  const [isRewriting, setIsRewriting] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [isSummarizing, setIsSummarizing] = useState(false)

  // Contact detail fields (local states sync'd on active chat change)
  const [contactName, setContactName] = useState("")
  const [contactNotes, setContactNotes] = useState("")
  const [newLabelInput, setNewLabelInput] = useState("")

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Query: Conversations List (polls every 4 seconds)
  const { data: conversations = [], isLoading: loadingConvos } = useQuery({
    queryKey: ["conversations", { status: statusFilter, starred: starredFilter, archived: archivedFilter, search }],
    queryFn: () => getConversations({ 
      status: statusFilter, 
      starred: starredFilter, 
      archived: archivedFilter, 
      search 
    }),
    refetchInterval: 4000,
  })

  // Query: Active Chat Messages (polls every 3 seconds)
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", selectedConversationId],
    queryFn: () => selectedConversationId ? getConversationMessages(selectedConversationId) : Promise.resolve([]),
    enabled: !!selectedConversationId,
    refetchInterval: 3000,
  })

  const activeConversation = conversations.find(c => c.id === selectedConversationId)
  const activeContact = activeConversation?.contact

  // Auto Scroll Chat to Bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Sync profile details side-panel on conversation selection
  useEffect(() => {
    if (activeContact) {
      setContactName(activeContact.name || "")
      setContactNotes(activeContact.notes || "")
      setSummary(null)
    }
  }, [selectedConversationId, activeContact])

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: (text: string) => {
      if (!selectedConversationId) throw new Error("No active chat selected")
      return sendDirectMessage(selectedConversationId, text)
    },
    onSuccess: () => {
      setMessageInput("")
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversationId] })
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    }
  })

  const handleSend = () => {
    if (!messageInput.trim() || sendMessageMutation.isPending) return
    sendMessageMutation.mutate(messageInput)
  }

  // AI Actions
  const handleAiRewrite = async () => {
    if (!messageInput.trim()) return
    setIsRewriting(true)
    try {
      const response = await rewriteMessage(messageInput, selectedTone)
      if (response.success && response.rewritten) {
        setMessageInput(response.rewritten)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsRewriting(false)
    }
  }

  const handleSummarize = async () => {
    if (!selectedConversationId) return
    setIsSummarizing(true)
    try {
      const response = await summarizeConversationLog(selectedConversationId)
      if (response.success && response.summary) {
        setSummary(response.summary)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSummarizing(false)
    }
  }

  // Contact updates
  const handleSaveContact = async () => {
    if (!activeContact) return
    await updateContactDetails(activeContact.id, {
      name: contactName,
      notes: contactNotes
    })
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  const handleAddLabel = async () => {
    if (!activeContact || !newLabelInput.trim()) return
    const currentLabels = (activeContact.labels as string[]) || []
    if (currentLabels.includes(newLabelInput.trim())) return

    const updatedLabels = [...currentLabels, newLabelInput.trim()]
    await updateContactDetails(activeContact.id, { labels: updatedLabels })
    setNewLabelInput("")
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  const handleRemoveLabel = async (labelToRemove: string) => {
    if (!activeContact) return
    const updatedLabels = ((activeContact.labels as string[]) || []).filter(l => l !== labelToRemove)
    await updateContactDetails(activeContact.id, { labels: updatedLabels })
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  const handleToggleStar = async (convoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await toggleStarConversation(convoId)
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  const handleToggleArchive = async () => {
    if (!selectedConversationId) return
    await toggleArchiveConversation(selectedConversationId)
    setSelectedConversationId(null)
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  const handleStatusChange = async (newStatus: ConversationStatus) => {
    if (!selectedConversationId) return
    await changeConversationStatus(selectedConversationId, newStatus)
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  const handleAssigneeChange = async (userId: string) => {
    if (!selectedConversationId) return
    await assignConversation(selectedConversationId, userId === "unassigned" ? null : userId)
    queryClient.invalidateQueries({ queryKey: ["conversations"] })
  }

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-64px)] relative">
      {/* Sidebar List Panel */}
      <div className="w-80 border-r border-white/5 bg-[#0b0b0e]/50 flex flex-col shrink-0 overflow-y-auto">
        {/* Search */}
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
            />
          </div>

          {/* Inbox Filter Toggles */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => { setStatusFilter("OPEN"); setArchivedFilter(false) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === "OPEN" && !archivedFilter
                  ? "bg-pink-500/10 border border-pink-500/30 text-pink-400"
                  : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Open
            </button>
            <button
              onClick={() => { setStatusFilter("RESOLVED"); setArchivedFilter(false) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === "RESOLVED" && !archivedFilter
                  ? "bg-pink-500/10 border border-pink-500/30 text-pink-400"
                  : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => { setArchivedFilter(true) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                archivedFilter
                  ? "bg-pink-500/10 border border-pink-500/30 text-pink-400"
                  : "bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Archived
            </button>
            <button
              onClick={() => setStarredFilter(!starredFilter)}
              className={`p-1.5 rounded-lg border cursor-pointer transition-all ${
                starredFilter
                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500"
                  : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <Star className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* Chat Threads */}
        <div className="flex-1 divide-y divide-white/5">
          {loadingConvos && conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">Loading inbox...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">No conversations found.</div>
          ) : (
            conversations.map((convo) => {
              const contact = convo.contact
              const lastMessage = convo.messages[0]
              const isSelected = convo.id === selectedConversationId

              return (
                <div
                  key={convo.id}
                  onClick={() => setSelectedConversationId(convo.id)}
                  className={`p-4 flex items-start gap-3 cursor-pointer transition-all hover:bg-white/[0.01] ${
                    isSelected ? "bg-white/[0.02] border-l-2 border-pink-500" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5 text-zinc-300 font-bold shrink-0 text-sm">
                    {contact.name ? contact.name[0].toUpperCase() : contact.username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {contact.name || contact.username}
                      </span>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {new Date(convo.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-1">
                      {lastMessage ? lastMessage.text : "No messages yet"}
                    </p>
                    
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {convo.isStarred && <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />}
                      {(contact.labels as string[] | null)?.slice(0, 2).map((label: string) => (
                        <span key={label} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[9px] font-semibold uppercase tracking-wide">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => handleToggleStar(convo.id, e)}
                    className="text-zinc-600 hover:text-yellow-500 transition-colors self-center p-1 cursor-pointer"
                  >
                    <Star className={`w-3.5 h-3.5 ${convo.isStarred ? "text-yellow-500 fill-current" : ""}`} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Main Chat Display */}
      {selectedConversationId && activeConversation ? (
        <div className="flex-1 flex flex-col bg-[#0d0d11]/20">
          {/* Header */}
          <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0b0b0e]/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-white text-xs border border-white/5">
                {activeContact?.name ? activeContact.name[0].toUpperCase() : activeContact?.username[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{activeContact?.name || activeContact?.username}</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">@{activeContact?.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Star */}
              <button
                onClick={(e) => handleToggleStar(activeConversation.id, e)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  activeConversation.isStarred 
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                <Star className={`w-4 h-4 ${activeConversation.isStarred ? "fill-current" : ""}`} />
              </button>

              {/* Archive */}
              <button
                onClick={handleToggleArchive}
                className="p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-800 cursor-pointer transition-colors"
                title={activeConversation.isArchived ? "Unarchive" : "Archive"}
              >
                <Archive className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Logs Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingMessages ? (
              <div className="text-center text-xs text-zinc-500 py-10">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-xs text-zinc-500 py-10">No messages in this chat yet.</div>
            ) : (
              messages.map((msg) => {
                const isOutbound = msg.senderType === "USER"
                
                return (
                  <div 
                    key={msg.id} 
                    className={`flex items-start gap-3 max-w-[70%] ${
                      isOutbound ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border border-white/5 shrink-0 ${
                      isOutbound ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400"
                    }`}>
                      {isOutbound ? "ME" : "IG"}
                    </div>

                    <div className="space-y-1">
                      <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                        isOutbound 
                          ? "bg-gradient-to-tr from-pink-500 to-indigo-600 text-white rounded-tr-none shadow-md shadow-pink-500/5"
                          : "bg-zinc-900 text-zinc-200 border border-white/5 rounded-tl-none"
                      }`}>
                        {msg.text}
                      </div>
                      <p className={`text-[9px] text-zinc-500 ${isOutbound ? "text-right" : "text-left"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Text Input & AI Box */}
          <div className="p-4 border-t border-white/5 bg-[#0b0b0e]/30 space-y-3">
            {/* Tone Helper Row */}
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span className="font-semibold text-[11px]">AI Tone Assistant:</span>
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-0.5 text-[10px] font-medium"
                >
                  <option value="friendly">Friendly 😊</option>
                  <option value="professional">Professional 💼</option>
                  <option value="casual">Casual ✌️</option>
                  <option value="witty">Witty 🎭</option>
                  <option value="formal">Formal 📝</option>
                </select>
              </div>

              <button
                onClick={handleAiRewrite}
                disabled={isRewriting || !messageInput.trim()}
                className="text-[10px] text-pink-400 hover:text-pink-300 font-bold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                {isRewriting ? "Rewriting..." : "Apply Tone Rewrite"}
              </button>
            </div>

            {/* Input Box */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Type response message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
              />
              <button
                onClick={handleSend}
                disabled={sendMessageMutation.isPending || !messageInput.trim()}
                className="p-3 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 hover:opacity-95 disabled:opacity-50 text-white transition-all shadow-md shadow-pink-500/10 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#0d0d11]/10">
          <MessageSquare className="w-12 h-12 text-zinc-700 mb-4" />
          <h3 className="text-base font-bold text-white">No conversation selected</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm">
            Select a direct message from the sidebar to view metrics, notes, logs, and draft AI responses.
          </p>
        </div>
      )}

      {/* Right Details Panel */}
      {selectedConversationId && activeConversation && activeContact && (
        <div className="w-80 border-l border-white/5 bg-[#0b0b0e]/50 flex flex-col shrink-0 overflow-y-auto p-5 space-y-6">
          
          {/* Conversation State Block */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status & Agent</h4>
            
            {/* Status Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Inbox Folder</label>
              <select
                value={activeConversation.status}
                onChange={(e) => handleStatusChange(e.target.value as ConversationStatus)}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500"
              >
                <option value="OPEN">Open Inbox</option>
                <option value="RESOLVED">Resolved / Closed</option>
                <option value="SNOOZED">Snoozed</option>
              </select>
            </div>

            {/* Agent Assignment Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Assign Agent</label>
              <select
                value={activeConversation.assignedToId || "unassigned"}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500"
              >
                <option value="unassigned">Unassigned</option>
                {teamMembers.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Contact Details Form */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contact Info</h4>
            
            {/* Custom display name */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Display Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                onBlur={handleSaveContact}
                placeholder="Set customer name..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
              />
            </div>

            {/* Notes area */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-500">Customer Notes</label>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                onBlur={handleSaveContact}
                placeholder="Record customer preferences or order tags..."
                rows={4}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500 resize-none"
              />
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Custom Tag Labels */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              Labels & Tags
            </h4>

            {/* Tags Container */}
            <div className="flex flex-wrap gap-1.5">
              {((activeContact.labels as string[]) || []).length === 0 ? (
                <span className="text-[10px] text-zinc-600 italic">No labels applied.</span>
              ) : (
                (activeContact.labels as string[]).map((lbl: string) => (
                  <span 
                    key={lbl} 
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-semibold"
                  >
                    {lbl}
                    <button 
                      onClick={() => handleRemoveLabel(lbl)} 
                      className="text-zinc-500 hover:text-red-400 font-bold shrink-0 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add tag Input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="New label..."
                value={newLabelInput}
                onChange={(e) => setNewLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-[11px] focus:outline-none"
              />
              <button
                onClick={handleAddLabel}
                className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* AI summaries summary */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              Conversation Summary
            </h4>
            
            {summary ? (
              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-purple-300 text-[11px] leading-relaxed">
                {summary}
              </div>
            ) : (
              <button
                onClick={handleSummarize}
                disabled={isSummarizing}
                className="w-full py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSummarizing ? (
                  "Analyzing logs..."
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    AI Summary Logs
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
