require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local explicitly if present
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const [k, ...rest] = line.split('=');
    if (!k || !rest.length) continue;
    const v = rest.join('=');
    if (v) process.env[k.trim()] = v.trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function log(msg) { console.log(msg); }
function warn(msg) { console.warn(msg); }

async function tableExists(supabase, table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error && error.message) {
    if (error.message.includes('relation') || error.message.includes('not exist')) return false;
  }
  return !error;
}

async function functionExists(supabase, fn) {
  const { data, error } = await supabase.rpc(fn, {});
  if (error && error.message) {
    if (error.message.includes('not exist') || error.message.includes('does not exist')) return false;
  }
  // A function may require args; existence is inferred if error is about args
  return true;
}

async function main() {
  log('🔎 Verificación de objetos en Supabase (Docker-free)');
  if (!supabaseUrl || !serviceKey) {
    warn('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    'profiles','works','posts','follows','likes',
    'content_views','reading_progress','reading_list','reading_list_chapters','chapters'
  ];
  const functions = [
    'handle_new_user','get_posts_by_likes','get_works_by_likes','get_chapters_by_likes'
  ];

  log('Tablas:');
  for (const t of tables) {
    const exists = await tableExists(supabase, t);
    log(`  - ${t}: ${exists ? '✅ existe' : '❌ falta o no expuesta'}`);
  }

  log('Funciones:');
  for (const f of functions) {
    const exists = await functionExists(supabase, f);
    log(`  - ${f}: ${exists ? '✅ existe (o requiere args, expuesta)' : '❌ falta/not expuesta'}`);
  }
}

main().catch(err => {
  console.error('Error en verificación:', err?.message || err);
  process.exit(1);
});