import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import type { ColorTheme } from '../lib/markdown';

interface Props {
  value: string;
  onChange: (value: string) => void;
  theme: ColorTheme;
}

export default function MarkdownEditor({ value, onChange, theme }: Props) {
  const extensions = useMemo(() => [markdown()], []);

  return (
    <div className="editor-shell" aria-label="Markdown editor">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={theme}
        height="100%"
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        placeholder="Paste Markdown here…"
      />
    </div>
  );
}
