import { describe, it, expect } from 'vitest';
import { generateSlug, isValidSlug, generateUniqueSlug } from '../slugUtils';

describe('slugUtils', () => {
  it('generateSlug normalizes and cleans titles', () => {
    expect(generateSlug('  Hola Mundo! ')).toBe('hola-mundo');
    expect(generateSlug('Canción número #1')).toBe('cancion-numero-1');
    expect(generateSlug('Árbol de la vida')).toBe('arbol-de-la-vida');
  });

  it('isValidSlug validates slug format', () => {
    expect(isValidSlug('hola-mundo')).toBe(true);
    expect(isValidSlug('hola--mundo')).toBe(false);
    expect(isValidSlug('-hola-')).toBe(false);
    expect(isValidSlug('Hola-Mundo')).toBe(false);
  });

  it('generateUniqueSlug ensures uniqueness with suffixes', () => {
    const existing = ['hola-mundo', 'hola-mundo-1'];
    expect(generateUniqueSlug('Hola Mundo', existing)).toBe('hola-mundo-2');
  });
});