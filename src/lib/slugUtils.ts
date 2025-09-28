/**
 * Genera un slug URL-friendly a partir de un título
 * @param title - El título del cual generar el slug
 * @returns El slug generado
 */
export function generateSlug(title: string): string {
  if (!title || typeof title !== 'string') {
    return '';
  }

  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales
    .trim()
    .replace(/\s+/g, '-') // Reemplazar espacios con guiones
    .replace(/-+/g, '-') // Remover guiones múltiples
    .replace(/^-+|-+$/g, ''); // Remover guiones al inicio y final
}

/**
 * Verifica si un slug es válido
 * @param slug - El slug a verificar
 * @returns true si el slug es válido
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  // Un slug válido debe contener solo letras minúsculas, números y guiones
  // No debe empezar ni terminar con guión
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

/**
 * Genera un slug único añadiendo un sufijo numérico si es necesario
 * @param title - El título base
 * @param existingSlugs - Array de slugs existentes para evitar duplicados
 * @returns Un slug único
 */
export function generateUniqueSlug(title: string, existingSlugs: string[] = []): string {
  const baseSlug = generateSlug(title);
  
  if (!baseSlug) {
    return 'untitled';
  }

  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  // Si el slug ya existe, añadir un número
  let counter = 1;
  let uniqueSlug = `${baseSlug}-${counter}`;
  
  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  return uniqueSlug;
}