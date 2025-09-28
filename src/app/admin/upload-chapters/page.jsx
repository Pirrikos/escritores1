"use client";

import { useState, useMemo, useEffect } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";
import { validatePost, validateUserInput, VALIDATION_LIMITS } from '@/lib/databaseValidation';
import { sanitizeText, normalizeText } from '@/lib/sanitization';
import { Button, Input, Textarea, Card, CardHeader, CardBody } from "@/components/ui";
import FileSelector from '@/components/ui/FileSelector';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { useToast, ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';
import AdminLayout from '@/components/admin/AdminLayout';
import { AdminGuard } from '@/lib/adminAuth';

function UploadChaptersContent() {
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

  // Estados para cargar obras disponibles
  const [availableWorks, setAvailableWorks] = useState([]);

  // Cargar obras disponibles para capítulos
  useEffect(() => {
    const loadWorks = async () => {
      if (!session?.user?.id) return;

      try {
        const { data, error } = await supabase
          .from('works')
          .select('id, title, slug')
          .eq('author_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAvailableWorks(data || []);
      } catch (error) {
        console.error('Error al cargar obras:', error);
        addToast({ message: 'Error al cargar las obras disponibles', type: 'error' });
      }
    };

    loadWorks();
  }, [session, supabase, addToast]);

  // Estados del formulario para capítulos
  const [chapterFormData, setChapterFormData] = useState({
    title: '',
    work_id: '',
    chapter_number: 1,
    status: 'draft',
    is_independent: false
  });

  const [chapterFiles, setChapterFiles] = useState({
    cover: null,
    chapter: null
  });

  // Estados para la portada generada
  const [coverSettings, setCoverSettings] = useState({
    mode: 'auto',
    templateId: 'template-1',
    paletteId: 'marino'
  });

  const [errors, setErrors] = useState({});

  // Validación del formulario para capítulos
  const validateChapterForm = () => {
    const newErrors = {};

    // Validar título
    if (!chapterFormData?.title?.trim()) {
      newErrors.title = 'El título es requerido';
    } else if (chapterFormData.title.length > VALIDATION_LIMITS.WORK.TITLE_MAX) {
      newErrors.title = `El título no puede exceder ${VALIDATION_LIMITS.WORK.TITLE_MAX} caracteres`;
    }

    // Validar obra (solo si no es capítulo independiente)
    if (!chapterFormData.is_independent && !chapterFormData.work_id) {
      newErrors.work_id = 'Debes seleccionar una obra';
    }

    // Validar número de capítulo
    if (!chapterFormData.chapter_number || chapterFormData.chapter_number < 1) {
      newErrors.chapter_number = 'El número de capítulo debe ser mayor a 0';
    }

    // Validar archivo del capítulo
    if (!chapterFiles?.chapter) {
      newErrors.chapter = 'Debes seleccionar un archivo de capítulo';
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
        work_id: chapterFormData.is_independent ? null : chapterFormData.work_id,
        chapter_number: parseInt(chapterFormData.chapter_number),
        status: chapterFormData.status,
        is_independent: chapterFormData.is_independent
      };

      // Generar slug único para el capítulo
      let slug = generateSlug(`${sanitizedData.title}-chapter-${sanitizedData.chapter_number}`);
      
      // Verificar si el slug ya existe
      let query = supabase
        .from('chapters')
        .select('slug')
        .eq('slug', slug);
      
      // Si no es independiente, verificar solo dentro de la obra
      if (!sanitizedData.is_independent && sanitizedData.work_id) {
        query = query.eq('work_id', sanitizedData.work_id);
      }
      
      const { data: existingChapter } = await query.single();

      if (existingChapter) {
        slug = `${slug}-${Date.now()}`;
      }

      // Subir archivos a Supabase Storage
      let coverUrl = null;
      let chapterUrl = null;

      // Subir portada si existe
      if (chapterFiles.cover) {
        const coverExtension = chapterFiles.cover.name.split('.').pop() || 'jpg';
        const coverPath = `${session.user.id}/cover-${slug}-${Date.now()}.${coverExtension}`;
        const { data: coverData, error: coverError } = await supabase.storage
          .from('chapters')
          .upload(coverPath, chapterFiles.cover);

        if (coverError) throw coverError;
        coverUrl = coverPath;
      }

      // Subir archivo del capítulo
      if (!chapterFiles.chapter || !chapterFiles.chapter.name) {
        throw new Error('No se ha seleccionado un archivo de capítulo válido');
      }
      
      const chapterExtension = chapterFiles.chapter.name.split('.').pop() || 'txt';
      const chapterPath = `${session.user.id}/capitulo-${slug}-${Date.now()}.${chapterExtension}`;
      const { data: chapterData, error: chapterError } = await supabase.storage
        .from('chapters')
        .upload(chapterPath, chapterFiles.chapter);

      if (chapterError) throw chapterError;
      chapterUrl = chapterPath;

      // Insertar capítulo en la base de datos
      const insertData = {
        title: sanitizedData.title,
        content: sanitizedData.title, // Usando title como content por ahora
        work_id: sanitizedData.work_id,
        chapter_number: sanitizedData.chapter_number,
        status: sanitizedData.status,
        author_id: session.user.id,
        user_id: session.user.id, // Agregar user_id requerido
        slug: slug,
        cover_url: coverUrl,
        file_url: chapterUrl,
        file_type: chapterFiles.chapter.type,
        file_size: chapterFiles.chapter.size,
        is_independent: sanitizedData.is_independent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Agregar published_at si el status es 'published'
      if (sanitizedData.status === 'published') {
        insertData.published_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('chapters')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      addToast({ message: 'Capítulo subido exitosamente', type: 'success' });
      
      // Limpiar formulario
      setChapterFormData({
        title: '',
        work_id: '',
        chapter_number: 1,
        status: 'draft',
        is_independent: false
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

  return (
    <AdminGuard session={session}>
      <AdminLayout activeTab="upload-chapters">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Subir Capítulo</h1>
                <p className="text-slate-600">Sube capítulos individuales</p>
              </div>
            </div>
          </div>

          {/* Formulario para capítulos */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60">
            <div className="p-8">
              <form onSubmit={handleChapterSubmit} className="space-y-6">
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
                                   field === 'work_id' ? 'Obra' : 
                                   field === 'chapter_number' ? 'Número del capítulo' : 
                                   field === 'chapter' ? 'Archivo del capítulo' : 
                                   field === 'cover' ? 'Imagen de portada' : field}:
                                </strong> {error}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Obra */}
                    {/* Tipo de capítulo */}
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={chapterFormData.is_independent}
                          onChange={(e) => {
                            const isIndependent = e.target.checked;
                            setChapterFormData(prev => ({
                              ...prev,
                              is_independent: isIndependent,
                              work_id: isIndependent ? '' : prev.work_id
                            }));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          Capítulo independiente
                        </span>
                      </label>
                      <p className="mt-1 text-sm text-slate-500">
                        Marca esta opción si el capítulo no pertenece a ninguna obra específica
                      </p>
                    </div>

                    {/* Obra - Solo mostrar si no es independiente */}
                    {!chapterFormData.is_independent && (
                      <div>
                        <label htmlFor="chapter-work" className="block text-sm font-medium text-slate-700 mb-2">
                          Obra *
                        </label>
                        <select
                          id="chapter-work"
                          value={chapterFormData.work_id}
                          onChange={(e) => handleChapterInputChange('work_id', e.target.value)}
                          className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.work_id ? 'border-red-500' : ''}`}
                        >
                          <option value="">Selecciona una obra</option>
                          {availableWorks.map((work) => (
                            <option key={work.id} value={work.id}>
                              {work.title}
                            </option>
                          ))}
                        </select>
                        {errors.work_id && (
                          <p className="mt-1 text-sm text-red-600">{errors.work_id}</p>
                        )}
                        <p className="mt-1 text-sm text-slate-500">
                          Selecciona la obra a la que pertenece este capítulo
                        </p>
                      </div>
                    )}

                    {/* Título */}
                    <div>
                      <label htmlFor="chapter-title" className="block text-sm font-medium text-slate-700 mb-2">
                        Título del capítulo *
                      </label>
                      <Input
                        id="chapter-title"
                        type="text"
                        value={chapterFormData.title}
                        onChange={(e) => handleChapterInputChange('title', e.target.value)}
                        placeholder="Ingresa el título del capítulo"
                        className={errors.title ? 'border-red-500' : ''}
                        maxLength={VALIDATION_LIMITS.WORK.TITLE_MAX}
                      />
                      {errors.title && (
                        <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                      )}
                      <p className="mt-1 text-sm text-slate-500">
                        {chapterFormData?.title?.length || 0}/{VALIDATION_LIMITS.WORK.TITLE_MAX} caracteres
                      </p>
                    </div>

                    {/* Número del capítulo - Solo mostrar si NO es independiente */}
                    {!chapterFormData.is_independent && (
                      <div>
                        <label htmlFor="chapter-index" className="block text-sm font-medium text-slate-700 mb-2">
                          Número del capítulo *
                        </label>
                        <Input
                          id="chapter-index"
                          type="number"
                          min="1"
                          value={chapterFormData.chapter_number}
                          onChange={(e) => handleChapterInputChange('chapter_number', parseInt(e.target.value) || 1)}
                          placeholder="1"
                          className={errors.chapter_number ? 'border-red-500' : ''}
                        />
                        {errors.chapter_number && (
                          <p className="mt-1 text-sm text-red-600">{errors.chapter_number}</p>
                        )}
                        <p className="mt-1 text-sm text-slate-500">
                          Número de orden del capítulo en la obra
                        </p>
                      </div>
                    )}

                    {/* Estado */}
                    <div>
                      <label htmlFor="chapter-status" className="block text-sm font-medium text-slate-700 mb-2">
                        Estado
                      </label>
                      <select
                        id="chapter-status"
                        value={chapterFormData.status}
                        onChange={(e) => handleChapterInputChange('status', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="draft">Borrador</option>
                        <option value="published">Publicado</option>
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
                          title={chapterFormData.title || 'Título del capítulo'}
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
                      onFileSelect={(file) => handleChapterFileUpload('cover', file)}
                      acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
                      maxSize={5 * 1024 * 1024} // 5MB
                      placeholder="Arrastra una imagen de portada aquí o haz clic para seleccionar"
                      selectedFile={chapterFiles.cover}
                    />
                    {errors.cover && (
                      <p className="mt-1 text-sm text-red-600">{errors.cover}</p>
                    )}
                  </div>

                  {/* Archivo del capítulo */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Archivo del capítulo *
                    </label>
                    <FileSelector
                      onFileSelect={(file) => handleChapterFileUpload('chapter', file)}
                      acceptedTypes={[
                        'application/pdf',
                        'application/epub+zip',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/msword',
                        'text/plain'
                      ]}
                      maxSize={50 * 1024 * 1024} // 50MB
                      placeholder="Arrastra el archivo del capítulo aquí o haz clic para seleccionar"
                      selectedFile={chapterFiles.chapter}
                    />
                    {errors.chapter && (
                      <p className="mt-1 text-sm text-red-600">{errors.chapter}</p>
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
                    {loading ? 'Subiendo...' : 'Subir Capítulo'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}

export default function UploadChaptersPage() {
  return (
    <ToastProvider>
      <UploadChaptersContent />
      <ToastContainer />
    </ToastProvider>
  );
}