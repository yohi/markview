import { useRef } from 'react';

interface Props {
  disabled: boolean;
  onFile: (file: File) => void;
}

export default function ImportButton({ disabled, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        className="visually-hidden-file"
        type="file"
        accept=".md,.markdown,text/markdown"
        tabIndex={-1}
        aria-label="Choose Markdown file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) onFile(file);
        }}
      />
      <button type="button" className="button subtle-button" disabled={disabled}
        onClick={() => input.current?.click()} title="Open a local Markdown file">
        Open .md
      </button>
    </>
  );
}
