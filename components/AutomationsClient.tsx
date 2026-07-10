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
  Loader2
} from "lucide-react"

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
  const [activeRuleKeyword, setActiveRuleKeyword] = useState<Record<string, string>>({})
  const [activeRuleReply, setActiveRuleReply] = useState<Record<string, string>>({})
  const [ruleError, setRuleError] = useState<Record<string, string>>({})

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
    const keyword = activeRuleKeyword[automationId] || ""
    const reply = activeRuleReply[automationId] || ""

    if (!keyword.trim() || !reply.trim()) {
      setRuleError(prev => ({ ...prev, [automationId]: "Trigger word and reply text are required." }))
      return
    }

    setRuleError(prev => ({ ...prev, [automationId]: "" }))

    await addRuleMutation.mutateAsync({
      automationId,
      triggerType: "KEYWORD",
      triggerValue: keyword,
      replyText: reply
    })

    // Reset inputs
    setActiveRuleKeyword(prev => ({ ...prev, [automationId]: "" }))
    setActiveRuleReply(prev => ({ ...prev, [automationId]: "" }))
  }

  return (
    <div className="flex-1 p-8 space-y-8 bg-[#09090b]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Zap className="w-8 h-8 text-pink-500 fill-pink-500/10" />
            Keyword Automations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Build triggers that immediately reply to incoming messages based on keyword matches.
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

      {/* Main Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-xs text-zinc-500">Loading automation configurations...</div>
      ) : automations.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center bg-[#121217]/20 border-white/5 max-w-xl mx-auto mt-8">
          <Zap className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-base font-bold text-white">No Keyword Automations yet</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-normal">
            Create an automation flow, set keyword matches like "price" or "delivery", and specify the exact text reply to deliver.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Create Your First Rule
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
                    </div>
                  </div>

                  {/* Actions (Toggle & Trash) */}
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

                {/* Rules Details */}
                <div className="space-y-4 mb-6">
                  {auto.rules.length === 0 ? (
                    <div className="text-[11px] text-zinc-600 italic">No matching keyword patterns defined yet.</div>
                  ) : (
                    auto.rules.map((rule) => (
                      <div key={rule.id} className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 relative">
                        <span className="absolute right-3 top-3 px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-500 text-[8px] font-bold uppercase tracking-wide">
                          KW Rule
                        </span>

                        <div className="space-y-2">
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">If Message Contains:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {rule.triggerValue.split(",").map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 text-[10px] border border-pink-500/10 font-medium">
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Reply With:</span>
                            <p className="text-xs text-zinc-300 leading-normal mt-0.5 italic">
                              "{rule.replyText}"
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          className="absolute right-3 bottom-3 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add rule drawer Form */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Add Keyword Match</span>
                
                {ruleError[auto.id] && (
                  <p className="text-[10px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {ruleError[auto.id]}
                  </p>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Keyword trigger (e.g. price, cost, rates)"
                    value={activeRuleKeyword[auto.id] || ""}
                    onChange={(e) => setActiveRuleKeyword(prev => ({ ...prev, [auto.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                  />
                  <input
                    type="text"
                    placeholder="Reply content (e.g. Our rates start at $29/mo.)"
                    value={activeRuleReply[auto.id] || ""}
                    onChange={(e) => setActiveRuleReply(prev => ({ ...prev, [auto.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                  />
                  <button
                    onClick={() => handleAddRule(auto.id)}
                    className="w-full py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Save Match Rule
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Create Container */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0b0b0e] border border-white/10 rounded-3xl p-6 shadow-2xl animate-scale-up relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <FolderPlus className="w-5 h-5 text-pink-500" />
              New Automation Flow
            </h3>
            <p className="text-xs text-zinc-400 leading-normal mb-6">
              Create an automation block. Once created, you can add multiple matching keywords and response drafts.
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
                  Flow Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Price Query Trigger"
                  value={newAutoName}
                  onChange={(e) => setNewAutoName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Priority Rating
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newAutoPriority}
                    onChange={(e) => setNewAutoPriority(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-pink-500"
                  />
                  <span className="text-[9px] text-zinc-500 block mt-1">Higher numbers fire first.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Delay (seconds)
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
                  {isCreating ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : "Save Flow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
