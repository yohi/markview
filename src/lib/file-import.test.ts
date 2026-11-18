import { describe, expect, it } from 'vitest';
import { assertMarkdownFile, decodeMarkdownBytes, MAX_IMPORT_BYTES } from './file-import';

describe('Markdown file import', () => {
  it('allows Markdown extensions case-insensitively', () => {
    expect(() => assertMarkdownFile({ name: 'README.MD', size: 123 })).not.toThrow();
    expect(() => assertMarkdownFile({ name: 'notes.markdown', size: 0 })).not.toThrow();
  });
  it('rejects other formats and oversized files', () => {
    expect(() => assertMarkdownFile({ name: 'notes.txt', size: 123 })).toThrow();
    expect(() => assertMarkdownFile({ name: 'notes.md', size: MAX_IMPORT_BYTES + 1 })).toThrow();
  });
  it('preserves CRLF and rejects malformed UTF-8', () => {
    const valid = new TextEncoder().encode('# test\r\n- [ ] item\r\n');
    expect(decodeMarkdownBytes(valid.buffer)).toBe('# test\r\n- [ ] item\r\n');
    expect(() => decodeMarkdownBytes(Uint8Array.from([0xff]).buffer)).toThrow();
  });
});
