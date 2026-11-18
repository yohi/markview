import { describe, expect, it } from 'vitest';
import { assertMarkdownFile, decodeMarkdownBytes, readMarkdownFile, MAX_IMPORT_BYTES } from './file-import';

describe('Markdown file import', () => {
  it('allows Markdown extensions case-insensitively', () => {
    expect(() => assertMarkdownFile({ name: 'README.MD', size: 123 })).not.toThrow();
    expect(() => assertMarkdownFile({ name: 'notes.markdown', size: 0 })).not.toThrow();
  });
  it('rejects other formats and oversized files', () => {
    expect(() => assertMarkdownFile({ name: 'notes.txt', size: 123 })).toThrow();
    expect(() => assertMarkdownFile({ name: 'notes.md', size: MAX_IMPORT_BYTES + 1 })).toThrow();
  });
  it('normalizes CRLF and CR to LF without altering existing LF', () => {
    const valid = new TextEncoder().encode('# test\r\n- [ ] item\r## Next\nEnd\r\n');
    expect(decodeMarkdownBytes(valid.buffer)).toBe('# test\n- [ ] item\n## Next\nEnd\n');
    expect(decodeMarkdownBytes(new TextEncoder().encode('## LF\nOnly\n').buffer)).toBe('## LF\nOnly\n');
  });

  it('uses the normalized source for both file import and preview offsets', async () => {
    const raw = '# Start\r\n## Second\r\n## Third\r\n';
    const bytes = new TextEncoder().encode(raw);
    const file = { name: 'README.md', size: bytes.byteLength, arrayBuffer: async () => bytes.buffer };
    const imported = await readMarkdownFile(file);
    expect(imported).toBe('# Start\n## Second\n## Third\n');
    expect(imported.indexOf('## Third')).toBe(18);
  });

  it('rejects invalid UTF-8 before returning document text', () => {
    expect(() => decodeMarkdownBytes(Uint8Array.from([0xff]).buffer)).toThrow();
  });
});
