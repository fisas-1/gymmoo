'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from '../contexts/LanguageContext'

type FriendStats = {
  id: string
  username: string
  totalWorkouts: number
  consistency: number
  lastWorkout: string | null
  avatarUrl?: string | null
}

function daysSince(lastWorkout: string | null): number {
  if (!lastWorkout) return 999
  const diff = Date.now() - new Date(lastWorkout).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }

export default function AmicsPage() {
  const { user } = useAuth()
  const { t, locale } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<FriendStats[]>([])
  const [searching, setSearching] = useState(false)
  const [myStats, setMyStats] = useState<FriendStats | null>(null)
  const [reactions, setReactions] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (user) {
      loadMyStats()
    } else {
      setMyStats(null)
    }
  }, [user])

  async function loadMyStats() {
    if (!user) return

    const { data: logs } = await supabase
      .from('workout_logs')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (logs && logs.length > 0) {
      const uniqueDays = new Set(logs.map(l => new Date(l.created_at).toDateString()))
      const last30 = new Date()
      last30.setDate(last30.getDate() - 30)
      const recentDays = new Set(
        logs.filter(l => new Date(l.created_at) >= last30)
            .map(l => new Date(l.created_at).toDateString())
      )
      const { data: profile } = await supabase
        .from('profiles').select('username, avatar_url').eq('id', user.id).single()
      setMyStats({
        id: user.id,
        username: profile?.username || user.email?.split('@')[0] || 'Tu',
        totalWorkouts: uniqueDays.size,
        consistency: Math.round((recentDays.size / 30) * 100),
        lastWorkout: logs[0]?.created_at || null,
        avatarUrl: profile?.avatar_url || null,
      })
    } else {
      const { data: profile } = await supabase
        .from('profiles').select('username, avatar_url').eq('id', user.id).single()
      setMyStats({
        id: user.id,
        username: profile?.username || user.email?.split('@')[0] || 'Tu',
        totalWorkouts: 0,
        consistency: 0,
        lastWorkout: null,
        avatarUrl: profile?.avatar_url || null,
      })
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${searchQuery.trim()}%`)
      .limit(10)

    if (error) {
      console.error('Error searching users:', error)
      setSearching(false)
      return
    }

    if (profiles && profiles.length > 0) {
      const usersWithStats = await Promise.all(profiles.map(async (profile) => {
        const [{ data: logs }, { data: prof }] = await Promise.all([
          supabase.from('workout_logs').select('created_at').eq('user_id', profile.id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('avatar_url').eq('id', profile.id).single(),
        ])

        const uniqueDays = new Set(logs?.map(l => new Date(l.created_at).toDateString()) || [])
        const last30 = new Date()
        last30.setDate(last30.getDate() - 30)
        const recentDays = new Set(
          (logs || []).filter(l => new Date(l.created_at) >= last30)
                     .map(l => new Date(l.created_at).toDateString())
        )
        return {
          id: profile.id,
          username: profile.username,
          totalWorkouts: uniqueDays.size,
          consistency: Math.round((recentDays.size / 30) * 100),
          lastWorkout: logs && logs.length > 0 ? logs[0].created_at : null,
          avatarUrl: prof?.avatar_url || null,
        }
      }))
      setResults(usersWithStats)
    } else {
      setResults([])
    }
    setSearching(false)
  }

  function handleReaction(userId: string, type: 'volt' | 'energia' | 'motivar' | 'empenyer') {
    const msgs: Record<string, string> = {
      volt:     t('friends.reactionVolt'),
      energia:  t('friends.reactionEnergia'),
      motivar:  t('friends.reactionMotivar'),
      empenyer: t('friends.reactionEmpenyer'),
    }
    setReactions(prev => ({ ...prev, [userId]: msgs[type] }))
    setTimeout(() => setReactions(prev => ({ ...prev, [userId]: null })), 2500)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--bg)]">
        <div className="text-center max-w-sm space-y-6">
          <p className="section-label mb-1">{t('friends.feedSubtitle')}</p>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)]">{t('friends.title')}.</h1>
          <p className="text-sm text-[var(--text-3)]">{t('friends.searchToSeeRanking')}</p>
          <a
            href="/login"
            className="inline-block py-3.5 px-8 rounded-full font-medium text-[13px] text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {t('common.login')}
          </a>
        </div>
      </div>
    )
  }

  const allUsers = myStats ? [myStats, ...results.filter(u => u.id !== myStats.id)] : results
  const sorted = [...allUsers].sort((a, b) => b.consistency - a.consistency)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="px-5 pt-12 pb-0 max-w-2xl mx-auto">
        <p className="section-label mb-1">{t('friends.feedSubtitle')}</p>
        <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)]">
          {t('friends.title')}.
        </h1>
      </div>

      <div className="px-5 pt-5 pb-6 space-y-4 max-w-2xl mx-auto">
        {/* Search */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--rule)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('friends.searchUser')}
            className="flex-1 text-[13px] bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-3)]"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {searching ? '…' : t('friends.search') || 'Cercar'}
          </button>
        </div>

        {/* Ranking */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="section-label">{t('friends.ranking')} · {t('friends.period30d')}</p>
            {sorted.length > 0 && (
              <span className="font-mono text-[10px] text-[var(--text-3)]">{sorted.length} {t('friends.users')}</span>
            )}
          </div>

          {sorted.length === 0 ? (
            <div
              className="py-10 rounded-2xl text-center"
              style={{ backgroundColor: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <p className="text-sm text-[var(--text-3)]">{t('friends.searchToSeeRanking')}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sorted.map((u, idx) => {
                const isMe = myStats && u.id === myStats.id
                const days = daysSince(u.lastWorkout)
                const isDanger = !isMe && days >= 3
                const isHot = !isMe && u.consistency >= 60 && days <= 3
                const medal = MEDAL[idx] ?? null

                const consistencyColor = u.consistency >= 70
                  ? 'var(--good)'
                  : u.consistency >= 40
                    ? 'var(--text)'
                    : 'var(--text-3)'

                const barColor = u.consistency === 0
                  ? 'var(--text-3)'
                  : isMe
                    ? 'var(--accent)'
                    : u.consistency >= 70
                      ? 'var(--good)'
                      : 'var(--text-2)'

                return (
                  <div
                    key={u.id}
                    className="card-surface px-4 pt-3.5 pb-3 relative overflow-hidden"
                    style={{
                      ...(isMe ? { borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' } : {}),
                      animation: `dopSlideUp 500ms ${idx * 60 + 100}ms cubic-bezier(.22,1,.36,1) both`,
                    }}
                  >
                    {/* Accent top line for "me" */}
                    {isMe && (
                      <div
                        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                        style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
                      />
                    )}

                    {/* Main row */}
                    <div className="flex items-center gap-2.5">
                      {/* Rank */}
                      <span className="font-mono text-[13px] tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                        {medal ?? `${idx + 1}.`}
                      </span>

                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold overflow-hidden"
                        style={{
                          backgroundColor: isMe ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'var(--card-hi)',
                          color: isMe ? 'var(--accent)' : 'var(--text-2)',
                          border: `1px solid ${isMe ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--rule)'}`,
                        }}
                      >
                        {u.avatarUrl
                          ? <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                          : u.username[0]?.toUpperCase()
                        }
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-[15px] tracking-tight text-[var(--text)] truncate">{u.username}</p>
                          {isMe && (
                            <span
                              className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                                color: 'var(--accent)',
                              }}
                            >
                              {t('friends.youLabel')}
                            </span>
                          )}
                          {isHot && (
                            <span
                              className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--good) 15%, transparent)',
                                color: 'var(--good)',
                              }}
                            >
                              🔥 {t('friends.onStreak')}
                            </span>
                          )}
                          {isDanger && (
                            <span
                              className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                                color: 'var(--danger)',
                              }}
                            >
                              ⚠️ {days === 999 ? t('friends.noActivity') : t('friends.daysInactive', { days: String(days) })}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] mt-0.5 tabular-nums" style={{ color: 'var(--text-3)' }}>
                          {u.lastWorkout
                            ? new Date(u.lastWorkout).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
                            : t('friends.noActivity')}
                        </p>
                      </div>

                      {/* Consistency */}
                      <div className="text-right flex-shrink-0">
                        <p
                          className="font-mono text-[22px] font-medium leading-none tabular-nums tracking-[-0.02em]"
                          style={{ color: consistencyColor }}
                        >
                          {u.consistency}<span className="text-[11px]" style={{ color: 'var(--text-3)' }}>%</span>
                        </p>
                        <p className="font-mono text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-3)' }}>
                          {t('friends.consistency')}
                        </p>
                      </div>
                    </div>

                    {/* Consistency bar */}
                    <div className="mt-3 pl-[3.75rem]">
                      <div className="h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--rule-soft)' }}>
                        <div
                          className="h-full rounded-full progress-fill transition-all duration-700"
                          style={{ width: `${u.consistency}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>

                    {/* Reaction feedback */}
                    {reactions[u.id] && (
                      <p className="mt-2 text-xs font-medium text-center reaction-pop" style={{ color: 'var(--accent)' }}>
                        {reactions[u.id]}
                      </p>
                    )}

                    {/* Reaction buttons */}
                    {!isMe && (
                      <div className="mt-3 flex gap-1.5 flex-wrap pl-[3.75rem]">
                        {isDanger ? (
                          <>
                            <button
                              onClick={() => handleReaction(u.id, 'motivar')}
                              className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                                color: 'var(--accent)',
                                borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                              }}
                            >
                              {t('friends.mootivate')}
                            </button>
                            <button
                              onClick={() => handleReaction(u.id, 'empenyer')}
                              className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                                color: 'var(--danger)',
                                borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                              }}
                            >
                              {t('friends.pushThem')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleReaction(u.id, 'volt')}
                              className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                              style={{
                                backgroundColor: 'transparent',
                                color: 'var(--text-2)',
                                borderColor: 'var(--rule)',
                              }}
                            >
                              {t('friends.giveVolt')}
                            </button>
                            <button
                              onClick={() => handleReaction(u.id, 'motivar')}
                              className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                              style={{
                                backgroundColor: 'transparent',
                                color: 'var(--text-2)',
                                borderColor: 'var(--rule)',
                              }}
                            >
                              {t('friends.mootivate')}
                            </button>
                            <button
                              onClick={() => handleReaction(u.id, 'energia')}
                              className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                              style={{
                                backgroundColor: 'transparent',
                                color: 'var(--text-2)',
                                borderColor: 'var(--rule)',
                              }}
                            >
                              {t('friends.injectEnergy')}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="h-24" />
    </div>
  )
}
