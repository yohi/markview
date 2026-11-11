import { describe, expect, it } from 'vitest';
import { clampSplitRatio, cleanCodeBlock, isMermaidCode } from './markdown';

describe('Markdown helpers', () => {
  it('recognizes fenced Mermaid blocks without matching similar languages', () => {
    expect(isMermaidCode('language-mermaid')).toBe(true);
    expect(isMermaidCode('foo language-mermaid bar')).toBe(true);
    expect(isMermaidCode('language-mermaidx')).toBe(false);
    expect(isMermaidCode('language-typescript')).toBe(false);
    expect(isMermaidCode()).toBe(false);
  });

  it('removes only the final newline of a fenced block', () => {
    expect(cleanCodeBlock('flowchart LR\n A-->B\n')).toBe('flowchart LR\n A-->B');
    expect(cleanCodeBlock('hello')).toBe('hello');
  });

  it('keeps the split handle inside usable limits', () => {
    expect(clampSplitRatio(0)).toBe(30);
    expect(clampSplitRatio(50)).toBe(50);
    expect(clampSplitRatio(99)).toBe(70);
  });
});
