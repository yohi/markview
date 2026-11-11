import { useEffect, useId, useRef, useState } from 'react';
import type { ColorTheme } from '../lib/markdown';

type RenderState =
  | { status: 'loading' }
  | { status: 'success'; svg: string }
  | { status: 'error'; message: string };

let renderQueue: Promise<unknown> = Promise.resolve();

function renderSafely(source: string, theme: ColorTheme, id: string): Promise<string> {
  const job = renderQueue.then(async () => {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
    });
    await mermaid.parse(source);
    const { svg } = await mermaid.render(id, source);
    return svg;
  });
  renderQueue = job.then(() => undefined, () => undefined);
  return job;
}

interface Props {
  source: string;
  theme: ColorTheme;
}

export default function MermaidDiagram({ source, theme }: Props) {
  const stableId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sequence = useRef(0);
  const [state, setState] = useState<RenderState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const timeout = window.setTimeout(() => {
      const id = 'markview-mermaid-' + stableId + '-' + (++sequence.current);
      void renderSafely(source, theme, id).then(
        (svg) => {
          if (!cancelled) setState({ status: 'success', svg });
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
  }, [source, theme, stableId]);

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
  // Mermaid renders sanitized SVG with securityLevel: strict (no interactive links or HTML).
  return <div className="mermaid-diagram" role="img" aria-label="Mermaid diagram" dangerouslySetInnerHTML={{ __html: state.svg }} />;
}
