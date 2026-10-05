// Ajustes acotados: el deslizador sigue siendo la referencia del usuario.
export function turnPause(text: string, baseMs: number, spokenMs: number): number {
  const clean = text.trim();
  if (!clean) return Math.max(baseMs, 1300);
  if (/(?:\b(?:y|pero|porque|entonces|que|para|con|de|el|la|un|una)|[,;:])$/i.test(clean)) return Math.max(baseMs, 1500);
  if (spokenMs < 900 && !/[.!?]$/.test(clean)) return Math.max(baseMs, 1200);
  return /[.!?]$/.test(clean) ? Math.max(650, baseMs - 150) : baseMs;
}
