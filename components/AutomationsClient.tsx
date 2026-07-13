"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getAutomations, 
  createAutomation, 
  updateAutomation, 
  deleteAutomation, 
  addAutomationRule,
  deleteAutomationRule
} from "@/actions/automations"
import { 
  Zap, 
  Plus, 
  Trash2, 
  Clock, 
  ArrowUp, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  FolderPlus,
  Loader2,
  MessageSquare,
  Image,
  BookOpen,
  Sparkles,
  Users,
  Link2,
  ChevronDown,
  ChevronUp
} from "lucide-react"

type TriggerType = "KEYWORD" | "COMMENT" | "ALL_COMMENTS" | "STORY_REPLY" | "AI_FALLBACK"
type PostTriggerScope = "ALL_POSTS" | "SPECIFIC_POST" | "NEXT_POST"

const TRIGGER_OPTIONS: { value: TriggerType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "KEYWORD", icon: <MessageSquare className="w-4 h-4" />, label: "DM Keyword", description: "Auto-reply when DM contains a keyword" },
  { value: "COMMENT", icon: <Image className="w-4 h-4" />, label: "Comment Keyword", description: "Comment on Post/Reel → send DM" },
  { value: "ALL_COMMENTS", icon: <BookOpen className="w-4 h-4" />, label: "All Comments", description: "Any comment on your post → send DM" },
  { value: "STORY_REPLY", icon: <Sparkles className="w-4 h-4" />, label: "Story Reply", description: "Story reply/reaction → auto DM" },
  { value: "AI_FALLBACK", icon: <Zap className="w-4 h-4" />, label: "AI Fallback", description: "AI answers when no keyword matches" },
]

export default function AutomationsClient() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Create automation form states
  const [newAutoName, setNewAutoName] = useState("")
  const [newAutoPriority, setNewAutoPriority] = useState(0)
  const [newAutoDelay, setNewAutoDelay] = useState(0)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Add rule form states (keyed by automationId)
  const [ruleStates, setRuleStates] = useState<Record<string, {
    triggerType: TriggerType
    triggerValue: string
    replyText: string
    commentReply: string
    smartMatch: boolean
    postTriggerScope: PostTriggerScope
    postUrl: string
    requireFollow: boolean
    expanded: boolean
  }>>({})
  const [ruleError, setRuleError] = useState<Record<string, string>>({})

  const getRuleState = (automationId: string) => ruleStates[automationId] || {
    triggerType: "KEYWORD" as TriggerType,
    triggerValue: "",
    replyText: "",
    commentReply: "",
    smartMatch: false,
    postTriggerScope: "ALL_POSTS" as PostTriggerScope,
    postUrl: "",
    requireFollow: false,
    expanded: false
  }

  const updateRuleState = (automationId: string, updates: Partial<ReturnType<typeof getRuleState>>) => {
    setRuleStates(prev => ({
      ...prev,
      [automationId]: { ...getRuleState(automationId), ...updates }
    }))
  }

  // Query: Automations
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: () => getAutomations(),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: createAutomation,
    onSuccess: () => {
      setNewAutoName("")
      setNewAutoPriority(0)
      setNewAutoDelay(0)
      setShowCreateModal(false)
      queryClient.invalidateQueries({ queryKey: ["automations"] })
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => 
      updateAutomation(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] })
    }
  })

  const addRuleMutation = useMutation({
    mutationFn: addAutomationRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] })
    }
  })

  const deleteRuleMutation = useMutation({
    mutationFn: deleteAutomationRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] })
    }
  })

  const handleCreateAutomation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAutoName.trim()) return
    setCreateError(null)
    setIsCreating(true)

    try {
      const res = await createMutation.mutateAsync({
        name: newAutoName,
        priority: Number(newAutoPriority),
        delaySeconds: Number(newAutoDelay)
      })
      if (res.error) {
        setCreateError(res.error)
      }
    } catch {
      setCreateError("Failed to save automation.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddRule = async (automationId: string) => {
    const state = getRuleState(automationId)
    const needsKeyword = state.triggerType === "KEYWORD" || state.triggerType === "COMMENT"

    if (needsKeyword && !state.triggerValue.trim()) {
      setRuleError(prev => ({ ...prev, [automationId]: "Keyword is required for this trigger type." }))
      return
    }
    if (!state.replyText.trim()) {
      setRuleError(prev => ({ ...prev, [automationId]: "DM reply text is required." }))
      return
    }

    setRuleError(prev => ({ ...prev, [automationId]: "" }))

    await addRuleMutation.mutateAsync({
      automationId,
      triggerType: state.triggerType,
      triggerValue: state.triggerValue,
      replyText: state.replyText,
      commentReply: state.commentReply || undefined,
      smartMatch: state.smartMatch,
      postTriggerScope: state.postTriggerScope,
      postUrl: state.postUrl || undefined,
      requireFollow: state.requireFollow,
    })

    // Reset inputs
    updateRuleState(automationId, {
      triggerValue: "",
      replyText: "",
      commentReply: "",
      smartMatch: false,
      postUrl: "",
      requireFollow: false,
      expanded: false,
    })
  }

  const getTriggerBadge = (triggerType: string) => {
    const map: Record<string, { label: string; color: string }> = {
      KEYWORD: { label: "DM Keyword", color: "bg-pink-500/10 text-pink-400 border-pink-500/10" },
      COMMENT: { label: "Comment→DM", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/10" },
      ALL_COMMENTS: { label: "All Comments", color: "bg-purple-500/10 text-purple-400 border-purple-500/10" },
      STORY_REPLY: { label: "Story Reply", color: "bg-orange-500/10 text-orange-400 border-orange-500/10" },
      AI_FALLBACK: { label: "AI Fallback", color: "bg-green-500/10 text-green-400 border-green-500/10" },
    }
    return map[triggerType] || { label: triggerType, color: "bg-zinc-800 text-zinc-400 border-zinc-700" }
  }

  return (
    <div className="flex-1 p-8 space-y-8 bg-[#09090b]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-pink-500 fill-pink-500/10" />
            Automations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Auto-reply to DMs, comments, story replies. Set keywords, smart match, follow-gate and more.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-gradient-to-tr from-pink-500 to-indigo-600 hover:opacity-95 text-white text-sm font-semibold rounded-xl transition-all inline-flex items-center gap-2 shadow-lg shadow-pink-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Automation
        </button>
      </div>

      {/* Trigger Type Legend */}
      <div className="flex flex-wrap gap-2">
        {TRIGGER_OPTIONS.map(opt => (
          <div key={opt.value} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-white/5 text-[10px] text-zinc-400">
            {opt.icon}
            <span className="font-semibold">{opt.label}</span>
            <span className="text-zinc-600">— {opt.description}</span>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-xs text-zinc-500">Loading automation configurations...</div>
      ) : automations.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center bg-[#121217]/20 border-white/5 max-w-xl mx-auto mt-8">
          <Zap className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-base font-bold text-white">No Automations yet</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-normal">
            Create automations for DM keywords, post comments, story replies and more.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Create Your First Automation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {automations.map((auto) => (
            <div 
              key={auto.id} 
              className={`glass-panel rounded-3xl p-6 bg-[#121217]/30 border-white/5 flex flex-col justify-between transition-all ${
                !auto.isActive ? "opacity-60" : ""
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">{auto.name}</h3>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <ArrowUp className="w-3.5 h-3.5 text-pink-500" />
                        Priority {auto.priority}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        {auto.delaySeconds === 0 ? "Immediate Reply" : `Delayed: ${auto.delaySeconds}s`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                        {auto.rules.length} rule{auto.rules.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleMutation.mutate({ id: auto.id, isActive: !auto.isActive })}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      {auto.isActive ? (
                        <ToggleRight className="w-7 h-7 text-pink-500" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-zinc-600" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => deleteMutation.mutate(auto.id)}
                      className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <hr className="border-white/5 my-4" />

                {/* Rules List */}
                <div className="space-y-3 mb-6">
                  {auto.rules.length === 0 ? (
                    <div className="text-[11px] text-zinc-600 italic">No rules added yet. Add one below.</div>
                  ) : (
                    auto.rules.map((rule: any) => {
                      const badge = getTriggerBadge(rule.triggerType)
                      return (
                        <div key={rule.id} className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 relative">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${badge.color}`}>
                              {badge.label}
                            </span>
                            {rule.smartMatch && (
                              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/10 text-yellow-400 text-[9px] font-bold uppercase">
                                Smart Match
                              </span>
                            )}
                            {rule.requireFollow && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/10 text-blue-400 text-[9px] font-bold uppercase flex items-center gap-1">
                                <Users className="w-3 h-3" /> Follow-Gate
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {rule.triggerValue && (
                              <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Trigger Keyword:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {rule.triggerValue.split(",").map((tag: string) => (
                                    <span key={tag} className="px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 text-[10px] border border-pink-500/10 font-medium">
                                      {tag.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">DM Reply:</span>
                              <p className="text-xs text-zinc-300 leading-normal mt-0.5 italic">"{rule.replyText}"</p>
                            </div>
                            {rule.commentReply && (
                              <div>
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Public Comment Reply:</span>
                                <p className="text-xs text-zinc-300 leading-normal mt-0.5 italic">"{rule.commentReply}"</p>
                              </div>
                            )}
                            {rule.postUrl && (
                              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                                <Link2 className="w-3 h-3" />
                                <span className="truncate">{rule.postUrl}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            className="absolute right-3 bottom-3 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Add Rule Form */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <button
                  onClick={() => updateRuleState(auto.id, { expanded: !getRuleState(auto.id).expanded })}
                  className="w-full flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
                >
                  <span>+ Add Rule</span>
                  {getRuleState(auto.id).expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {getRuleState(auto.id).expanded && (
                  <div className="space-y-3 pt-2">
                    {ruleError[auto.id] && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {ruleError[auto.id]}
                      </p>
                    )}

                    {/* Trigger Type Select */}
                    <div>
                      <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-1.5 font-semibold">Trigger Type</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TRIGGER_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateRuleState(auto.id, { triggerType: opt.value })}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                              getRuleState(auto.id).triggerType === opt.value
                                ? "bg-pink-500 text-white"
                                : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                            }`}
                          >
                            {opt.icon}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Keyword Input - show only for KEYWORD and COMMENT types */}
                    {(getRuleState(auto.id).triggerType === "KEYWORD" || getRuleState(auto.id).triggerType === "COMMENT") && (
                      <input
                        type="text"
                        placeholder="Keyword (e.g. PRICE, INFO, LINK)"
                        value={getRuleState(auto.id).triggerValue}
                        onChange={(e) => updateRuleState(auto.id, { triggerValue: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                      />
                    )}

                    {/* Post Scope - for COMMENT and ALL_COMMENTS */}
                    {(getRuleState(auto.id).triggerType === "COMMENT" || getRuleState(auto.id).triggerType === "ALL_COMMENTS") && (
                      <div>
                        <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-1.5 font-semibold">Target Posts</label>
                        <select
                          value={getRuleState(auto.id).postTriggerScope}
                          onChange={(e) => updateRuleState(auto.id, { postTriggerScope: e.target.value as PostTriggerScope })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-pink-500"
                        >
                          <option value="ALL_POSTS">All Posts & Reels</option>
                          <option value="SPECIFIC_POST">Specific Post</option>
                          <option value="NEXT_POST">Next Published Post</option>
                        </select>
                        {getRuleState(auto.id).postTriggerScope === "SPECIFIC_POST" && (
                          <input
                            type="text"
                            placeholder="Post URL (e.g. https://instagram.com/p/...)"
                            value={getRuleState(auto.id).postUrl}
                            onChange={(e) => updateRuleState(auto.id, { postUrl: e.target.value })}
                            className="w-full mt-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                          />
                        )}
                      </div>
                    )}

                    {/* DM Reply */}
                    <textarea
                      placeholder="DM reply message to send automatically..."
                      value={getRuleState(auto.id).replyText}
                      onChange={(e) => updateRuleState(auto.id, { replyText: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500 resize-none"
                    />

                    {/* Comment Public Reply - for COMMENT types */}
                    {(getRuleState(auto.id).triggerType === "COMMENT" || getRuleState(auto.id).triggerType === "ALL_COMMENTS") && (
                      <input
                        type="text"
                        placeholder="Public comment reply (optional, e.g. 'Check your DMs! 📩')"
                        value={getRuleState(auto.id).commentReply}
                        onChange={(e) => updateRuleState(auto.id, { commentReply: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                      />
                    )}

                    {/* Toggles */}
                    <div className="flex flex-wrap gap-3">
                      {/* Smart Match */}
                      {(getRuleState(auto.id).triggerType === "KEYWORD" || getRuleState(auto.id).triggerType === "COMMENT") && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <button
                            type="button"
                            onClick={() => updateRuleState(auto.id, { smartMatch: !getRuleState(auto.id).smartMatch })}
                            className={`w-8 h-4 rounded-full transition-all relative ${getRuleState(auto.id).smartMatch ? "bg-pink-500" : "bg-zinc-700"}`}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${getRuleState(auto.id).smartMatch ? "left-4" : "left-0.5"}`} />
                          </button>
                          <span className="text-[10px] text-zinc-400">Smart Match (typo-proof)</span>
                        </label>
                      )}

                      {/* Follow Gate */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <button
                          type="button"
                          onClick={() => updateRuleState(auto.id, { requireFollow: !getRuleState(auto.id).requireFollow })}
                          className={`w-8 h-4 rounded-full transition-all relative ${getRuleState(auto.id).requireFollow ? "bg-blue-500" : "bg-zinc-700"}`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${getRuleState(auto.id).requireFollow ? "left-4" : "left-0.5"}`} />
                        </button>
                        <span className="text-[10px] text-zinc-400">Follow-Gate (followers only)</span>
                      </label>
                    </div>

                    <button
                      onClick={() => handleAddRule(auto.id)}
                      disabled={addRuleMutation.isPending}
                      className="w-full py-2 bg-gradient-to-r from-pink-500 to-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer hover:opacity-90"
                    >
                      {addRuleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5" /> Save Rule</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Create Automation */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0b0b0e] border border-white/10 rounded-3xl p-6 shadow-2xl animate-scale-up relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <FolderPlus className="w-5 h-5 text-pink-500" />
              New Automation
            </h3>
            <p className="text-xs text-zinc-400 leading-normal mb-6">
              Create an automation group. Add DM keyword rules, comment triggers, story replies inside it.
            </p>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateAutomation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Automation Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Price Inquiry Flow"
                  value={newAutoName}
                  onChange={(e) => setNewAutoName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Priority
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newAutoPriority}
                    onChange={(e) => setNewAutoPriority(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-pink-500"
                  />
                  <span className="text-[9px] text-zinc-500 block mt-1">Higher = fires first.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Reply Delay (sec)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newAutoDelay}
                    onChange={(e) => setNewAutoDelay(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-pink-500"
                  />
                  <span className="text-[9px] text-zinc-500 block mt-1">Simulate natural typing.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Automation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
