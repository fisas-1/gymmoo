'use client'

import { useState, useEffect, useContext, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { ThemeContext } from '../contexts/ThemeContext'
import { useTranslation } from '../contexts/LanguageContext'
import { useUnit } from '../contexts/UnitContext'
import LanguageSelector from '../components/LanguageSelector'
import { getBaseExercise, getVariantFromFullName, isVariantUnilateral } from '@/types'

type UserProfile = {
  age: number | null
  height: number | null
  weight: number | null
  gender: 'm' | 'f'
}

const STRENGTH_STANDARDS: Record<string, Record<string, { m: number; f: number }>> = {
  'Press Banca':     { novice: { m: 1.0, f: 0.5 }, beginner: { m: 1.2, f: 0.6 }, intermediate: { m: 1.5, f: 0.8 }, advanced: { m: 2.0, f: 1.1 }, elite: { m: 2.5, f: 1.4 }, worldclass: { m: 3.0, f: 1.7 } },
  'Sentadilles':     { novice: { m: 1.2, f: 0.6 }, beginner: { m: 1.5, f: 0.8 }, intermediate: { m: 2.0, f: 1.0 }, advanced: { m: 2.5, f: 1.3 }, elite: { m: 3.0, f: 1.6 }, worldclass: { m: 3.5, f: 2.0 } },
  'Leg Press':       { novice: { m: 1.5, f: 0.8 }, beginner: { m: 2.0, f: 1.0 }, intermediate: { m: 2.5, f: 1.3 }, advanced: { m: 3.0, f: 1.6 }, elite: { m: 3.5, f: 2.0 }, worldclass: { m: 4.0, f: 2.5 } },
  'Dominades':       { novice: { m: 1.0, f: 0.8 }, beginner: { m: 1.1, f: 0.9 }, intermediate: { m: 1.3, f: 1.1 }, advanced: { m: 1.5, f: 1.3 }, elite: { m: 1.8, f: 1.5 }, worldclass: { m: 2.2, f: 1.8 } },
  'Flexions':        { novice: { m: 1.0, f: 0.8 }, beginner: { m: 1.2, f: 1.0 }, intermediate: { m: 1.5, f: 1.2 }, advanced: { m: 1.8, f: 1.4 }, elite: { m: 2.2, f: 1.7 }, worldclass: { m: 2.8, f: 2.0 } },
  'Dips':            { novice: { m: 1.0, f: 0.7 }, beginner: { m: 1.2, f: 0.9 }, intermediate: { m: 1.5, f: 1.1 }, advanced: { m: 1.8, f: 1.3 }, elite: { m: 2.2, f: 1.6 }, worldclass: { m: 2.7, f: 1.9 } },
  'Lat Pulldown':    { novice: { m: 0.8, f: 0.4 }, beginner: { m: 1.0, f: 0.5 }, intermediate: { m: 1.3, f: 0.7 }, advanced: { m: 1.6, f: 0.9 }, elite: { m: 2.0, f: 1.1 }, worldclass: { m: 2.4, f: 1.3 } },
  'Press Military':  { novice: { m: 0.6, f: 0.3 }, beginner: { m: 0.8, f: 0.4 }, intermediate: { m: 1.0, f: 0.5 }, advanced: { m: 1.3, f: 0.7 }, elite: { m: 1.6, f: 0.9 }, worldclass: { m: 2.0, f: 1.1 } },
  'Curl de Bíceps':  { novice: { m: 0.4, f: 0.2 }, beginner: { m: 0.5, f: 0.25 }, intermediate: { m: 0.7, f: 0.35 }, advanced: { m: 0.9, f: 0.5 }, elite: { m: 1.1, f: 0.6 }, worldclass: { m: 1.4, f: 0.8 } },
  'Extensió Tríceps':{ novice: { m: 0.4, f: 0.2 }, beginner: { m: 0.5, f: 0.25 }, intermediate: { m: 0.7, f: 0.35 }, advanced: { m: 0.9, f: 0.5 }, elite: { m: 1.1, f: 0.6 }, worldclass: { m: 1.3, f: 0.7 } },
  'Zancades':        { novice: { m: 0.8, f: 0.4 }, beginner: { m: 1.0, f: 0.5 }, intermediate: { m: 1.3, f: 0.7 }, advanced: { m: 1.6, f: 0.9 }, elite: { m: 2.0, f: 1.1 }, worldclass: { m: 2.4, f: 1.3 } },
  'Extensiones Tricep': { novice: { m: 0.4, f: 0.2 }, beginner: { m: 0.5, f: 0.25 }, intermediate: { m: 0.7, f: 0.35 }, advanced: { m: 0.9, f: 0.5 }, elite: { m: 1.1, f: 0.6 }, worldclass: { m: 1.3, f: 0.7 } },
  'French Press':       { novice: { m: 0.3, f: 0.15 }, beginner: { m: 0.4, f: 0.2 }, intermediate: { m: 0.5, f: 0.25 }, advanced: { m: 0.7, f: 0.35 }, elite: { m: 0.9, f: 0.45 }, worldclass: { m: 1.1, f: 0.55 } },
  'Zancadas':           { novice: { m: 0.8, f: 0.4 }, beginner: { m: 1.0, f: 0.5 }, intermediate: { m: 1.3, f: 0.7 }, advanced: { m: 1.6, f: 0.9 }, elite: { m: 2.0, f: 1.1 }, worldclass: { m: 2.4, f: 1.3 } },
}

const LEVELS = [
  { key: 'novice',       color: '#888' },
  { key: 'beginner',     color: '#22c55e' },
  { key: 'intermediate', color: '#3b82f6' },
  { key: 'advanced',     color: '#a855f7' },
  { key: 'elite',        color: '#f97316' },
  { key: 'worldclass',   color: '#ef4444' },
] as const

const LEVEL_TO_NUM: Record<string, number> = {
  novice: 1, beginner: 2, intermediate: 3, advanced: 4, elite: 5, worldclass: 6,
}

type ExerciseLevel = { exercise: string; level: string; levelColor: string; oneRM: number; isUnilateral?: boolean }

export default function PerfilPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { t } = useTranslation()
  const { unit, setUnit, toKg, format } = useUnit()
  const themeContext = useContext(ThemeContext)
  const theme = themeContext?.theme ?? 'dark'
  const toggleTheme = themeContext?.toggleTheme ?? (() => {})
  const [heightUnit, setHeightUnitState] = useState<'cm' | 'ftin'>('cm')
  const [age, setAge] = useState<string>('')
  const [height, setHeight] = useState<string>('')
  const [heightFt, setHeightFt] = useState<string>('')
  const [heightIn, setHeightIn] = useState<string>('')
  const [weight, setWeight] = useState<string>('')
  const [gender, setGender] = useState<'m' | 'f'>('m')
  const [saved, setSaved] = useState(false)
  const [exerciseLevels, setExerciseLevels] = useState<ExerciseLevel[]>([])
  const [overallLevel, setOverallLevel] = useState<string>('')
  const [overallAvgPct, setOverallAvgPct] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [scheduledDaysCount, setScheduledDaysCount] = useState<number>(0)
  const [username, setUsername] = useState('')
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedUnit = localStorage.getItem('height_unit') as 'cm' | 'ftin'
    if (savedUnit === 'cm' || savedUnit === 'ftin') setHeightUnitState(savedUnit)
  }, [])

  useEffect(() => { loadProfile() }, [unit, heightUnit])
  useEffect(() => { if (weight) calculateLevels() }, [weight, gender, user])
  useEffect(() => { if (user) { calculateStreak(); loadUserProfile() } }, [user])

  function setHeightUnit(u: 'cm' | 'ftin') {
    if (u === 'ftin' && height) {
      const cm = parseFloat(height)
      if (!isNaN(cm)) {
        const totalInches = cm / 2.54
        setHeightFt(Math.floor(totalInches / 12).toString())
        setHeightIn(Math.round(totalInches % 12).toString())
      }
    } else if (u === 'cm' && (heightFt || heightIn)) {
      const ft = parseInt(heightFt) || 0
      const inches = parseInt(heightIn) || 0
      const cm = Math.round((ft * 12 + inches) * 2.54)
      setHeight(cm.toString())
    }
    setHeightUnitState(u)
    localStorage.setItem('height_unit', u)
  }

  function loadProfile() {
    const saved = localStorage.getItem('user_profile')
    if (saved) {
      const p: UserProfile = JSON.parse(saved)
      setAge(p.age?.toString() || '')
      const currentHeightUnit = (localStorage.getItem('height_unit') as 'cm' | 'ftin') || 'cm'
      if (p.height != null) {
        if (currentHeightUnit === 'ftin') {
          const totalInches = p.height / 2.54
          setHeightFt(Math.floor(totalInches / 12).toString())
          setHeightIn(Math.round(totalInches % 12).toString())
        } else {
          setHeight(p.height.toString())
        }
      }
      setWeight(p.weight != null ? format(p.weight) : '')
      setGender(p.gender || 'm')
    }
  }

  function saveProfile() {
    const wInput = parseFloat(weight)
    let heightCm: number | null = null
    if (heightUnit === 'ftin') {
      const ft = parseInt(heightFt) || 0
      const inches = parseInt(heightIn) || 0
      if (ft > 0 || inches > 0) heightCm = Math.round((ft * 12 + inches) * 2.54)
    } else {
      heightCm = parseFloat(height) || null
    }
    localStorage.setItem('user_profile', JSON.stringify({
      age: parseInt(age) || null,
      height: heightCm,
      weight: isNaN(wInput) ? null : toKg(wInput),
      gender,
    }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function calculateLevels() {
    if (!user) return
    const wInput = parseFloat(weight)
    const w = isNaN(wInput) ? 70 : toKg(wInput)
    supabase.from('workout_logs').select('exercise, weight, reps, one_rm')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data: logs }) => {
        if (!logs) return

        const best: Record<string, { weight: number; reps: number; oneRM: number; fullName: string }> = {}
        logs.forEach(l => {
          const base = getBaseExercise(l.exercise)
          if (!best[base] || (l.one_rm || 0) > best[base].oneRM) {
            best[base] = { weight: l.weight, reps: l.reps, oneRM: l.one_rm || 0, fullName: l.exercise }
          }
        })

        const levels: ExerciseLevel[] = Object.entries(best).map(([ex, d]) => {
          const std = STRENGTH_STANDARDS[ex]
          if (!std) return null
          const ratio = d.oneRM / w
          const stdg = gender === 'm'
            ? { worldclass: std.worldclass.m, elite: std.elite.m, advanced: std.advanced.m, intermediate: std.intermediate.m, beginner: std.beginner.m, novice: std.novice.m }
            : { worldclass: std.worldclass.f, elite: std.elite.f, advanced: std.advanced.f, intermediate: std.intermediate.f, beginner: std.beginner.f, novice: std.novice.f }
          let level = 'novice'
          if (ratio >= stdg.worldclass) level = 'worldclass'
          else if (ratio >= stdg.elite) level = 'elite'
          else if (ratio >= stdg.advanced) level = 'advanced'
          else if (ratio >= stdg.intermediate) level = 'intermediate'
          else if (ratio >= stdg.beginner) level = 'beginner'
          const lv = LEVELS.find(l => l.key === level)
          const variant = getVariantFromFullName(d.fullName)
          const isUnilateral = variant ? isVariantUnilateral(ex, variant) : false
          return { exercise: ex, level, levelColor: lv?.color || '#888', oneRM: d.oneRM, isUnilateral }
        }).filter(Boolean) as ExerciseLevel[]

        setExerciseLevels(levels.sort((a, b) => (LEVELS.findIndex(l => l.key === b.level)) - (LEVELS.findIndex(l => l.key === a.level))))

        if (levels.length) {
          const avgPct = levels.reduce((s, l) => s + (LEVELS.findIndex(x => x.key === l.level) + 1) * 17, 0) / levels.length
          setOverallAvgPct(Math.min(Math.round(avgPct), 100))
          if (avgPct > 80) setOverallLevel('worldclass')
          else if (avgPct > 65) setOverallLevel('elite')
          else if (avgPct > 50) setOverallLevel('advanced')
          else if (avgPct > 35) setOverallLevel('intermediate')
          else if (avgPct > 20) setOverallLevel('beginner')
          else setOverallLevel('novice')
        }
      })
  }

  async function calculateStreak() {
    if (!user) return
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!logs || logs.length === 0) { setStreak(0); return }

    const trainedDays = new Set(logs.map(l => l.created_at.slice(0, 10)))

    const routineDaysRaw = localStorage.getItem('routine_days')
    const routineDaysMap: Record<string, number[]> = routineDaysRaw ? JSON.parse(routineDaysRaw) : {}
    const allScheduled = new Set<number>()
    Object.values(routineDaysMap).forEach(days => days.forEach(d => allScheduled.add(d)))

    if (allScheduled.size === 0) {
      const uniqueDateMs = [...new Set(logs.map(l => {
        const d = new Date(l.created_at)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      }))].sort((a, b) => b - a)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const todayMs = today.getTime(); const dayMs = 86400000
      if (uniqueDateMs[0] < todayMs - dayMs) { setStreak(0); return }
      let s = 0; let exp = uniqueDateMs[0] === todayMs ? todayMs : todayMs - dayMs
      for (const ms of uniqueDateMs) {
        if (ms === exp) { s++; exp -= dayMs } else if (ms < exp) break
      }
      setStreak(s)
      return
    }

    setScheduledDaysCount(allScheduled.size)

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dayMs = 86400000
    let sessions = 0
    let cursor = new Date(today)
    const maxLookback = 365

    for (let i = 0; i < maxLookback; i++) {
      const dayOfWeek = cursor.getDay()
      const dateStr = cursor.toISOString().slice(0, 10)
      const isScheduled = allScheduled.has(dayOfWeek)

      if (!isScheduled) {
        cursor = new Date(cursor.getTime() - dayMs)
        continue
      }

      if (trainedDays.has(dateStr)) {
        sessions++
        cursor = new Date(cursor.getTime() - dayMs)
        continue
      }

      if (i === 0) {
        cursor = new Date(cursor.getTime() - dayMs)
        continue
      }
      break
    }

    setStreak(sessions)
  }

  async function loadUserProfile() {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single()
    if (data) {
      setUsername(data.username || '')
      setAvatarUrl(data.avatar_url || null)
    } else {
      const meta = user.user_metadata
      setUsername((meta?.username as string) || user.email?.split('@')[0] || '')
    }
  }

  async function handleSaveUsername() {
    const trimmed = usernameInput.trim()
    if (!trimmed) return
    if (trimmed === username) { setEditingUsername(false); return }
    setSavingUsername(true)
    setUsernameError('')

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', trimmed)
      .neq('id', user!.id)
      .maybeSingle()

    if (existing) {
      setUsernameError(t('perfil.usernameExists'))
      setSavingUsername(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user!.id, username: trimmed }, { onConflict: 'id' })

    if (!error || error.message?.includes('schema cache')) {
      setUsername(trimmed)
      setEditingUsername(false)
    } else if (error.code === '42501' || error.message?.includes('policy')) {
      setUsernameError(t('perfil.permissionDenied'))
    } else {
      setUsernameError(t('perfil.saveUsernameError'))
    }
    setSavingUsername(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    setAvatarError(null)

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      console.error('Avatar upload error:', uploadError)
      setAvatarError(t('perfil.avatarUploadError'))
    } else {
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)
      const url = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: url }, { onConflict: 'id' })
      if (!updateError) {
        setAvatarUrl(url)
      } else {
        console.error('Avatar url save error:', updateError)
        setAvatarError(t('perfil.avatarSaveError'))
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploadingAvatar(false)
  }

  const levelColor = LEVELS.find(l => l.key === overallLevel)?.color || 'var(--text-3)'
  const lvlNum = LEVEL_TO_NUM[overallLevel] || 1
  const xpPct = overallAvgPct > 0 ? overallAvgPct : Math.round((lvlNum / 6) * 100)

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--bg)]">
        <div className="text-center space-y-6 max-w-sm">
          <p className="section-label mb-1">{t('perfil.yourProfile')}</p>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)]">
            {t('perfil.title')}
          </h1>
          <p className="text-sm text-[var(--text-3)]">{t('perfil.loginRequired')}</p>
          <a
            href="/login"
            className="inline-block py-3.5 px-8 rounded-full font-medium text-[13px] text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {t('perfil.enter')}
          </a>
        </div>
      </div>
    )
  }

  const userCode = `#${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="px-5 pt-12 pb-0 max-w-2xl mx-auto">
        <p className="section-label mb-1">{t('perfil.yourProfile')}</p>
        <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)]">
          {t('perfil.title')}
        </h1>
      </div>

      {/* Avatar + username row */}
      <div className="px-5 pt-6 max-w-2xl mx-auto">
        <div className="card-surface p-4 flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <label className="cursor-pointer block" title={t('perfil.changeAvatar')}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-semibold select-none relative"
                style={{
                  backgroundColor: 'var(--card-hi)',
                  border: avatarError ? '1px solid var(--danger)' : streak > 0 ? '1px solid color-mix(in srgb, var(--accent) 40%, transparent)' : '1px solid var(--rule)',
                  color: 'var(--accent)',
                }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : (user.email?.[0] || '?').toUpperCase()
                }
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <span className="text-xs text-white">…</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/50">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
              </div>
            </label>
            {avatarError && (
              <p className="text-[10px] text-[var(--danger)] mt-1 text-center w-16 leading-tight">{avatarError}</p>
            )}
            <div
              className="absolute -bottom-1.5 -right-1.5 font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-md tabular-nums text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              LVL {lvlNum}
            </div>
          </div>

          {/* Name + code + level + XP */}
          <div className="flex-1 min-w-0 pt-0.5">
            {editingUsername ? (
              <div className="space-y-1.5 mb-1">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={usernameInput}
                    onChange={e => { setUsernameInput(e.target.value); setUsernameError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveUsername(); if (e.key === 'Escape') setEditingUsername(false) }}
                    className="flex-1 text-sm font-medium rounded-xl px-3 py-1.5 outline-none bg-[var(--card-hi)] text-[var(--text)] border border-[var(--rule)] focus:border-[var(--accent)] transition-colors"
                    maxLength={30}
                  />
                  <button
                    onClick={handleSaveUsername}
                    disabled={savingUsername || !usernameInput.trim()}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-all disabled:opacity-40 hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {savingUsername ? '…' : '✓'}
                  </button>
                  <button
                    onClick={() => { setEditingUsername(false); setUsernameError('') }}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-75 bg-[var(--card-hi)] text-[var(--text-3)] border border-[var(--rule)]"
                  >
                    ✕
                  </button>
                </div>
                {usernameError && (
                  <p className="text-[11px] text-[var(--danger)]">{usernameError}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-xl font-semibold tracking-tight truncate text-[var(--text)]">
                  {username || user.email?.split('@')[0]}
                </h2>
                <button
                  onClick={() => { setUsernameInput(username || user.email?.split('@')[0] || ''); setEditingUsername(true) }}
                  className="flex-shrink-0 transition-all hover:opacity-75 text-[var(--text-3)]"
                  aria-label={t('perfil.editUsername')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            )}

            <p className="font-mono text-[10px] uppercase tracking-widest mb-0.5 text-[var(--text-3)]">
              {userCode}
            </p>

            {overallLevel && (
              <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: levelColor }}>
                {t(`level.${overallLevel}`)}
              </p>
            )}
            <div className="mt-2.5">
              <div className="w-full h-1.5 rounded-full overflow-hidden bg-[var(--rule-soft)]">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${xpPct}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
              <p className="font-mono text-[10px] mt-1 tabular-nums text-[var(--text-3)]">
                {xpPct}% XP · {t('perfil.toLevel')} {Math.min(lvlNum + 1, 6)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-6 space-y-4 max-w-2xl mx-auto animate-slide-up">

        {/* Streak card */}
        <div
          className="card-surface p-5 relative overflow-hidden streak-pulse"
          style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
          />
          <div
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% -20%, color-mix(in srgb, var(--accent) 11%, transparent) 0%, transparent 65%)' }}
          />
          <div className="relative flex items-end justify-between gap-4">
            <div>
              <p className="section-label mb-3">⚡ {t('perfil.streakTitle')}</p>
              <p className="font-mono text-[96px] font-medium leading-none tabular-nums text-[var(--text)]">
                {streak}
              </p>
              <p className="text-sm mt-2 text-[var(--text-3)]">
                {scheduledDaysCount > 0
                  ? t('perfil.streakSessions')
                  : streak === 1 ? t('perfil.streakDay') : t('perfil.streakDays')}
              </p>
              {scheduledDaysCount > 0 && (
                <p className="font-mono text-[10px] mt-1 uppercase tracking-widest tabular-nums" style={{ color: 'var(--accent)' }}>
                  {t('perfil.daysPerWeek', { count: String(scheduledDaysCount) })}
                </p>
              )}
            </div>
            <p className="text-[7rem] select-none leading-none mb-1 flex-shrink-0 opacity-[0.06]">🔥</p>
          </div>
        </div>

        {/* Level + exercise count grid */}
        {(overallLevel || exerciseLevels.length > 0) && (
          <div className="grid grid-cols-3 gap-3">
            <div
              className="col-span-2 card-surface p-4 relative overflow-hidden"
              style={{ borderColor: `${levelColor}30` }}
            >
              <div
                className="absolute inset-0 pointer-events-none rounded-[inherit]"
                style={{ background: `linear-gradient(135deg, ${levelColor}08 0%, transparent 55%)` }}
              />
              <div className="relative">
                <p className="section-label mb-1">{t('perfil.overallLevel')}</p>
                <p className="text-2xl font-semibold tracking-tight" style={{ color: levelColor }}>
                  {overallLevel ? t(`level.${overallLevel}`) : '—'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {LEVELS.map((l) => (
                    <span
                      key={l.key}
                      className="px-2 py-0.5 rounded-full font-mono text-[10px]"
                      style={{
                        backgroundColor: l.color + '18',
                        color: l.color,
                        border: overallLevel === l.key ? `1px solid ${l.color}55` : '1px solid transparent',
                      }}
                    >
                      {t(`level.${l.key}`)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-1 card-surface p-4 flex flex-col justify-between">
              <p className="section-label">{t('perfil.exercises')}</p>
              <p className="font-mono text-[40px] font-medium tabular-nums leading-none" style={{ color: 'var(--accent)' }}>
                {exerciseLevels.length}
              </p>
              <p className="section-label mt-1">{t('perfil.exercisesAnalyzed')}</p>
            </div>
          </div>
        )}

        {/* Exercise levels list */}
        {exerciseLevels.length > 0 && (
          <div>
            <p className="section-label mb-3">{t('perfil.byExercise')}</p>
            <div className="space-y-2">
              {exerciseLevels.map((ex) => (
                <div
                  key={ex.exercise}
                  className="card-surface flex justify-between items-center py-3 px-4 relative overflow-hidden"
                >
                  <div
                    className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                    style={{ backgroundColor: ex.levelColor }}
                  />
                  <div className="min-w-0 pl-3">
                    <span className="font-medium truncate block text-[var(--text)]">{ex.exercise}</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--text-3)]">
                      {format(ex.oneRM)}{unit} 1RM
                      {ex.isUnilateral && <span className="ml-1 opacity-50"> · {t('perfil.perArm')}</span>}
                    </span>
                  </div>
                  <span
                    className="font-mono text-xs px-2.5 py-1 rounded-full flex-shrink-0 ml-3"
                    style={{
                      backgroundColor: ex.levelColor + '1A',
                      color: ex.levelColor,
                      border: `1px solid ${ex.levelColor}30`,
                    }}
                  >
                    {t(`level.${ex.level}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal data */}
        <div>
          <p className="section-label mb-3">{t('perfil.data')}</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text" inputMode="numeric" value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={t('perfil.age')}
                className="text-sm rounded-2xl px-4 py-3 outline-none tabular-nums bg-[var(--card-hi)] text-[var(--text)] border border-[var(--rule)] focus:border-[var(--accent)] transition-colors"
              />
              <div className="flex gap-2">
                {(['m', 'f'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className="flex-1 py-3 rounded-2xl text-sm font-medium transition-all"
                    style={{
                      backgroundColor: gender === g ? 'var(--accent)' : 'var(--card-hi)',
                      color: gender === g ? '#fff' : 'var(--text-3)',
                      border: `1px solid ${gender === g ? 'var(--accent)' : 'var(--rule)'}`,
                    }}
                  >
                    {g === 'm' ? t('perfil.male') : t('perfil.female')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {heightUnit === 'ftin' ? (
                <div className="flex gap-2">
                  <input
                    type="text" inputMode="numeric" value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    placeholder={t('perfil.heightFt')}
                    className="flex-1 text-sm rounded-2xl px-4 py-3 outline-none tabular-nums bg-[var(--card-hi)] text-[var(--text)] border border-[var(--rule)] focus:border-[var(--accent)] transition-colors"
                  />
                  <input
                    type="text" inputMode="numeric" value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    placeholder={t('perfil.heightIn')}
                    className="flex-1 text-sm rounded-2xl px-4 py-3 outline-none tabular-nums bg-[var(--card-hi)] text-[var(--text)] border border-[var(--rule)] focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              ) : (
                <input
                  type="text" inputMode="numeric" value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder={t('perfil.heightCm')}
                  className="text-sm rounded-2xl px-4 py-3 outline-none tabular-nums bg-[var(--card-hi)] text-[var(--text)] border border-[var(--rule)] focus:border-[var(--accent)] transition-colors"
                />
              )}
              <input
                type="text" inputMode="numeric" value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={`${t('perfil.weightLabel')} (${unit})`}
                className="text-sm rounded-2xl px-4 py-3 outline-none tabular-nums bg-[var(--card-hi)] text-[var(--text)] border border-[var(--rule)] focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          <button
            onClick={saveProfile}
            type="button"
            className="w-full mt-4 py-4 rounded-2xl font-medium text-sm transition-all active:scale-[0.98]"
            style={saved
              ? { backgroundColor: 'transparent', color: 'var(--good)', border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)' }
              : { backgroundColor: 'var(--accent)', color: '#fff', border: '1px solid transparent' }}
          >
            {saved ? `✓ ${t('perfil.saved')}` : t('perfil.save')}
          </button>
        </div>

        {/* Preferences */}
        <div>
          <p className="section-label mb-3">{t('preferences.title')}</p>
          <div className="card-surface overflow-hidden divide-y divide-[var(--rule)]">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm font-medium text-[var(--text)]">{t('nav.language')}</span>
              <LanguageSelector />
            </div>

            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm font-medium text-[var(--text)]">
                {t(theme === 'dark' ? 'nav.theme_light' : 'nav.theme_dark')}
              </span>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all hover:opacity-75 bg-[var(--card-hi)] text-[var(--text)] border border-[var(--rule)]"
                aria-label={t(theme === 'dark' ? 'nav.theme_light' : 'nav.theme_dark')}
              >
                <span className="text-base leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
                <span className="font-mono text-xs uppercase tracking-wider">{theme === 'dark' ? t('nav.themeLightShort') : t('nav.themeDarkShort')}</span>
              </button>
            </div>

            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm font-medium text-[var(--text)]">{t('preferences.weightUnit')}</span>
              <div className="flex rounded-xl p-0.5 bg-[var(--card-hi)] border border-[var(--rule)]">
                {(['kg', 'lb'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider rounded-lg transition-all"
                    style={{
                      backgroundColor: unit === u ? 'var(--accent)' : 'transparent',
                      color: unit === u ? '#fff' : 'var(--text-3)',
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm font-medium text-[var(--text)]">{t('preferences.heightUnit')}</span>
              <div className="flex rounded-xl p-0.5 bg-[var(--card-hi)] border border-[var(--rule)]">
                {(['cm', 'ftin'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setHeightUnit(u)}
                    className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider rounded-lg transition-all"
                    style={{
                      backgroundColor: heightUnit === u ? 'var(--accent)' : 'transparent',
                      color: heightUnit === u ? '#fff' : 'var(--text-3)',
                    }}
                  >
                    {u === 'cm' ? 'cm' : 'ft·in'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={async () => { await signOut(); router.replace('/login') }}
          className="w-full py-3 rounded-2xl text-sm font-medium transition-all hover:opacity-80 active:scale-[0.98]"
          style={{
            color: 'var(--danger)',
            backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
          }}
        >
          {t('nav.logout')}
        </button>
      </div>

      <div className="h-24" />
    </div>
  )
}
