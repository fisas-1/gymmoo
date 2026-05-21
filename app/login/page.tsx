'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useTranslation } from '../contexts/LanguageContext'
import LanguageSelector from '../components/LanguageSelector'
import Logo from '../components/Logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const { user, signIn, signUp, resetPassword } = useAuth()
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    if (user) router.replace('/')
  }, [user, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, username)

    setLoading(false)

    if (result?.error) {
      if (result.error.includes('Invalid login credentials')) {
        setError(t('login.invalidCredentials'))
      } else {
        setError(result.error)
      }
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError(t('login.enterEmail'))
      return
    }
    setError(null)
    setLoading(true)
    const result = await resetPassword(email)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setResetEmailSent(true)
    }
  }

  function renderForgotPasswordForm() {
    if (resetEmailSent) {
      return (
        <div className="text-center">
          <p className="text-[var(--good)] text-sm mb-4">
            {t('login.resetPassword')}<br />
            {t('login.resetPasswordHint')}
          </p>
          <button
            onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); setEmail(''); }}
            className="text-sm text-[var(--text-3)] hover:text-[var(--text)] underline transition-colors"
          >
            ← {t('common.cancel')}
          </button>
        </div>
      )
    }
    return (
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <p className="text-sm text-[var(--text-3)] mb-2">
          {t('login.resetPasswordHint')}
        </p>
        <div>
          <label className="section-label block mb-2">{t('login.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full bg-[var(--surface-strong)] text-[var(--text)] rounded-2xl px-4 py-3 border border-transparent focus:outline-none focus:border-[var(--rule)] placeholder:text-[var(--text-3)]"
            required
            autoComplete="email"
          />
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--accent-danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setShowForgotPassword(false); setError(null) }}
            className="flex-1 py-3 rounded-2xl bg-[var(--surface-strong)] text-[var(--text-2)] font-light hover:bg-[var(--surface-hover)] transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-2xl font-medium bg-[var(--accent)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? t('common.loading') : t('common.send')}
          </button>
        </div>
      </form>
    )
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-6">
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-1"><Logo size="lg" /></div>
          <p className="section-label text-center mb-6">{t('home.tagline')}</p>
          <div className="bg-[var(--card)] border border-[var(--rule)] rounded-3xl p-6 sm:p-8" style={{ boxShadow: 'var(--shadow)' }}>
            <h3 className="text-lg font-light text-[var(--text)] mb-4">{t('login.resetPassword')}</h3>
            {renderForgotPasswordForm()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-6 py-10">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <div className="w-full max-w-sm animate-slide-up">
        <h1 className="text-3xl font-light tracking-tight mb-1 text-center">gym.</h1>
        <p className="section-label text-center mb-6">{t('home.tagline')}</p>

        <div className="bg-[var(--card)] border border-[var(--rule)] rounded-3xl p-6 sm:p-8" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="flex mb-6 bg-[var(--surface-strong)] rounded-full p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                isLogin
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              {t('common.login')}
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                !isLogin
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              {t('common.register')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="section-label block mb-2">{t('login.username')}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.placeholderUsername')}
                  className="w-full bg-[var(--surface-strong)] text-[var(--text)] rounded-2xl px-4 py-3 border border-transparent focus:outline-none focus:border-[var(--rule)] placeholder:text-[var(--text-3)]"
                  required
                  autoComplete="username"
                />
              </div>
            )}

            <div>
              <label className="section-label block mb-2">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-[var(--surface-strong)] text-[var(--text)] rounded-2xl px-4 py-3 border border-transparent focus:outline-none focus:border-[var(--rule)] placeholder:text-[var(--text-3)]"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="section-label block mb-2">{t('login.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--surface-strong)] text-[var(--text)] rounded-2xl px-4 py-3 border border-transparent focus:outline-none focus:border-[var(--rule)] pr-12 placeholder:text-[var(--text-3)]"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--surface-hover)] transition-colors"
                  aria-label={t('login.togglePassword')}
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--accent-danger)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]"
            >
              {loading
                ? (isLogin ? t('login.loggingIn') : t('login.registering'))
                : (isLogin ? t('common.login') : t('common.register'))}
            </button>
          </form>

          <div className="mt-5 flex justify-center">
            <button
              onClick={() => { setShowForgotPassword(true); setError(null) }}
              className="text-xs text-[var(--text-3)] hover:text-[var(--text)] hover:underline transition-colors"
            >
              {t('login.forgotPassword')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
