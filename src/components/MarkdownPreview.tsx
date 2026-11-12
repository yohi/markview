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
}

// remark-gfm generates disabled inputs without source offsets.
// Their parent list-item carries the original Markdown position.
const TaskItemOffset = createContext<number | null>(null);

export default function MarkdownPreview({ markdown, theme, onToggleTask }: Props) {
  const sourceRef = useRef(markdown);
  sourceRef.current = markdown;

  const components = useMemo<Components>(() => ({
    a({ children, ...props }) {
      return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    li({ node, children, ...props }) {
      const offset = node?.position?.start.offset;
      return (
        <TaskItemOffset.Provider value={typeof offset === 'number' ? offset : null}>
          <li {...props}>{children}</li>
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
    pre({ children, ...props }) {
      if (isValidElement(children) && children.type === MermaidDiagram) {
        return children;
      }
      return <pre {...props}>{children}</pre>;
    },
  }), [theme, onToggleTask]);

  return (
    <div className="preview-body markdown-body">
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
