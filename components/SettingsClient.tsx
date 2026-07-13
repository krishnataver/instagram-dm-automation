"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { updateAiPrompt } from "@/actions/ai"
import { subscribeToPlan, redirectToPortal, processMockUpiPayment } from "@/actions/billing"
import { connectInstagramAccount } from "@/actions/instagram"
import { PlanType } from "@prisma/client"
import { 
  Instagram, 
  Bot, 
  CreditCard, 
  Users, 
  Check, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  Loader2,
  CheckCircle2,
  Settings,
  Copy,
  QrCode,
  X,
  ArrowRight
} from "lucide-react"

interface InstagramAccount {
  id: string
  username: string
  displayName: string | null
  instagramAccountId: string
  pageId: string | null
}

interface SettingsClientProps {
  initialPrompt: {
    promptText: string
    tone: string
    isActive: boolean
  } | null
  initialSubscription: {
    plan: PlanType
    status: string
    currentPeriodEnd: Date
  } | null
  initialTeamMembers: {
    id: string
    name: string
    email: string
    role: string
  }[]
  workspaceId: string
  connectedAccounts: InstagramAccount[]
}

export default function SettingsClient({
  initialPrompt,
  initialSubscription,
  initialTeamMembers,
  workspaceId,
  connectedAccounts: initialAccounts,
}: SettingsClientProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"integration" | "ai" | "billing" | "team">("integration")

  const searchParams = useSearchParams()

  // Instagram OAuth result banner
  const [oauthBanner, setOauthBanner] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")
    if (success === "instagram_connected") {
      setOauthBanner({ type: "success", message: "Instagram account connected successfully! " })
      setTimeout(() => setOauthBanner(null), 6000)
    } else if (error) {
      const errorMessages: Record<string, string> = {
        instagram_denied: "Instagram connection was cancelled.",
        token_failed: "Failed to get Instagram access token. Please try again.",
        no_pages: "No Facebook Pages found. Please create a Facebook Page linked to your Instagram.",
        no_instagram_business: "No Instagram Business account found linked to your Facebook Page.",
        server_error: "A server error occurred. Please try again.",
        no_workspace: "Workspace not found. Please login again.",
        invalid_state: "Invalid session. Please try connecting again.",
      }
      setOauthBanner({ type: "error", message: errorMessages[error] || "Instagram connection failed." })
      setTimeout(() => setOauthBanner(null), 8000)
    }
  }, [searchParams])

  // Instagram Connection simulator state
  const [isConnectingIg, setIsConnectingIg] = useState(false)
  const [igConnectSuccess, setIgConnectSuccess] = useState(false)

  // AI Prompt Form States
  const [promptText, setPromptText] = useState(initialPrompt?.promptText || "")
  const [promptTone, setPromptTone] = useState(initialPrompt?.tone || "helpful")
  const [promptActive, setPromptActive] = useState(initialPrompt?.isActive ?? true)
  const [aiSaveSuccess, setAiSaveSuccess] = useState(false)
  const [isSavingAi, setIsSavingAi] = useState(false)

  // Billing Actions states
  const [billingLoading, setBillingLoading] = useState<string | null>(null)
  const [billingError, setBillingError] = useState<string | null>(null)

  // Billing cycle & modal states
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "upi">("stripe")
  const [upiTxId, setUpiTxId] = useState("")
  const [upiError, setUpiError] = useState<string | null>(null)
  const [upiSuccess, setUpiSuccess] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)

  const handlePlanUpgrade = (plan: PlanType) => {
    setSelectedPlan(plan)
    setPaymentMethod("stripe")
    setUpiTxId("")
    setUpiError(null)
    setUpiSuccess(false)
    setIsPaymentModalOpen(true)
  }

  const handleStripeCheckout = async () => {
    if (!selectedPlan) return
    setBillingLoading(selectedPlan)
    setBillingError(null)
    setIsPaymentModalOpen(false)
    try {
      const response = await subscribeToPlan(selectedPlan, billingCycle)
      if (response.error) {
        setBillingError(response.error)
      } else if (response.url) {
        window.location.href = response.url
      }
    } catch (err) {
      setBillingError("Could not initiate subscription checkout.")
    } finally {
      setBillingLoading(null)
    }
  }

  const handleUpiCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan) return
    setBillingLoading("upi")
    setUpiError(null)
    try {
      const response = await processMockUpiPayment(selectedPlan, billingCycle, upiTxId)
      if (response.error) {
        setUpiError(response.error)
      } else {
        setUpiSuccess(true)
        setTimeout(() => {
          setIsPaymentModalOpen(false)
          window.location.reload()
        }, 2000)
      }
    } catch (err) {
      setUpiError("Failed to verify UPI payment. Please try again.")
    } finally {
      setBillingLoading(null)
    }
  }

  const handleCopyUpi = () => {
    navigator.clipboard.writeText("priyataver32@okaxis")
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  // Query: Connected Accounts
  const { data: accounts = initialAccounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["connectedAccounts"],
    queryFn: async () => {
      // In a dynamic app we could call a server action, or return static
      return initialAccounts
    },
    initialData: initialAccounts
  })

  // Mutations
  const updateAiMutation = useMutation({
    mutationFn: updateAiPrompt,
    onSuccess: () => {
      setAiSaveSuccess(true)
      setTimeout(() => setAiSaveSuccess(false), 3000)
    }
  })

  const handleConnectMockInstagram = async () => {
    setIsConnectingIg(true)
    try {
      // Server action call to connect mock account
      const result = await connectInstagramAccount(workspaceId, "mock_token", "mock_fb_page_id")
      if (result.error) {
        console.error("Instagram connect error:", result.error)
        alert("Failed to connect: " + result.error)
        return
      }
      setIgConnectSuccess(true)
      queryClient.invalidateQueries({ queryKey: ["connectedAccounts"] })
      setTimeout(() => {
        setIgConnectSuccess(false)
        window.location.reload() // Reload page to fetch fresh data from server component
      }, 1500)
    } catch (err) {
      console.error(err)
      alert("An unexpected error occurred while connecting Instagram.")
    } finally {
      setIsConnectingIg(false)
    }
  }

  const handleSaveAiPrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingAi(true)
    try {
      await updateAiMutation.mutateAsync({
        promptText,
        tone: promptTone,
        isActive: promptActive
      })
    } finally {
      setIsSavingAi(false)
    }
  }

// handlePlanUpgrade removed in favor of modal version above

  const handlePortalRedirect = async () => {
    setBillingLoading("portal")
    setBillingError(null)
    try {
      const response = await redirectToPortal()
      if (response.error) {
        setBillingError(response.error)
      } else if (response.url) {
        window.location.href = response.url
      }
    } catch (err) {
      setBillingError("Could not open billing portal.")
    } finally {
      setBillingLoading(null)
    }
  }

  const activePlan = initialSubscription?.plan || PlanType.FREE

  return (
    <div className="flex-1 p-8 space-y-8 bg-[#09090b]">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-pink-500" />
          Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage integrations, configure AI reply presets, view invoices, and add team members.
        </p>
      </div>

      {/* OAuth Result Banner */}
      {oauthBanner && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-sm ${
          oauthBanner.type === "success"
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {oauthBanner.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <span>{oauthBanner.message}</span>
          <button onClick={() => setOauthBanner(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("integration")}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-all ${
            activeTab === "integration"
              ? "border-pink-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Instagram className="w-3.5 h-3.5 inline mr-2" />
          Instagram Integrations
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-all ${
            activeTab === "ai"
              ? "border-pink-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Bot className="w-3.5 h-3.5 inline mr-2" />
          AI Support Agent
        </button>
        <button
          onClick={() => setActiveTab("billing")}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-all ${
            activeTab === "billing"
              ? "border-pink-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 inline mr-2" />
          Billing & Subscriptions
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-all ${
            activeTab === "team"
              ? "border-pink-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-2" />
          Workspace Team
        </button>
      </div>

      {/* Content Container */}
      <div className="max-w-4xl">
        
        {/* Tab 1: Integrations */}
        {activeTab === "integration" && (
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5 space-y-4">
              <h3 className="text-base font-bold text-white">Instagram Professional Connection</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect your business account to begin capturing direct messages. Note that Facebook policies require you to link an Instagram Professional (Creator or Business) Account to a Facebook page you manage.
              </p>

              {igConnectSuccess && (
                <div className="p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  Instagram sandbox account connected successfully! Reloading...
                </div>
              )}

              {/* Status List */}
              <div className="space-y-3 pt-2">
                {accounts.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-900 text-center text-xs text-zinc-500">
                    No Instagram accounts linked yet.
                  </div>
                ) : (
                  accounts.map((acc) => (
                    <div key={acc.id} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-pink-500/15 text-pink-500">
                          <Instagram className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{acc.displayName || acc.username}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Username: @{acc.username} • ID: {acc.instagramAccountId}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-bold uppercase tracking-wider">
                        Active Connection
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Connect buttons */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleConnectMockInstagram}
                  disabled={isConnectingIg || igConnectSuccess}
                  className="px-4 py-2.5 bg-gradient-to-tr from-pink-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pink-500/5"
                >
                  {isConnectingIg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Instagram className="w-4 h-4" />
                      Quick Connect Sandbox Instagram (Simulator)
                    </>
                  )}
                </button>

                <a
                  href="/api/auth/instagram"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  <Instagram className="w-4 h-4" />
                  Connect Real Instagram Account
                </a>
              </div>
            </div>

            {/* Config Webhook Box */}
            <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5 space-y-3">
              <h4 className="text-sm font-bold text-white">Webhook Ingestion Endpoint</h4>
              <p className="text-xs text-zinc-500 leading-normal">
                If configuring a production application in the Facebook App dashboard, enter the following configurations:
              </p>
              <div className="space-y-2 mt-4 text-xs font-mono bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                <p className="text-zinc-400"><span className="text-pink-400">Callback URL:</span> http://yourdomain.com/api/webhooks/instagram</p>
                <p className="text-zinc-400"><span className="text-pink-400">Verify Token:</span> instagram_dm_automation_webhook_verify_token</p>
                <p className="text-zinc-400"><span className="text-pink-400">Subscriptions:</span> messages, messaging_postbacks</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: AI Support configurations */}
        {activeTab === "ai" && (
          <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-2">
              <Bot className="w-5 h-5 text-purple-500" />
              AI Assistant Settings & FAQ Base
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              When no keyword rules match incoming DMs, InstaSponder escalates to this OpenAI model. Train your assistant by writing details about your store, products, and FAQ policies below.
            </p>

            {aiSaveSuccess && (
              <div className="mb-6 p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5" />
                AI FAQ training system guidelines updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveAiPrompt} className="space-y-5">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/40 border border-zinc-850">
                <div>
                  <label className="text-xs font-bold text-white block">Enable AI Autopilot</label>
                  <span className="text-[10px] text-zinc-500">Enable automated fallback replies for unrecognized questions.</span>
                </div>
                <input
                  type="checkbox"
                  checked={promptActive}
                  onChange={(e) => setPromptActive(e.target.checked)}
                  className="w-4 h-4 rounded text-pink-500 bg-zinc-800 border-zinc-700"
                />
              </div>

              {/* Tone */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Assistant Tone Preset
                </label>
                <select
                  value={promptTone}
                  onChange={(e) => setPromptTone(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-pink-500"
                >
                  <option value="helpful">Helpful & Polite (Default)</option>
                  <option value="professional">Professional & Informative</option>
                  <option value="casual">Casual & Friendly</option>
                  <option value="witty">Witty & Energetic</option>
                  <option value="formal">Formal & Structured</option>
                </select>
              </div>

              {/* Prompt Text / Knowledge base */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Custom FAQ Guidelines & Brand Rules (System Prompt)
                </label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={8}
                  placeholder="e.g. You are a support bot for 'Luxe Threads'. We specialize in selling custom apparel. Pricing: jackets are $99, t-shirts are $29. Shipping takes 3-5 business days. Return policy: 30 days."
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-850 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSavingAi}
                className="px-6 py-2.5 bg-gradient-to-tr from-pink-500 to-indigo-600 text-white text-xs font-bold rounded-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-pink-500/10"
              >
                {isSavingAi ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Save Training Guidelines
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Billing & Plans */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            
            {billingError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5" />
                {billingError}
              </div>
            )}

            {/* Stripe customer billing portal button if not free */}
            {activePlan !== PlanType.FREE && (
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-850 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Manage Subscriptions</h4>
                  <p className="text-[10px] text-zinc-500">Update payment methods, view invoices, or cancel plans via Stripe.</p>
                </div>
                <button
                  onClick={handlePortalRedirect}
                  disabled={billingLoading === "portal"}
                  className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  {billingLoading === "portal" ? "Redirecting..." : "Open Stripe Billing Portal"}
                </button>
              </div>
            )}

            {/* Billing Cycle Toggle */}
            <div className="flex justify-center mb-8">
              <div className="bg-zinc-905 border border-zinc-800 p-1 rounded-xl inline-flex items-center gap-1 bg-zinc-900/60 backdrop-blur-md">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    billingCycle === "monthly"
                      ? "bg-pink-500 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    billingCycle === "yearly"
                      ? "bg-pink-500 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Yearly (Save 17%)
                </button>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Free Card */}
              <div className={`glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5 flex flex-col justify-between relative ${
                activePlan === PlanType.FREE ? "border-pink-500/40 bg-pink-500/[0.02]" : ""
              }`}>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Free Tier</span>
                  <div className="mt-4 flex items-baseline text-white">
                    <span className="text-3xl font-extrabold">$0</span>
                    <span className="text-xs text-zinc-500 ml-1">/ forever</span>
                  </div>
                  
                  <ul className="mt-6 space-y-2 text-[11px] text-zinc-400">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> 1 Instagram Connection</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> 100 AI Replies/mo</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Standard dashboard logs</li>
                  </ul>
                </div>
                
                <button
                  disabled
                  className="mt-8 w-full py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-600 text-xs font-bold cursor-not-allowed text-center"
                >
                  {activePlan === PlanType.FREE ? "Current Plan" : "Downgrade"}
                </button>
              </div>

              {/* Pro Card */}
              <div className={`glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5 flex flex-col justify-between relative ${
                activePlan === PlanType.PRO ? "border-pink-500/40 bg-pink-500/[0.02]" : ""
              }`}>
                <div className="absolute right-4 top-4 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[8px] font-bold uppercase tracking-wider">
                  Popular
                </div>

                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Pro Tier</span>
                  <div className="mt-4 flex items-baseline text-white">
                    <span className="text-3xl font-extrabold">{billingCycle === "monthly" ? "$4" : "$40"}</span>
                    <span className="text-xs text-zinc-500 ml-1">{billingCycle === "monthly" ? "/ month" : "/ year"}</span>
                  </div>
                  <p className="text-[10px] text-pink-400 font-semibold mt-1.5 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> 3-day free trial included
                  </p>

                  <ul className="mt-6 space-y-2 text-[11px] text-zinc-400">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Unlimited Automations</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Unlimited AI DMs</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Add Team Members</li>
                  </ul>
                </div>

                <button
                  onClick={() => handlePlanUpgrade(PlanType.PRO)}
                  disabled={activePlan === PlanType.PRO || billingLoading === "PRO"}
                  className="mt-8 w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                >
                  {billingLoading === "PRO" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : activePlan === PlanType.PRO ? (
                    "Active Plan"
                  ) : (
                    "Upgrade to Pro"
                  )}
                </button>
              </div>

              {/* Enterprise Card */}
              <div className={`glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5 flex flex-col justify-between relative ${
                activePlan === PlanType.ENTERPRISE ? "border-pink-500/40 bg-pink-500/[0.02]" : ""
              }`}>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Enterprise</span>
                  <div className="mt-4 flex items-baseline text-white">
                    <span className="text-3xl font-extrabold">{billingCycle === "monthly" ? "$149" : "$1490"}</span>
                    <span className="text-xs text-zinc-500 ml-1">{billingCycle === "monthly" ? "/ month" : "/ year"}</span>
                  </div>
                  <p className="text-[10px] text-pink-400 font-semibold mt-1.5 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> 3-day free trial included
                  </p>

                  <ul className="mt-6 space-y-2 text-[11px] text-zinc-400">
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Unlimited Everything</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Priority Support</li>
                    <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-500 shrink-0" /> Dedicated Account Manager</li>
                  </ul>
                </div>

                <button
                  onClick={() => handlePlanUpgrade(PlanType.ENTERPRISE)}
                  disabled={activePlan === PlanType.ENTERPRISE || billingLoading === "ENTERPRISE"}
                  className="mt-8 w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                >
                  {billingLoading === "ENTERPRISE" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : activePlan === PlanType.ENTERPRISE ? (
                    "Active Plan"
                  ) : (
                    "Upgrade Enterprise"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Team settings */}
        {activeTab === "team" && (
          <div className="glass-panel rounded-3xl p-6 bg-[#121217]/20 border-white/5 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Workspace Members</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-normal">
                List of collaborative team agents assigned to answer customer direct messages inside your collaborative live inbox.
              </p>
            </div>

            {/* Members table */}
            <div className="divide-y divide-white/5">
              {initialTeamMembers.map((member) => (
                <div key={member.id} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold border border-white/5">
                      {member.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-white">{member.name}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{member.email}</p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-850 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>

            {/* Add Team Note alert */}
            <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-850 text-zinc-400 text-[11px] leading-relaxed">
              <strong>Tip:</strong> Need to add team agents? Share your Credentials logins or upgrade to Pro to unlock direct team invitations with RBAC permissions (Owner, Admin, Agent).
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal for Card vs UPI / QR */}
      {isPaymentModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-white/5 bg-[#121217]/90 backdrop-blur-md shadow-2xl relative space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-pink-500" />
                  Upgrade Workspace
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Select payment method for <span className="text-white font-semibold">{selectedPlan}</span> ({billingCycle}) plan.
                </p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/5 text-zinc-455 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-900 rounded-2xl">
              <button
                type="button"
                onClick={() => setPaymentMethod("stripe")}
                className={`py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === "stripe"
                    ? "bg-pink-500 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Credit Card (Stripe)
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("upi")}
                className={`py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  paymentMethod === "upi"
                    ? "bg-pink-500 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <QrCode className="w-4 h-4" />
                UPI / QR Code
              </button>
            </div>

            {/* Payment Form Area */}
            {paymentMethod === "stripe" ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You will be securely redirected to Stripe Checkout to configure your card.
                </p>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-zinc-300 space-y-2">
                  <div className="flex justify-between">
                    <span>Plan:</span>
                    <span className="text-white font-bold">{selectedPlan} ({billingCycle})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trial Period:</span>
                    <span className="text-pink-400 font-bold">3 Days Free Trial</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span>Amount Due Later:</span>
                    <span className="text-white font-bold">
                      {selectedPlan === PlanType.PRO 
                        ? (billingCycle === "monthly" ? "$4/mo" : "$40/yr")
                        : (billingCycle === "monthly" ? "$149/mo" : "$1490/yr")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStripeCheckout}
                  disabled={billingLoading === selectedPlan}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pink-500/20"
                >
                  {billingLoading === selectedPlan ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Proceed to Stripe Checkout
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleUpiCheckout} className="space-y-4">
                
                {/* UPI Errors / Success */}
                {upiError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    {upiError}
                  </div>
                )}
                {upiSuccess && (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Payment submitted successfully! Upgraded to {selectedPlan}.
                  </div>
                )}

                {/* Display QR Code */}
                <div className="text-center space-y-3">
                  <div className="p-2 bg-white rounded-3xl inline-block shadow-md">
                    <img 
                      src="/upi-qr.jpg" 
                      alt="UPI QR Code" 
                      className="w-48 h-48 object-contain mx-auto"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-normal px-4">
                    Scan the QR code above with Google Pay, PhonePe, Paytm, BHIM, or any UPI app.
                  </div>
                </div>

                {/* UPI Details */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">UPI ID:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-white font-bold font-mono">priyataver32@okaxis</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="p-1 text-zinc-400 hover:text-white rounded hover:bg-white/5 cursor-pointer transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedUpi ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Amount to Transfer:</span>
                    <span className="text-white font-bold">
                      {selectedPlan === PlanType.PRO 
                        ? (billingCycle === "monthly" ? "$4 / approx ₹330" : "$40 / approx ₹3300")
                        : (billingCycle === "monthly" ? "$149 / approx ₹12300" : "$1490 / approx ₹123000")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Free Trial Applied:</span>
                    <span className="text-pink-400 font-bold">3 Days Free Trial</span>
                  </div>
                </div>

                {/* Transaction ID Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    UPI Transaction ID / Ref No
                  </label>
                  <input
                    type="text"
                    required
                    value={upiTxId}
                    onChange={(e) => setUpiTxId(e.target.value)}
                    placeholder="Enter the 12-digit transaction ID"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-900 text-white placeholder-zinc-650 focus:outline-none focus:border-pink-500 text-xs font-mono"
                    disabled={billingLoading === "upi" || upiSuccess}
                  />
                </div>

                <button
                  type="submit"
                  disabled={billingLoading === "upi" || upiSuccess}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pink-500/20"
                >
                  {billingLoading === "upi" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Confirm Payment & Start Trial
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}
      </div>
  )
}
