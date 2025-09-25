const publish = async (e) => {
  e.preventDefault();
  setMsg("");
  try {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, status }),
    });

    let payload = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      payload = await res.json();
    } else {
      payload = { error: await res.text() };
    }

    if (!res.ok) {
      setMsg(`Error ${res.status}: ${payload.error || "Fallo al guardar"}`);
      return;
    }

    setTitle(""); setContent("");
    setMsg(`Guardado: ${payload.data.title}`);
  } catch (err) {
    setMsg(`Error de red: ${String(err)}`);
  }
};
