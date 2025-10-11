"use client";

import { useState, useMemo, useEffect } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";
import { validatePost, validateUserInput, VALIDATION_LIMITS } from '@/lib/databaseValidation';
import { sanitizeText, normalizeText } from '@/lib/sanitization';
import { Button, Input, Textarea, Card, CardHeader, CardBody, AppHeader } from "@/components/ui";
import FileSelector from '@/components/ui/FileSelector';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { useToast, ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';
import Link from 'next/link';

function UploadWorksContent() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  // Obtener sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Estados del formulario para obras
  const [workFormData, setWorkFormData] = useState({
    title: '',
    synopsis: '',
    isbn: '',
    status: 'draft',
    category: 'otras'
  });

  const [workFiles, setWorkFiles] = useState({
    cover: null,
    work: null
  });

  // Estados para la portada generada
  const [coverSettings, setCoverSettings] = useState({
    mode: 'auto',
    templateId: 'template-1',
    paletteId: 'marino'
  });

  const [errors, setErrors] = useState({});

  // Categorías permitidas (coherentes con el catálogo público)
  // Nota: 'otras' se ofrece como opción explícita, no se duplica aquí
  const WORK_CATEGORIES = [
    'Novela',
    'Cuento',
    'Poesía',
    'Teatro',
    'Ensayo',
    'Fantasía',
    'Ciencia ficción',
    'Romance',
    'Misterio',
    'Terror',
  ];

  // Validación del formulario para obras
  const validateWorkForm = () => {
    const newErrors = {};

    // Validar título
    if (!workFormData.title.trim()) {
      newErrors.title = 'El título es obligatorio';
    } else if (workFormData.title.length > VALIDATION_LIMITS.TITLE_MAX_LENGTH) {
      newErrors.title = `El título no puede exceder ${VALIDATION_LIMITS.TITLE_MAX_LENGTH} caracteres`;
    }

    // Validar sinopsis
    if (!workFormData.synopsis.trim()) {
      newErrors.synopsis = 'La sinopsis es obligatoria';
    } else if (workFormData.synopsis.length > VALIDATION_LIMITS.CONTENT_MAX_LENGTH) {
      newErrors.synopsis = `La sinopsis no puede exceder ${VALIDATION_LIMITS.CONTENT_MAX_LENGTH} caracteres`;
    }

    // Validar ISBN (opcional pero si se proporciona debe tener formato válido)
    if (workFormData.isbn && !/^(?:\d{10}|\d{13})$/.test(workFormData.isbn.replace(/[-\s]/g, ''))) {
      newErrors.isbn = 'El ISBN debe tener 10 o 13 dígitos';
    }

    // Validar archivo de la obra
    if (!workFiles.work) {
      newErrors.work = 'Debe subir el archivo de la obra';
    }

    // La categoría es opcional; si no hay categoría válida, se asigna 'otras'

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar cambios en el formulario de obras
  const handleWorkInputChange = (field, value) => {
    setWorkFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  // Manejar subida de archivos para obras
  const handleWorkFileUpload = (type, file) => {
    setWorkFiles(prev => ({
      ...prev,
      [type]: file
    }));

    // Limpiar error del archivo cuando se suba uno
    if (errors[type]) {
      setErrors(prev => ({
        ...prev,
        [type]: undefined
      }));
    }
  };

  // Validación del formulario para capítulos
  const validateChapterForm = () => {
    const newErrors = {};

    // Validar título
    if (!chapterFormData.title.trim()) {
      newErrors.title = 'El título es obligatorio';
    } else if (chapterFormData.title.length > VALIDATION_LIMITS.TITLE_MAX_LENGTH) {
      newErrors.title = `El título no puede exceder ${VALIDATION_LIMITS.TITLE_MAX_LENGTH} caracteres`;
    }

    // Validar archivo del capítulo
    if (!chapterFiles.chapter) {
      newErrors.chapter = 'Debe subir el archivo del capítulo';
    }

    // Validar obra seleccionada
    if (!chapterFormData.work_id) {
      newErrors.work_id = 'Debe seleccionar una obra';
    }

    // Validar número del capítulo
    if (chapterFormData.chapter_number < 1) {
      newErrors.chapter_number = 'El número del capítulo debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar cambios en el formulario de capítulos
  const handleChapterInputChange = (field, value) => {
    setChapterFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  // Manejar subida de archivos para capítulos
  const handleChapterFileUpload = (type, file) => {
    setChapterFiles(prev => ({
      ...prev,
      [type]: file
    }));

    // Limpiar error del archivo cuando se suba uno
    if (errors[type]) {
      setErrors(prev => ({
        ...prev,
        [type]: undefined
      }));
    }
  };

  // Generar slug único
  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
      .replace(/\s+/g, '-') // Reemplazar espacios con guiones
      .replace(/-+/g, '-') // Reemplazar múltiples guiones con uno solo
      .trim('-'); // Remover guiones al inicio y final
  };

  // Subida a bucket 'works': intenta cliente primero y cae al endpoint server si falla por RLS
  const uploadToWorksWithFallback = async (path, file) => {
    // Intento directo desde el cliente (respeta las políticas de Storage)
    const { data, error } = await supabase.storage
      .from('works')
      .upload(path, file);

    if (!error) return data;

    // Fallback al endpoint server (usa service role y valida path en el backend)
    try {
      const fd = new FormData();
      fd.append('path', path);
      fd.append('file', file);
      const res = await fetch('/api/storage/upload-work', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Error subiendo archivo (fallback)');
      }
      return { path };
    } catch (e) {
      const message = error?.message ? `Upload denegado por RLS: ${error.message}` : e.message;
      throw new Error(message);
    }
  };

  // Subida a bucket 'chapters': intenta cliente primero y cae al endpoint server si falla por RLS
  const uploadToChaptersWithFallback = async (path, file) => {
    const { data, error } = await supabase.storage
      .from('chapters')
      .upload(path, file);

    if (!error) return data;

    try {
      const fd = new FormData();
      fd.append('path', path);
      fd.append('file', file);
      const res = await fetch('/api/storage/upload-chapter', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Error subiendo capítulo (fallback)');
      }
      return { path };
    } catch (e) {
      const message = error?.message ? `Upload capítulo denegado por RLS: ${error.message}` : e.message;
      throw new Error(message);
    }
  };

  // Subir obra
  const handleWorkSubmit = async (e) => {
    e.preventDefault();

    if (!validateWorkForm()) {
      addToast({ message: 'Por favor, corrige los errores en el formulario', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Obtener el perfil del usuario para el display_name
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error obteniendo perfil:', profileError);
      }

      const authorName = userProfile?.display_name || session?.user?.user_metadata?.display_name || 'Autor';

      // Sanitizar datos
      const sanitizedData = {
        title: sanitizeText(workFormData.title),
        synopsis: sanitizeText(workFormData.synopsis),
        isbn: workFormData.isbn ? sanitizeText(workFormData.isbn) : null,
        status: workFormData.status,
        category: WORK_CATEGORIES.includes(workFormData.category) ? workFormData.category : 'otras'
      };

      // Generar slug único
      let slug = generateSlug(sanitizedData.title);
      
      // Verificar si el slug ya existe
      const { data: existingWork } = await supabase
        .from('works')
        .select('slug')
        .eq('slug', slug)
        .maybeSingle();

      if (existingWork) {
        slug = `${slug}-${Date.now()}`;
      }

      // Subir archivos a Supabase Storage
      let coverUrl = null;
      let workUrl = null;

      // Subir portada si existe, o generar una automática
      if (workFiles.cover) {
        const coverPath = `${session.user.id}/cover-${slug}-${Date.now()}.${workFiles.cover.name.split('.').pop()}`;
        await uploadToWorksWithFallback(coverPath, workFiles.cover);
        // Para buckets privados, guardamos el path del archivo
        coverUrl = coverPath;
      } else {
        // Usar la portada del preview con la configuración seleccionada
        coverUrl = `preview:${coverSettings.templateId}:${coverSettings.paletteId}:${encodeURIComponent(sanitizedData.title)}:${encodeURIComponent(authorName)}`;
      }

      // Subir archivo de la obra
      const workPath = `${session.user.id}/obra-${slug}-${Date.now()}.${workFiles.work.name.split('.').pop()}`;
      await uploadToWorksWithFallback(workPath, workFiles.work);
      // Para buckets privados, guardamos el path del archivo
      workUrl = workPath;

      // Insertar obra en la base de datos (con fallback si falla enum de categoría)
      const { data, error } = await supabase
        .from('works')
        .insert({
          title: sanitizedData.title,
          synopsis: sanitizedData.synopsis,
          isbn: sanitizedData.isbn,
          status: sanitizedData.status,
          category: sanitizedData.category,
          author_id: session.user.id,
          slug: slug,
          cover_url: coverUrl,
          file_url: workUrl,
          file_type: workFiles.work.type,
          file_size: workFiles.work.size,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      let insertedWork = data;
      if (error) {
        const msg = error.message || '';
        const isEnumCategoryError = msg.includes('invalid input value for enum') || msg.includes('work_category');
        if (isEnumCategoryError) {
          const { data: fallbackData, error: retryError } = await supabase
            .from('works')
            .insert({
              title: sanitizedData.title,
              synopsis: sanitizedData.synopsis,
              isbn: sanitizedData.isbn,
              status: sanitizedData.status,
              category: 'otras',
              author_id: session.user.id,
              slug: slug,
              cover_url: coverUrl,
              file_url: workUrl,
              file_type: workFiles.work.type,
              file_size: workFiles.work.size,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          if (retryError) throw retryError;
          addToast({ message: 'La categoría seleccionada no está disponible. Se usó "otras".', type: 'info' });
          insertedWork = fallbackData;
        } else {
          throw error;
        }
      }

      addToast({ message: 'Obra subida exitosamente', type: 'success' });
      
      // Limpiar formulario
      setWorkFormData({
        title: '',
        synopsis: '',
        isbn: '',
        status: 'draft',
        category: 'otras'
      });
      setWorkFiles({
        cover: null,
        work: null
      });

    } catch (error) {
      console.error('Error al subir obra:', error);
      addToast({ message: `Error al subir obra: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Subir capítulo
  const handleChapterSubmit = async (e) => {
    e.preventDefault();

    if (!validateChapterForm()) {
      addToast({ message: 'Por favor, corrige los errores en el formulario', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Sanitizar datos
      const sanitizedData = {
        title: sanitizeText(chapterFormData.title),
        work_id: chapterFormData.work_id,
        chapter_number: parseInt(chapterFormData.chapter_number),
        status: chapterFormData.status
      };

      // Generar slug único para el capítulo
      let slug = generateSlug(`${sanitizedData.title}-chapter-${sanitizedData.chapter_number}`);
      
      // Verificar si el slug ya existe
      const { data: existingChapter } = await supabase
        .from('posts')
        .select('slug')
        .eq('slug', slug)
        .single();

      if (existingChapter) {
        slug = `${slug}-${Date.now()}`;
      }

      // Subir archivos a Supabase Storage
      let coverUrl = null;
      let chapterUrl = null;

      // Subir portada si existe (prefijo por uid)
      if (chapterFiles.cover) {
        const coverPath = `${session.user.id}/cover-${slug}-${Date.now()}.${chapterFiles.cover.name.split('.').pop()}`;
        await uploadToChaptersWithFallback(coverPath, chapterFiles.cover);
        // Para buckets privados, guardamos el path del archivo
        coverUrl = coverPath;
      }

      // Subir archivo del capítulo (prefijo por uid)
      const chapterPath = `${session.user.id}/capitulo-${slug}-${Date.now()}.${chapterFiles.chapter.name.split('.').pop()}`;
      await uploadToChaptersWithFallback(chapterPath, chapterFiles.chapter);
      // Para buckets privados, guardamos el path del archivo
      chapterUrl = chapterPath;

      // Insertar capítulo en la base de datos
      const { data, error } = await supabase
        .from('posts')
        .insert({
          title: sanitizedData.title,
          work_id: sanitizedData.work_id,
          chapter_number: sanitizedData.chapter_number,
          status: sanitizedData.status,
          slug: slug,
          cover_url: coverUrl,
          file_url: chapterUrl,
          file_type: chapterFiles.chapter.type,
          file_size: chapterFiles.chapter.size,
          type: 'chapter',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      addToast({ message: 'Capítulo subido exitosamente', type: 'success' });
      
      // Limpiar formulario
      setChapterFormData({
        title: '',
        work_id: '',
        chapter_number: 1,
        status: 'draft'
      });

      setChapterFiles({
        cover: null,
        chapter: null
      });

    } catch (error) {
      console.error('Error al subir capítulo:', error);
      addToast({ message: `Error al subir capítulo: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Acceso requerido</h2>
          </CardHeader>
          <CardBody>
            <p className="text-slate-700 mb-4">Debes iniciar sesión para subir obras.</p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700"
            >
              Iniciar sesión
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Encabezado principal */}
          <AppHeader className="mb-6" />
          <h1 className="text-3xl font-bold text-slate-900">Subir Obra</h1>

          {/* Formulario para obras */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60">
            <div className="p-8">
              <form onSubmit={handleWorkSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Columna izquierda - Formulario */}
                  <div className="space-y-6">
                    {/* Mostrar resumen de errores si los hay */}
                    {Object.keys(errors).length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-red-800 mb-2">
                          Errores en el formulario:
                        </h3>
                        <ul className="text-sm text-red-700 space-y-1">
                          {Object.entries(errors).map(([field, error]) => (
                            <li key={field} className="flex items-start">
                              <span className="text-red-500 mr-2">•</span>
                              <span>
                                <strong>
                                  {field === 'title' ? 'Título' : 
                                   field === 'synopsis' ? 'Sinopsis' : 
                                   field === 'isbn' ? 'ISBN' : 
                                   field === 'work' ? 'Archivo de la obra' : 
                                   field === 'cover' ? 'Imagen de portada' :
                                   field === 'category' ? 'Categoría' : field}:
                                </strong> {error}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Título */}
                    <div>
                      <label htmlFor="work-title" className="block text-sm font-medium text-slate-700 mb-2">
                        Título *
                      </label>
                      <Input
                        id="work-title"
                        type="text"
                        value={workFormData.title}
                        onChange={(e) => handleWorkInputChange('title', e.target.value)}
                        placeholder="Ingresa el título de la obra"
                        className={errors.title ? 'border-red-500' : ''}
                        maxLength={VALIDATION_LIMITS.TITLE_MAX_LENGTH}
                      />
                      {errors.title && (
                        <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                      )}
                      <p className="mt-1 text-sm text-slate-500">
                        {workFormData.title.length}/{VALIDATION_LIMITS.TITLE_MAX_LENGTH} caracteres
                      </p>
                    </div>

                    {/* Sinopsis */}
                    <div>
                      <label htmlFor="work-synopsis" className="block text-sm font-medium text-slate-700 mb-2">
                        Sinopsis *
                      </label>
                      <Textarea
                        id="work-synopsis"
                        value={workFormData.synopsis}
                        onChange={(e) => handleWorkInputChange('synopsis', e.target.value)}
                        placeholder="Describe brevemente de qué trata la obra"
                        rows={4}
                        className={errors.synopsis ? 'border-red-500' : ''}
                        maxLength={VALIDATION_LIMITS.CONTENT_MAX_LENGTH}
                      />
                      {errors.synopsis && (
                        <p className="mt-1 text-sm text-red-600">{errors.synopsis}</p>
                      )}
                      <p className="mt-1 text-sm text-slate-500">
                        {workFormData.synopsis.length}/{VALIDATION_LIMITS.CONTENT_MAX_LENGTH} caracteres
                      </p>
                    </div>

                    {/* ISBN */}
                    <div>
                      <label htmlFor="work-isbn" className="block text-sm font-medium text-slate-700 mb-2">
                        ISBN (opcional)
                      </label>
                      <Input
                        id="work-isbn"
                        type="text"
                        value={workFormData.isbn}
                        onChange={(e) => handleWorkInputChange('isbn', e.target.value)}
                        placeholder="978-84-376-0494-7"
                        className={errors.isbn ? 'border-red-500' : ''}
                      />
                      {errors.isbn && (
                        <p className="mt-1 text-sm text-red-600">{errors.isbn}</p>
                      )}
                      <p className="mt-1 text-sm text-slate-500">
                        Formato: 10 o 13 dígitos (con o sin guiones)
                      </p>
                    </div>

                    {/* Estado */}
                    <div>
                      <label htmlFor="work-status" className="block text-sm font-medium text-slate-700 mb-2">
                        Estado
                      </label>
                      <select
                        id="work-status"
                        value={workFormData.status}
                        onChange={(e) => handleWorkInputChange('status', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="draft">Borrador</option>
                        <option value="published">Publicado</option>
                      </select>
                    </div>

                    {/* Categoría */}
                    <div>
                      <label htmlFor="work-category" className="block text-sm font-medium text-slate-700 mb-2">
                        Categoría *
                      </label>
                      <select
                        id="work-category"
                        value={workFormData.category}
                        onChange={(e) => handleWorkInputChange('category', e.target.value)}
                        className={"w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"}
                      >
                        <option value="otras">Otras</option>
                        {WORK_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Columna derecha - Portada generada */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-slate-900 mb-4">Vista previa de portada</h3>
                      <div className="bg-slate-50 rounded-lg p-4 flex justify-center">
                        <CoverRenderer
                          mode="template"
                          templateId={coverSettings.templateId}
                          title={workFormData.title || 'Título de la obra'}
                          author={session?.user?.user_metadata?.display_name || 'Autor'}
                          paletteId={coverSettings.paletteId}
                          width={200}
                          height={300}
                          className="shadow-lg"
                        />
                      </div>
                    </div>

                    {/* Configuración de portada */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-slate-700">Configuración de portada</h4>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Plantilla
                        </label>
                        <select
                          value={coverSettings.templateId}
                          onChange={(e) => setCoverSettings(prev => ({ ...prev, templateId: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="template-1">Franja Diagonal</option>
                          <option value="template-2">Marco Fino</option>
                          <option value="template-3">Líneas Suaves</option>
                          <option value="template-4">Círculos Decorativos</option>
                          <option value="template-5">Gradiente Sutil</option>
                          <option value="template-6">Formas Geométricas</option>
                          <option value="template-7">Líneas Verticales</option>
                          <option value="template-8">Marco Redondeado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Paleta de colores
                        </label>
                        <select
                          value={coverSettings.paletteId}
                          onChange={(e) => setCoverSettings(prev => ({ ...prev, paletteId: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                </div>

                {/* Archivos */}
                <div className="space-y-6 border-t border-slate-200 pt-6">
                  {/* Portada personalizada (opcional) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Portada personalizada (opcional)
                    </label>
                    <p className="text-sm text-slate-500 mb-3">
                      Si no subes una portada, se usará la generada automáticamente
                    </p>
                    <FileSelector
                      onFileSelect={(file) => handleWorkFileUpload('cover', file)}
                      acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                      maxSize={5 * 1024 * 1024} // 5MB
                      placeholder="Arrastra una imagen de portada aquí o haz clic para seleccionar"
                      selectedFile={workFiles.cover}
                    />
                    {errors.cover && (
                      <p className="mt-1 text-sm text-red-600">{errors.cover}</p>
                    )}
                  </div>

                  {/* Archivo de la obra */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Archivo de la obra *
                    </label>
                    <FileSelector
                      onFileSelect={(file) => handleWorkFileUpload('work', file)}
                      acceptedTypes={[
                        'application/pdf',
                        'application/epub+zip',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/msword',
                        'text/plain'
                      ]}
                      maxSize={50 * 1024 * 1024} // 50MB
                      placeholder="Arrastra el archivo de la obra aquí o haz clic para seleccionar"
                      selectedFile={workFiles.work}
                    />
                    {errors.work && (
                      <p className="mt-1 text-sm text-red-600">{errors.work}</p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">
                      Formatos soportados: PDF, EPUB, DOCX, DOC, TXT (máx. 50MB)
                    </p>
                  </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setWorkFormData({
                        title: '',
                        synopsis: '',
                        isbn: '',
                        status: 'draft'
                      });
                      setWorkFiles({
                        cover: null,
                        work: null
                      });
                      setErrors({});
                    }}
                    disabled={loading}
                  >
                    Limpiar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  >
                    {loading ? 'Subiendo...' : 'Subir Obra'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
  );
}

export default function UploadWorksPage() {
  return (
    <ToastProvider>
      <UploadWorksContent />
      <ToastContainer />
    </ToastProvider>
  );
}