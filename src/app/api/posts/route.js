// ...
export async function POST(req) {
  // ...
  const body = await req.json().catch(() => ({}));
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  const status = body.status === "published" ? "published" : "draft";
  const published_at = status === "published" ? new Date().toISOString() : null;

  // 👇 NUEVO: si no viene, poner por defecto 'post'
  const type = (body.type || "post");

  // ...
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      title,
      content,
      status,
      published_at,
      type,              // 👈 incluir type
    })
    .select("id,title,status,published_at,type")
    .single();
  // ...
}
