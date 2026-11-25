import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_ZOOM, MIN_ZOOM, stepZoom } from '../lib/mermaid-config';
import type { MermaidZoom } from '../lib/mermaid-config';

interface Props {
  svg: SVGSVGElement;
  width: number;
  capture: boolean;
}

export default function MermaidViewport({ svg, width, capture }: Props) {
  const [zoom, setZoom] = useState<MermaidZoom>('fit');
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);

  // Attach only the sanitized DOM tree; no HTML string is interpreted here.
  // A fresh clone is needed when React moves between inline and modal views.
  const mountSvg = useCallback((element: HTMLDivElement | null) => {
    if (element) element.replaceChildren(svg.cloneNode(true));
  }, [svg]);

  useEffect(() => {
    if (expanded && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    } else if (!expanded && restoreFocus.current) {
      restoreFocus.current = false;
      expandRef.current?.focus();
    }
  }, [expanded]);

  const close = () => {
    restoreFocus.current = true;
    setExpanded(false);
  };
  const adjustZoom = (direction: -1 | 1) => {
    const available = viewportRef.current?.clientWidth || width;
    const fitPercent = Math.min(100, available / width * 100);
    setZoom(current => stepZoom(current, direction, fitPercent));
  };
  const toolbar = (
    <div className="mermaid-controls" role="group" aria-label="Mermaid zoom">
      <button type="button" aria-label="Zoom out" disabled={zoom === MIN_ZOOM} onClick={() => adjustZoom(-1)}>−</button>
      <span aria-live="polite">{zoom === 'fit' ? 'Fit' : zoom + '%'}</span>
      <button type="button" aria-label="Zoom in" disabled={zoom === MAX_ZOOM} onClick={() => adjustZoom(1)}>+</button>
      <button type="button" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>Fit width</button>
      <button type="button" aria-pressed={zoom === 100} onClick={() => setZoom(100)}>100%</button>
    </div>
  );

  // Exactly one copy of the SVG is mounted: duplicating it would duplicate IDs
  // used by Mermaid's marker, clip-path and style references.
  const viewport = (
    <div ref={viewportRef} className="mermaid-diagram" tabIndex={capture ? undefined : 0} aria-label={capture ? undefined : 'Scrollable Mermaid diagram'}>
      <div className="mermaid-svg" role="img" aria-label="Mermaid diagram"
        style={{ width: width * (capture || zoom === 'fit' ? 1 : zoom / 100), maxWidth: capture || zoom === 'fit' ? '100%' : 'none' }}
        ref={mountSvg} />
    </div>
  );

  if (capture) return viewport;
  return (
    <div className="mermaid-viewer">
      <div className="mermaid-toolbar">
        {!expanded && toolbar}
        <button ref={expandRef} type="button" aria-label="Expand diagram" aria-expanded={expanded}
          disabled={expanded} onClick={() => setExpanded(true)}>⛶ Expand</button>
      </div>
      {!expanded && viewport}
      {expanded && (
        <dialog className="mermaid-dialog" ref={dialogRef} aria-label="Expanded Mermaid diagram" onClose={close}>
          <div className="mermaid-toolbar">
            {toolbar}
            <button type="button" onClick={() => dialogRef.current?.close()}>Close diagram</button>
          </div>
          {viewport}
        </dialog>
      )}
    </div>
  );
}
