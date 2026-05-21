import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ronzmensezcuszabqfbz.supabase.co',
  'sb_publishable_PAj7ItJGXoWw1-uedmUYnQ_OrZfRuBz'
)

// Test 1: Can we query routines table with the new columns?
const { data, error } = await supabase
  .from('routines')
  .select('id, name, is_favorite, scheduled_days, deleted_at, created_at')
  .limit(1)

if (error) {
  console.log('FAIL - columns missing or query error:', error.message)
  console.log('Error code:', error.code)
  process.exit(1)
} else {
  console.log('PASS - routines table has all required columns')
  console.log('Query returned (no auth, RLS blocks data - expected):', data?.length ?? 0, 'rows')
}

// Test 2: Check if deleted_at filter works
const { error: filterError } = await supabase
  .from('routines')
  .select('id')
  .is('deleted_at', null)
  .limit(1)

if (filterError) {
  console.log('FAIL - .is("deleted_at", null) filter fails:', filterError.message)
} else {
  console.log('PASS - deleted_at filter works correctly')
}

// Test 3: Check is_favorite column
const { error: favError } = await supabase
  .from('routines')
  .select('id, is_favorite')
  .eq('is_favorite', false)
  .limit(1)

if (favError) {
  console.log('FAIL - is_favorite column error:', favError.message)
} else {
  console.log('PASS - is_favorite column works correctly')
}

// Test 4: Check scheduled_days column
const { error: daysError } = await supabase
  .from('routines')
  .select('id, scheduled_days')
  .limit(1)

if (daysError) {
  console.log('FAIL - scheduled_days column error:', daysError.message)
} else {
  console.log('PASS - scheduled_days column works correctly')
}

console.log('\nAll schema checks complete.')
