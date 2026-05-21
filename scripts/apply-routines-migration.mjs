// One-time script to apply the routines migration to Supabase
// Run with: node scripts/apply-routines-migration.mjs <your-access-token>
// Get your access token at: https://supabase.com/dashboard/account/tokens

const accessToken = process.argv[2]
if (!accessToken) {
  console.error('\nUsage: node scripts/apply-routines-migration.mjs <your-access-token>')
  console.error('\nGet your personal access token from:')
  console.error('  https://supabase.com/dashboard/account/tokens\n')
  process.exit(1)
}

const projectRef = 'ronzmensezcuszabqfbz'

const sql = `
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS scheduled_days INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;
`

console.log('Applying routines migration...')

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

if (!response.ok) {
  const err = await response.text()
  console.error('Migration failed:', err)
  console.error('\nAlternative: paste this SQL into the Supabase SQL Editor:')
  console.error('  https://supabase.com/dashboard/project/ronzmensezcuszabqfbz/sql/new\n')
  console.error(sql)
  process.exit(1)
}

const result = await response.json()
console.log('Migration applied successfully!')
console.log(result)
