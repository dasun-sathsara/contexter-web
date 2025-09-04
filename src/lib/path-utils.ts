export function normalizeRootRelativePath(p: string): string {
  return p.replace(/^(\.\/|\/)+/, ''); // strip leading "./" or "/"
}
