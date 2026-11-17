import { useRef } from 'react';

interface Props {
  disabled: boolean;
  busy: boolean;
  canCopy: boolean;
  onCopyPng: () => void;
  onSavePng: () => void;
  onSaveJpg: () => void;
}

export default function ExportMenu({ disabled, busy, canCopy, onCopyPng, onSavePng, onSaveJpg }: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  const choose = (action: () => void) => {
    details.current?.removeAttribute('open');
    action();
  };

  return (
    <details className="export-menu" ref={details}>
      <summary className="button subtle-button" aria-label="Export preview as image">
        {busy ? 'Exporting…' : 'Export ▾'}
      </summary>
      <div className="export-options" aria-label="Image export options">
        <button type="button" disabled={disabled || busy || !canCopy}
          title={canCopy ? 'Copy the full preview as PNG' : 'Use Save PNG: image clipboard is unavailable'}
          onClick={() => choose(onCopyPng)}>Copy PNG</button>
        <button type="button" disabled={disabled || busy} onClick={() => choose(onSavePng)}>Save PNG</button>
        <button type="button" disabled={disabled || busy} onClick={() => choose(onSaveJpg)}>Save JPG</button>
      </div>
    </details>
  );
}
