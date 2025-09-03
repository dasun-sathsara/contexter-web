import { FileWithPath } from 'react-dropzone'

/**
 * Builds a combined gitignore content string from ALL .gitignore files in the
 * uploaded directory, prefixing each rule with the directory path relative to
 * the selected root. This approximates native .gitignore scoping semantics.
**/
export const buildCombinedGitignoreContent = async (
  files: FileWithPath[],
): Promise<string> => {
  const normalizePath = (p: string): string => {
    // Convert backslashes, remove leading "./", collapse repeated slashes
    let s = p.replace(/\\/g, '/').replace(/^\.\/+/, '');
    // Ensure a single leading slash for consistency
    if (!s.startsWith('/')) s = '/' + s;
    s = s.replace(/\/{2,}/g, '/');
    // Remove trailing slash for files (we only get file paths here)
    return s;
  };

  const dirOf = (p: string): string => {
    const s = normalizePath(p);
    const idx = s.lastIndexOf('/');
    if (idx <= 0) return '/';
    return s.slice(0, idx) || '/';
  };

  const isGitignore = (p: string): boolean =>
    normalizePath(p).toLowerCase().endsWith('/.gitignore');

  const gitignoreFiles = files.filter((f) => isGitignore(f.path!));
  if (gitignoreFiles.length === 0) return '';

  // Sort by directory depth ascending: parents first, children later (so child rules override)
  gitignoreFiles.sort((a, b) => {
    const da = dirOf(a.path!).split('/').filter(Boolean).length;
    const db = dirOf(b.path!).split('/').filter(Boolean).length;
    return da - db;
  });

  const out = new Set<string>();

  for (const file of gitignoreFiles) {
    let content = '';
    try {
      content = await file.text();
    } catch {
      continue;
    }

    // Directory that owns this .gitignore, e.g. "/mp3-converter/src/auth"
    const baseDir = dirOf(file.path!);

    const addRule = (rule: string) => {
      // Ensure we don't add empty rules
      if (!rule) return;
      out.add(rule);
    };

    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
      // Preserve trailing slash semantics, trim right spaces only
      let line = raw.replace(/\s+$/, '');

      if (!line) continue;

      // Comments (unless escaped)
      if (line.startsWith('#')) continue;
      if (line.startsWith('\\#')) line = line.slice(1); // literal '#'

      // Handle literal '!' escape
      if (line.startsWith('\\!')) line = line.slice(1);

      // Negation
      let negated = false;
      if (line.startsWith('!')) {
        negated = true;
        line = line.slice(1);
      }

      // Drop leading "./"
      if (line.startsWith('./')) line = line.slice(2);

      // If after processing it's empty, skip
      if (!line) continue;

      // Determine anchoring and shape of the pattern
      const anchoredToBase = line.startsWith('/');
      const patternNoLeadingSlash = anchoredToBase ? line.slice(1) : line;

      // Collapse internal duplicate slashes
      const normalizedPattern = patternNoLeadingSlash.replace(/\/{2,}/g, '/');

      // If the pattern has any slash, it's path-relative to the .gitignore directory.
      const containsSlash = normalizedPattern.includes('/');

      let scoped: string;
      if (anchoredToBase || containsSlash) {
        // Anchor to the directory owning the .gitignore
        // Example:
        //   - "/build"      -> "/<baseDir>/build"
        //   - "foo/bar"     -> "/<baseDir>/foo/bar"
        scoped = `${baseDir}/${normalizedPattern}`;
      } else {
        // Name-only patterns should match at any depth under baseDir
        // Example:
        //   - "secret.yaml" -> "/<baseDir>/**/secret.yaml"
        scoped = `${baseDir}/**/${normalizedPattern}`;
      }

      // Normalize slashes and ensure a single leading slash
      scoped = scoped.replace(/\/{2,}/g, '/');
      if (!scoped.startsWith('/')) scoped = '/' + scoped;

      if (negated) {
        addRule('!' + scoped);
      } else {
        addRule(scoped);
      }
    }
  }

  return Array.from(out).join('\n');
};
