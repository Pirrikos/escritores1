"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { sanitizeText, normalizeText } from '@/lib/sanitization';
import { validatePost, validateUserInput, VALIDATION_LIMITS, VALIDATION_ERRORS } from '@/lib/databaseValidation';
import { Button, Input, Textarea, Select, Card, CardHeader, CardBody, AppHeader } from "@/components/ui";

export default function WritePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");     // 'draft' | 'published'
  const [type, setType] = useState("poem");          // 'poem'  | 'chapter'
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Estados para validación
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  // Patrones de seguridad mejorados
  const SECURITY_PATTERNS = {
    maliciousContent: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi
    ],
    suspiciousUrls: [
      /https?:\/\/(?:bit\.ly|tinyurl|t\.co|goo\.gl|short\.link)/gi,
      /https?:\/\/[^\/\s]+\.tk\b/gi,
      /https?:\/\/[^\/\s]+\.ml\b/gi
    ],
    spamPatterns: [
      /(.)\1{10,}/gi, // Repetición excesiva de caracteres
      /\b(?:GRATIS|FREE|CLICK|AQUÍ|HERE)\b.*!{3,}/gi,
      /\$\d+.*(?:gratis|free|win|ganar)/gi
    ]
  };

  // Función de validación mejorada
  const validateForm = async () => {
    setIsValidating(true);
    const newErrors = {};
    
    try {
      // Validación básica de campos requeridos
      if (!title.trim()) {
        newErrors.title = VALIDATION_ERRORS.TITLE_REQUIRED;
      } else if (title.trim().length < VALIDATION_LIMITS.TITLE_MIN_LENGTH) {
        newErrors.title = `El título debe tener al menos ${VALIDATION_LIMITS.TITLE_MIN_LENGTH} caracteres`;
      } else if (title.trim().length > VALIDATION_LIMITS.TITLE_MAX_LENGTH) {
        newErrors.title = `El título no puede exceder ${VALIDATION_LIMITS.TITLE_MAX_LENGTH} caracteres`;
      }
      
      if (!content.trim()) {
        newErrors.content = VALIDATION_ERRORS.CONTENT_REQUIRED;
      } else if (content.trim().length < VALIDATION_LIMITS.CONTENT_MIN_LENGTH) {
        newErrors.content = `El contenido debe tener al menos ${VALIDATION_LIMITS.CONTENT_MIN_LENGTH} caracteres`;
      } else if (content.trim().length > VALIDATION_LIMITS.CONTENT_MAX_LENGTH) {
        newErrors.content = `El contenido no puede exceder ${VALIDATION_LIMITS.CONTENT_MAX_LENGTH} caracteres`;
      }

      // Validación de seguridad para contenido malicioso
      const titleText = title.trim();
      const contentText = content.trim();
      
      // Verificar patrones maliciosos en título
      for (const pattern of SECURITY_PATTERNS.maliciousContent) {
        if (pattern.test(titleText)) {
          newErrors.title = "El título contiene contenido no permitido";
          break;
        }
      }
      
      // Verificar patrones maliciosos en contenido
      for (const pattern of SECURITY_PATTERNS.maliciousContent) {
        if (pattern.test(contentText)) {
          newErrors.content = "El contenido contiene elementos no permitidos (scripts, iframes, etc.)";
          break;
        }
      }

      // Verificar URLs sospechosas
      for (const pattern of SECURITY_PATTERNS.suspiciousUrls) {
        if (pattern.test(contentText)) {
          newErrors.content = "El contenido contiene URLs sospechosas o acortadas no permitidas";
          break;
        }
      }

      // Verificar patrones de spam
      for (const pattern of SECURITY_PATTERNS.spamPatterns) {
        if (pattern.test(titleText) || pattern.test(contentText)) {
          newErrors.content = "El contenido parece spam o contiene patrones sospechosos";
          break;
        }
      }

      // Validación usando la librería de validación existente
      if (!newErrors.title && !newErrors.content) {
        const postValidation = validatePost({
          title: titleText,
          content: contentText,
          type,
          status
        });
        
        if (!postValidation.isValid) {
          Object.assign(newErrors, postValidation.errors);
        }

        // Validación adicional de entrada de usuario
        const userInputValidation = validateUserInput(titleText);
        if (!userInputValidation.isValid) {
          newErrors.title = userInputValidation.error;
        }

        const contentInputValidation = validateUserInput(contentText);
        if (!contentInputValidation.isValid) {
          newErrors.content = contentInputValidation.error;
        }
      }

      // Validación de rate limiting del lado cliente
      if (session?.user?.id) {
        const rateLimitCheck = await checkPostRateLimit(session.user.id);
        if (!rateLimitCheck.allowed) {
          newErrors.general = `Has alcanzado el límite de publicaciones. Intenta de nuevo en ${Math.ceil(rateLimitCheck.resetTime / 60)} minutos.`;
        }
      }

    } catch (error) {
      console.error('Error en validación:', error);
      newErrors.general = "Error al validar el formulario. Intenta de nuevo.";
    } finally {
      setIsValidating(false);
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Función para verificar rate limiting
  const checkPostRateLimit = async (userId) => {
    try {
      const response = await fetch('/api/posts/rate-limit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        return await response.json();
      }
      return { allowed: true }; // Permitir si no se puede verificar
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true }; // Permitir si hay error
    }
  };

  // Validación en tiempo real mejorada
  const handleTitleChange = (e) => {
    const value = e.target.value;
    
    // Filtrar caracteres no permitidos en tiempo real
    const filteredValue = value.replace(/[<>{}]/g, '');
    
    setTitle(filteredValue);
    
    if (touched.title) {
      const newErrors = { ...errors };
      if (!filteredValue.trim()) {
        newErrors.title = VALIDATION_ERRORS.TITLE_REQUIRED;
      } else if (filteredValue.trim().length < VALIDATION_LIMITS.TITLE_MIN_LENGTH) {
        newErrors.title = `El título debe tener al menos ${VALIDATION_LIMITS.TITLE_MIN_LENGTH} caracteres`;
      } else if (filteredValue.trim().length > VALIDATION_LIMITS.TITLE_MAX_LENGTH) {
        newErrors.title = `El título no puede exceder ${VALIDATION_LIMITS.TITLE_MAX_LENGTH} caracteres`;
      } else {
        // Verificación rápida de patrones maliciosos
        const hasMaliciousContent = SECURITY_PATTERNS.maliciousContent.some(pattern => 
          pattern.test(filteredValue)
        );
        if (hasMaliciousContent) {
          newErrors.title = "El título contiene contenido no permitido";
        } else {
          delete newErrors.title;
        }
      }
      setErrors(newErrors);
    }
  };

  const handleContentChange = (e) => {
    const value = e.target.value;
    setContent(value);
    
    if (touched.content) {
      const newErrors = { ...errors };
      if (!value.trim()) {
        newErrors.content = VALIDATION_ERRORS.CONTENT_REQUIRED;
      } else if (value.trim().length < VALIDATION_LIMITS.CONTENT_MIN_LENGTH) {
        newErrors.content = `El contenido debe tener al menos ${VALIDATION_LIMITS.CONTENT_MIN_LENGTH} caracteres`;
      } else if (value.trim().length > VALIDATION_LIMITS.CONTENT_MAX_LENGTH) {
        newErrors.content = `El contenido no puede exceder ${VALIDATION_LIMITS.CONTENT_MAX_LENGTH} caracteres`;
      } else {
        // Verificación rápida de patrones maliciosos
        const hasMaliciousContent = SECURITY_PATTERNS.maliciousContent.some(pattern => 
          pattern.test(value)
        );
        const hasSuspiciousUrls = SECURITY_PATTERNS.suspiciousUrls.some(pattern => 
          pattern.test(value)
        );
        const hasSpamPatterns = SECURITY_PATTERNS.spamPatterns.some(pattern => 
          pattern.test(value)
        );
        
        if (hasMaliciousContent) {
          newErrors.content = "El contenido contiene elementos no permitidos";
        } else if (hasSuspiciousUrls) {
          newErrors.content = "El contenido contiene URLs sospechosas";
        } else if (hasSpamPatterns) {
          newErrors.content = "El contenido parece spam";
        } else {
          delete newErrors.content;
        }
      }
      setErrors(newErrors);
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    // Validación completa al perder el foco
    setTimeout(() => validateForm(), 100);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/write` },
    });
    if (error) setMsg(`Error: ${error.message}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMsg("Sesión cerrada.");
    setSession(null);
  };

  const publish = async (e) => {
    e.preventDefault();
    setMsg("");
    
    // Validar formulario antes de enviar
    const isValid = await validateForm();
    if (!isValid) {
      setMsg("Por favor, corrige los errores antes de continuar");
      setTouched({ title: true, content: true });
      return;
    }
    
    setSaving(true);
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptPublish = async () => {
      try {
        // Sanitizar datos antes de enviar
        const sanitizedTitle = sanitizeText(title.trim());
        const sanitizedContent = normalizeText(sanitizeText(content.trim()));
        
        // Validación final antes del envío
        if (!sanitizedTitle || !sanitizedContent) {
          setMsg("❌ Error: Los datos no pudieron ser procesados correctamente");
          return false;
        }
        
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest" // Header adicional de seguridad
          },
          body: JSON.stringify({ 
            title: sanitizedTitle, 
            content: sanitizedContent, 
            status, 
            type 
          }),
        });

        const ct = res.headers.get("content-type") || "";
        const payload = ct.includes("application/json")
          ? await res.json()
          : { error: await res.text() };

        if (!res.ok) {
          // Extraer el mensaje de error correctamente
          let errorMessage = "Fallo al guardar";
          
          if (payload.error) {
            // Si payload.error es un objeto, extraer el mensaje
            if (typeof payload.error === 'object') {
              errorMessage = payload.error.message || payload.error.error || JSON.stringify(payload.error);
            } else {
              errorMessage = payload.error;
            }
          }
          
          // Manejo específico de diferentes tipos de errores
          switch (res.status) {
            case 400:
              // Para errores de validación, mostrar detalles específicos
              if (payload.error && payload.error.details && payload.error.details.validationErrors) {
                const validationErrors = payload.error.details.validationErrors;
                const errorMessages = validationErrors.map(err => {
                  if (typeof err === 'object') {
                    return err.message || err.error || 'Error de validación';
                  }
                  return err;
                }).join(', ');
                setMsg(`❌ Error de validación: ${errorMessages}`);
              } else {
                setMsg(`❌ Error de validación: ${errorMessage}`);
              }
              
              if (payload.details) {
                setErrors(payload.details);
              }
              return false; // No reintentar errores de validación
              
            case 401:
              setMsg("❌ Sesión expirada. Por favor, inicia sesión nuevamente.");
              await signOut();
              return false;
              
            case 403:
              setMsg("❌ No tienes permisos para realizar esta acción.");
              return false;
              
            case 429:
              const retryAfter = res.headers.get('Retry-After');
              if (retryAfter) {
                setMsg(`❌ Demasiadas solicitudes. Intenta de nuevo en ${retryAfter} segundos.`);
                // Auto-retry después del tiempo especificado
                if (retryCount < maxRetries) {
                  setTimeout(() => {
                    retryCount++;
                    setMsg(`🔄 Reintentando... (${retryCount}/${maxRetries})`);
                    attemptPublish();
                  }, parseInt(retryAfter) * 1000);
                }
              }
              return false;
              
            case 500:
            case 502:
            case 503:
            case 504:
              // Errores del servidor - reintentar
              if (retryCount < maxRetries) {
                retryCount++;
                setMsg(`🔄 Error del servidor. Reintentando... (${retryCount}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return attemptPublish();
              } else {
                setMsg(`❌ Error del servidor persistente: ${errorMessage}`);
                return false;
              }
              
            default:
              setMsg(`❌ Error ${res.status}: ${errorMessage}`);
              return false;
          }
        }

        // Reset del formulario y estados
        setTitle("");
        setContent("");
        setStatus("draft");
        setType("poem");
        setErrors({});
        setTouched({});
        setMsg(`✅ Guardado exitosamente: "${payload.data.title}"`);
        
        // Log de éxito para auditoría
        console.log('Post creado exitosamente:', {
          id: payload.data.id,
          title: payload.data.title,
          timestamp: new Date().toISOString()
        });
        
        return true;
        
      } catch (err) {
        console.error("Error al guardar:", err);
        
        // Diferentes mensajes según el tipo de error
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          if (retryCount < maxRetries) {
            retryCount++;
            setMsg(`🔄 Error de conexión. Reintentando... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return attemptPublish();
          } else {
            setMsg(`❌ Error de conexión persistente: Verifica tu conexión a internet`);
          }
        } else if (err.name === 'AbortError') {
          setMsg(`❌ La solicitud fue cancelada. Intenta de nuevo.`);
        } else if (err.message.includes('JSON')) {
          setMsg(`❌ Error de formato de respuesta del servidor`);
        } else {
          setMsg(`❌ Error inesperado: ${err.message || "No se pudo conectar con el servidor"}`);
        }
        
        return false;
      }
    };
    
    try {
      await attemptPublish();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-3">
      <AppHeader className="mb-6" />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">Escribir</h1>

      {!session ? (
        <Card>
          <CardBody>
            <div className="space-y-2">
              <Button onClick={signInWithGoogle} fullWidth>Entrar con Google</Button>
              {msg && <p className="text-sm text-gray-600">{msg}</p>}
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Crear nuevo post" />
            <CardBody>
              <form onSubmit={publish} className="space-y-4">
                <Input
                  label="Título"
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  onBlur={() => handleBlur('title')}
                  placeholder="Escribe el título de tu post..."
                  fullWidth
                  required
                  error={errors.title}
                  maxLength={VALIDATION_LIMITS.TITLE_MAX_LENGTH}
                />
                
                <Textarea
                  label="Contenido"
                  value={content}
                  onChange={handleContentChange}
                  onBlur={() => handleBlur('content')}
                  placeholder="Escribe el contenido de tu post..."
                  rows={10}
                  fullWidth
                  required
                  error={errors.content}
                  maxLength={VALIDATION_LIMITS.CONTENT_MAX_LENGTH}
                />

                <Select
                  label="Estado"
                  value={status}
                  onChange={(value) => setStatus(value)}
                  options={[
                    { value: "draft", label: "Borrador" },
                    { value: "published", label: "Publicado" }
                  ]}
                  fullWidth
                />

                <Select
                  label="Tipo"
                  value={type}
                  onChange={(value) => setType(value)}
                  options={[
                    { value: "poem", label: "Poema" },
                    { value: "chapter", label: "Capítulo" }
                  ]}
                  fullWidth
                />

                {/* Mostrar errores generales */}
                {errors.general && (
                  <Card variant="outlined" className="border-red-200 bg-red-50">
                    <CardBody>
                      <p className="text-red-700 text-sm">{errors.general}</p>
                    </CardBody>
                  </Card>
                )}

                <Button 
                  type="submit" 
                  disabled={saving || isValidating || Object.keys(errors).length > 0}
                  loading={saving || isValidating}
                  fullWidth
                >
                  {saving ? "Guardando..." : isValidating ? "Validando..." : "Guardar"}
                </Button>
                
                {/* Mostrar contadores de caracteres con colores según límites */}
                <div className="flex justify-between text-xs">
                  <span className={
                    title.length > VALIDATION_LIMITS.TITLE_MAX_LENGTH * 0.9 ? 'text-red-500' : 
                    title.length > VALIDATION_LIMITS.TITLE_MAX_LENGTH * 0.7 ? 'text-yellow-500' : 'text-gray-500'
                  }>
                    Título: {title.length}/{VALIDATION_LIMITS.TITLE_MAX_LENGTH}
                  </span>
                  <span className={
                    content.length > VALIDATION_LIMITS.CONTENT_MAX_LENGTH * 0.9 ? 'text-red-500' : 
                    content.length > VALIDATION_LIMITS.CONTENT_MAX_LENGTH * 0.7 ? 'text-yellow-500' : 'text-gray-500'
                  }>
                    Contenido: {content.length}/{VALIDATION_LIMITS.CONTENT_MAX_LENGTH}
                  </span>
                </div>
                
                {/* Indicador de validación en tiempo real */}
                {isValidating && (
                  <div className="text-xs text-blue-500 text-center py-1">
                    🔍 Validando contenido...
                  </div>
                )}
              </form>
            </CardBody>
          </Card>

          {msg && (
            <Card variant="outlined" className={
              msg.includes('✅') ? 'border-green-200 bg-green-50' : 
              msg.includes('❌') ? 'border-red-200 bg-red-50' : 
              'border-yellow-200 bg-yellow-50'
            }>
              <CardBody>
                <p className={
                  msg.includes('✅') ? 'text-green-700' : 
                  msg.includes('❌') ? 'text-red-700' : 
                  'text-yellow-700'
                }>
                  {msg}
                </p>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
