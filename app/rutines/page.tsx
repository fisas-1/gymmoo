'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Exercise, DEFAULT_EXERCISES, Routine, RoutineExercise, RoutineSet, WorkoutLog, calculate1RM, EXERCISE_KEYS, EXERCISE_VARIANTS, VARIANT_KEYS } from '@/types'
import { useTranslation } from '../contexts/LanguageContext'
import { useUnit } from '../contexts/UnitContext'
import { ROUTINE_TEMPLATES } from '../lib/routineTemplates'
import RestTimer from '../components/RestTimer'
import QuickLogFab from '../components/QuickLogFab'
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableExerciseItem({ id, children }: { id: string; children: (handleProps: { ref: any; style: any; attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }
  return <>{children({ ref: setNodeRef, style, attributes, listeners, isDragging })}</>
}

type CustomExercises = string[]

export default function RutinesPage() {
  const { user } = useAuth()
  const { t, locale } = useTranslation()
  const { unit, toKg, fromKg, format } = useUnit()
  const tEx = (name: string) => {
    const dotIdx = name.indexOf(' · ')
    if (dotIdx !== -1) {
      const base = name.slice(0, dotIdx)
      const v = name.slice(dotIdx + 3)
      const baseKey = EXERCISE_KEYS[base]
      const variantKey = VARIANT_KEYS[v]
      return `${baseKey ? t(baseKey) : base} · ${variantKey ? t(variantKey) : v}`
    }
    const key = EXERCISE_KEYS[name]
    return key ? t(key) : name
  }
  const [routines, setRoutines] = useState<Routine[]>([])
  const [routineExerciseCounts, setRoutineExerciseCounts] = useState<Record<string, number>>({})
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([])
  const [routineSets, setRoutineSets] = useState<Record<string, RoutineSet[]>>({})
  const [customExercises, setCustomExercises] = useState<CustomExercises>([])
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExerciseVariant, setNewExerciseVariant] = useState<string | null>(null)
  const [newExercisePrimary, setNewExercisePrimary] = useState('')
  const [newExerciseSecondary, setNewExerciseSecondary] = useState('')
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [newRoutineName, setNewRoutineName] = useState('')
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [editRoutineName, setEditRoutineName] = useState('')
  const [showEditRoutineModal, setShowEditRoutineModal] = useState(false)
  const [editingExercise, setEditingExercise] = useState<RoutineExercise | null>(null)
  const [showEditExerciseModal, setShowEditExerciseModal] = useState(false)
  const [editSetsTarget, setEditSetsTarget] = useState<number>(3)
  const [editRepsMin, setEditRepsMin] = useState<number>(8)
  const [editRepsMax, setEditRepsMax] = useState<number>(12)
  const [editVariant, setEditVariant] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastSessions, setLastSessions] = useState<Record<string, { date: string; sets: { weight: number; reps: number; rir: number | null }[] }>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [routineDays, setRoutineDays] = useState<Record<string, number[]>>({})
  const [activeTab, setActiveTab] = useState<'all' | 'fav' | 'deleted'>('all')
  const [deletedRoutines, setDeletedRoutines] = useState<{ id: string; name: string; deleted_at: string }[]>([])

  const allExercises = [...DEFAULT_EXERCISES, ...customExercises]

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleExerciseDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = routineExercises.findIndex(e => e.id === active.id)
    const newIdx = routineExercises.findIndex(e => e.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(routineExercises, oldIdx, newIdx)
    setRoutineExercises(reordered)
    const updates = reordered.map((ex, i) => supabase.from('routine_exercises').update({ order_index: i }).eq('id', ex.id))
    const results = await Promise.all(updates)
    const firstErr = results.find(r => r.error)
    if (firstErr?.error) {
      console.error('Error reordering:', firstErr.error)
      setErrorMsg(t('routines.errorReordering'))
    }
  }

  function handleRoutineDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = routines.findIndex(r => r.id === active.id)
    const newIdx = routines.findIndex(r => r.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(routines, oldIdx, newIdx)
    setRoutines(reordered)
    localStorage.setItem('routine_order', JSON.stringify(reordered.map(r => r.id)))
  }

  useEffect(() => {
    if (user) {
      loadRoutines()
      loadDeletedRoutines()
      loadCustomExercises()
    }
  }, [user])

  function getDayAbbr(dayIndex: number): string {
    const date = new Date(2024, 0, 7 + dayIndex)
    return date.toLocaleDateString(locale, { weekday: 'narrow' }).replace(/\.$/, '').toUpperCase()
  }

  function toggleRoutineDay(routineId: string, day: number) {
    setRoutineDays(prev => {
      const current = prev[routineId] || []
      const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort((a, b) => a - b)
      const updated = { ...prev, [routineId]: next }
      supabase.from('routines').update({ scheduled_days: next }).eq('id', routineId)
        .then(({ error }) => { if (error) console.error('Error updating scheduled_days:', error.message) })
      return updated
    })
  }

  useEffect(() => {
    if (selectedRoutine) {
      loadRoutineExercises(selectedRoutine.id)
    }
  }, [selectedRoutine])

  useEffect(() => {
    if (selectedRoutine && routineExercises.length > 0) {
      loadRoutineSets(selectedRoutine.id)
      loadLastSessions(routineExercises.map(e => e.exercise))
    }
  }, [selectedRoutine, routineExercises])

  async function loadLastSessions(exerciseNames: string[]) {
    if (!user || exerciseNames.length === 0) return
    const uniq = Array.from(new Set(exerciseNames))
    const { data } = await supabase
      .from('workout_logs')
      .select('exercise, weight, reps, rir, created_at')
      .eq('user_id', user.id)
      .in('exercise', uniq)
      .order('created_at', { ascending: false })
      .limit(500)

    if (!data) return
    const grouped: Record<string, { date: string; sets: { weight: number; reps: number; rir: number | null }[] }> = {}
    for (const log of data) {
      const dayKey = new Date(log.created_at).toISOString().slice(0, 10)
      const entry = grouped[log.exercise]
      if (!entry) {
        grouped[log.exercise] = { date: dayKey, sets: [{ weight: log.weight, reps: log.reps, rir: log.rir }] }
      } else if (entry.date === dayKey) {
        entry.sets.push({ weight: log.weight, reps: log.reps, rir: log.rir })
      }
    }
    for (const ex of Object.keys(grouped)) grouped[ex].sets.reverse()
    setLastSessions(grouped)
  }

  useEffect(() => {
    if (successMsg || errorMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg(null)
        setErrorMsg(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [successMsg, errorMsg])

  useEffect(() => {
    if (selectedRoutine && routineExercises.length > 0) {
      routineExercises.forEach(ex => {
        syncExerciseSets(ex.id, ex.sets_target)
      })
    }
  }, [selectedRoutine, routineExercises])

  async function loadRoutines() {
    if (!user) return
    let { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // If deleted_at column doesn't exist yet (migration pending), retry without filter
    if (error && (error.code === '42703' || error.message?.includes('deleted_at'))) {
      const result = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Error loading routines:', error)
      setErrorMsg(t('routines.errorLoading') || 'Error carregant rutines')
      return
    }
    if (data) {
      const savedOrder: string[] = JSON.parse(localStorage.getItem('routine_order') || '[]')
      const ordered = savedOrder.length > 0
        ? [...data].sort((a, b) => {
            const ai = savedOrder.indexOf(a.id)
            const bi = savedOrder.indexOf(b.id)
            if (ai === -1 && bi === -1) return 0
            if (ai === -1) return 1
            if (bi === -1) return -1
            return ai - bi
          })
        : data
      setRoutines(ordered)
      setFavoriteIds(data.filter(r => r.is_favorite).map(r => r.id))
      setRoutineDays(Object.fromEntries(data.map(r => [r.id, r.scheduled_days || []])))
      const counts: Record<string, number> = {}
      for (const routine of data) {
        const { count } = await supabase
          .from('routine_exercises')
          .select('*', { count: 'exact', head: true })
          .eq('routine_id', routine.id)
        counts[routine.id] = count || 0
      }
      setRoutineExerciseCounts(counts)
    }
  }

  async function loadDeletedRoutines() {
    if (!user) return
    const { data } = await supabase
      .from('routines')
      .select('id, name, deleted_at')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setDeletedRoutines(data || [])
  }

  async function handleRestoreRoutine(routineId: string) {
    await supabase.from('routines').update({ deleted_at: null }).eq('id', routineId)
    loadRoutines()
    loadDeletedRoutines()
    setSuccessMsg(t('routines.restored'))
  }

  async function loadRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
    const { data, error } = await supabase
      .from('routine_exercises')
      .select('*')
      .eq('routine_id', routineId)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Error loading routine exercises:', error)
      return []
    }
    if (data) setRoutineExercises(data)
    return data || []
  }

  async function loadRoutineSets(routineId: string, exerciseIds?: string[]) {
    const ids = exerciseIds || routineExercises.map(re => re.id)
    if (ids.length === 0) return

    const { data, error } = await supabase
      .from('routine_sets')
      .select('*')
      .in('routine_exercise_id', ids)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading routine sets:', error)
      return
    }

    const grouped: Record<string, RoutineSet[]> = {}
    data?.forEach(set => {
      if (!grouped[set.routine_exercise_id]) grouped[set.routine_exercise_id] = []
      grouped[set.routine_exercise_id].push(set)
    })
    setRoutineSets(grouped)
  }

  function loadCustomExercises() {
    const saved = localStorage.getItem('custom_exercises')
    if (saved) setCustomExercises(JSON.parse(saved))
  }

  async function handleCreateRoutine() {
    if (!user) return
    const template = ROUTINE_TEMPLATES.find(t => t.id === selectedTemplate) || null

    if (!template && !newRoutineName.trim()) {
      setErrorMsg(t('routines.nameRequired'))
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      if (template) {
        for (const r of template.routines) {
          const routineName = template.routines.length === 1 && newRoutineName.trim()
            ? newRoutineName.trim()
            : r.name
          const { data: newRoutine, error: rErr } = await supabase
            .from('routines')
            .insert({ user_id: user.id, name: routineName, description: t(template.nameKey) })
            .select()
            .single()
          if (rErr || !newRoutine) throw rErr || new Error(t('routines.errorCreating'))

          for (let i = 0; i < r.exercises.length; i++) {
            const ex = r.exercises[i]
            const { data: newEx, error: eErr } = await supabase
              .from('routine_exercises')
              .insert({
                routine_id: newRoutine.id,
                exercise: ex.exercise,
                sets_target: ex.sets_target,
                reps_min: ex.reps_min,
                reps_max: ex.reps_max,
                order_index: i,
              })
              .select()
              .single()
            if (eErr || !newEx) throw eErr || new Error(t('routines.errorAddingExercise'))
            const setsToInsert = Array.from({ length: ex.sets_target }, (_, k) => ({
              routine_exercise_id: newEx.id,
              set_number: k + 1,
              completed: false,
            }))
            await supabase.from('routine_sets').insert(setsToInsert)
          }
        }
        setSuccessMsg(template.routines.length > 1 ? t('routines.createdMultiple') : t('routines.created'))
      } else {
        const { error } = await supabase
          .from('routines')
          .insert({ user_id: user.id, name: newRoutineName.trim(), description: '' })
        if (error) throw error
        setSuccessMsg(t('routines.created'))
      }
    } catch (err: any) {
      setLoading(false)
      setErrorMsg(t('routines.errorCreating') + (err.message || t('routines.unknown')))
      return
    }

    setLoading(false)
    setShowRoutineModal(false)
    setNewRoutineName('')
    setSelectedTemplate('')
    loadRoutines()
  }

  function handleSelectRoutine(routine: Routine) {
    setSelectedRoutine(routine)
  }

  function handleOpenEditRoutine(routine: Routine) {
    setEditingRoutine(routine)
    setEditRoutineName(routine.name)
    setShowEditRoutineModal(true)
  }

  async function handleUpdateRoutine() {
    if (!editingRoutine || !editRoutineName.trim()) return

    setLoading(true)
    setErrorMsg(null)

    const { error } = await supabase
      .from('routines')
      .update({ name: editRoutineName.trim() })
      .eq('id', editingRoutine.id)

    setLoading(false)

    if (error) {
      setErrorMsg(t('routines.errorUpdating') + error.message)
      return
    }

    setShowEditRoutineModal(false)
    setEditingRoutine(null)
    setEditRoutineName('')
    loadRoutines()
    if (selectedRoutine?.id === editingRoutine.id) {
      setSelectedRoutine(prev => prev ? { ...prev, name: editRoutineName.trim() } : null)
    }
    setSuccessMsg(t('routines.updated'))
  }

  async function toggleFavorite(routineId: string) {
    const isFav = favoriteIds.includes(routineId)
    const next = isFav ? favoriteIds.filter(id => id !== routineId) : [...favoriteIds, routineId]
    setFavoriteIds(next)
    const { error } = await supabase.from('routines').update({ is_favorite: !isFav }).eq('id', routineId)
    if (error) {
      setFavoriteIds(prev => isFav ? [...prev, routineId] : prev.filter(id => id !== routineId))
      setErrorMsg(t('routines.errorUpdating') + error.message)
      return
    }
    setSuccessMsg(isFav ? t('routines.removedFromFavorites') : t('routines.addedToFavorites'))
  }

  async function handleDeleteRoutine() {
    if (!editingRoutine) return
    setLoading(true)

    const { error } = await supabase
      .from('routines')
      .update({ deleted_at: new Date().toISOString(), is_favorite: false })
      .eq('id', editingRoutine.id)

    setLoading(false)
    if (error) { setErrorMsg(t('routines.errorDeleting')); return }

    if (favoriteIds.includes(editingRoutine.id)) {
      setFavoriteIds(prev => prev.filter(id => id !== editingRoutine.id))
    }

    setShowDeleteConfirm(false)
    setShowEditRoutineModal(false)
    setEditingRoutine(null)
    setEditRoutineName('')
    setSuccessMsg(t('routines.deleted'))
    loadRoutines()
    loadDeletedRoutines()
  }

  function handleOpenEditExercise(exercise: RoutineExercise) {
    setEditingExercise(exercise)
    setEditSetsTarget(exercise.sets_target)
    setEditRepsMin(exercise.reps_min)
    setEditRepsMax(exercise.reps_max)
    const parts = exercise.exercise.split(' · ')
    setEditVariant(parts.length > 1 ? parts[1] : null)
    setShowEditExerciseModal(true)
  }

  async function handleUpdateExercise() {
    if (!editingExercise || !selectedRoutine) return
    if (editSetsTarget <= 0 || editRepsMin <= 0 || editRepsMax <= 0 || editRepsMin > editRepsMax) {
      setErrorMsg(t('routines.invalidValues'))
      return
    }

    setLoading(true)
    setErrorMsg(null)

    const baseExerciseName = editingExercise.exercise.split(' · ')[0]
    const updatedExerciseName = editVariant ? `${baseExerciseName} · ${editVariant}` : baseExerciseName

    const { error } = await supabase
      .from('routine_exercises')
      .update({
        exercise: updatedExerciseName,
        sets_target: editSetsTarget,
        reps_min: editRepsMin,
        reps_max: editRepsMax,
      })
      .eq('id', editingExercise.id)

    setLoading(false)

    if (error) {
      setErrorMsg(t('routines.errorUpdating') + error.message)
      return
    }

    setShowEditExerciseModal(false)
    setEditingExercise(null)
    setSuccessMsg(t('routines.exerciseAdded'))

    const exercises = await loadRoutineExercises(selectedRoutine.id)
    await loadRoutineSets(selectedRoutine.id, exercises.map(e => e.id))
  }

  function handleBackToList() {
    setSelectedRoutine(null)
    setRoutineExercises([])
    setRoutineSets({})
  }

  async function handleAddExercise(exerciseName?: string) {
    if (!user || !selectedRoutine) return

    const exercise = exerciseName || newExerciseName
    if (!exercise || !exercise.trim()) return

    const baseName = exercise.trim()
    const useVariant = !exerciseName && newExerciseVariant
    const exerciseWithVariant = useVariant ? `${baseName} · ${newExerciseVariant}` : baseName

    const exerciseExists = routineExercises.some(re => re.exercise === exerciseWithVariant)
    if (exerciseExists) {
      setErrorMsg(t('routines.exerciseExists'))
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const isDefaultExercise = DEFAULT_EXERCISES.includes(baseName as any)
      if (!isDefaultExercise) {
        const { data: existing } = await supabase
          .from('saved_exercises')
          .select('id')
          .eq('user_id', user.id)
          .eq('exercise', baseName)
          .single()

        if (!existing) {
          const { error: saveError } = await supabase
            .from('saved_exercises')
            .insert({ user_id: user.id, exercise: baseName })

          if (saveError) {
            console.error('Error saving custom exercise:', saveError)
          }
        }
      }

      const { data, error } = await supabase
        .from('routine_exercises')
        .insert({
          routine_id: selectedRoutine.id,
          exercise: exerciseWithVariant,
          sets_target: 3,
          reps_min: 8,
          reps_max: 12,
          order_index: routineExercises.length
        })
        .select()
        .single()

      if (error) {
        console.error('Supabase error adding exercise:', error)
        setErrorMsg(t('routines.errorAddingExercise') + error.message)
        return
      }

      const newSets = []
      const newRoutineSets: Record<string, RoutineSet[]> = { ...routineSets }
      for (let i = 1; i <= 3; i++) {
        const setId = crypto.randomUUID()
        newSets.push({
          routine_exercise_id: data.id,
          set_number: i,
          completed: false
        })
        if (!newRoutineSets[data.id]) {
          newRoutineSets[data.id] = []
        }
        newRoutineSets[data.id].push({
          id: setId,
          routine_exercise_id: data.id,
          set_number: i,
          weight: 0,
          reps: 0,
          rir: 0,
          completed: false,
          created_at: new Date().toISOString()
        })
      }
      await supabase.from('routine_sets').insert(newSets)

      setRoutineExercises(prev => [...prev, data])
      setRoutineSets(newRoutineSets)

      const { count } = await supabase
        .from('routine_exercises')
        .select('*', { count: 'exact', head: true })
        .eq('routine_id', selectedRoutine.id)
      setRoutineExerciseCounts(prev => ({
        ...prev,
        [selectedRoutine.id]: count || 0
      }))

      if (newExercisePrimary && !DEFAULT_EXERCISES.includes(baseName as any)) {
        const groups: Record<string, { primary: string; secondary?: string }> = JSON.parse(localStorage.getItem('exercise_muscle_groups') || '{}')
        groups[baseName] = { primary: newExercisePrimary, ...(newExerciseSecondary ? { secondary: newExerciseSecondary } : {}) }
        localStorage.setItem('exercise_muscle_groups', JSON.stringify(groups))
      }
      setNewExerciseName('')
      setNewExerciseVariant(null)
      setNewExercisePrimary('')
      setNewExerciseSecondary('')
      setShowExerciseModal(false)
      setSuccessMsg(t('routines.exerciseAdded'))
    } catch (err) {
      console.error('Error in handleAddExercise:', err)
      setErrorMsg(t('routines.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveExercise(exerciseId: string) {
    await supabase.from('routine_sets').delete().eq('routine_exercise_id', exerciseId)

    const { error } = await supabase
      .from('routine_exercises')
      .delete()
      .eq('id', exerciseId)

    if (error) {
      setErrorMsg(t('routines.errorRemovingExercise'))
      return
    }

    setRoutineExercises(prev => prev.filter(re => re.id !== exerciseId))
    setRoutineSets(prev => {
      const next = { ...prev }
      delete next[exerciseId]
      return next
    })
    setSuccessMsg(t('routines.exerciseRemoved'))
  }

  async function updateExercise(exerciseId: string, field: string, value: number) {
    const { error } = await supabase
      .from('routine_exercises')
      .update({ [field]: value })
      .eq('id', exerciseId)

    if (error) {
      setErrorMsg(t('routines.errorUpdating').trim())
      return
    }

    setRoutineExercises(prev => prev.map(re =>
      re.id === exerciseId ? { ...re, [field]: value } : re
    ))
  }

  async function getWeightRecommendation(exerciseName: string, targetReps: number) {
    if (!user) return null

    const { data, error } = await supabase.rpc('get_weight_recommendation', {
      p_user_id: user.id,
      p_exercise: exerciseName,
      p_target_reps: targetReps
    })

    if (error || !data || data.length === 0) return null

    return data[0]
  }

  async function syncExerciseSets(exerciseId: string, setsTarget: number) {
    if (!exerciseId) return

    try {
      const { data: existingSets } = await supabase
        .from('routine_sets')
        .select('*')
        .eq('routine_exercise_id', exerciseId)
        .order('set_number', { ascending: true })

      const currentCount = existingSets?.length || 0

      if (currentCount < setsTarget) {
        const newSets: RoutineSet[] = []
        for (let i = currentCount + 1; i <= setsTarget; i++) {
          newSets.push({
            id: crypto.randomUUID(),
            routine_exercise_id: exerciseId,
            set_number: i,
            weight: 0,
            reps: 0,
            rir: 0,
            completed: false,
            created_at: new Date().toISOString()
          })
        }
        const setsToInsert = newSets.map(s => ({
          routine_exercise_id: s.routine_exercise_id,
          set_number: s.set_number,
          completed: false
        }))
        await supabase.from('routine_sets').insert(setsToInsert)
        setRoutineSets(prev => ({
          ...prev,
          [exerciseId]: [...(prev[exerciseId] || []), ...newSets]
        }))
      } else if (currentCount > setsTarget) {
        const setsToRemove = (existingSets || []).slice(setsTarget).map(s => s.id)
        if (setsToRemove.length > 0) {
          await supabase.from('routine_sets').delete().in('id', setsToRemove)
          const newSets = (existingSets || []).slice(0, setsTarget)
          setRoutineSets(prev => ({
            ...prev,
            [exerciseId]: newSets
          }))
        }
      }
    } catch (error) {
      console.error('Error syncing sets:', error)
    }
  }

  async function toggleSetCompletion(exerciseId: string, setNumber: number, completed: boolean) {
    const set = routineSets[exerciseId]?.find(s => s.set_number === setNumber)
    if (!set) return

    const { error } = await supabase
      .from('routine_sets')
      .update({
        completed: completed,
        completed_at: completed ? new Date().toISOString() : null
      })
      .eq('id', set.id)

    if (error) {
      setErrorMsg(t('routines.errorUpdatingSet'))
      return
    }

    setRoutineSets(prev => {
      const current = prev[exerciseId] || []
      const updated = current.map(s =>
        s.set_number === setNumber
          ? ({ ...s, completed, completed_at: completed ? new Date().toISOString() : null } as RoutineSet)
          : s
      )
      return { ...prev, [exerciseId]: updated }
    })

    if (completed && typeof window !== 'undefined') {
      const restPreset = parseInt(localStorage.getItem('rest_timer_default') || '90', 10)
      window.dispatchEvent(new CustomEvent('rest-timer:start', { detail: { seconds: restPreset } }))
    }
  }

  async function handleUpdateSet(exerciseId: string, setId: string, weight: number, reps: number) {
    setRoutineSets(prev => {
      const current = prev[exerciseId] || []
      const updated = current.map(s =>
        s.id === setId ? { ...s, weight, reps } : s
      )
      return { ...prev, [exerciseId]: updated }
    })

    const { error } = await supabase
      .from('routine_sets')
      .update({ weight, reps })
      .eq('id', setId)

    if (error) {
      console.error('Error updating set:', error)
    }
  }

  function autoCompleteExercise(exerciseId: string) {
    const sets = routineSets[exerciseId] || []
    const allCompleted = sets.every(s => s.completed)

    if (allCompleted) {
      setRoutineSets(prev => {
        const current = prev[exerciseId] || []
        const updated = current.map(s => ({ ...s, completed: false }))
        return { ...prev, [exerciseId]: updated }
      })
    }
  }

  async function resetRoutineForNextDay() {
    if (!selectedRoutine) return

    const exerciseIds = routineExercises.map(re => re.id)
    const { error } = await supabase
      .from('routine_sets')
      .update({ completed: false, completed_at: null })
      .in('routine_exercise_id', exerciseIds)

    if (error) {
      setErrorMsg(t('routines.errorReset'))
      return
    }

    loadRoutineSets(selectedRoutine.id)
    setSuccessMsg(t('routines.resetDone'))
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  if (!selectedRoutine) {

    const filteredRoutines = activeTab === 'fav'
      ? routines.filter(r => favoriteIds.includes(r.id))
      : routines

    const todayDow = new Date().getDay()

    return (
      <div className="min-h-screen bg-[var(--bg)]">
        {/* Header */}
        <div className="px-5 pt-12 pb-0 flex items-end justify-between max-w-2xl mx-auto">
          <div>
            <p className="section-label mb-1">{t('routines.yourRoutines')}</p>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)]">
              {t('routines.title')}.
            </h1>
          </div>
          <button
            onClick={() => setShowRoutineModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium text-white tap-scale"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            + {t('routines.newShort')}
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 px-5 pt-4 pb-3 max-w-2xl mx-auto">
          {[
            { id: 'all' as const, label: t('routines.tabAll'), count: routines.length },
            { id: 'fav' as const, label: t('routines.tabFavorites'), count: routines.filter(r => favoriteIds.includes(r.id)).length },
            { id: 'deleted' as const, label: t('routines.tabDeleted'), count: deletedRoutines.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-full text-[12px] font-medium border transition-colors"
              style={activeTab === tab.id
                ? { backgroundColor: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
                : { backgroundColor: 'transparent', color: 'var(--text-2)', borderColor: 'var(--rule)' }}
            >
              {tab.label}
              <span className="font-mono text-[10px] opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="px-5 pb-6 max-w-2xl mx-auto">
          {/* This-week calendar */}
          <div className="card-surface px-3.5 py-3 mb-3">
            <p className="section-label mb-2">{t('routines.thisWeek')}</p>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map(d => {
                const isToday = todayDow === d
                const hasRoutine = routines.some(r => (routineDays[r.id] || []).includes(d))
                const diff = d - todayDow
                const dateObj = new Date()
                dateObj.setDate(dateObj.getDate() + diff)
                const dateNum = dateObj.getDate()
                return (
                  <div
                    key={d}
                    className="flex-1 h-14 rounded-[10px] flex flex-col items-center justify-between py-1.5"
                    style={{
                      background: isToday ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : hasRoutine ? 'var(--card-hi)' : 'transparent',
                      border: `1px solid ${isToday ? 'var(--accent)' : 'var(--rule)'}`,
                    }}
                  >
                    <span
                      className="font-mono text-[9px] leading-none"
                      style={{ color: isToday ? 'var(--accent)' : 'var(--text-3)', fontWeight: isToday ? 600 : 400 }}
                    >
                      {getDayAbbr(d)}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: hasRoutine ? (isToday ? 'var(--accent)' : 'var(--text-3)') : 'transparent' }}
                    />
                    <span
                      className="font-mono text-[11px] leading-none"
                      style={{ color: isToday ? 'var(--accent)' : hasRoutine ? 'var(--text)' : 'var(--text-3)', fontWeight: isToday ? 600 : 500 }}
                    >
                      {dateNum}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Deleted tab */}
          {activeTab === 'deleted' ? (
            deletedRoutines.length === 0 ? (
              <p className="text-[var(--text-3)] text-sm py-6 text-center">{t('routines.noDeleted')}</p>
            ) : (
              <div className="space-y-2">
                {deletedRoutines.map((dr, idx) => (
                  <div
                    key={dr.id}
                    className="card-surface px-4 py-3 flex items-center justify-between gap-3"
                    style={{ animation: `dopSlideUp 500ms ${idx * 70}ms cubic-bezier(.22,1,.36,1) both` }}
                  >
                    <div className="min-w-0">
                      <p className="text-[var(--text)] font-medium text-[15px] truncate">{dr.name}</p>
                      <p className="text-[var(--text-3)] font-mono text-[10px] mt-0.5">
                        {new Date(dr.deleted_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreRoutine(dr.id)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-80 active:scale-95"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                        color: 'var(--accent)',
                        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                      }}
                    >
                      {t('routines.restore')}
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {filteredRoutines.length === 0 ? (
                <p className="text-[var(--text-3)] text-sm py-6 text-center">
                  {activeTab === 'fav' ? t('routines.noFavorites') : t('routines.noRoutines')}
                </p>
              ) : (
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleRoutineDragEnd}>
                  <SortableContext items={filteredRoutines.map(r => r.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {filteredRoutines.map((routine, idx) => {
                        const isFav = favoriteIds.includes(routine.id)
                        const days = routineDays[routine.id] || []
                        return (
                          <SortableExerciseItem key={routine.id} id={routine.id}>
                            {({ ref, style, attributes, listeners, isDragging }) => (
                              <div
                                ref={ref}
                                style={{ ...style, animation: `dopSlideUp 500ms ${idx * 70}ms cubic-bezier(.22,1,.36,1) both` }}
                                {...attributes}
                                className={`card-surface overflow-hidden transition-all ${isDragging ? 'opacity-60' : ''}`}
                              >
                                <div className="px-4 pt-3.5 pb-3.5">
                                  <div className="flex items-start gap-2.5">
                                    {/* Drag handle */}
                                    <button
                                      {...listeners}
                                      type="button"
                                      className="touch-none cursor-grab active:cursor-grabbing mt-[5px] flex-shrink-0"
                                      style={{ color: 'var(--text-3)' }}
                                      aria-label={t('routines.dragToReorder')}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                        <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
                                        <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                                        <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
                                      </svg>
                                    </button>

                                    {/* Main tap area → detail */}
                                    <button className="flex-1 min-w-0 text-left" onClick={() => handleSelectRoutine(routine)}>
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)] truncate">
                                          {routine.name}
                                        </h3>
                                        {isFav && (
                                          <span className="text-[13px] flex-shrink-0" style={{ color: 'var(--accent)' }}>★</span>
                                        )}
                                      </div>
                                      {routine.description ? (
                                        <p className="text-[var(--text-2)] text-[13px] leading-snug mt-1 mb-2">{routine.description}</p>
                                      ) : (
                                        <div className="mb-2" />
                                      )}
                                      <span className="font-mono text-[10px] text-[var(--text-3)]">
                                        {t('routines.exercisesCount', { count: String(routineExerciseCounts[routine.id] || 0) })}
                                      </span>
                                    </button>

                                    {/* Right column: day circles + action buttons */}
                                    <div className="flex-shrink-0 flex flex-col items-end gap-2.5">
                                      <div className="flex gap-0.5">
                                        {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                          const active = days.includes(d)
                                          return (
                                            <span
                                              key={d}
                                              className="w-[18px] h-[18px] rounded-full flex items-center justify-center font-mono text-[8px] font-medium"
                                              style={{
                                                background: active ? 'var(--accent)' : 'transparent',
                                                color: active ? '#fff' : 'var(--text-3)',
                                                border: `1px solid ${active ? 'var(--accent)' : 'var(--rule)'}`,
                                              }}
                                            >
                                              {getDayAbbr(d)[0]}
                                            </span>
                                          )
                                        })}
                                      </div>
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); toggleFavorite(routine.id) }}
                                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--card-hi)]"
                                          style={{ color: isFav ? 'var(--accent)' : 'var(--text-3)' }}
                                          aria-label={isFav ? t('routines.unfavorite') : t('routines.favorite')}
                                        >
                                          {isFav ? '★' : '☆'}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleOpenEditRoutine(routine) }}
                                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[13px] transition-colors hover:bg-[var(--card-hi)]"
                                          style={{ color: 'var(--text-3)' }}
                                          aria-label={t('routines.editBtn')}
                                        >
                                          ✎
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </SortableExerciseItem>
                        )
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

            </>
          )}
        </div>

        {/* Modal: Nova Rutina */}
        {showRoutineModal && (
          <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm fade-in"
            onClick={() => { setShowRoutineModal(false); setSelectedTemplate('') }}
          >
            <div
              className="bg-[var(--card)] border border-[var(--rule)] rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] w-full max-w-sm max-h-[85vh] overflow-y-auto animate-scale-in"
              style={{ boxShadow: 'var(--shadow)' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text)] mb-4">{t('routines.new')}</h3>

              <p className="section-label mb-2">{t('routines.template')}</p>
              <div className="space-y-2 mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate('')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${selectedTemplate === '' ? 'bg-[var(--card-hi)] border-[var(--text-3)] text-[var(--text)]' : 'bg-[var(--card-hi)] border-[var(--rule)] text-[var(--text-3)] hover:border-[var(--text-3)]'}`}
                >
                  <p className="text-sm font-medium">{t('routines.empty')}</p>
                  <p className="text-xs text-[var(--text-3)]">{t('routines.emptyDesc')}</p>
                </button>
                {ROUTINE_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${selectedTemplate === tpl.id ? 'bg-[var(--card-hi)] border-[var(--text-3)] text-[var(--text)]' : 'bg-[var(--card-hi)] border-[var(--rule)] text-[var(--text-3)] hover:border-[var(--text-3)]'}`}
                  >
                    <p className="text-sm font-medium">{t(tpl.nameKey)}</p>
                    <p className="text-xs text-[var(--text-3)]">{t(tpl.descKey)}</p>
                  </button>
                ))}
              </div>

              {(!selectedTemplate || ROUTINE_TEMPLATES.find(tpl => tpl.id === selectedTemplate)?.routines.length === 1) && (
                <input
                  type="text"
                  value={newRoutineName}
                  onChange={(e) => setNewRoutineName(e.target.value)}
                  placeholder={selectedTemplate ? t('routines.customName') : t('routines.routineName')}
                  className="w-full bg-[var(--card-hi)] text-[var(--text)] rounded-2xl px-4 py-3 mb-3 border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                />
              )}
              {errorMsg && <p className="text-sm mb-3 text-[var(--danger)]">{errorMsg}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRoutineModal(false); setSelectedTemplate('') }}
                  className="flex-1 py-3 rounded-2xl bg-[var(--card-hi)] text-[var(--text-2)] font-medium hover:bg-[var(--rule-soft)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreateRoutine}
                  disabled={loading}
                  className="flex-1 py-3 rounded-2xl font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {loading ? '…' : t('common.create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Editar Rutina */}
        {showEditRoutineModal && editingRoutine && (
          <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm fade-in"
            onClick={() => { setShowEditRoutineModal(false); setShowDeleteConfirm(false) }}
          >
            <div
              className="bg-[var(--card)] border border-[var(--rule)] rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] w-full max-w-sm max-h-[85vh] overflow-y-auto animate-scale-in"
              style={{ boxShadow: 'var(--shadow)' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold tracking-tight text-[var(--text)] mb-4">{t('routines.edit')}</h3>
              <input
                type="text"
                value={editRoutineName}
                onChange={(e) => setEditRoutineName(e.target.value)}
                placeholder={t('routines.routineName')}
                className="w-full bg-[var(--card-hi)] text-[var(--text)] rounded-2xl px-4 py-3 mb-3 border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              {/* Day-of-week selector */}
              <div className="mb-4">
                <p className="section-label mb-2">{t('routines.trainingDays')}</p>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const active = routineDays[editingRoutine.id]?.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleRoutineDay(editingRoutine.id, d)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          backgroundColor: active ? 'var(--good)' : 'var(--card-hi)',
                          color: active ? '#fff' : 'var(--text-3)',
                          border: `1px solid ${active ? 'var(--good)' : 'var(--rule)'}`,
                        }}
                      >
                        {getDayAbbr(d)}
                      </button>
                    )
                  })}
                </div>
              </div>
              {errorMsg && <p className="text-sm mb-3 text-[var(--danger)]">{errorMsg}</p>}
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => { setShowEditRoutineModal(false); setShowDeleteConfirm(false) }}
                  className="flex-1 py-3 rounded-2xl bg-[var(--card-hi)] text-[var(--text-2)] font-medium hover:bg-[var(--rule-soft)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleUpdateRoutine}
                  className="flex-1 py-3 rounded-2xl font-medium text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {t('common.save')}
                </button>
              </div>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 rounded-2xl text-sm font-medium transition-colors"
                  style={{ color: 'var(--danger)', backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)' }}
                >
                  {t('routines.deleteRoutine')}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>
                    {t('routines.deleteConfirm', { name: editingRoutine.name })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2.5 rounded-2xl text-sm bg-[var(--card-hi)] text-[var(--text-2)] hover:bg-[var(--rule-soft)] transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleDeleteRoutine}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-2xl text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      {loading ? '…' : t('common.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div
            className="fixed bottom-24 left-5 right-5 px-4 py-3 rounded-2xl fade-in z-50 backdrop-blur-md"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--good) 18%, var(--card))',
              border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)',
            }}
          >
            <p className="text-sm text-center" style={{ color: 'var(--good)' }}>{successMsg}</p>
          </div>
        )}

        <QuickLogFab />
        <div className="h-24" />
      </div>
    )
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────
  const completedExercises = routineExercises.filter(re => {
    const sets = routineSets[re.id] || []
    return sets.length > 0 && sets.every(s => s.completed)
  }).length
  const totalExercises = routineExercises.length
  const progressPct = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 max-w-2xl mx-auto">
        <button
          onClick={handleBackToList}
          className="text-[var(--text-3)] hover:text-[var(--text)] text-sm transition-colors inline-flex items-center gap-1 mb-2"
        >
          <span aria-hidden>‹</span> {t('routines.title')}
        </button>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] leading-none text-[var(--text)]">
          {selectedRoutine?.name}
        </h1>
      </div>

      <div className="px-5 space-y-4 max-w-2xl mx-auto animate-slide-up">
        {/* Progress card */}
        <div className="card-surface px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[var(--text-2)] text-sm">
              {t('routines.routineProgressFormat', { done: String(completedExercises), total: String(totalExercises) })}
            </p>
            <p className="font-mono text-xs text-[var(--text-3)] tabular-nums">{progressPct}%</p>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden bg-[var(--rule-soft)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: 'var(--good)' }}
            />
          </div>
        </div>

        {/* Exercise list */}
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleExerciseDragEnd}>
          <SortableContext items={routineExercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {routineExercises.map(exercise => {
                const sets = routineSets[exercise.id] || []
                const completedSets = sets.filter(s => s.completed).length
                const allCompleted = sets.length >= exercise.sets_target && sets.every(s => s.completed)

                return (
                  <SortableExerciseItem key={exercise.id} id={exercise.id}>
                    {({ ref, style, attributes, listeners, isDragging }) => (
                      <div
                        ref={ref}
                        style={style}
                        {...attributes}
                        className={`card-surface p-4 space-y-3 transition-all ${isDragging ? 'opacity-60' : ''} ${allCompleted ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            {...listeners}
                            type="button"
                            className="touch-none cursor-grab active:cursor-grabbing -ml-1 p-1 flex-shrink-0 mt-0.5"
                            style={{ color: 'var(--text-3)' }}
                            aria-label={t('routines.dragToReorder')}
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/>
                              <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                              <circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/>
                            </svg>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--text)] font-medium truncate flex items-center gap-2">
                              {tEx(exercise.exercise)}
                              {allCompleted && <span className="text-xs" style={{ color: 'var(--good)' }}>✓</span>}
                            </p>
                            <p className="text-[var(--text-3)] font-mono text-xs mt-0.5">
                              {t('routines.repsRangeFormat', { sets: String(exercise.sets_target), repsMin: String(exercise.reps_min), repsMax: String(exercise.reps_max) })}
                              <span className="mx-1.5">·</span>
                              <span className="tabular-nums">{completedSets}/{exercise.sets_target}</span>
                              {(() => {
                                const parts = exercise.exercise.split(' · ')
                                const parsedVariant = parts.length > 1 ? parts[1] : null
                                return parsedVariant ? (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-[var(--card-hi)] text-[var(--text-3)]">
                                    {VARIANT_KEYS[parsedVariant] ? t(VARIANT_KEYS[parsedVariant]) : parsedVariant}
                                  </span>
                                ) : null
                              })()}
                            </p>
                          </div>
                          <div className="flex gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => handleOpenEditExercise(exercise)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--card-hi)] text-sm"
                              style={{ color: 'var(--text-3)' }}
                              title={t('routines.editExerciseTitle')}
                              aria-label={t('routines.editExerciseTitle')}
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleRemoveExercise(exercise.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--card-hi)] text-sm"
                              style={{ color: 'var(--text-3)' }}
                              title={t('routines.removeExerciseTitle')}
                              aria-label={t('routines.removeExerciseTitle')}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Last session */}
                        {lastSessions[exercise.exercise] && (
                          <div className="px-3 py-2 rounded-xl border" style={{ backgroundColor: 'var(--card-hi)', borderColor: 'var(--rule)' }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="section-label">{t('workouts.lastSession')}</p>
                              <p className="font-mono text-[10px] text-[var(--text-3)]">
                                {new Date(lastSessions[exercise.exercise].date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {lastSessions[exercise.exercise].sets.map((s, i) => (
                                <span key={i} className="font-mono text-xs px-2 py-0.5 rounded-md bg-[var(--rule-soft)] text-[var(--text-2)] tabular-nums">
                                  {format(s.weight)}{unit} × {s.reps}
                                  {s.rir != null && <span className="text-[var(--text-3)]"> · RIR {s.rir}</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sets */}
                        <div className="space-y-1.5">
                          {sets.map((set) => {
                            const prev = lastSessions[exercise.exercise]?.sets[set.set_number - 1]
                            const curW = set.weight || 0, curR = set.reps || 0
                            const hasCurrent = curR > 0 && (curW > 0 || (prev?.weight === 0))
                            const isBodyweight = prev?.weight === 0 && curW === 0
                            const curMetric = isBodyweight ? curR : calculate1RM(curW, curR)
                            const prevMetric = prev ? (isBodyweight ? prev.reps : calculate1RM(prev.weight, prev.reps)) : 0
                            const diff = curMetric - prevMetric
                            const diffPct = prevMetric > 0 ? Math.round((diff / prevMetric) * 100) : 0
                            return (
                              <div
                                key={set.id}
                                className="flex items-center gap-2 p-2 rounded-xl border transition-colors"
                                style={set.completed
                                  ? { backgroundColor: 'color-mix(in srgb, var(--good) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--good) 25%, transparent)' }
                                  : { backgroundColor: 'var(--card-hi)', borderColor: 'var(--rule)' }}
                              >
                                <span className="font-mono text-[11px] font-medium tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--text-3)' }}>
                                  {set.set_number}
                                </span>

                                <button
                                  onClick={() => toggleSetCompletion(exercise.id, set.set_number, !set.completed)}
                                  className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0"
                                  style={set.completed
                                    ? { backgroundColor: 'var(--good)', borderColor: 'var(--good)', color: '#fff' }
                                    : { borderColor: 'var(--rule)' }}
                                  aria-label={set.completed ? t('routines.completed') : t('routines.pending')}
                                >
                                  {set.completed && <span className="text-xs leading-none">✓</span>}
                                </button>

                                {!set.completed ? (
                                  <>
                                    <input
                                      type="number"
                                      value={set.weight ? (unit === 'kg' ? set.weight : Number(fromKg(set.weight).toFixed(1))) : ''}
                                      onChange={(e) => {
                                        const inputVal = parseFloat(e.target.value) || 0
                                        handleUpdateSet(exercise.id, set.id, toKg(inputVal), set.reps || 0)
                                      }}
                                      placeholder={prev ? format(prev.weight) : unit}
                                      className="w-16 bg-[var(--card)] text-[var(--text)] rounded-lg px-2 py-1.5 text-sm tabular-nums border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                    <span className="text-[var(--text-3)] text-xs">×</span>
                                    <input
                                      type="number"
                                      value={set.reps || ''}
                                      onChange={(e) => {
                                        const r = parseInt(e.target.value) || 0
                                        handleUpdateSet(exercise.id, set.id, set.weight || 0, r)
                                      }}
                                      placeholder={prev ? String(prev.reps) : t('routines.repsLabel')}
                                      className="w-14 bg-[var(--card)] text-[var(--text)] rounded-lg px-2 py-1.5 text-sm tabular-nums border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                  </>
                                ) : (
                                  <span className="font-mono text-sm tabular-nums text-[var(--text-2)]">
                                    {format(set.weight)}{unit} × {set.reps}
                                  </span>
                                )}

                                <div className="ml-auto flex items-center gap-1.5">
                                  {prev && hasCurrent && prevMetric > 0 && diff !== 0 && (
                                    <span
                                      className="font-mono text-[10px] px-1.5 py-0.5 rounded font-medium tabular-nums"
                                      style={diff > 0
                                        ? { backgroundColor: 'color-mix(in srgb, var(--good) 18%, transparent)', color: 'var(--good)' }
                                        : { color: 'var(--text-3)' }}
                                      title={`${t('workouts.previous')}: ${format(prev.weight)}${unit} × ${prev.reps}`}
                                    >
                                      {diff > 0 ? `▲${diffPct}%` : `▼${Math.abs(diffPct)}%`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {allCompleted && (
                          <button
                            onClick={() => autoCompleteExercise(exercise.id)}
                            className="w-full text-xs py-2 rounded-xl transition-colors"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--good) 12%, transparent)',
                              color: 'var(--good)',
                              border: '1px solid color-mix(in srgb, var(--good) 30%, transparent)',
                            }}
                          >
                            ✓ {t('routines.exerciseCompleted')}
                          </button>
                        )}
                      </div>
                    )}
                  </SortableExerciseItem>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add exercise */}
        <button
          onClick={() => setShowExerciseModal(true)}
          className="w-full py-3 rounded-2xl border-2 border-dashed text-sm transition-colors"
          style={{ borderColor: 'var(--rule)', color: 'var(--text-3)' }}
        >
          + {t('routines.addExercise')}
        </button>

        {/* Reset */}
        <button
          onClick={resetRoutineForNextDay}
          className="w-full py-3 rounded-2xl text-sm transition-colors"
          style={{ backgroundColor: 'var(--card-hi)', color: 'var(--text-3)', border: '1px solid var(--rule)' }}
        >
          ↺ {t('routines.resetForSession')}
        </button>
      </div>

      {/* Modal: Afegir Exercici */}
      {showExerciseModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm fade-in"
          onClick={() => { setShowExerciseModal(false); setNewExerciseName(''); setNewExerciseVariant(null); setNewExercisePrimary(''); setNewExerciseSecondary(''); setErrorMsg(null) }}
        >
          <div
            className="bg-[var(--card)] border border-[var(--rule)] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm max-h-[80vh] flex flex-col animate-scale-in"
            style={{ boxShadow: 'var(--shadow)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text)] mb-4">{t('routines.addExercise')}</h3>

            {errorMsg && <p className="text-sm mb-3 text-[var(--danger)]">{errorMsg}</p>}

            {(() => {
              const muscleOptions = [
                { value: 'Pectoral', key: 'exercise.muscleGroupPectoral' },
                { value: 'Esquena', key: 'exercise.muscleGroupEsquena' },
                { value: 'Cames', key: 'exercise.muscleGroupCames' },
                { value: 'Esquitxos', key: 'exercise.muscleGroupEsquitxos' },
                { value: 'Braços', key: 'exercise.muscleGroupBracos' },
                { value: 'Abdominals', key: 'exercise.muscleGroupAbdominals' },
                { value: 'Gluts', key: 'exercise.muscleGroupGluts' },
                { value: 'Full Body', key: 'exercise.muscleGroupFullBody' },
              ]
              const isCustom = newExerciseName.trim() && !DEFAULT_EXERCISES.includes(newExerciseName.trim() as any)
              const exerciseVariants = EXERCISE_VARIANTS[newExerciseName.trim()] ?? null
              return (
                <div className="mb-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newExerciseName}
                      onChange={(e) => { setNewExerciseName(e.target.value); setNewExerciseVariant(null) }}
                      placeholder={t('routines.exerciseNamePlaceholder')}
                      className="flex-1 bg-[var(--card-hi)] text-[var(--text)] rounded-xl px-4 py-2.5 text-sm border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                      onKeyDown={(e) => { if (e.key === 'Enter' && newExerciseName.trim()) handleAddExercise() }}
                      autoFocus
                    />
                    <button
                      onClick={() => { if (newExerciseName.trim()) handleAddExercise() }}
                      disabled={!newExerciseName.trim()}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-white whitespace-nowrap disabled:opacity-40 hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      + {t('routines.add')}
                    </button>
                  </div>
                  {exerciseVariants && (
                    <div>
                      <label className="section-label block mb-1.5">{t('routines.variantLabel')}</label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setNewExerciseVariant(null)}
                          className="px-3 py-1 rounded-lg text-xs transition-colors"
                          style={newExerciseVariant === null
                            ? { backgroundColor: 'var(--text)', color: 'var(--bg)' }
                            : { backgroundColor: 'var(--card-hi)', color: 'var(--text-2)', border: '1px solid var(--rule)' }}
                        >
                          {t('routines.variantAny')}
                        </button>
                        {exerciseVariants.map(v => (
                          <button
                            key={v}
                            onClick={() => setNewExerciseVariant(v)}
                            className="px-3 py-1 rounded-lg text-xs transition-colors"
                            style={newExerciseVariant === v
                              ? { backgroundColor: 'var(--text)', color: 'var(--bg)' }
                              : { backgroundColor: 'var(--card-hi)', color: 'var(--text-2)', border: '1px solid var(--rule)' }}
                          >
                            {VARIANT_KEYS[v] ? t(VARIANT_KEYS[v]) : v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isCustom && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="section-label block mb-1">{t('exercise.primaryMuscle')}</label>
                        <select
                          value={newExercisePrimary}
                          onChange={(e) => setNewExercisePrimary(e.target.value)}
                          className="w-full bg-[var(--card-hi)] text-[var(--text)] rounded-xl px-3 py-2 text-xs border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                        >
                          <option value="">—</option>
                          {muscleOptions.map(o => <option key={o.value} value={o.value}>{t(o.key)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="section-label block mb-1">{t('exercise.secondaryMuscle')}</label>
                        <select
                          value={newExerciseSecondary}
                          onChange={(e) => setNewExerciseSecondary(e.target.value)}
                          className="w-full bg-[var(--card-hi)] text-[var(--text)] rounded-xl px-3 py-2 text-xs border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                        >
                          <option value="">{t('exercise.noSecondary')}</option>
                          {muscleOptions.map(o => <option key={o.value} value={o.value}>{t(o.key)}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            <p className="section-label mb-2">{t('workouts.exercise')}</p>
            <div className="space-y-1 overflow-y-auto -mx-1 px-1 flex-1 min-h-0">
              {allExercises.map(ex => (
                <button
                  key={ex}
                  onClick={() => {
                    if (EXERCISE_VARIANTS[ex]) {
                      setNewExerciseName(ex)
                      setNewExerciseVariant(null)
                    } else {
                      handleAddExercise(ex)
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-left transition-colors"
                  style={newExerciseName === ex
                    ? { backgroundColor: 'var(--card-hi)', color: 'var(--text)' }
                    : { backgroundColor: 'transparent', color: 'var(--text-2)' }}
                >
                  {tEx(ex)}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowExerciseModal(false); setNewExerciseName(''); setNewExerciseVariant(null); setNewExercisePrimary(''); setNewExerciseSecondary(''); setErrorMsg(null) }}
                className="flex-1 py-3 rounded-2xl bg-[var(--card-hi)] text-[var(--text-2)] font-medium hover:bg-[var(--rule-soft)] transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Exercici */}
      {showEditExerciseModal && editingExercise && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm fade-in"
          onClick={() => setShowEditExerciseModal(false)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--rule)] rounded-t-3xl sm:rounded-3xl px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] w-full max-w-sm animate-scale-in"
            style={{ boxShadow: 'var(--shadow)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text)] mb-1">{t('routines.editExercise')}</h3>
            <p className="text-[var(--text-3)] text-sm mb-4">{tEx(editingExercise.exercise)}</p>

            <div className="space-y-4">
              <div>
                <label className="section-label block mb-2">{t('routines.setsTarget')}</label>
                <input
                  type="number"
                  min="1"
                  value={editSetsTarget}
                  onChange={(e) => setEditSetsTarget(parseInt(e.target.value) || 1)}
                  className="w-full bg-[var(--card-hi)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="section-label block mb-2">{t('routines.repsMin')}</label>
                  <input
                    type="number"
                    min="1"
                    value={editRepsMin}
                    onChange={(e) => setEditRepsMin(parseInt(e.target.value) || 1)}
                    className="w-full bg-[var(--card-hi)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="section-label block mb-2">{t('routines.repsMax')}</label>
                  <input
                    type="number"
                    min="1"
                    value={editRepsMax}
                    onChange={(e) => setEditRepsMax(parseInt(e.target.value) || 1)}
                    className="w-full bg-[var(--card-hi)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--rule)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
              {editingExercise && EXERCISE_VARIANTS[editingExercise.exercise.split(' · ')[0]] && (
                <div>
                  <label className="section-label block mb-1.5">{t('routines.variantLabel')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setEditVariant(null)}
                      className="px-3 py-1 rounded-lg text-xs transition-colors"
                      style={editVariant === null
                        ? { backgroundColor: 'var(--text)', color: 'var(--bg)' }
                        : { backgroundColor: 'var(--card-hi)', color: 'var(--text-2)', border: '1px solid var(--rule)' }}
                    >
                      {t('routines.variantAny')}
                    </button>
                    {EXERCISE_VARIANTS[editingExercise.exercise.split(' · ')[0]].map(v => (
                      <button
                        key={v}
                        onClick={() => setEditVariant(v)}
                        className="px-3 py-1 rounded-lg text-xs transition-colors"
                        style={editVariant === v
                          ? { backgroundColor: 'var(--text)', color: 'var(--bg)' }
                          : { backgroundColor: 'var(--card-hi)', color: 'var(--text-2)', border: '1px solid var(--rule)' }}
                      >
                        {VARIANT_KEYS[v] ? t(VARIANT_KEYS[v]) : v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {errorMsg && <p className="text-sm mt-4 text-[var(--danger)]">{errorMsg}</p>}

            <button
              onClick={async () => {
                if (!editingExercise) return
                const rec = await getWeightRecommendation(editingExercise.exercise, editRepsMin)
                if (rec) {
                  setSuccessMsg(t('routines.recommendation', { exercise: tEx(editingExercise.exercise), weight: format(rec.recommended_weight), unit, prevWeight: format(rec.previous_weight), prevReps: String(rec.previous_reps) }))
                } else {
                  setSuccessMsg(t('routines.noExerciseHistory'))
                }
                setShowEditExerciseModal(false)
              }}
              className="w-full mt-4 py-2.5 rounded-2xl text-sm transition-colors"
              style={{ color: 'var(--text-3)', backgroundColor: 'var(--card-hi)', border: '1px solid var(--rule)' }}
            >
              💡 {t('routines.recommendWeight')}
            </button>

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setShowEditExerciseModal(false)}
                className="flex-1 py-3 rounded-2xl bg-[var(--card-hi)] text-[var(--text-2)] font-medium hover:bg-[var(--rule-soft)] transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUpdateExercise}
                className="flex-1 py-3 rounded-2xl font-medium text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div
          className="fixed bottom-24 left-5 right-5 px-4 py-3 rounded-2xl z-50 fade-in backdrop-blur-md"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--good) 18%, var(--card))',
            border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)',
          }}
        >
          <p className="text-sm text-center" style={{ color: 'var(--good)' }}>{successMsg}</p>
        </div>
      )}

      <RestTimer />
      <QuickLogFab />
      <div className="h-40" />
    </div>
  )
}
