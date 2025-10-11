require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local explicitly if present
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const [k, ...rest] = line.split('=');
    if (!k || !rest.length) continue;
    const v = rest.join('=').trim();
    if (v) process.env[k.trim()] = v;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function log(msg) { console.log(msg); }
function warn(msg) { console.warn(msg); }
function error(msg) { console.error(msg); }

async function main() {
  log('🔎 db:status — Docker-free migration status');

  // List local migrations
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  let localMigrations = [];
  try {
    localMigrations = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch (e) {
    warn('No se pudo leer supabase/migrations');
  }
  log(`📄 Migraciones locales (${localMigrations.length}):`);
  for (const f of localMigrations) log(`  - ${f}`);

  if (!supabaseUrl || !serviceKey) {
    warn('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Mostrando solo migraciones locales.');
    return;
  }

  // Connect with service role to read migration_log if exists
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Try querying public.migration_log
  const { data, error: qErr } = await supabase
    .from('migration_log')
    .select('migration_name, applied_at, description')
    .order('applied_at', { ascending: false });

  if (qErr) {
    warn('No se pudo consultar public.migration_log (puede no existir).');
    return;
  }

  log(`✅ Migraciones aplicadas registradas (${data?.length ?? 0}):`);
  for (const row of (data || [])) {
    const when = row.applied_at || 'desconocido';
    log(`  - ${row.migration_name} @ ${when} ${row.description ? '- ' + row.description : ''}`);
  }

  // Compare local vs logged
  const appliedNames = new Set((data || []).map(r => `${r.migration_name}.sql`));
  const pending = localMigrations.filter(f => !appliedNames.has(f));
  log(`🟡 Pendientes (no presentes en migration_log): ${pending.length}`);
  for (const f of pending) log(`  - ${f}`);
}

main().catch(err => {
  error('Error ejecutando db:status');
  error(err?.message || String(err));
  process.exit(1);
});