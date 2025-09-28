console.log('🔐 Generando políticas RLS para la tabla "chapters"...\n');

console.log('📝 Ejecuta estos comandos SQL en tu Supabase Dashboard → SQL Editor:\n');

console.log('-- 1. Habilitar RLS en la tabla chapters');
console.log('ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;\n');

console.log('-- 2. Política para INSERT - Solo usuarios autenticados pueden insertar capítulos');
console.log(`CREATE POLICY "Authenticated users can insert chapters" ON chapters
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);\n`);

console.log('-- 3. Política para SELECT - Los usuarios pueden ver sus propios capítulos');
console.log(`CREATE POLICY "Users can view own chapters" ON chapters
FOR SELECT USING (
  auth.uid() = user_id
);\n`);

console.log('-- 4. Política para UPDATE - Los usuarios pueden actualizar sus propios capítulos');
console.log(`CREATE POLICY "Users can update own chapters" ON chapters
FOR UPDATE USING (
  auth.uid() = user_id
);\n`);

console.log('-- 5. Política para DELETE - Los usuarios pueden eliminar sus propios capítulos');
console.log(`CREATE POLICY "Users can delete own chapters" ON chapters
FOR DELETE USING (
  auth.uid() = user_id
);\n`);

console.log('✅ Políticas generadas correctamente');
console.log('💡 Nota: Asegúrate de que la columna "user_id" existe en la tabla chapters');
console.log('   y que se está asignando correctamente al insertar nuevos capítulos.\n');

console.log('🔍 Para verificar que las políticas se aplicaron correctamente, ejecuta:');
console.log('SELECT * FROM pg_policies WHERE tablename = \'chapters\';');