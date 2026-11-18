import { createContext, isValidElement, useContext, useMemo, useRef } from 'react';
import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import MermaidDiagram from './MermaidDiagram';
import { cleanCodeBlock, isMermaidCode } from '../lib/markdown';
import type { ColorTheme } from '../lib/markdown';

interface Props {
  markdown: string;
  theme: ColorTheme;
  onToggleTask: (itemOffset: number, checked: boolean, source: string) => void;
  onScrollElement?: (element: HTMLDivElement | null) => void;
}

// remark-gfm generates disabled inputs without source offsets.
// Their parent list-item carries the original Markdown position.
const TaskItemOffset = createContext<number | null>(null);

function sourceOffset(node: { position?: { start?: { offset?: number } } } | null | undefined): number | undefined {
  return node?.position?.start?.offset;
}

export default function MarkdownPreview({ markdown, theme, onToggleTask, onScrollElement }: Props) {
  const sourceRef = useRef(markdown);
  sourceRef.current = markdown;

  const components = useMemo<Components>(() => ({
    a({ children, ...props }) {
      return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    h1({ node, children, ...props }) { const offset = sourceOffset(node); return <h1 {...props} data-source-offset={offset} data-heading-offset={offset}>{children}</h1>; },
    h2({ node, children, ...props }) { const offset = sourceOffset(node); return <h2 {...props} data-source-offset={offset} data-heading-offset={offset}>{children}</h2>; },
    h3({ node, children, ...props }) { const offset = sourceOffset(node); return <h3 {...props} data-source-offset={offset} data-heading-offset={offset}>{children}</h3>; },
    h4({ node, children, ...props }) { const offset = sourceOffset(node); return <h4 {...props} data-source-offset={offset} data-heading-offset={offset}>{children}</h4>; },
    h5({ node, children, ...props }) { const offset = sourceOffset(node); return <h5 {...props} data-source-offset={offset} data-heading-offset={offset}>{children}</h5>; },
    h6({ node, children, ...props }) { const offset = sourceOffset(node); return <h6 {...props} data-source-offset={offset} data-heading-offset={offset}>{children}</h6>; },
    p({ node, children, ...props }) { return <p {...props} data-source-offset={sourceOffset(node)}>{children}</p>; },
    blockquote({ node, children, ...props }) { return <blockquote {...props} data-source-offset={sourceOffset(node)}>{children}</blockquote>; },
    ul({ node, children, ...props }) { return <ul {...props} data-source-offset={sourceOffset(node)}>{children}</ul>; },
    ol({ node, children, ...props }) { return <ol {...props} data-source-offset={sourceOffset(node)}>{children}</ol>; },
    table({ node, children, ...props }) { return <table {...props} data-source-offset={sourceOffset(node)}>{children}</table>; },
    hr({ node, ...props }) { return <hr {...props} data-source-offset={sourceOffset(node)} />; },
    li({ node, children, ...props }) {
      const offset = node?.position?.start.offset;
      return (
        <TaskItemOffset.Provider value={typeof offset === 'number' ? offset : null}>
          <li {...props} data-source-offset={offset}>{children}</li>
        </TaskItemOffset.Provider>
      );
    },
    input({ type, checked, disabled, ...props }) {
      const itemOffset = useContext(TaskItemOffset);
      if (type !== 'checkbox') {
        return <input {...props} type={type} checked={checked} disabled={disabled} />;
      }
      return (
        <input
          {...props}
          type="checkbox"
          checked={Boolean(checked)}
          disabled={itemOffset === null}
          aria-label="Toggle Markdown task"
          onChange={(event) => {
            if (itemOffset !== null) {
              onToggleTask(itemOffset, event.currentTarget.checked, sourceRef.current);
            }
          }}
        />
      );
    },
    code({ className, children, ...props }) {
      if (isMermaidCode(className)) {
        return <MermaidDiagram source={cleanCodeBlock(String(children))} theme={theme} />;
      }
      return <code className={className} {...props}>{children}</code>;
    },
    pre({ node, children, ...props }) {
      if (isValidElement(children) && children.type === MermaidDiagram) {
        return <div data-source-offset={sourceOffset(node)}>{children}</div>;
      }
      return <pre {...props} data-source-offset={sourceOffset(node)}>{children}</pre>;
    },
  }), [theme, onToggleTask]);

  return (
    <div className="preview-body markdown-body" ref={onScrollElement}>
      {markdown.trim() ? (
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
          {markdown}
        </Markdown>
      ) : (
        <div className="empty-preview">Your Markdown preview will appear here.</div>
      )}
    </div>
  );
}
