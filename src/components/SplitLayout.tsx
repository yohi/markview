import { useEffect, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { clampSplitRatio } from '../lib/markdown';

interface Props {
  editor: ReactNode;
  preview: ReactNode;
}

export default function SplitLayout({ editor, preview }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(50);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const bounds = container.current?.getBoundingClientRect();
      if (!bounds || bounds.width === 0) return;
      setRatio(clampSplitRatio(((event.clientX - bounds.left) / bounds.width) * 100));
    };
    const onEnd = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragging]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    setDragging(true);
  };

  return (
    <div className={'split-layout' + (dragging ? ' is-dragging' : '')} ref={container} style={{ gridTemplateColumns: 'minmax(0,' + ratio + 'fr) 8px minmax(0,' + (100 - ratio) + 'fr)' }}>
      <section className="workspace-pane" aria-label="Editor pane">
        <div className="pane-heading"><span className="pane-dot" />EDITOR <span className="pane-hint">Markdown</span></div>
        {editor}
      </section>
      <div
        className="split-handle"
        role="separator"
        aria-label="Resize editor and preview"
        aria-orientation="vertical"
        aria-valuemin={30}
        aria-valuemax={70}
        aria-valuenow={ratio}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); setRatio((n) => clampSplitRatio(n - 5)); }
          if (event.key === 'ArrowRight') { event.preventDefault(); setRatio((n) => clampSplitRatio(n + 5)); }
        }}
      ><span /></div>
      <section className="workspace-pane" aria-label="Preview pane">
        <div className="pane-heading"><span className="pane-dot preview-dot" />PREVIEW <span className="pane-hint">GitHub flavored</span></div>
        {preview}
      </section>
    </div>
  );
}
