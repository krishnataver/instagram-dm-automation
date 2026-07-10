"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { requestPasswordReset } from "@/actions/auth"
import { MessageCircle, ArrowRight, Loader2, AlertCircle, CheckCircle2, Key } from "lucide-react"

const schema = z.object({
  email: z.string().email("Invalid email address"),
})

type ForgotForm = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sandboxLink, setSandboxLink] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: ForgotForm) => {
    setError(null)
    setSandboxLink(null)
    setLoading(true)

    try {
      const response = await requestPasswordReset(data.email)
      if (response.error) {
        setError(response.error)
      } else {
        setSuccess(true)
        if (response.resetLink) {
          setSandboxLink(response.resetLink)
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative p-4 overflow-hidden bg-[#09090b]">
      {/* Decorative Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md animate-slide-up relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-600 mb-4 shadow-lg shadow-pink-500/10">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            InstaSponder
          </h1>
          <p className="text-sm text-zinc-400 mt-2">
            Reset your password and regain workspace access
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-3xl p-8 shadow-2xl relative border border-white/5 bg-[#121217]/70 backdrop-blur-md">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Reset instructions prepared!</p>
                  <p className="mt-1 text-zinc-400 text-xs">
                    If this user exists, a reset link has been dispatched to their email address.
                  </p>
                </div>
              </div>

              {sandboxLink && (
                <div className="p-5 rounded-2xl border border-pink-500/20 bg-pink-500/5 mt-4 space-y-4">
                  <div className="flex items-center gap-2 text-pink-400 text-xs font-semibold uppercase tracking-wider">
                    <Key className="w-4 h-4" />
                    Sandbox Helper Mode
                  </div>
                  <p className="text-xs text-zinc-300">
                    Since the application is running in local Sandbox Mode, you can bypass email dispatch and reset the password directly by clicking this button:
                  </p>
                  <Link
                    href={sandboxLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold text-xs hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-pink-500/10"
                  >
                    Reset Password Now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-zinc-400 hover:text-white transition-colors">
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <p className="text-zinc-400 text-xs leading-relaxed">
                Enter your account email below. We'll send you a password reset link to securely update your credentials.
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2" htmlFor="email">
                  Email Address
                </label>
                <input
                  {...register("email")}
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all text-sm"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white font-semibold text-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-pink-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 mt-2"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
                <p className="text-xs text-zinc-400 font-semibold">
                  Remember your password?{" "}
                  <Link href="/login" className="text-pink-400 hover:text-pink-300 transition-colors ml-1">
                    Sign In
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
