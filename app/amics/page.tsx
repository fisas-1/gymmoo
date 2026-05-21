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

type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'rejected'
}

function daysSince(lastWorkout: string | null): number {
  if (!lastWorkout) return 999
  const diff = Date.now() - new Date(lastWorkout).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }

async function fetchUserStats(profileId: string, username: string, avatarUrl: string | null): Promise<FriendStats> {
  const { data: logs } = await supabase
    .from('workout_logs')
    .select('created_at')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })

  const uniqueDays = new Set((logs || []).map(l => new Date(l.created_at).toDateString()))
  const last30 = new Date()
  last30.setDate(last30.getDate() - 30)
  const recentDays = new Set(
    (logs || []).filter(l => new Date(l.created_at) >= last30)
               .map(l => new Date(l.created_at).toDateString())
  )
  return {
    id: profileId,
    username,
    totalWorkouts: uniqueDays.size,
    consistency: Math.round((recentDays.size / 30) * 100),
    lastWorkout: logs && logs.length > 0 ? logs[0].created_at : null,
    avatarUrl,
  }
}

export default function AmicsPage() {
  const { user } = useAuth()
  const { t, locale } = useTranslation()

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<FriendStats[]>([])
  const [searching, setSearching] = useState(false)

  // My stats
  const [myStats, setMyStats] = useState<FriendStats | null>(null)

  // Reactions UI feedback
  const [reactions, setReactions] = useState<Record<string, string | null>>({})

  // Friendships
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [friendStats, setFriendStats] = useState<FriendStats[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)

  // Tabs: 'friends' | 'search'
  const [tab, setTab] = useState<'friends' | 'search'>('friends')

  useEffect(() => {
    if (user) {
      loadMyStats()
      loadFriendships()
    } else {
      setMyStats(null)
      setFriendships([])
      setFriendStats([])
    }
  }, [user])

  async function loadMyStats() {
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('username, avatar_url').eq('id', user.id).single()
    const stats = await fetchUserStats(
      user.id,
      profile?.username || user.email?.split('@')[0] || 'Tu',
      profile?.avatar_url || null
    )
    setMyStats(stats)
  }

  async function loadFriendships() {
    if (!user) return
    setLoadingFriends(true)
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const all = (data || []) as Friendship[]
    setFriendships(all)

    // Load stats for accepted friends
    const accepted = all.filter(f => f.status === 'accepted')
    const friendIds = accepted.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)

    if (friendIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', friendIds)

      const stats = await Promise.all((profiles || []).map(p =>
        fetchUserStats(p.id, p.username, p.avatar_url)
      ))
      setFriendStats(stats)
    } else {
      setFriendStats([])
    }
    setLoadingFriends(false)
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${searchQuery.trim()}%`)
      .limit(10)

    if (error) { setSearching(false); return }

    if (profiles && profiles.length > 0) {
      const usersWithStats = await Promise.all(
        profiles.map(p => fetchUserStats(p.id, p.username, p.avatar_url))
      )
      setResults(usersWithStats)
    } else {
      setResults([])
    }
    setSearching(false)
  }

  async function handleReaction(userId: string, type: 'volt' | 'energia' | 'motivar' | 'empenyer') {
    const msgs: Record<string, string> = {
      volt:     t('friends.reactionVolt'),
      energia:  t('friends.reactionEnergia'),
      motivar:  t('friends.reactionMotivar'),
      empenyer: t('friends.reactionEmpenyer'),
    }
    setReactions(prev => ({ ...prev, [userId]: msgs[type] }))
    setTimeout(() => setReactions(prev => ({ ...prev, [userId]: null })), 2500)

    if (user) {
      await supabase.from('reactions').insert({
        from_user_id: user.id,
        to_user_id: userId,
        type,
      })
    }
  }

  async function handleSendFriendRequest(addresseeId: string) {
    if (!user) return
    const { data, error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      status: 'pending',
    }).select().single()
    if (!error && data) {
      setFriendships(prev => [...prev, data as Friendship])
    }
  }

  async function handleAcceptFriend(friendshipId: string) {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
    if (!error) await loadFriendships()
  }

  async function handleRejectFriend(friendshipId: string) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (!error) {
      setFriendships(prev => prev.filter(f => f.id !== friendshipId))
      await loadFriendships()
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    if (!error) await loadFriendships()
  }

  function getFriendshipWith(userId: string): Friendship | undefined {
    return friendships.find(f =>
      (f.requester_id === user?.id && f.addressee_id === userId) ||
      (f.addressee_id === user?.id && f.requester_id === userId)
    )
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

  // Pending requests received (others sent to me)
  const pendingReceived = friendships.filter(f => f.addressee_id === user.id && f.status === 'pending')
  // Pending requests sent by me
  const pendingSent = friendships.filter(f => f.requester_id === user.id && f.status === 'pending')

  // Ranking for friends tab: accepted friends + me
  const friendsRanking = myStats
    ? [myStats, ...friendStats.filter(u => u.id !== myStats.id)]
    : friendStats
  const sortedFriends = [...friendsRanking].sort((a, b) => b.consistency - a.consistency)

  // Ranking for search tab
  const allSearch = myStats ? [myStats, ...results.filter(u => u.id !== myStats.id)] : results
  const sortedSearch = [...allSearch].sort((a, b) => b.consistency - a.consistency)

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

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--rule)' }}>
          {(['friends', 'search'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all"
              style={{
                backgroundColor: tab === tabKey ? 'var(--accent)' : 'transparent',
                color: tab === tabKey ? '#fff' : 'var(--text-3)',
              }}
            >
              {tabKey === 'friends'
                ? `${t('friends.tabFriends')}${friendStats.length > 0 ? ` (${friendStats.length})` : ''}`
                : t('friends.tabSearch')
              }
            </button>
          ))}
        </div>

        {/* Pending requests — always visible */}
        {pendingReceived.length > 0 && (
          <div className="space-y-2">
            <p className="section-label">{t('friends.pendingRequests')}</p>
            {pendingReceived.map(f => {
              const requesterStats = [...friendStats, ...(results || [])].find(u => u.id === f.requester_id)
              return (
                <div
                  key={f.id}
                  className="card-surface px-4 py-3 flex items-center gap-3"
                  style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ backgroundColor: 'var(--card-hi)', color: 'var(--text-2)', border: '1px solid var(--rule)' }}
                  >
                    {requesterStats?.avatarUrl
                      ? <img src={requesterStats.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                      : (requesterStats?.username?.[0]?.toUpperCase() ?? '?')
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">
                      {requesterStats?.username ?? t('friends.unknownUser')}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--text-3)]">{t('friends.wantsToBeYourFriend')}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptFriend(f.id)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-opacity hover:opacity-80"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                      {t('friends.accept')}
                    </button>
                    <button
                      onClick={() => handleRejectFriend(f.id)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition-opacity hover:opacity-80"
                      style={{ color: 'var(--text-3)', borderColor: 'var(--rule)' }}
                    >
                      {t('friends.reject')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* FRIENDS TAB */}
        {tab === 'friends' && (
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <p className="section-label">{t('friends.ranking')} · {t('friends.period30d')}</p>
              {sortedFriends.length > 1 && (
                <span className="font-mono text-[10px] text-[var(--text-3)]">{sortedFriends.length} {t('friends.users')}</span>
              )}
            </div>

            {loadingFriends ? (
              <div className="py-10 flex justify-center">
                <div className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--rule)', borderTopColor: 'var(--accent)' }} />
              </div>
            ) : sortedFriends.length <= 1 ? (
              <div
                className="py-10 rounded-2xl text-center space-y-2"
                style={{ backgroundColor: 'var(--card)', border: '1px solid var(--rule)' }}
              >
                <p className="text-sm text-[var(--text-3)]">{t('friends.noFriendsYet')}</p>
                <button
                  onClick={() => setTab('search')}
                  className="px-4 py-2 rounded-full text-[12px] font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                >
                  {t('friends.findFriends')}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedFriends.map((u, idx) => (
                  <UserCard
                    key={u.id}
                    u={u}
                    idx={idx}
                    isMe={myStats?.id === u.id}
                    myId={user.id}
                    friendship={getFriendshipWith(u.id)}
                    reaction={reactions[u.id]}
                    locale={locale}
                    t={t}
                    onReaction={handleReaction}
                    onSendRequest={handleSendFriendRequest}
                    onAccept={handleAcceptFriend}
                    onReject={handleRejectFriend}
                    onRemove={handleRemoveFriend}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === 'search' && (
          <div className="space-y-4">
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
                {searching ? '…' : t('friends.search')}
              </button>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-3">
                <p className="section-label">{t('friends.ranking')} · {t('friends.period30d')}</p>
                {sortedSearch.length > 0 && (
                  <span className="font-mono text-[10px] text-[var(--text-3)]">{sortedSearch.length} {t('friends.users')}</span>
                )}
              </div>

              {sortedSearch.length === 0 ? (
                <div
                  className="py-10 rounded-2xl text-center"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--rule)' }}
                >
                  <p className="text-sm text-[var(--text-3)]">{t('friends.searchToSeeRanking')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortedSearch.map((u, idx) => (
                    <UserCard
                      key={u.id}
                      u={u}
                      idx={idx}
                      isMe={myStats?.id === u.id}
                      myId={user.id}
                      friendship={getFriendshipWith(u.id)}
                      reaction={reactions[u.id]}
                      locale={locale}
                      t={t}
                      onReaction={handleReaction}
                      onSendRequest={handleSendFriendRequest}
                      onAccept={handleAcceptFriend}
                      onReject={handleRejectFriend}
                      onRemove={handleRemoveFriend}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="h-24" />
    </div>
  )
}

// ─── UserCard ─────────────────────────────────────────────────────────────────

function UserCard({
  u, idx, isMe, myId, friendship, reaction, locale, t,
  onReaction, onSendRequest, onAccept, onReject, onRemove,
}: {
  u: FriendStats
  idx: number
  isMe: boolean
  myId: string
  friendship: Friendship | undefined
  reaction: string | null | undefined
  locale: string
  t: (key: string, vars?: Record<string, string>) => string
  onReaction: (id: string, type: 'volt' | 'energia' | 'motivar' | 'empenyer') => void
  onSendRequest: (id: string) => void
  onAccept: (friendshipId: string) => void
  onReject: (friendshipId: string) => void
  onRemove: (friendshipId: string) => void
}) {
  const days = daysSince(u.lastWorkout)
  const isDanger = !isMe && days >= 3
  const isHot = !isMe && u.consistency >= 60 && days <= 3
  const medal = MEDAL[idx] ?? null
  const consistencyColor = u.consistency >= 70 ? 'var(--good)' : u.consistency >= 40 ? 'var(--text)' : 'var(--text-3)'
  const barColor = u.consistency === 0 ? 'var(--text-3)' : isMe ? 'var(--accent)' : u.consistency >= 70 ? 'var(--good)' : 'var(--text-2)'

  const isSentByMe = friendship?.requester_id === myId && friendship?.status === 'pending'
  const isReceivedByMe = friendship?.addressee_id === myId && friendship?.status === 'pending'
  const isAccepted = friendship?.status === 'accepted'

  return (
    <div
      className="card-surface px-4 pt-3.5 pb-3 relative overflow-hidden"
      style={{
        ...(isMe ? { borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' } : {}),
        animation: `dopSlideUp 500ms ${idx * 60 + 100}ms cubic-bezier(.22,1,.36,1) both`,
      }}
    >
      {isMe && (
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
        />
      )}

      {/* Main row */}
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[13px] tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--text-3)' }}>
          {medal ?? `${idx + 1}.`}
        </span>

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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-[15px] tracking-tight text-[var(--text)] truncate">{u.username}</p>
            {isMe && (
              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                {t('friends.youLabel')}
              </span>
            )}
            {isAccepted && !isMe && (
              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--good) 12%, transparent)', color: 'var(--good)' }}>
                ✓ {t('friends.friendLabel')}
              </span>
            )}
            {isHot && (
              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)' }}>
                🔥 {t('friends.onStreak')}
              </span>
            )}
            {isDanger && (
              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
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

        <div className="text-right flex-shrink-0">
          <p className="font-mono text-[22px] font-medium leading-none tabular-nums tracking-[-0.02em]" style={{ color: consistencyColor }}>
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
          <div className="h-full rounded-full progress-fill transition-all duration-700"
            style={{ width: `${u.consistency}%`, backgroundColor: barColor }} />
        </div>
      </div>

      {/* Reaction feedback */}
      {reaction && (
        <p className="mt-2 text-xs font-medium text-center reaction-pop" style={{ color: 'var(--accent)' }}>
          {reaction}
        </p>
      )}

      {/* Bottom row: reactions + friend button */}
      {!isMe && (
        <div className="mt-3 pl-[3.75rem] flex gap-1.5 flex-wrap items-center">
          {/* Reaction buttons */}
          {isDanger ? (
            <>
              <button onClick={() => onReaction(u.id, 'motivar')}
                className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>
                {t('friends.mootivate')}
              </button>
              <button onClick={() => onReaction(u.id, 'empenyer')}
                className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)' }}>
                {t('friends.pushThem')}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onReaction(u.id, 'volt')}
                className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                style={{ backgroundColor: 'transparent', color: 'var(--text-2)', borderColor: 'var(--rule)' }}>
                {t('friends.giveVolt')}
              </button>
              <button onClick={() => onReaction(u.id, 'motivar')}
                className="flex-1 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80"
                style={{ backgroundColor: 'transparent', color: 'var(--text-2)', borderColor: 'var(--rule)' }}>
                {t('friends.mootivate')}
              </button>
            </>
          )}

          {/* Friend action button */}
          {!friendship && (
            <button
              onClick={() => onSendRequest(u.id)}
              className="px-3 py-2 rounded-full text-[11px] font-medium border transition-colors hover:opacity-80 flex-shrink-0"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}
            >
              + {t('friends.addFriend')}
            </button>
          )}
          {isSentByMe && (
            <span className="px-3 py-2 rounded-full text-[11px] font-mono flex-shrink-0" style={{ color: 'var(--text-3)' }}>
              {t('friends.pendingLabel')}…
            </span>
          )}
          {isReceivedByMe && friendship && (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onAccept(friendship.id)}
                className="px-3 py-2 rounded-full text-[11px] font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                {t('friends.accept')}
              </button>
              <button onClick={() => onReject(friendship.id)}
                className="px-2 py-2 rounded-full text-[11px] border transition-opacity hover:opacity-80"
                style={{ color: 'var(--text-3)', borderColor: 'var(--rule)' }}>
                ✕
              </button>
            </div>
          )}
          {isAccepted && friendship && (
            <button
              onClick={() => onRemove(friendship.id)}
              className="px-2 py-2 rounded-full text-[10px] border transition-opacity hover:opacity-80 flex-shrink-0"
              style={{ color: 'var(--text-3)', borderColor: 'var(--rule)' }}
              title={t('friends.removeFriend')}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}
