# Políticas RLS para el Bucket Chapters

## Resumen

Este documento describe las políticas de Row Level Security (RLS) implementadas para el bucket `chapters` en Supabase Storage, que garantizan que solo los usuarios autenticados puedan acceder a sus propios archivos de capítulos.

## Estructura del Bucket

```
chapters/
├── {user_id_1}/
│   ├── chapter-file-1.docx
│   └── chapter-cover-1.jpg
├── {user_id_2}/
│   ├── chapter-file-2.docx
│   └── chapter-cover-2.jpg
└── ...
```

- **Organización**: Por UUID de usuario
- **Privacidad**: Bucket privado (`public = false`)
- **Acceso**: Solo el propietario puede acceder a sus archivos

## Políticas Implementadas

### 1. Política de Upload (INSERT)

```sql
CREATE POLICY "chapters_upload_policy_2024" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Función**: Permite a usuarios autenticados subir archivos únicamente a su propia carpeta.

**Condiciones**:
- Usuario debe estar autenticado
- El archivo debe ir al bucket `chapters`
- La primera carpeta del path debe coincidir con el UUID del usuario

### 2. Política de Select (READ)

```sql
CREATE POLICY "chapters_select_policy_2024" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Función**: Permite a usuarios autenticados ver únicamente sus propios archivos.

**Condiciones**:
- Usuario debe estar autenticado
- Solo archivos del bucket `chapters`
- Solo archivos en la carpeta del usuario

### 3. Política de Update (UPDATE)

```sql
CREATE POLICY "chapters_update_policy_2024" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Función**: Permite a usuarios autenticados actualizar únicamente sus propios archivos.

**Condiciones**:
- Usuario debe estar autenticado
- Solo archivos del bucket `chapters`
- Solo archivos en la carpeta del usuario

### 4. Política de Delete (DELETE)

```sql
CREATE POLICY "chapters_delete_policy_2024" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Función**: Permite a usuarios autenticados eliminar únicamente sus propios archivos.

**Condiciones**:
- Usuario debe estar autenticado
- Solo archivos del bucket `chapters`
- Solo archivos en la carpeta del usuario

## Seguridad

### Principios de Seguridad Aplicados

1. **Principio de Menor Privilegio**: Los usuarios solo pueden acceder a sus propios archivos
2. **Autenticación Requerida**: Todas las operaciones requieren autenticación
3. **Aislamiento por Usuario**: Cada usuario tiene su propia carpeta aislada
4. **Bucket Privado**: El bucket no es público, requiere autenticación para cualquier acceso

### Validación de Rutas

La función `(storage.foldername(name))[1]` extrae el primer nivel de carpeta del path del archivo:

- Para `chapters/f844097c-52c0-42d9-8694-322f616d19f0/file.docx`
- Extrae: `f844097c-52c0-42d9-8694-322f616d19f0`
- Compara con: `auth.uid()::text`

## Implementación

### Scripts Disponibles

1. **`apply-chapters-bucket-rls.js`**: Genera los comandos SQL para aplicar las políticas
2. **`verify-chapters-bucket-rls.js`**: Verifica que las políticas estén correctamente aplicadas

### Comandos de Aplicación

```bash
# Generar comandos SQL
node scripts/apply-chapters-bucket-rls.js

# Verificar implementación
node scripts/verify-chapters-bucket-rls.js
```

### Aplicación Manual

Ejecutar en el SQL Editor de Supabase:

```sql
-- Habilitar RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Aplicar las 4 políticas (ver scripts para comandos completos)
```

## Verificación

### Checklist de Verificación

- [ ] Bucket `chapters` existe y es privado
- [ ] RLS habilitado en `storage.objects`
- [ ] 4 políticas creadas correctamente
- [ ] Estructura organizada por UUID de usuario
- [ ] Pruebas de acceso funcionando correctamente

### Pruebas Recomendadas

1. **Subir archivo**: Verificar que solo se puede subir a la carpeta propia
2. **Listar archivos**: Verificar que solo se ven los archivos propios
3. **Acceso cruzado**: Verificar que no se puede acceder a archivos de otros usuarios
4. **Usuario no autenticado**: Verificar que no puede acceder a nada

## Mantenimiento

### Monitoreo

- Revisar logs de acceso regularmente
- Verificar que las políticas siguen activas
- Monitorear intentos de acceso no autorizados

### Actualizaciones

Si se necesita modificar las políticas:

1. Crear nuevas políticas con nombres únicos
2. Probar en entorno de desarrollo
3. Eliminar políticas antiguas
4. Actualizar documentación

## Troubleshooting

### Problemas Comunes

1. **Error "RLS policy violation"**: 
   - Verificar que el usuario esté autenticado
   - Verificar que el path incluya el UUID correcto

2. **No se pueden ver archivos**:
   - Verificar que RLS esté habilitado
   - Verificar que las políticas SELECT estén activas

3. **No se pueden subir archivos**:
   - Verificar políticas INSERT
   - Verificar estructura de carpetas

### Comandos de Diagnóstico

```sql
-- Ver políticas activas
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%chapters%';

-- Ver estado RLS
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'objects' AND schemaname = 'storage';
```

## Conclusión

Las políticas RLS implementadas garantizan un acceso seguro y aislado al bucket `chapters`, donde cada usuario solo puede gestionar sus propios archivos de capítulos independientes. La estructura por UUID proporciona escalabilidad y seguridad a largo plazo.