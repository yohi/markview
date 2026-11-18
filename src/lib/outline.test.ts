import { describe, expect, it } from 'vitest';
import { extractHeadings } from './outline';

describe('Markdown headings outline', () => {
  it('supports ATX and Setext headings with source locations', () => {
    const source = '# Title\n\nSection\n-------\n\n## One **bold** code\n';
    const headings = extractHeadings(source);
    expect(headings.map((h) => [h.level, h.text])).toEqual([
      [1, 'Title'], [2, 'Section'], [2, 'One bold code'],
    ]);
    expect(headings[2].offset).toBe(source.indexOf('## One'));
  });
  it('ignores headings inside code fences and preserves duplicate titles', () => {
    const source = '# Same\n\n' + '~~~md\n# Fake\n~~~\n\n' + '# Same';
    const headings = extractHeadings(source);
    expect(headings.map((h) => h.text)).toEqual(['Same', 'Same']);
    expect(headings[0].offset).not.toBe(headings[1].offset);
  });
  it('does not report plain text or an empty document as headings', () => {
    expect(extractHeadings('')).toEqual([]);
    expect(extractHeadings('Just a paragraph')).toEqual([]);
  });
});
