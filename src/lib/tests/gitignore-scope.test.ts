import { describe, it, expect } from 'vitest';
import { scopeGitignoreContent } from '../../lib/gitignore-scope';

describe('scopeGitignoreContent', () => {
  it('scopes name-only patterns under baseDir with **', () => {
    const content = 'secret.yaml\npackage-lock.json\n';
    const out = scopeGitignoreContent('src', content);

    expect(out).toEqual([
      '/src/**/secret.yaml',
      '/src/**/package-lock.json',
    ]);
  });

  it('anchors patterns with leading slash or containing slashes to baseDir', () => {
    const content = '/build\nfoo/bar\n';
    const out = scopeGitignoreContent('src', content);

    expect(out).toEqual(['/src/build', '/src/foo/bar']);
  });

  it('scopes patterns at the root when baseDir is empty', () => {
    const content = 'node_modules\n/build\n./.cache\n';
    const out = scopeGitignoreContent('', content);

    expect(out).toEqual([
      '/**/node_modules',
      '/build',
      '/**/.cache',
    ]);
  });

  it('skips comments, preserves escaped # as literal, and handles negation', () => {
    const content = [
      '# comment should be ignored',
      '\\#literal',
      '!negate.txt',
    ].join('\n');

    const out = scopeGitignoreContent('src/auth', content);

    expect(out).toEqual([
      '/src/auth/**/#literal',
      '!/src/auth/**/negate.txt',
    ]);
  });

  it('trims leading "./" and collapses duplicate slashes; preserves trailing slash', () => {
    const content = './foo//bar\nfoo//\n';
    const out = scopeGitignoreContent('src', content);

    expect(out).toEqual(['/src/foo/bar', '/src/foo/']);
  });

  it('handles empty base/root by anchoring to absolute patterns from root', () => {
    const content = 'Makefile\n';
    const out = scopeGitignoreContent('', content);

    expect(out).toEqual(['/**/Makefile']);
  });

  // Documenting a real bug with an expected-to-fail test:
  // According to the function comment ("Literal '!' escape"), "\!file"
  // should be treated as a literal '!' filename, not as a negation.
  // Current implementation removes the backslash first, then interprets
  // '!' as negation.
  it.fails('treats "\\!" at start as literal "!" (not negation) - currently buggy', () => {
    const content = '\\!bang.txt\n';
    const out = scopeGitignoreContent('src', content);
    // Expected correct behavior:
    expect(out).toEqual(['/src/**/!bang.txt']);
  });
});
