const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return {}
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

function normalizeUrl(url) {
  return (url || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
  const url = normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  const key = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  if (!url || !key) {
    console.error('❌ .env.local Supabase 설정이 없습니다.')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const total = await supabase.from('records').select('*', { count: 'exact', head: true })
  const active = await supabase.from('records').select('*', { count: 'exact', head: true }).is('deleted_at', null)
  const deleted = await supabase.from('records').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null)

  console.log('전체 실적:', total.count ?? '?', total.error ? `(조회 오류: ${total.error.message})` : '')
  console.log('활성 실적:', active.count ?? '?', active.error ? `(조회 오류: ${active.error.message})` : '')
  console.log('삭제함:', deleted.count ?? '?', deleted.error ? `(조회 오류: ${deleted.error.message})` : '')

  if (deleted.error) {
    console.error('\n❌ deleted_at 컬럼이 없을 수 있습니다. scripts/add-deleted-at-columns.sql 을 먼저 실행하세요.')
    process.exit(1)
  }

  if ((deleted.count || 0) === 0) {
    console.log('\n삭제함에 복구할 실적이 없습니다.')
    if ((total.count || 0) === 0) {
      console.log('⚠️  DB 자체에 실적이 0건입니다. Vercel과 동일한 Supabase URL인지 확인하세요.')
    }
    return
  }

  const { error } = await supabase
    .from('records')
    .update({ deleted_at: null, deleted_by: null })
    .not('deleted_at', 'is', null)

  if (error) {
    console.error('❌ 복구 실패:', error.message)
    process.exit(1)
  }

  console.log(`\n✅ ${deleted.count}건 복구 완료`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
