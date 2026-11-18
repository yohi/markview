import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { EditorView } from '@codemirror/view';
import MarkdownEditor from './components/MarkdownEditor';
import MarkdownPreview from './components/MarkdownPreview';
import SplitLayout from './components/SplitLayout';
import ExportMenu from './components/ExportMenu';
import ImportButton from './components/ImportButton';
import OutlinePanel from './components/OutlinePanel';
import { readMarkdownFile } from './lib/file-import';
import { extractHeadings } from './lib/outline';
import { attachScrollSync } from './lib/scroll-sync';
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
  const [importing, setImporting] = useState(false);
  const importBusyRef = useRef(false);
  const markdownRef = useRef(markdown);
  markdownRef.current = markdown;
  const [dropActive, setDropActive] = useState(false);
  const dropDepth = useRef(0);
  const [showOutline, setShowOutline] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 760px)').matches,
  );
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null);
  const headings = useMemo(() => (showOutline ? extractHeadings(markdown) : []), [markdown, showOutline]);

  useEffect(() => {
    if (!syncEnabled || mode !== 'split' || !editorView || !previewElement) return;
    return attachScrollSync(editorView, previewElement);
  }, [syncEnabled, mode, editorView, previewElement]);

  const importMarkdown = async (file: File) => {
    if (importBusyRef.current) return;
    importBusyRef.current = true;
    setImporting(true);
    const previous = markdownRef.current;
    try {
      const contents = await readMarkdownFile(file);
      if (markdownRef.current !== previous) {
        setNotice('Editor changed while reading. Import cancelled.');
        return;
      }
      if (previous && contents !== previous &&
          !window.confirm('Replace the current Markdown with ' + file.name + '? This cannot be undone after leaving the page.')) {
        setNotice('Import cancelled');
        return;
      }
      if (markdownRef.current !== previous) {
        setNotice('Editor changed. Import cancelled.');
        return;
      }
      markdownRef.current = contents;
      setMarkdown(contents);
      setNotice('Imported ' + file.name);
    } catch (error) {
      setNotice(error instanceof Error ? 'Import failed: ' + error.message : 'Import failed.');
    } finally {
      importBusyRef.current = false;
      setImporting(false);
    }
  };

  const onFileDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dropDepth.current++;
    setDropActive(true);
  };
  const onFileDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  };
  const onFileDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    dropDepth.current = Math.max(0, dropDepth.current - 1);
    if (dropDepth.current === 0) setDropActive(false);
  };
  const onFileDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dropDepth.current = 0;
    setDropActive(false);
    if (event.dataTransfer.files.length !== 1) {
      setNotice('Drop exactly one Markdown file.');
      return;
    }
    void importMarkdown(event.dataTransfer.files[0]);
  };

  const jumpToHeading = (offset: number) => {
    const anchor = previewElement?.querySelector<HTMLElement>('[data-heading-offset="' + offset + '"]');
    if (anchor && previewElement) {
      previewElement.scrollTop += anchor.getBoundingClientRect().top - previewElement.getBoundingClientRect().top - 24;
    }
    if (editorView) {
      editorView.dispatch({
        effects: EditorView.scrollIntoView(Math.min(offset, editorView.state.doc.length), { y: 'start', yMargin: 24 }),
      });
    }
  };

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

  const editor = <MarkdownEditor value={markdown} onChange={setMarkdown} theme={theme} onReady={setEditorView} />;
  const preview = <MarkdownPreview markdown={markdown} theme={theme} onToggleTask={toggleTask} onScrollElement={setPreviewElement} />;

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
              <button type="button" className="button subtle-button" aria-expanded={showOutline}
                aria-controls="markview-outline" onClick={() => setShowOutline((value) => !value)}>
                Outline
              </button>
              {mode === 'split' && (
                <button type="button" className="button subtle-button"
                  aria-pressed={syncEnabled} title="Synchronize editor and preview scrolling"
                  onClick={() => setSyncEnabled((value) => !value)}>
                  {syncEnabled ? 'Sync On' : 'Sync Off'}
                </button>
              )}
              <ImportButton disabled={importing} onFile={(file) => { void importMarkdown(file); }} />
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

          <div className={"workspace-frame" + (dropActive ? " is-file-over" : "")}
            onDragEnter={onFileDragEnter} onDragOver={onFileDragOver}
            onDragLeave={onFileDragLeave} onDrop={onFileDrop}>
            {mode === 'split' ? (
              <SplitLayout editor={editor} preview={preview} />
            ) : mode === 'editor' ? (
              <section className="workspace-pane single-pane" aria-label="Editor pane"><div className="pane-heading"><span className="pane-dot" />EDITOR <span className="pane-hint">Markdown</span></div>{editor}</section>
            ) : (
              <section className="workspace-pane single-pane" aria-label="Preview pane"><div className="pane-heading"><span className="pane-dot preview-dot" />PREVIEW <span className="pane-hint">GitHub flavored</span></div>{preview}</section>
            )}
            {showOutline && (
              <div id="markview-outline">
                <OutlinePanel headings={headings} onSelect={jumpToHeading} onClose={() => setShowOutline(false)} />
              </div>
            )}
            {dropActive && <div className="import-drop-overlay" aria-hidden="true">Drop a .md or .markdown file to import</div>}
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
