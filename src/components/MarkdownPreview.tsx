import { isValidElement, useMemo } from 'react';
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
}

export default function MarkdownPreview({ markdown, theme }: Props) {
  const components = useMemo<Components>(() => ({
    a({ children, ...props }) {
      return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
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
  }), [theme]);

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
