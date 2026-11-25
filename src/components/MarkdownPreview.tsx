import { createContext, isValidElement, useContext, useMemo, useRef } from 'react';
import type { ComponentProps } from 'react';
import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import MermaidDiagram from './MermaidDiagram';
import { cleanCodeBlock, isMermaidCode } from '../lib/markdown';
import type { ColorTheme } from '../lib/markdown';
import type { MermaidMode } from '../lib/mermaid-config';

interface Props {
  markdown: string;
  theme: ColorTheme;
  mermaidMode: MermaidMode;
  capture?: boolean;
  onToggleTask: (itemOffset: number, checked: boolean, source: string) => void;
  onScrollElement?: (element: HTMLDivElement | null) => void;
}

// remark-gfm generates disabled inputs without source offsets.
// Their parent list-item carries the original Markdown position.
const TaskItemOffset = createContext<number | null>(null);

function sourceOffset(node: { position?: { start?: { offset?: number } } } | null | undefined): number | undefined {
  return node?.position?.start?.offset;
}

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
type HeadingProps = ComponentProps<'h1'> & {
  node?: { position?: { start?: { offset?: number } } };
};

function headingRenderer(Tag: HeadingTag) {
  return ({ node, children, ...props }: HeadingProps) => {
    const offset = sourceOffset(node);
    return <Tag {...props} data-source-offset={offset} data-heading-offset={offset}>{children}</Tag>;
  };
}

// Keep heading component types stable across theme and task-handler updates.
const headingComponents = {
  h1: headingRenderer('h1'),
  h2: headingRenderer('h2'),
  h3: headingRenderer('h3'),
  h4: headingRenderer('h4'),
  h5: headingRenderer('h5'),
  h6: headingRenderer('h6'),
};

export default function MarkdownPreview({ markdown, theme, mermaidMode, capture = false, onToggleTask, onScrollElement }: Props) {
  const sourceRef = useRef(markdown);
  sourceRef.current = markdown;

  const components = useMemo<Components>(() => ({
    a({ children, ...props }) {
      return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    ...headingComponents,
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
        return <MermaidDiagram source={cleanCodeBlock(String(children))} theme={theme} mode={mermaidMode} capture={capture} />;
      }
      return <code className={className} {...props}>{children}</code>;
    },
    pre({ node, children, ...props }) {
      if (isValidElement(children) && children.type === MermaidDiagram) {
        return <div data-source-offset={sourceOffset(node)}>{children}</div>;
      }
      return <pre {...props} data-source-offset={sourceOffset(node)}>{children}</pre>;
    },
  }), [theme, mermaidMode, capture, onToggleTask]);

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
