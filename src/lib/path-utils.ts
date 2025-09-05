/**
  * Normalize a root-relative path by removing leading "./" or "/".
 */
export function normalizeRootRelativePath(p: string): string {
  return p.replace(/^(\.\/|\/)+/, '');
}
