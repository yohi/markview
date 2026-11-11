export type ViewMode = 'editor' | 'split' | 'preview';
export type ColorTheme = 'light' | 'dark';

export function isMermaidCode(className?: string): boolean {
  return /(?:^|\s)language-mermaid(?:\s|$)/.test(className ?? '');
}

export function cleanCodeBlock(value: string): string {
  return value.replace(/\n$/, '');
}

export function clampSplitRatio(value: number): number {
  return Math.max(30, Math.min(70, value));
}
