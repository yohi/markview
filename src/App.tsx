import { useDeferredValue, useEffect, useState } from 'react';
import MarkdownEditor from './components/MarkdownEditor';
import MarkdownPreview from './components/MarkdownPreview';
import SplitLayout from './components/SplitLayout';
import type { ColorTheme, ViewMode } from './lib/markdown';

function getSystemTheme(): ColorTheme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [markdown, setMarkdown] = useState('');
  const [mode, setMode] = useState<ViewMode>('split');
  const [theme, setTheme] = useState<ColorTheme>(getSystemTheme);
  const [notice, setNotice] = useState('');
  const deferredMarkdown = useDeferredValue(markdown);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const copyRaw = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setNotice('Raw Markdown copied');
    } catch {
      setNotice('Copy failed. Please select and copy the editor text.');
    }
  };

  const clearMarkdown = () => {
    if (markdown && !window.confirm('Clear all Markdown? This cannot be undone after leaving the page.')) return;
    setMarkdown('');
    setNotice('Editor cleared');
  };

  const editor = <MarkdownEditor value={markdown} onChange={setMarkdown} theme={theme} />;
  const preview = <MarkdownPreview markdown={deferredMarkdown} theme={theme} />;

  return (
    <div className="app" data-theme={theme}>
      <header className="app-header">
        <div className="brand" aria-label="MarkView home">
          <div className="brand-symbol">M<span>↗</span></div>
          <div><div className="brand-title">MarkView</div><div className="brand-subtitle">MARKDOWN WORKSPACE</div></div>
        </div>
        <div className="header-actions">
          <span className="ephemeral-note"><span className="status-indicator" /> No saving · Browser only</span>
          <button type="button" className="icon-button theme-button" title="Toggle theme" aria-label="Toggle theme" onClick={() => setTheme((prev) => prev === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="workspace-topline">
          <div><div className="eyebrow">YOUR WORKSPACE</div><h1>Markdown, beautifully rendered.</h1><p>Write, preview, and copy. Nothing is stored.</p></div>
          <div className="topline-tag">GFM <span>+</span> MERMAID</div>
        </div>

        <div className="toolbar">
          <div className="mode-switch" role="group" aria-label="View mode">
            {(['editor', 'split', 'preview'] as const).map((item) => (
              <button key={item} type="button" aria-pressed={mode === item} className={mode === item ? 'mode-button active' : 'mode-button'} onClick={() => setMode(item)}>
                {item === 'editor' ? '✎ Editor' : item === 'split' ? '◫ Split' : '▤ Preview'}
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <button type="button" className="button subtle-button" onClick={clearMarkdown} disabled={!markdown}>Clear</button>
            <button type="button" className="button primary-button" onClick={() => void copyRaw()} title="Copy original Markdown as plain text">⧉ <span>Copy Raw</span></button>
          </div>
        </div>

        <div className="workspace-frame">
          {mode === 'split' ? (
            <SplitLayout editor={editor} preview={preview} />
          ) : mode === 'editor' ? (
            <section className="workspace-pane single-pane" aria-label="Editor pane"><div className="pane-heading"><span className="pane-dot" />EDITOR <span className="pane-hint">Markdown</span></div>{editor}</section>
          ) : (
            <section className="workspace-pane single-pane" aria-label="Preview pane"><div className="pane-heading"><span className="pane-dot preview-dot" />PREVIEW <span className="pane-hint">GitHub flavored</span></div>{preview}</section>
          )}
        </div>
        <footer className="app-footer"><span>Markdown stays in this tab's memory.</span><span>{markdown.length.toLocaleString()} characters <span className="footer-separator">·</span> {markdown ? markdown.trim().split(/\s+/).length.toLocaleString() : 0} words</span></footer>
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
