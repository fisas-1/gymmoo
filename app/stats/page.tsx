'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUnit } from '../contexts/UnitContext'
import { EXERCISE_KEYS } from '@/types'
import { useTranslation } from '../contexts/LanguageContext'
import QuickLogFab from '../components/QuickLogFab'

const MUSCLE_GROUPS = [
  { id: 'pit', tKey: 'exercise.muscleGroupPectoral' },
  { id: 'esquena', tKey: 'exercise.muscleGroupEsquena' },
  { id: 'cames', tKey: 'exercise.muscleGroupCames' },
  { id: 'espatles', tKey: 'exercise.muscleGroupEsquitxos' },
  { id: 'biceps', tKey: 'exercise.muscleGroupBiceps' },
  { id: 'triceps', tKey: 'exercise.muscleGroupTriceps' },
  { id: 'abdominals', tKey: 'exercise.muscleGroupAbdominals' },
  { id: 'gluts', tKey: 'exercise.muscleGroupGluts' },
]

const EXERCISE_MUSCLE_MAP: Record<string, string> = {
  'Press Banca': 'pit', 'Lat Pulldown': 'esquena', 'Sentadilles': 'cames',
  'Leg Press': 'cames', 'Dominades': 'esquena', 'Press Military': 'espatles',
  'Curl de Bíceps': 'biceps', 'Extensiones Tricep': 'triceps', 'French Press': 'triceps', 'Zancadas': 'cames',
}

type MuscleStats = { muscle: string; label: string; improvement: number; currentMax: number; previousMax: number }
type LogEntry = { id: string; exercise: string; weight: number; reps: number; rir: number | null; one_rm: number; note: string | null; created_at: string }

export default function EstadistiquesPage() {
  const { user } = useAuth()
  const { unit, format } = useUnit()
  const { t, locale } = useTranslation()
  const tEx = (name: string) => { const key = EXERCISE_KEYS[name]; return key ? t(key) : name }
  const [stats, setStats] = useState<MuscleStats[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('30')

  const [exerciseList, setExerciseList] = useState<string[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [exerciseLogs, setExerciseLogs] = useState<LogEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [weeklyVolume, setWeeklyVolume] = useState<{ muscle: string; label: string; thisWeek: number; lastWeek: number }[]>([])

  useEffect(() => { loadStats() }, [period])
  useEffect(() => { if (user) { loadExerciseList(); loadWeeklyVolume() } }, [user])
  useEffect(() => { if (selectedExercise) loadExerciseHistory(selectedExercise) }, [selectedExercise, user])

  async function loadWeeklyVolume() {
    if (!user) return
    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const dayOfWeek = (now.getDay() + 6) % 7
    const startThis = new Date(now.getTime() - dayOfWeek * dayMs)
    startThis.setHours(0, 0, 0, 0)
    const startLast = new Date(startThis.getTime() - 7 * dayMs)

    const { data } = await supabase
      .from('workout_logs')
      .select('exercise, weight, reps, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startLast.toISOString())

    const byMuscle: Record<string, { thisWeek: number; lastWeek: number }> = {}
    for (const m of MUSCLE_GROUPS) byMuscle[m.id] = { thisWeek: 0, lastWeek: 0 }

    for (const log of data || []) {
      const cleanName = (log.exercise as string).replace(/ - Pes corporal$/, '')
      const muscle = EXERCISE_MUSCLE_MAP[cleanName]
      if (!muscle) continue
      const vol = (log.weight || 0) * (log.reps || 0)
      if (vol <= 0) continue
      const ts = new Date(log.created_at).getTime()
      if (ts >= startThis.getTime()) byMuscle[muscle].thisWeek += vol
      else byMuscle[muscle].lastWeek += vol
    }

    const result = MUSCLE_GROUPS.map(m => ({
      muscle: m.id,
      label: t(m.tKey),
      thisWeek: byMuscle[m.id].thisWeek,
      lastWeek: byMuscle[m.id].lastWeek,
    })).filter(r => r.thisWeek > 0 || r.lastWeek > 0)
    setWeeklyVolume(result)
  }

  async function loadStats() {
    setLoading(true)
    const days = period === 'all' ? 365 : parseInt(period)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const { data: logs } = await supabase
      .from('workout_logs')
      .select('*')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: true })

    const muscleData: Record<string, { current: number; previous: number }> = {}
    MUSCLE_GROUPS.forEach(m => { muscleData[m.id] = { current: 0, previous: 0 } })

    if (logs?.length) {
      const mid = Math.floor(logs.length / 2)
      logs.forEach((log, idx) => {
        const muscle = EXERCISE_MUSCLE_MAP[log.exercise]
        if (!muscle || !log.one_rm) return
        if (idx >= mid && log.one_rm > muscleData[muscle].current) {
          muscleData[muscle].current = log.one_rm
        } else if (idx < mid && log.one_rm > muscleData[muscle].previous) {
          muscleData[muscle].previous = log.one_rm
        }
      })
    }

    const calculated: MuscleStats[] = MUSCLE_GROUPS.map(m => {
      const d = muscleData[m.id]
      const imp = d.previous > 0 && d.current > d.previous
        ? Math.round(((d.current - d.previous) / d.previous) * 100)
        : d.current > 0 ? 100 : 0
      return { muscle: m.id, label: t(m.tKey), improvement: imp, currentMax: d.current, previousMax: d.previous }
    })

    setStats(calculated)
    setLoading(false)
  }

  async function loadExerciseList() {
    if (!user) return
    const { data } = await supabase
      .from('workout_logs')
      .select('exercise')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (!data) return
    const uniq = Array.from(new Set(data.map(r => r.exercise as string)))
    setExerciseList(uniq)
    if (uniq.length && !selectedExercise) setSelectedExercise(uniq[0])
  }

  async function loadExerciseHistory(exercise: string) {
    if (!user) return
    setHistoryLoading(true)
    const { data } = await supabase
      .from('workout_logs')
      .select('id, exercise, weight, reps, rir, one_rm, note, created_at')
      .eq('user_id', user.id)
      .eq('exercise', exercise)
      .order('created_at', { ascending: false })
      .limit(200)
    setExerciseLogs((data as LogEntry[]) || [])
    setHistoryLoading(false)
  }

  const groupedByDay = useMemo(() => {
    const map: Record<string, LogEntry[]> = {}
    for (const l of exerciseLogs) {
      const key = new Date(l.created_at).toISOString().slice(0, 10)
      ;(map[key] ||= []).push(l)
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [exerciseLogs])

  const chartData = useMemo(() => {
    const points = groupedByDay
      .map(([day, logs]) => ({ day, max: Math.max(...logs.map(l => l.one_rm || 0)) }))
      .filter(p => p.max > 0)
      .reverse()
    return points
  }, [groupedByDay])

  const totalImprovement = stats.filter(s => s.improvement > 0).reduce((sum, s) => sum + s.improvement, 0)
  const improvedCount = stats.filter(s => s.improvement > 0).length
  const maxImp = Math.max(...stats.map(s => Math.abs(s.improvement)), 1)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="px-5 pt-12 pb-0 max-w-2xl mx-auto">
        <p className="section-label mb-1">{t('stats.yourProgress')}</p>
        <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)]">
          {t('stats.title')}.
        </h1>
      </div>

      <div className="px-5 pt-5 pb-6 space-y-5 max-w-2xl mx-auto animate-slide-up">
        {/* Period segmented control */}
        <div
          className="flex gap-1 p-1 rounded-full border"
          style={{ backgroundColor: 'var(--card-hi)', borderColor: 'var(--rule)' }}
        >
          {[
            { key: '30', label: t('stats.period1m') },
            { key: '90', label: t('stats.period3m') },
            { key: 'all', label: t('stats.periodAll') },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key as '30' | '90' | 'all')}
              className="flex-1 py-[7px] rounded-full text-[12px] transition-all"
              style={period === p.key
                ? { backgroundColor: 'var(--card)', color: 'var(--text)', fontWeight: 500, border: '1px solid var(--rule)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                : { backgroundColor: 'transparent', color: 'var(--text-2)', fontWeight: 400, border: '1px solid transparent' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card-surface p-4 space-y-2">
                <div className="skeleton h-2.5 w-20 rounded" />
                <div className="skeleton h-8 w-16 rounded" />
              </div>
              <div className="card-surface p-4 space-y-2">
                <div className="skeleton h-2.5 w-20 rounded" />
                <div className="skeleton h-8 w-10 rounded" />
              </div>
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="skeleton h-3 w-24 rounded" />
                    <div className="skeleton h-3 w-10 rounded" />
                  </div>
                  <div className="skeleton h-[5px] w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card-surface px-3.5 py-3 dop-slide-up stagger-1">
                <p className="section-label mb-1">{t('stats.totalImprovement')}</p>
                <p
                  className="font-mono text-[30px] font-medium leading-none tabular-nums tracking-[-0.02em]"
                  style={{ color: totalImprovement > 0 ? 'var(--good)' : 'var(--text)' }}
                >
                  +{totalImprovement}<span className="text-[16px]" style={{ color: 'var(--text-3)' }}>%</span>
                </p>
              </div>
              <div className="card-surface px-3.5 py-3 dop-slide-up stagger-2">
                <p className="section-label mb-1">{t('stats.groupsImproved')}</p>
                <p className="font-mono text-[30px] font-medium leading-none tabular-nums tracking-[-0.02em] text-[var(--text)]">
                  {improvedCount}<span className="text-[16px]" style={{ color: 'var(--text-3)' }}>/{MUSCLE_GROUPS.length}</span>
                </p>
              </div>
            </div>

            {/* Muscle improvement bars */}
            <div>
              <p className="section-label mb-3">{t('stats.byMuscleGroup')}</p>
              <div className="space-y-2.5">
                {stats.sort((a, b) => b.improvement - a.improvement).map((stat, idx) => (
                  <div
                    key={stat.muscle}
                    style={{ animation: `dopSlideUp 480ms ${idx * 60}ms cubic-bezier(.22,1,.36,1) both` }}
                  >
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="text-[var(--text-2)]">{stat.label}</span>
                      <span
                        className="font-mono text-[12px] tabular-nums"
                        style={{ color: stat.improvement > 0 ? 'var(--good)' : stat.improvement < 0 ? 'var(--danger)' : 'var(--text-3)' }}
                      >
                        {stat.improvement > 0 ? '+' : ''}{stat.improvement}%
                      </span>
                    </div>
                    <div className="h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--card-hi)' }}>
                      <div
                        className="h-full rounded-full progress-fill"
                        style={{
                          width: `${Math.min((Math.abs(stat.improvement) / maxImp) * 100, 100)}%`,
                          backgroundColor: stat.improvement > 0 ? 'var(--good)' : stat.improvement < 0 ? 'var(--danger)' : 'var(--rule)',
                          animationDelay: `${idx * 80 + 100}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Weekly volume */}
        {weeklyVolume.length > 0 && (
          <div className="pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
            <div className="flex items-baseline justify-between mb-3">
              <p className="section-label">{t('stats.weeklyVolume')}</p>
              <span className="font-mono text-[9px] flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--rule)' }} />
                {t('stats.prevAbbr')}
                <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ backgroundColor: 'var(--accent)' }} />
                {t('stats.nowAbbr')}
              </span>
            </div>
            <div className="space-y-3">
              {weeklyVolume.sort((a, b) => b.thisWeek - a.thisWeek).map(v => {
                const max = Math.max(v.thisWeek, v.lastWeek, 1)
                const diff = v.lastWeek > 0 ? Math.round(((v.thisWeek - v.lastWeek) / v.lastWeek) * 100) : (v.thisWeek > 0 ? 100 : 0)
                return (
                  <div key={v.muscle}>
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="text-[var(--text-2)]">{v.label}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono tabular-nums text-[var(--text)]">{format(v.thisWeek)}{unit}</span>
                        {v.lastWeek > 0 && (
                          <span
                            className="font-mono text-[11px] tabular-nums"
                            style={{ color: diff > 0 ? 'var(--good)' : diff < 0 ? 'var(--danger)' : 'var(--text-3)' }}
                          >
                            {diff > 0 ? '+' : ''}{diff}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="relative h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--card-hi)' }}>
                      <div
                        className="absolute h-full rounded-full progress-fill"
                        style={{ width: `${(v.lastWeek / max) * 100}%`, backgroundColor: 'var(--rule)' }}
                      />
                      <div
                        className="absolute h-full rounded-full progress-fill stagger-1"
                        style={{ width: `${(v.thisWeek / max) * 100}%`, backgroundColor: 'var(--accent)', opacity: 0.85 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="font-mono text-[9px] mt-3" style={{ color: 'var(--text-3)' }}>{t('stats.weeklyVolumeLegend')}</p>
          </div>
        )}

        {/* Exercise history */}
        {exerciseList.length > 0 && (
          <div className="pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
            <p className="section-label mb-3">{t('stats.exerciseHistory')}</p>

            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hidden mb-4">
              {exerciseList.map(ex => (
                <button
                  key={ex}
                  onClick={() => setSelectedExercise(ex)}
                  className="px-3.5 py-[7px] rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-colors border"
                  style={selectedExercise === ex
                    ? { backgroundColor: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
                    : { backgroundColor: 'var(--card-hi)', color: 'var(--text-2)', borderColor: 'var(--rule)' }}
                >
                  {tEx(ex)}
                </button>
              ))}
            </div>

            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex justify-between py-2">
                    <div className="skeleton h-3 w-32 rounded" />
                    <div className="skeleton h-3 w-20 rounded" />
                  </div>
                ))}
              </div>
            ) : exerciseLogs.length === 0 ? (
              <p className="text-[var(--text-3)] text-sm py-6 text-center">{t('stats.noHistory')}</p>
            ) : (
              <>
                {chartData.length >= 2 && (
                  <ProgressChart points={chartData} unit={unit} format={format} label={t('stats.oneRMEvolution')} locale={locale} />
                )}

                {(() => {
                  const allTimeMax = Math.max(...exerciseLogs.map(l => l.one_rm || 0))
                  return (
                    <div className="space-y-2 mt-4">
                      {groupedByDay.map(([day, logs]) => {
                        const maxOneRM = Math.max(...logs.map(l => l.one_rm || 0))
                        const isPrDay = maxOneRM > 0 && maxOneRM === allTimeMax
                        const notes = logs.map(l => l.note).filter(Boolean) as string[]
                        return (
                          <div
                            key={day}
                            className="card-surface p-3"
                            style={isPrDay ? { borderColor: 'color-mix(in srgb, var(--accent) 50%, transparent)' } : undefined}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-[13px] text-[var(--text-2)] flex items-center gap-1.5">
                                {isPrDay && (
                                  <span
                                    className="font-mono text-[9px] px-1.5 py-0.5 rounded text-white"
                                    style={{ backgroundColor: 'var(--accent)', letterSpacing: '0.06em' }}
                                  >
                                    PR
                                  </span>
                                )}
                                {new Date(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                              {maxOneRM > 0 && (
                                <p className="font-mono text-[11px] text-[var(--text-3)]">
                                  1RM <span className="text-[var(--text)] font-medium tabular-nums">{format(maxOneRM)}{unit}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {logs.map(l => (
                                <span
                                  key={l.id}
                                  className="font-mono text-[11px] px-2 py-1 rounded-md tabular-nums"
                                  style={{ backgroundColor: 'var(--card-hi)', color: 'var(--text-2)' }}
                                >
                                  {format(l.weight)}{unit} × {l.reps}
                                  {l.rir != null && <span style={{ color: 'var(--text-3)' }}> · RIR {l.rir}</span>}
                                </span>
                              ))}
                            </div>
                            {notes.length > 0 && (
                              <div className="mt-2 space-y-0.5">
                                {notes.map((n, i) => (
                                  <p key={i} className="text-[12px] italic" style={{ color: 'var(--text-3)' }}>"{n}"</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}
      </div>

      <QuickLogFab />
      <div className="h-24" />
    </div>
  )
}

function ProgressChart({ points, unit, format, label, locale }: {
  points: { day: string; max: number }[]
  unit: string
  format: (kg: number) => string
  label: string
  locale: string
}) {
  const W = 320, H = 110, padX = 12, padY = 12
  const xs = points.map((_, i) => padX + (i * (W - 2 * padX)) / Math.max(1, points.length - 1))
  const maxY = Math.max(...points.map(p => p.max))
  const minY = Math.min(...points.map(p => p.max))
  const range = maxY - minY || 1
  const ys = points.map(p => H - padY - ((p.max - minY) / range) * (H - 2 * padY))
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ')
  const areaPath = `${path} L ${xs[xs.length - 1]} ${H - padY} L ${xs[0]} ${H - padY} Z`
  const first = points[0].max, last = points[points.length - 1].max
  const trend = last - first
  const trendPct = first > 0 ? Math.round((trend / first) * 100) : 0

  return (
    <div className="card-surface p-4">
      <div className="flex justify-between items-baseline mb-2">
        <p className="section-label">{label}</p>
        <p
          className="font-mono text-[12px] tabular-nums"
          style={{ color: trend > 0 ? 'var(--good)' : trend < 0 ? 'var(--danger)' : 'var(--text-3)' }}
        >
          {trend > 0 ? '+' : ''}{format(trend)}{unit} ({trendPct > 0 ? '+' : ''}{trendPct}%)
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chartGrad)" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 4 : 2.4} fill="var(--accent)" />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[9px] mt-1 tabular-nums" style={{ color: 'var(--text-3)' }}>
        <span>{new Date(points[0].day).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
        <span>{format(minY)}–{format(maxY)}{unit}</span>
        <span>{new Date(points[points.length - 1].day).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
  )
}
