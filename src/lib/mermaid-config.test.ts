import { describe, expect, it } from 'vitest';
import { DEFAULT_MERMAID_MODE, intrinsicDiagramWidth, mermaidConfig, stepZoom } from './mermaid-config';

describe('Mermaid presets', () => {
  it('defaults to enhanced and selects the expected layouts and themes', () => {
    expect(DEFAULT_MERMAID_MODE).toBe('enhanced');
    expect(mermaidConfig('light', 'standard')).toMatchObject({ layout: 'dagre', theme: 'default' });
    expect(mermaidConfig('dark', 'standard')).toMatchObject({ layout: 'dagre', theme: 'dark' });
    expect(mermaidConfig('light', 'enhanced')).toMatchObject({ layout: 'elk', theme: 'base', themeVariables: { darkMode: false } });
    expect(mermaidConfig('dark', 'enhanced')).toMatchObject({ layout: 'elk', theme: 'base', themeVariables: { darkMode: true } });
  });
  it('protects strict security and returns independent configurations', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const mode of ['standard', 'enhanced'] as const) {
        const config = mermaidConfig(theme, mode);
        expect(config.securityLevel).toBe('strict');
        expect(config.startOnLoad).toBe(false);
        expect(config.secure).toEqual(expect.arrayContaining(['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'themeCSS']));
        config.secure!.push('layout');
        expect(mermaidConfig(theme, mode).secure).not.toContain('layout');
      }
    }
  });
});
describe('Mermaid viewport sizing', () => {
  it('uses intrinsic SVG dimensions and handles missing/invalid values', () => {
    expect(intrinsicDiagramWidth('-10 -5 1240.5 300', '100%')).toBe(1240.5);
    expect(intrinsicDiagramWidth('0,0,400,80', null)).toBe(400);
    expect(intrinsicDiagramWidth('0 0 0 80', '320px')).toBe(320);
    expect(intrinsicDiagramWidth('0 0 Infinity 80', '100%')).toBe(800);
    expect(intrinsicDiagramWidth(null, null)).toBe(800);
  });
  it('clamps zoom in both directions', () => {
    expect(stepZoom('fit', 1)).toBe(125);
    expect(stepZoom('fit', -1)).toBe(75);
    expect(stepZoom(200, 1)).toBe(200);
    expect(stepZoom(25, -1)).toBe(25);
    expect(stepZoom('fit', 1, 63)).toBe(75);
    expect(stepZoom('fit', -1, 63)).toBe(50);
  });
});
