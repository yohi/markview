import type { MermaidConfig } from 'mermaid';
import type { ColorTheme } from './markdown';

export type MermaidMode = 'standard' | 'enhanced';
export const DEFAULT_MERMAID_MODE: MermaidMode = 'enhanced';

// Mermaid permits diagram-local configuration except for secure keys.
// Keep the upstream protected keys and prohibit document-provided CSS.
export function mermaidConfig(theme: ColorTheme, mode: MermaidMode): MermaidConfig {
  const common: MermaidConfig = {
    startOnLoad: false,
    securityLevel: 'strict',
    secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize',
      'suppressErrorRendering', 'maxEdges', 'themeCSS'],
    suppressErrorRendering: true,
  };
  if (mode === 'standard') {
    return { ...common, layout: 'dagre', theme: theme === 'dark' ? 'dark' : 'default' };
  }
  const dark = theme === 'dark';
  return {
    ...common,
    layout: 'elk',
    theme: 'base',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Noto Sans CJK JP", sans-serif',
    themeVariables: {
      darkMode: dark,
      primaryColor: dark ? '#1E293B' : '#F1F5F9',
      primaryTextColor: dark ? '#F1F5F9' : '#0F172A',
      primaryBorderColor: dark ? '#94A3B8' : '#64748B',
      secondaryColor: dark ? '#1E3A5F' : '#DBEAFE',
      tertiaryColor: dark ? '#243247' : '#F8FAFC',
      lineColor: dark ? '#CBD5E1' : '#475569',
      edgeLabelBackground: dark ? '#151C28' : '#FFFFFF',
      clusterBkg: dark ? '#202C3D' : '#F8FAFC',
      clusterBorder: dark ? '#64748B' : '#94A3B8',
      fontSize: '16px',
    },
    flowchart: { nodeSpacing: 45, rankSpacing: 55, diagramPadding: 16, curve: 'linear' },
  };
}

export type MermaidZoom = 'fit' | number;
export const MIN_ZOOM = 25;
export const MAX_ZOOM = 200;
export function stepZoom(zoom: MermaidZoom, direction: -1 | 1): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (zoom === 'fit' ? 100 : zoom) + direction * 25));
}

// Mermaid SVGs normally have a viewBox; use a finite width even for unusual diagram types.
export function intrinsicDiagramWidth(viewBox: string | null, width: string | null): number {
  const values = viewBox?.trim().split(/[\s,]+/).map(Number);
  if (values?.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
    return values[2];
  }
  const numeric = width && /^\d+(?:\.\d+)?(?:px)?$/.test(width) ? Number.parseFloat(width) : 0;
  return numeric > 0 && Number.isFinite(numeric) ? numeric : 800;
}
