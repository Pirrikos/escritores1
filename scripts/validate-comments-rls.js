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
    const v = rest.join('=');
    if (v) process.env[k.trim()] = v.trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ ${msg}`); }

async function signIn(email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`SignIn failed for ${email}: ${error.message}`);
  return { client, user: data.user, accessToken: data.session?.access_token };
}

async function createUser(email) {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = `P@ss-${Math.random().toString(36).slice(2)}-Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Tester', source: 'validate-comments-rls' },
  });
  if (error) throw new Error(`CreateUser failed: ${error.message}`);
  return { admin, user: data.user, password };
}

async function cleanup(adminClient, { workId, commentIds }) {
  try {
    if (commentIds?.length) {
      await adminClient.from('comment_reports').delete().in('comment_id', commentIds);
      await adminClient.from('comment_likes').delete().in('comment_id', commentIds);
      await adminClient.from('comments').delete().in('id', commentIds);
    }
    if (workId) {
      await adminClient.from('works').delete().eq('id', workId);
    }
  } catch (e) {
    console.warn('Cleanup warning:', e?.message || e);
  }
}

async function main() {
  log('🔎 Validación RLS: comentarios, likes y reports');
  if (!url || !anonKey || !serviceKey || !adminEmail || !adminPassword) {
    throw new Error('Faltan envs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD');
  }

  // Sign in admin
  const { client: adminClientAuth, user: adminUser } = await signIn(adminEmail, adminPassword);
  ok(`Admin autenticado: ${adminUser.email}`);

  // Create a work owned by admin for testing
  const { data: workIns, error: workErr } = await adminClientAuth
    .from('works')
    .insert({ title: 'Obra de prueba RLS', synopsis: 'Temporal', author_id: adminUser.id, status: 'published' })
    .select()
    .single();
  if (workErr) throw new Error(`Insert work failed: ${workErr.message}`);
  const workId = workIns.id;
  ok(`Work creada: ${workId}`);

  // Admin creates a comment
  const { data: adminComment, error: adminCommentErr } = await adminClientAuth
    .from('comments')
    .insert({ target_type: 'work', target_id: workId, user_id: adminUser.id, body: 'Comentario de admin' })
    .select()
    .single();
  if (adminCommentErr) throw new Error(`Admin insert comment failed: ${adminCommentErr.message}`);
  ok(`Admin creó comentario: ${adminComment.id}`);

  // Admin updates own comment
  const { error: adminUpdateErr } = await adminClientAuth
    .from('comments')
    .update({ body: 'Comentario editado por admin', is_edited: true })
    .eq('id', adminComment.id);
  if (adminUpdateErr) throw new Error(`Admin update comment failed: ${adminUpdateErr.message}`);
  ok('Admin actualizó su comentario');

  // Create a normal user (service role)
  const testEmail = `tester+${Date.now()}@example.com`;
  const { admin: serviceClient, user: normalUser, password: normalPass } = await createUser(testEmail);
  ok(`Usuario de pruebas creado: ${normalUser.email}`);

  // Sign in as normal user
  const { client: normalClientAuth } = await signIn(testEmail, normalPass);
  ok('Usuario autenticado');

  // Normal user tries to update admin's comment (should fail)
  const { data: normalUpdateData, error: normalUpdateOtherErr } = await normalClientAuth
    .from('comments')
    .update({ body: 'Intento indebido' })
    .eq('id', adminComment.id)
    .select()
    .maybeSingle();
  if (normalUpdateOtherErr) {
    ok('RLS bloqueó update de comentario ajeno (error devuelto)');
  } else if (!normalUpdateData) {
    ok('RLS bloqueó update de comentario ajeno (sin filas afectadas)');
  } else {
    fail('RLS NO bloqueó update de comentario ajeno (fila actualizada)');
  }

  // Normal user creates own comment
  const { data: normalComment, error: normalInsertErr } = await normalClientAuth
    .from('comments')
    .insert({ target_type: 'work', target_id: workId, user_id: normalUser.id, body: 'Comentario de usuario' })
    .select()
    .single();
  if (normalInsertErr) throw new Error(`Normal insert comment failed: ${normalInsertErr.message}`);
  ok(`Usuario creó comentario: ${normalComment.id}`);

  // Normal user likes admin's comment
  const { error: likeErr } = await normalClientAuth
    .from('comment_likes')
    .insert({ comment_id: adminComment.id, user_id: normalUser.id });
  if (likeErr) throw new Error(`Like failed: ${likeErr.message}`);
  ok('Usuario hizo like a comentario de admin');

  // Normal user unlikes (delete)
  const { error: unlikeErr } = await normalClientAuth
    .from('comment_likes')
    .delete()
    .eq('comment_id', adminComment.id)
    .eq('user_id', normalUser.id);
  if (unlikeErr) throw new Error(`Unlike failed: ${unlikeErr.message}`);
  ok('Usuario quitó like');

  // Normal user reports admin's comment
  const { error: reportErr } = await normalClientAuth
    .from('comment_reports')
    .insert({ comment_id: adminComment.id, user_id: normalUser.id, reason: 'Spam' });
  if (reportErr) throw new Error(`Report failed: ${reportErr.message}`);
  ok('Usuario reportó comentario de admin');

  // Normal user can read comments
  const { data: readComments, error: readErr } = await normalClientAuth
    .from('comments')
    .select('id, body, user_id, target_type')
    .eq('target_id', workId)
    .order('created_at', { ascending: false });
  if (readErr) throw new Error(`Read comments failed: ${readErr.message}`);
  ok(`Usuario puede leer ${readComments.length} comentarios`);

  // Normal user reads reports (policy allows select to authenticated)
  const { data: reports, error: readReportsErr } = await normalClientAuth
    .from('comment_reports')
    .select('id, comment_id, user_id, reason')
    .eq('comment_id', adminComment.id);
  if (readReportsErr) throw new Error(`Read reports failed: ${readReportsErr.message}`);
  ok(`Usuario puede leer ${reports.length} reports del comentario (política actual)`);

  // Cleanup with service role to remove test artifacts
  await cleanup(serviceClient, { workId, commentIds: [adminComment.id, normalComment.id] });
  ok('Cleanup realizado');
}

main().catch(err => {
  fail(err?.message || String(err));
  process.exit(1);
});