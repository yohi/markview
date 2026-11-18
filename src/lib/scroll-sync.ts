import type { EditorView } from '@codemirror/view';

export interface PositionPoint {
  source: number;
  target: number;
}

/** Linear interpolation between ordered points, clamped to the endpoints. */
export function interpolatePosition(points: readonly PositionPoint[], source: number): number {
  if (!points.length) return 0;
  if (source <= points[0].source) return points[0].target;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const next = points[index];
    if (source <= next.source) {
      const span = next.source - previous.source;
      if (span <= 0) return next.target;
      return previous.target + (next.target - previous.target) * ((source - previous.source) / span);
    }
  }
  return points[points.length - 1].target;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function previewAnchors(preview: HTMLElement, sourceLength: number): PositionPoint[] {
  const rect = preview.getBoundingClientRect();
  const points: PositionPoint[] = [{ source: 0, target: 0 }];
  for (const element of preview.querySelectorAll<HTMLElement>('[data-source-offset]')) {
    const source = Number(element.dataset.sourceOffset);
    if (!Number.isInteger(source) || source < 0 || source > sourceLength) continue;
    const top = element.getBoundingClientRect().top - rect.top + preview.scrollTop;
    if (Number.isFinite(top)) points.push({ source, target: Math.max(0, top) });
  }
  points.push({ source: sourceLength, target: preview.scrollHeight });
  points.sort((a, b) => a.source - b.source || a.target - b.target);

  // Nested elements may share source offsets; retain the earliest visual location.
  const ordered: PositionPoint[] = [];
  for (const point of points) {
    const last = ordered[ordered.length - 1];
    if (last && last.source === point.source) continue;
    if (last && point.target < last.target) continue;
    ordered.push(point);
  }
  return ordered;
}

export function attachScrollSync(editor: EditorView, preview: HTMLElement): () => void {
  const scroller = editor.scrollDOM;
  let frame = 0;
  let ignoreEditor: number | null = null;
  let ignorePreview: number | null = null;

  const updateFromEditor = () => {
    const maxScroll = Math.max(0, preview.scrollHeight - preview.clientHeight);
    if (maxScroll === 0) return;
    const y = scroller.getBoundingClientRect().top + 24 - editor.documentTop;
    const block = editor.lineBlockAtHeight(Math.max(0, y));
    const points = previewAnchors(preview, editor.state.doc.length);
    const target = scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 2
      ? maxScroll
      : clamp(interpolatePosition(points, block.from) - 24, 0, maxScroll);
    if (Math.abs(preview.scrollTop - target) > 1) {
      preview.scrollTop = target;
      ignorePreview = preview.scrollTop;
    }
  };

  const updateFromPreview = () => {
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (maxScroll === 0) return;
    const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight);
    let target: number;
    if (preview.scrollTop >= previewMax - 2) {
      target = maxScroll;
    } else {
      const points = previewAnchors(preview, editor.state.doc.length);
      const inverted = points.map((point) => ({ source: point.target, target: point.source }));
      const offset = Math.round(interpolatePosition(inverted, preview.scrollTop + 24));
      const block = editor.lineBlockAt(clamp(offset, 0, editor.state.doc.length));
      const top = editor.documentTop + block.top - scroller.getBoundingClientRect().top;
      target = clamp(scroller.scrollTop + top - 24, 0, maxScroll);
    }
    if (Math.abs(scroller.scrollTop - target) > 1) {
      scroller.scrollTop = target;
      ignoreEditor = scroller.scrollTop;
    }
  };

  const onEditorScroll = () => {
    if (ignoreEditor !== null && Math.abs(scroller.scrollTop - ignoreEditor) <= 2) {
      ignoreEditor = null;
      return;
    }
    ignoreEditor = null;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateFromEditor);
  };
  const onPreviewScroll = () => {
    if (ignorePreview !== null && Math.abs(preview.scrollTop - ignorePreview) <= 2) {
      ignorePreview = null;
      return;
    }
    ignorePreview = null;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateFromPreview);
  };

  scroller.addEventListener('scroll', onEditorScroll, { passive: true });
  preview.addEventListener('scroll', onPreviewScroll, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    scroller.removeEventListener('scroll', onEditorScroll);
    preview.removeEventListener('scroll', onPreviewScroll);
  };
}
