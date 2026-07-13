"use client"

import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFlows, createFlow, deleteFlow, addFlowStep, deleteFlowStep, toggleFlow } from "@/actions/flows"
import {
  GitBranch, Plus, Trash2, Loader2, AlertCircle,
  MessageSquare, ToggleLeft, ToggleRight, ChevronDown,
  ChevronUp, ArrowRight, Clock, CheckCircle2
} from "lucide-react"

export default function FlowsClient() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newFlowName, setNewFlowName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null)

  // Step form state keyed by flowId
  const [stepForms, setStepForms] = useState<Record<string, {
    message: string; waitForReply: boolean; matchValue: string; expanded: boolean
  }>>({})

  const getStepForm = (flowId: string) => stepForms[flowId] || {
    message: "", waitForReply: false, matchValue: "", expanded: false
  }

  const updateStepForm = (flowId: string, updates: Partial<ReturnType<typeof getStepForm>>) =>
    setStepForms(prev => ({ ...prev, [flowId]: { ...getStepForm(flowId), ...updates } }))

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows"],
    queryFn: () => getFlows(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFlow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flows"] })
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleFlow(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flows"] })
  })

  const addStepMutation = useMutation({
    mutationFn: addFlowStep,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flows"] })
  })

  const deleteStepMutation = useMutation({
    mutationFn: deleteFlowStep,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flows"] })
  })

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFlowName.trim()) return
    setCreateError(null)
    setIsCreating(true)
    try {
      const res = await createFlow({ name: newFlowName })
      if (res.error) { setCreateError(res.error); return }
      setNewFlowName("")
      setShowCreate(false)
      queryClient.invalidateQueries({ queryKey: ["flows"] })
    } catch { setCreateError("Failed to create flow.") }
    finally { setIsCreating(false) }
  }

  const handleAddStep = async (flowId: string, currentStepCount: number) => {
    const form = getStepForm(flowId)
    if (!form.message.trim()) return
    await addStepMutation.mutateAsync({
      flowId,
      stepOrder: currentStepCount + 1,
      message: form.message,
      waitForReply: form.waitForReply,
      matchValue: form.matchValue || undefined,
    })
    updateStepForm(flowId, { message: "", waitForReply: false, matchValue: "", expanded: false })
  }

  return (
    <div className="flex-1 p-8 space-y-8 bg-[#09090b]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-pink-500" />
            Conversational Flows
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Build multi-step automated conversations. Lead capture, product delivery, FAQ flows.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-gradient-to-tr from-pink-500 to-indigo-600 hover:opacity-95 text-white text-sm font-semibold rounded-xl transition-all inline-flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Flow
        </button>
      </div>

      {/* How it works */}
      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-300 flex items-start gap-3">
        <GitBranch className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
        <span>
          <strong>How Flows work:</strong> Create a flow → add steps (messages) → link this flow to an Automation Rule.
          When a user triggers that rule, the bot will send each step in sequence. Enable "Wait for Reply" to pause until the user responds.
        </span>
      </div>

      {/* Flows List */}
      {isLoading ? (
        <div className="text-center py-20 text-xs text-zinc-500">Loading flows...</div>
      ) : flows.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center bg-[#121217]/20 border-white/5 max-w-xl mx-auto">
          <GitBranch className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-base font-bold text-white">No Flows yet</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-normal">
            Create your first conversational flow to guide users through multi-step automated replies.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            Create First Flow
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {flows.map((flow: any) => (
            <div key={flow.id} className={`glass-panel rounded-3xl p-6 bg-[#121217]/30 border-white/5 transition-all ${!flow.isActive ? "opacity-60" : ""}`}>
              {/* Flow Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-indigo-400" />
                    {flow.name}
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1">{flow.steps.length} step{flow.steps.length !== 1 ? "s" : ""} • ID: <span className="font-mono">{flow.id.slice(-8)}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleMutation.mutate({ id: flow.id, isActive: !flow.isActive })} className="cursor-pointer">
                    {flow.isActive
                      ? <ToggleRight className="w-7 h-7 text-pink-500" />
                      : <ToggleLeft className="w-7 h-7 text-zinc-600" />}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(flow.id)}
                    className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setExpandedFlow(expandedFlow === flow.id ? null : flow.id)}
                    className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {expandedFlow === flow.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Steps Timeline */}
              <div className="space-y-2">
                {flow.steps.map((step: any, idx: number) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {step.stepOrder}
                      </div>
                      {idx < flow.steps.length - 1 && <div className="w-px h-4 bg-white/10 mt-1" />}
                    </div>
                    <div className="flex-1 p-3 rounded-xl bg-white/[0.02] border border-white/5 relative">
                      <p className="text-xs text-zinc-200 leading-relaxed">"{step.message}"</p>
                      <div className="flex items-center gap-3 mt-2">
                        {step.waitForReply && (
                          <span className="flex items-center gap-1 text-[9px] text-yellow-400 font-semibold">
                            <Clock className="w-3 h-3" /> Waits for reply
                          </span>
                        )}
                        {step.matchValue && (
                          <span className="flex items-center gap-1 text-[9px] text-indigo-400 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Match: "{step.matchValue}"
                          </span>
                        )}
                        {!step.waitForReply && !step.matchValue && (
                          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
                            <ArrowRight className="w-3 h-3" /> Sends immediately
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteStepMutation.mutate(step.id)}
                        className="absolute right-2 top-2 text-zinc-700 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Step Form */}
              {expandedFlow === flow.id && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Add Next Step</p>
                  <textarea
                    placeholder="Message to send at this step..."
                    value={getStepForm(flow.id).message}
                    onChange={(e) => updateStepForm(flow.id, { message: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500 resize-none"
                  />
                  <input
                    type="text"
                    placeholder="Match value (optional) — advance only if reply contains this"
                    value={getStepForm(flow.id).matchValue}
                    onChange={(e) => updateStepForm(flow.id, { matchValue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => updateStepForm(flow.id, { waitForReply: !getStepForm(flow.id).waitForReply })}
                        className={`w-8 h-4 rounded-full transition-all relative ${getStepForm(flow.id).waitForReply ? "bg-yellow-500" : "bg-zinc-700"}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${getStepForm(flow.id).waitForReply ? "left-4" : "left-0.5"}`} />
                      </button>
                      <span className="text-[10px] text-zinc-400">Wait for user reply</span>
                    </label>
                    <button
                      onClick={() => handleAddStep(flow.id, flow.steps.length)}
                      disabled={addStepMutation.isPending || !getStepForm(flow.id).message.trim()}
                      className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {addStepMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5" /> Add Step</>}
                    </button>
                  </div>
                </div>
              )}
              {expandedFlow !== flow.id && (
                <button
                  onClick={() => setExpandedFlow(flow.id)}
                  className="mt-4 w-full py-2 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Step
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Flow Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0b0b0e] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <GitBranch className="w-5 h-5 text-pink-500" /> New Conversation Flow
            </h3>
            {createError && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {createError}
              </div>
            )}
            <form onSubmit={handleCreateFlow} className="space-y-4">
              <input
                type="text"
                placeholder="Flow name (e.g. Lead Capture Flow)"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500"
                required
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={isCreating} className="flex-1 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer">
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Flow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
