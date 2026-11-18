import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

export interface OutlineHeading {
  offset: number;
  line: number;
  level: number;
  text: string;
}

interface MarkdownNode {
  type?: string;
  depth?: number;
  value?: string;
  alt?: string;
  children?: MarkdownNode[];
  position?: { start?: { offset?: number; line?: number } };
}

function inlineText(node: MarkdownNode): string {
  if (typeof node.value === 'string') return node.value;
  if (typeof node.alt === 'string') return node.alt;
  return (node.children ?? []).map(inlineText).join('');
}

export function extractHeadings(markdown: string): OutlineHeading[] {
  if (!markdown.trim()) return [];
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MarkdownNode;
  const headings: OutlineHeading[] = [];

  const walk = (node: MarkdownNode): void => {
    if (node.type === 'heading' && typeof node.position?.start?.offset === 'number') {
      headings.push({
        offset: node.position.start.offset,
        line: node.position.start.line ?? 1,
        level: node.depth ?? 1,
        text: inlineText(node).trim() || '(untitled heading)',
      });
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return headings;
}
