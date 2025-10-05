"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { AppHeader, Button, Card, CardBody, CardHeader, Input, Textarea } from "@/components/ui";
import { useToast, ToastProvider } from "@/contexts/ToastContext";
import ToastContainer from '@/components/ui/ToastContainer';
import FileSelector from '@/components/ui/FileSelector';
import CoverRenderer from '@/components/ui/CoverRenderer';

function WorkByChaptersContent() {
  const supabase = getSupabaseBrowserClient();
  const { addToast } = useToast();
  const [sessionUserId, setSessionUserId] = useState(null);
  const WORK_CATEGORIES = [
    "otras",
    "Novela",
    "Cuento",
    "Poesía",
    "Teatro",
    "Ensayo",
    "Fantasía",
    "Ciencia ficción",
    "Romance",
    "Misterio",
    "Terror",
  ];

  // UI state
  const [mode, setMode] = useState("new_work"); // 'new_work' | 'existing_work'

  // New work + first chapter form
  const [newWorkForm, setNewWorkForm] = useState({
    work_title: "",
    work_synopsis: "",
    category: "otras",
    chapter_title: "",
    chapter_content: "",
    work_status: 'draft',
    chapter_status: 'draft',
  });

  // Portada y archivo para la nueva obra
  const [newWorkFiles, setNewWorkFiles] = useState({
    cover: null,
    work: null,
    chapter: null,
  });

  // Configuraciones de portada (preview)
  const [coverSettings, setCoverSettings] = useState({
    mode: 'auto',
    templateId: 'template-1',
    paletteId: 'marino',
  });

  // Perfil del usuario para mostrar autor en preview
  const [userProfile, setUserProfile] = useState(null);

  // Existing work selection + new chapter
  const [availableWorks, setAvailableWorks] = useState([]);
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [workChapters, setWorkChapters] = useState([]);
  const nextChapterNumber = useMemo(() => {
    if (!workChapters?.length) return 1;
    const max = Math.max(...workChapters.map((c) => c.chapter_number));
    return max + 1;
  }, [workChapters]);

  const [existingChapterForm, setExistingChapterForm] = useState({
    title: "",
    content: "",
    chapter_number: 1,
    status: 'draft',
  });

  // Archivos para capítulo en obra existente
  const [existingChapterFiles, setExistingChapterFiles] = useState({
    chapter: null,
  });

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getUser();
      setSessionUserId(data?.user?.id || null);
    };
    fetchSession();
  }, [supabase]);

  useEffect(() => {
    if (!sessionUserId) return;
    const loadWorks = async () => {
      // Cargar IDs de obras que ya tienen capítulos (no independientes) del autor
      const { data: chRows, error: chErr } = await supabase
        .from('chapters')
        .select('work_id')
        .eq('author_id', sessionUserId)
        .eq('is_independent', false)
        .not('work_id', 'is', null)
        .limit(1000);
      if (chErr) {
        addToast({ type: 'error', message: `Error cargando capítulos: ${chErr.message}` });
        setAvailableWorks([]);
        return;
      }

      // Calcular conteo de capítulos por obra
      const countsMap = (chRows || []).reduce((acc, c) => {
        const wId = c.work_id;
        if (!wId) return acc;
        acc[wId] = (acc[wId] || 0) + 1;
        return acc;
      }, {});

      const workIds = Array.from(new Set((chRows || []).map((c) => c.work_id))).filter(Boolean);

      if (workIds.length === 0) {
        setAvailableWorks([]);
        return;
      }

      // Cargar solo obras del autor cuyos IDs están en la lista (obras por capítulos)
      const { data: worksData, error: worksError } = await supabase
        .from('works')
        .select('id, title, created_at')
        .eq('author_id', sessionUserId)
        .in('id', workIds)
        .order('created_at', { ascending: false });
      if (worksError) {
        addToast({ type: 'error', message: `Error cargando obras: ${worksError.message}` });
        setAvailableWorks([]);
      } else {
        // Adjuntar conteo de capítulos a cada obra
        const withCounts = (worksData || []).map((w) => ({
          ...w,
          chapterCount: countsMap[w.id] || 0,
        }));
        setAvailableWorks(withCounts);
      }
    };
    loadWorks();

    // Cargar perfil del usuario (para portada preview)
    const loadProfile = async () => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', sessionUserId)
          .single();
        if (!profileError) {
          setUserProfile(profileData);
        }
      } catch (e) {
        // silencioso
      }
    };
    loadProfile();
  }, [sessionUserId, supabase, addToast]);

  useEffect(() => {
    if (!selectedWorkId) {
      setWorkChapters([]);
      setExistingChapterForm((prev) => ({ ...prev, chapter_number: 1 }));
      return;
    }
    const loadChapters = async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, title, chapter_number, status, created_at")
        .eq("work_id", selectedWorkId)
        .order("chapter_number", { ascending: true });
      if (error) {
        addToast({ type: "error", message: `Error cargando capítulos: ${error.message}` });
      } else {
        setWorkChapters(data || []);
        const nextNum = (data && data.length)
          ? Math.max(...data.map((c) => c.chapter_number)) + 1
          : 1;
        setExistingChapterForm((prev) => ({ ...prev, chapter_number: nextNum }));
      }
    };
    loadChapters();
  }, [selectedWorkId, supabase, addToast]);

  const handleNewWorkFileUpload = (type, file) => {
    setNewWorkFiles((prev) => ({
      ...prev,
      [type]: file,
    }));
  };

  const handleExistingChapterFileUpload = (type, file) => {
    setExistingChapterFiles((prev) => ({
      ...prev,
      [type]: file,
    }));
  };

  const createWorkWithFirstChapter = async () => {
    if (!sessionUserId) {
      addToast({ type: "error", message: "Debes iniciar sesión para crear una obra" });
      return;
    }
    const title = newWorkForm.work_title.trim();
    const chTitle = newWorkForm.chapter_title.trim();
    const chContent = newWorkForm.chapter_content.trim();
    if (!title) {
      addToast({ type: "error", message: "El título de la obra es obligatorio" });
      return;
    }
    if (!chTitle || !chContent) {
      addToast({ type: "error", message: "Título y contenido del capítulo son obligatorios" });
      return;
    }
    // Validar archivo del capítulo 1 (obligatorio en este flujo)
    if (!newWorkFiles.chapter) {
      addToast({ type: "error", message: "Debes adjuntar el archivo del capítulo 1" });
      return;
    }

    // Subir portada (opcional) y archivo del capítulo 1 (obligatorio)
    let coverUrl = null;
    let chapterUrl = null;
    try {
      // Portada
      if (newWorkFiles.cover && newWorkFiles.cover.name) {
        const ext = newWorkFiles.cover.name.split('.').pop() || 'jpg';
        const coverPath = `${sessionUserId}/cover-${Date.now()}.${ext}`;
        const { error: coverError } = await supabase.storage
          .from('works')
          .upload(coverPath, newWorkFiles.cover);
        if (coverError) throw coverError;
        coverUrl = coverPath;
      } else {
        const authorName = userProfile?.display_name || 'Autor';
        coverUrl = `preview:${coverSettings.templateId}:${coverSettings.paletteId}:${encodeURIComponent(title)}:${encodeURIComponent(authorName)}`;
      }

      // Archivo del capítulo 1 (obligatorio)
      {
        const slug = newWorkForm.chapter_title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        const chapterExt = newWorkFiles.chapter.name.split('.').pop() || 'txt';
        const chapterPath = `${sessionUserId}/capitulo-${slug || 'capitulo'}-${Date.now()}.${chapterExt}`;
        const { error: chapterError } = await supabase.storage
          .from('chapters')
          .upload(chapterPath, newWorkFiles.chapter);
        if (chapterError) throw chapterError;
        chapterUrl = chapterPath;
      }
    } catch (uploadErr) {
      addToast({ type: 'error', message: `Error subiendo archivos: ${uploadErr.message}` });
      return;
    }

    // Forzar publicación conjunta: si obra o capítulo se marcan como "published",
    // ambos quedan publicados y el capítulo recibe published_at.
    const workStatus = newWorkForm.work_status || 'draft';
    const chapterStatus = newWorkForm.chapter_status || 'draft';
    const shouldPublishBoth = (workStatus === 'published' || chapterStatus === 'published');
    const effectiveWorkStatus = shouldPublishBoth ? 'published' : workStatus;
    const effectiveChapterStatus = shouldPublishBoth ? 'published' : chapterStatus;
    const effectivePublishedAt = shouldPublishBoth ? new Date().toISOString() : null;

    const { data: work, error: workError } = await supabase
      .from("works")
      .insert({
        author_id: sessionUserId,
        title,
        synopsis: newWorkForm.work_synopsis?.trim() || null,
        category: newWorkForm.category || 'otras',
        status: effectiveWorkStatus,
        cover_url: coverUrl,
      })
      .select("id")
      .single();
    if (workError) {
      // Manejo defensivo: si falla por enum de categoría, reintentar con 'otras'
      const msg = workError.message || '';
      const isEnumCategoryError = msg.includes('invalid input value for enum') || msg.includes('work_category');
      if (isEnumCategoryError) {
        try {
          const { data: fallbackWork, error: retryError } = await supabase
            .from('works')
            .insert({
              author_id: sessionUserId,
              title,
              synopsis: newWorkForm.work_synopsis?.trim() || null,
              category: 'otras',
              status: effectiveWorkStatus,
              cover_url: coverUrl,
            })
            .select('id')
            .single();
          if (retryError) {
            addToast({ type: 'error', message: `Error creando obra (categoría): ${retryError.message}` });
            return;
          }
          // Informar que se usó categoría por defecto
          addToast({ type: 'info', message: 'La categoría seleccionada no está disponible en la base de datos. Se usó "otras".' });
          // Continuar con el capítulo usando fallbackWork
          const { error: chError } = await supabase
            .from('chapters')
            .insert({
              work_id: fallbackWork.id,
              author_id: sessionUserId,
              title: chTitle,
              content: chContent,
              chapter_number: 1,
              status: effectiveChapterStatus,
              published_at: effectivePublishedAt,
              is_independent: false,
            });
          if (chError) {
            addToast({ type: 'error', message: `Error creando capítulo: ${chError.message}` });
            return;
          }
          addToast({ type: 'success', message: 'Obra y capítulo 1 creados' });
          setMode('existing_work');
          setSelectedWorkId(fallbackWork.id);
          setNewWorkForm({ work_title: '', work_synopsis: '', category: 'otras', chapter_title: '', chapter_content: '' });
          setNewWorkFiles({ cover: null, chapter: null });
          return;
        } catch (e) {
          addToast({ type: 'error', message: `Error inesperado creando obra: ${e.message}` });
          return;
        }
      }
      addToast({ type: 'error', message: `Error creando obra: ${workError.message}` });
      return;
    }

    const { error: chError } = await supabase
      .from("chapters")
      .insert({
        work_id: work.id,
        author_id: sessionUserId,
        title: chTitle,
        content: chContent,
        chapter_number: 1,
        status: effectiveChapterStatus,
        published_at: effectivePublishedAt,
        is_independent: false,
        file_url: chapterUrl || null,
        file_name: newWorkFiles.chapter ? newWorkFiles.chapter.name : null,
        file_size: newWorkFiles.chapter ? newWorkFiles.chapter.size : null,
        file_type: newWorkFiles.chapter ? newWorkFiles.chapter.type : null,
      });
    if (chError) {
      addToast({ type: "error", message: `Error creando capítulo: ${chError.message}` });
      return;
    }
    addToast({ type: "success", message: "Obra y capítulo 1 creados" });
    setMode("existing_work");
    setSelectedWorkId(work.id);
    setNewWorkForm({ work_title: "", work_synopsis: "", category: 'otras', chapter_title: "", chapter_content: "", work_status: 'draft', chapter_status: 'draft' });
    setNewWorkFiles({ cover: null, chapter: null });
  };

  const addChapterToExistingWork = async () => {
    if (!sessionUserId) {
      addToast({ type: "error", message: "Debes iniciar sesión" });
      return;
    }
    if (!selectedWorkId) {
      addToast({ type: "error", message: "Selecciona una obra" });
      return;
    }
    const title = existingChapterForm.title.trim();
    const content = existingChapterForm.content.trim();
    const chapter_number = Number(existingChapterForm.chapter_number) || 1;
    if (!title || !content) {
      addToast({ type: "error", message: "Título y contenido del capítulo son obligatorios" });
      return;
    }
    if (chapter_number <= 0) {
      addToast({ type: "error", message: "El número de capítulo debe ser mayor a 0" });
      return;
    }
    // Validar archivo del capítulo
    if (!existingChapterFiles.chapter) {
      addToast({ type: "error", message: "Debes adjuntar el archivo del capítulo" });
      return;
    }

    // Subir archivo del capítulo a Storage y guardar metadata
    let chapterUrl = null;
    try {
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      const chapterExtension = existingChapterFiles.chapter.name.split('.').pop() || 'txt';
      const chapterPath = `${sessionUserId}/capitulo-${slug || 'capitulo'}-${Date.now()}.${chapterExtension}`;
      const { error: chapterError } = await supabase.storage
        .from('chapters')
        .upload(chapterPath, existingChapterFiles.chapter);
      if (chapterError) throw chapterError;
      chapterUrl = chapterPath;
    } catch (uploadErr) {
      addToast({ type: 'error', message: `Error subiendo archivo del capítulo: ${uploadErr.message}` });
      return;
    }

    const { error } = await supabase
      .from("chapters")
      .insert({
        work_id: selectedWorkId,
        author_id: sessionUserId,
        title,
        content,
        chapter_number,
        status: existingChapterForm.status || 'draft',
        published_at: (existingChapterForm.status === 'published') ? new Date().toISOString() : null,
        is_independent: false,
        file_url: chapterUrl,
        file_name: existingChapterFiles.chapter.name,
        file_size: existingChapterFiles.chapter.size,
        file_type: existingChapterFiles.chapter.type,
      });
    if (error) {
      addToast({ type: "error", message: `Error creando capítulo: ${error.message}` });
      return;
    }
    addToast({ type: "success", message: `Capítulo ${chapter_number} añadido` });
    // Recargar lista
    const { data } = await supabase
      .from("chapters")
      .select("id, title, chapter_number, status, created_at")
      .eq("work_id", selectedWorkId)
      .order("chapter_number", { ascending: true });
    setWorkChapters(data || []);
    setExistingChapterForm({ title: "", content: "", chapter_number: nextChapterNumber, status: 'draft' });
    setExistingChapterFiles({ chapter: null });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <AppHeader title="Subir obra por capítulos" />

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <Button variant={mode === "new_work" ? "default" : "outline"} onClick={() => setMode("new_work")}>Crear nueva obra</Button>
            <Button variant={mode === "existing_work" ? "default" : "outline"} onClick={() => setMode("existing_work")}>Añadir a obra existente</Button>
          </div>
        </CardHeader>
        <CardBody>
          {mode === "new_work" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Título de la obra *</label>
                <Input value={newWorkForm.work_title} onChange={(e) => setNewWorkForm((p) => ({ ...p, work_title: e.target.value }))} placeholder="Ej: La sombra del viento" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Sinopsis (opcional)</label>
                <Textarea value={newWorkForm.work_synopsis} onChange={(e) => setNewWorkForm((p) => ({ ...p, work_synopsis: e.target.value }))} placeholder="Breve sinopsis de la obra" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Categoría literaria *</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg" value={newWorkForm.category} onChange={(e) => setNewWorkForm((p) => ({ ...p, category: e.target.value }))}>
                  {WORK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Usada para ordenar obras en el catálogo</p>
              </div>

              {/* Estado de la obra */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Estado de la obra</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={newWorkForm.work_status}
                  onChange={(e) => setNewWorkForm((p) => ({ ...p, work_status: e.target.value }))}
                >
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                </select>
              </div>

              {/* Campos del capítulo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Título del capítulo 1 *</label>
                <Input value={newWorkForm.chapter_title} onChange={(e) => setNewWorkForm((p) => ({ ...p, chapter_title: e.target.value }))} placeholder="Capítulo 1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contenido del capítulo *</label>
                <Textarea value={newWorkForm.chapter_content} onChange={(e) => setNewWorkForm((p) => ({ ...p, chapter_content: e.target.value }))} placeholder="Texto del capítulo" rows={8} />
              </div>

              {/* Estado del capítulo 1 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Estado del capítulo 1</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={newWorkForm.chapter_status}
                  onChange={(e) => setNewWorkForm((p) => ({ ...p, chapter_status: e.target.value }))}
                >
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Si publicas, se registrará la fecha de publicación.</p>
              </div>

              <hr className="my-4" />

              {/* Preview de portada y personalización */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border">
                  <CoverRenderer
                    mode={coverSettings.mode}
                    templateId={coverSettings.templateId}
                    title={newWorkForm.work_title || 'Título de la obra'}
                    author={userProfile?.display_name || 'Autor'}
                    paletteId={coverSettings.paletteId}
                    width={240}
                    height={360}
                    className="shadow-sm"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Modo de portada</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={coverSettings.mode}
                      onChange={(e) => setCoverSettings((p) => ({ ...p, mode: e.target.value }))}
                    >
                      <option value="auto">Automática</option>
                      <option value="template">Plantilla</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Plantilla</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={coverSettings.templateId}
                      onChange={(e) => setCoverSettings((p) => ({ ...p, templateId: e.target.value }))}
                    >
                      <option value="template-1">Template 1</option>
                      <option value="template-2">Template 2</option>
                      <option value="template-3">Template 3</option>
                      <option value="template-4">Template 4</option>
                      <option value="template-5">Template 5</option>
                      <option value="template-6">Template 6</option>
                      <option value="template-7">Template 7</option>
                      <option value="template-8">Template 8</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Paleta de color</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={coverSettings.paletteId}
                      onChange={(e) => setCoverSettings((p) => ({ ...p, paletteId: e.target.value }))}
                    >
                      <option value="marino">Marino Clásico</option>
                      <option value="rojo">Rojo Profundo</option>
                      <option value="negro">Negro Elegante</option>
                      <option value="verde">Verde Esmeralda</option>
                      <option value="purpura">Púrpura Editorial</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Archivos */}
              <div className="space-y-6 border-t border-slate-200 pt-6">
                {/* Portada de la obra (opcional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Portada de la obra (opcional)</label>
                  <p className="text-sm text-slate-500 mb-3">Si no subes una portada de la obra, se usará la generada automáticamente. Los capítulos no tienen portada en esta sección.</p>
                  <FileSelector
                    onFileSelect={(file) => handleNewWorkFileUpload('cover', file)}
                    acceptedTypes={["image/jpeg", "image/png", "image/webp"]}
                    maxSize={5 * 1024 * 1024}
                    placeholder="Arrastra una imagen de portada aquí o haz clic para seleccionar"
                    selectedFile={newWorkFiles.cover}
                  />
                </div>

                {/* Archivo del capítulo 1 (obligatorio) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Archivo del capítulo 1 *</label>
                  <FileSelector
                    onFileSelect={(file) => handleNewWorkFileUpload('chapter', file)}
                    acceptedTypes={[
                      'application/pdf',
                      'application/epub+zip',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'application/msword',
                      'text/plain',
                    ]}
                    maxSize={50 * 1024 * 1024}
                    placeholder="Arrastra el archivo del capítulo 1 aquí o haz clic para seleccionar"
                    selectedFile={newWorkFiles.chapter}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={createWorkWithFirstChapter}>Crear obra y subir capítulo 1</Button>
              </div>
            </div>
          )}

          {mode === "existing_work" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Obra *</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={selectedWorkId}
                  onChange={(e) => setSelectedWorkId(e.target.value)}>
                  <option value="">Selecciona una obra</option>
                  {availableWorks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title} ({w.chapterCount} capítulos)
                    </option>
                  ))}
                </select>
              </div>

              {selectedWorkId && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Capítulos existentes:</p>
                  <ul className="list-disc ml-5 text-sm">
                    {workChapters.length === 0 && <li>No hay capítulos aún</li>}
                    {workChapters.map((c) => (
                      <li key={c.id}>#{c.chapter_number} — {c.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Título del nuevo capítulo *</label>
                  <Input value={existingChapterForm.title} onChange={(e) => setExistingChapterForm((p) => ({ ...p, title: e.target.value }))} placeholder="Capítulo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Número *</label>
                  <Input type="number" min={1} value={existingChapterForm.chapter_number} onChange={(e) => setExistingChapterForm((p) => ({ ...p, chapter_number: Number(e.target.value) }))} />
                  <p className="text-xs text-slate-500 mt-1">Sugerido: {nextChapterNumber}</p>
                </div>
              </div>

              {/* Estado del capítulo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={existingChapterForm.status}
                  onChange={(e) => setExistingChapterForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contenido *</label>
                <Textarea value={existingChapterForm.content} onChange={(e) => setExistingChapterForm((p) => ({ ...p, content: e.target.value }))} rows={8} />
              </div>

              {/* Archivo del capítulo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Archivo del capítulo *</label>
                <FileSelector
                  onFileSelect={(file) => handleExistingChapterFileUpload('chapter', file)}
                  acceptedTypes={[
                    'application/pdf',
                    'application/epub+zip',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/msword',
                    'text/plain',
                  ]}
                  maxSize={50 * 1024 * 1024}
                  placeholder="Arrastra el archivo del capítulo aquí o haz clic para seleccionar"
                  selectedFile={existingChapterFiles.chapter}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={addChapterToExistingWork}>Añadir capítulo</Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <WorkByChaptersContent />
      <ToastContainer />
    </ToastProvider>
  );
}