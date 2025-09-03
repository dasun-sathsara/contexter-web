/**
 * Build scoped gitignore rules for a specific base directory.
**/
export const normalizeRel = (p: string): string => {
  // Normalize to posix, drop leading "./", collapse slashes
  let s = p.replace(/\\/g, '/').replace(/^\.\/+/, '');
  s = s.replace(/\/{2,}/g, '/');
  // No leading slash for relative path semantics with the "ignore" lib
  if (s.startsWith('/')) s = s.slice(1);
  // Remove trailing slash for files (we only need raw path segments here)
  return s;
};

const joinRel = (base: string, child: string): string => {
  const a = normalizeRel(base);
  const b = normalizeRel(child);
  return a ? `${a}/${b}`.replace(/\/{2,}/g, '/') : b;
};

/**
 * Convert a .gitignore file's content within baseDir (relative to the root
 * of the selected folder) into patterns usable by the "ignore" library.
**/

// Semantics:
// "/foo" in baseDir -> "<baseDir>/foo" anchored to root: we keep the leading slash
//    - "foo/bar" in baseDir -> "/<baseDir>/foo/bar"
//    - "name" in baseDir -> "/<baseDir>/**/name"
//    - Negation "!" preserved
//    - Escaped "#", "!" supported
export const scopeGitignoreContent = (
  baseDirRel: string, // e.g. "", "src", "src/auth"
  content: string,
): string[] => {
  const base = normalizeRel(baseDirRel);
  const out: string[] = [];

  const add = (rule: string) => {
    if (!rule) return;
    out.push(rule);
  };

  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    // Trim only right side to preserve trailing slash semantics
    let line = raw.replace(/\s+$/, '');
    if (!line) continue;

    // Comments (unless escaped)
    if (line.startsWith('#')) continue;
    if (line.startsWith('\\#')) line = line.slice(1); // literal '#'

    // Literal '!' escape
    if (line.startsWith('\\!')) line = line.slice(1);

    // Negation handling
    let negated = false;
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1);
    }

    // Normalize away leading "./"
    if (line.startsWith('./')) line = line.slice(2);

    // After processing, if empty, skip
    if (!line) continue;

    // Determine anchoring and path shape
    const anchoredToBase = line.startsWith('/');
    const patternNoLeadingSlash = anchoredToBase ? line.slice(1) : line;

    // Collapse internal duplicate slashes
    const normalizedPattern = patternNoLeadingSlash.replace(/\/{2,}/g, '/');

    const containsSlash = normalizedPattern.includes('/');

    let scoped: string;
    if (anchoredToBase || containsSlash) {
      // Anchor to base directory within the project root
      // Example:
      //  - "/build" in "src" -> "/src/build"
      //  - "foo/bar" in "src" -> "/src/foo/bar"
      const prefixed = base ? joinRel(base, normalizedPattern) : normalizedPattern;
      scoped = `/${prefixed}`;
    } else {
      // Name-only patterns match at any depth beneath the base dir
      // Example:
      //  - "secret.yaml" in "src" -> "/src/**/secret.yaml"
      const pattern = base ? `${base}/**/${normalizedPattern}` : `**/${normalizedPattern}`;
      scoped = `/${pattern}`;
    }

    // Normalize slashes
    scoped = scoped.replace(/\/{2,}/g, '/');

    if (negated) add('!' + scoped);
    else add(scoped);
  }

  return out;
};
