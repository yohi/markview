import { useEffect, useMemo } from 'react';
import type { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import type { ColorTheme } from '../lib/markdown';

interface Props {
  value: string;
  onChange: (value: string) => void;
  theme: ColorTheme;
  onReady: (view: EditorView | null) => void;
}

export default function MarkdownEditor({ value, onChange, theme, onReady }: Props) {
  const extensions = useMemo(() => [markdown()], []);
  useEffect(() => () => onReady(null), [onReady]);

  return (
    <div className="editor-shell" aria-label="Markdown editor">
      <CodeMirror
        value={value}
        onChange={onChange}
        onCreateEditor={onReady}
        extensions={extensions}
        theme={theme}
        height="100%"
        basicSetup={{ lineNumbers: true, foldGutter: true }}
        placeholder="Paste Markdown here…"
      />
    </div>
  );
}
