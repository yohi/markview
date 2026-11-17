import { useCallback, useEffect, useRef, useState } from 'react';
import MarkdownEditor from './components/MarkdownEditor';
import MarkdownPreview from './components/MarkdownPreview';
import SplitLayout from './components/SplitLayout';
import ExportMenu from './components/ExportMenu';
import { capturePreviewImage, downloadImage, imageExportFilename } from './lib/image-export';
import { setTaskChecked } from './lib/task-checkbox';
import type { ColorTheme, ViewMode } from './lib/markdown';

type ImageFormat = 'png' | 'jpeg';
type ImageCapture = { markdown: string; theme: ColorTheme };

function getSystemTheme(): ColorTheme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [markdown, setMarkdown] = useState('');
  const [mode, setMode] = useState<ViewMode>('split');
  const [theme, setTheme] = useState<ColorTheme>(getSystemTheme);
  const [notice, setNotice] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const exportingRef = useRef(false);
  const [capture, setCapture] = useState<ImageCapture | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    // Escape/browser controls can leave fullscreen without clicking our button.
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    try {
      if (document.fullscreenElement === workspace) {
        await document.exitFullscreen();
      } else if (document.fullscreenElement) {
        setNotice('Exit the current fullscreen view before entering MarkView fullscreen.');
      } else if (typeof workspace.requestFullscreen === 'function') {
        await workspace.requestFullscreen();
      } else {
        setNotice('Fullscreen is not supported in this browser.');
      }
    } catch {
      setNotice('Could not change fullscreen mode.');
    }
  };

  const toggleTask = useCallback((itemOffset: number, checked: boolean, previewSource: string) => {
    setMarkdown((current) => {
      // Position offsets belong to the displayed source version, not arbitrary later edits.
      if (current !== previewSource) return current;
      return setTaskChecked(current, itemOffset, checked);
    });
  }, []);

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


  const exportImage = (format: ImageFormat, action: 'copy' | 'save') => {
    if (exportingRef.current || !markdown.trim()) return;
    // Clipboard.write must be invoked in this click handler; PNG creation can
    // finish asynchronously through a promised ClipboardItem.
    if (action === 'copy' && (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')) {
      setNotice('Image clipboard is unavailable. Use Save PNG instead.');
      return;
    }
    exportingRef.current = true;
    setExporting(true);
    setCapture({ markdown, theme });

    const makeImage = async (): Promise<Blob> => {
      // Wait for React to mount the temporary, full-height preview.
      for (let frame = 0; frame < 20; frame++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (captureRef.current) return capturePreviewImage(captureRef.current, format, theme);
      }
      throw new Error('Could not prepare the image preview.');
    };
    const imagePromise = makeImage();
    const finish = (message: string) => {
      exportingRef.current = false;
      setExporting(false);
      setCapture(null);
      setNotice(message);
    };
    const fail = (error: unknown) => {
      finish(error instanceof Error ? 'Export failed: ' + error.message : 'Image export failed.');
    };

    if (action === 'copy') {
      try {
        const item = new ClipboardItem({ 'image/png': imagePromise });
        void navigator.clipboard.write([item]).then(
          () => finish('Preview PNG copied'),
          fail,
        );
      } catch (error) {
        void imagePromise.catch(() => undefined);
        fail(error);
      }
    } else {
      void imagePromise.then((blob) => {
        downloadImage(blob, imageExportFilename(format));
        finish(format === 'png' ? 'PNG saved' : 'JPG saved');
      }).catch(fail);
    }
  };

  const editor = <MarkdownEditor value={markdown} onChange={setMarkdown} theme={theme} />;
  const preview = <MarkdownPreview markdown={markdown} theme={theme} onToggleTask={toggleTask} />;

  return (
    <div className="app" data-theme={theme} data-maximized={isMaximized ? 'true' : undefined}>
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

        <div className="workspace-shell" ref={workspaceRef}>
          <div className="toolbar">
            <div className="mode-switch" role="group" aria-label="View mode">
              {(['editor', 'split', 'preview'] as const).map((item) => (
                <button key={item} type="button" aria-pressed={mode === item} className={mode === item ? 'mode-button active' : 'mode-button'} onClick={() => setMode(item)}>
                  {item === 'editor' ? '✎ Editor' : item === 'split' ? '◫ Split' : '▤ Preview'}
                </button>
              ))}
            </div>
            <div className="toolbar-actions">
              <button
                type="button"
                className="button subtle-button maximize-button"
                onClick={() => setIsMaximized((value) => !value)}
                aria-label={isMaximized ? 'Restore workspace size' : 'Maximize workspace in browser window'}
                aria-pressed={isMaximized}
                title={isMaximized ? 'Restore workspace size' : 'Fill browser window (keep tabs visible)'}
              >
                <span aria-hidden="true">{isMaximized ? '▢' : '▣'}</span>
                <span>{isMaximized ? 'Restore' : 'Maximize'}</span>
              </button>
              <button
                type="button"
                className="button subtle-button fullscreen-button"
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                aria-pressed={isFullscreen}
                title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
              >
                <span aria-hidden="true">{isFullscreen ? '⤢' : '⛶'}</span>
                <span>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
              </button>
              <ExportMenu
                busy={exporting}
                disabled={!markdown.trim()}
                canCopy={typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write)}
                onCopyPng={() => exportImage('png', 'copy')}
                onSavePng={() => exportImage('png', 'save')}
                onSaveJpg={() => exportImage('jpeg', 'save')}
              />
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
          {capture && (
            <div className="export-capture-host" aria-hidden="true">
              <div className="export-capture-surface" ref={captureRef}>
                <MarkdownPreview markdown={capture.markdown} theme={capture.theme} onToggleTask={() => undefined} />
              </div>
            </div>
          )}
          <footer className="app-footer"><span>Markdown stays in this tab's memory.</span><span>{markdown.length.toLocaleString()} characters <span className="footer-separator">·</span> {markdown ? markdown.trim().split(/\s+/).length.toLocaleString() : 0} words</span></footer>
        </div>
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
