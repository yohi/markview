import { useEffect, useId, useRef, useState } from 'react';
import type { ColorTheme } from '../lib/markdown';
import { mermaidConfig, intrinsicDiagramWidth } from '../lib/mermaid-config';
import type { MermaidMode } from '../lib/mermaid-config';
import MermaidViewport from './MermaidViewport';

type RenderState =
  | { status: 'loading' }
  | { status: 'success'; svg: string; width: number }
  | { status: 'error'; message: string };

let renderQueue: Promise<unknown> = Promise.resolve();

function renderSafely(source: string, theme: ColorTheme, mode: MermaidMode, id: string): Promise<{ svg: string; width: number }> {
  const job = renderQueue.then(async () => {
    const { default: mermaid } = await import('mermaid');
    // initialize + render must remain atomic because Mermaid configuration is global.
    mermaid.initialize(mermaidConfig(theme, mode));
    const { svg } = await mermaid.render(id, source);
    // Parse in an inert template, using the same HTML/SVG parsing rules as
    // the display path (Mermaid can contain HTML labels inside foreignObject).
    const template = document.createElement('template');
    template.innerHTML = svg;
    const root = template.content.querySelector('svg');
    if (!root) throw new Error('Invalid Mermaid SVG');
    return { svg, width: intrinsicDiagramWidth(root.getAttribute('viewBox'), root.getAttribute('width')) };
  });
  renderQueue = job.then(() => undefined, () => undefined);
  return job;
}

interface Props {
  source: string;
  theme: ColorTheme;
  mode: MermaidMode;
  capture?: boolean;
}

export default function MermaidDiagram({ source, theme, mode, capture = false }: Props) {
  const stableId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sequence = useRef(0);
  const [state, setState] = useState<RenderState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const timeout = window.setTimeout(() => {
      const id = 'markview-mermaid-' + stableId + '-' + (++sequence.current);
      void renderSafely(source, theme, mode, id).then(
        (result) => {
          if (!cancelled) setState({ status: 'success', ...result });
        },
        (error: unknown) => {
          if (!cancelled) setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Invalid Mermaid diagram',
          });
        },
      );
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [source, theme, mode, stableId]);

  if (state.status === 'loading') {
    return <div className="mermaid-status" role="status">Rendering Mermaid diagram…</div>;
  }
  if (state.status === 'error') {
    return (
      <div className="mermaid-error" role="alert">
        <strong>Mermaid error</strong>
        <pre>{state.message}</pre>
        <details>
          <summary>Show diagram source</summary>
          <pre>{source}</pre>
        </details>
      </div>
    );
  }
  return <MermaidViewport svg={state.svg} width={state.width} capture={capture} />;
}
