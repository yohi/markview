import { toCanvas } from 'html-to-image';
import type { ColorTheme } from './markdown';

export type ImageFormat = 'png' | 'jpeg';

const SCALE = 2;
const MAX_DIMENSION = 16384;
const MAX_PIXELS = 40_000_000;
const READY_TIMEOUT_MS = 10_000;

export function imageExportFilename(format: ImageFormat, now = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const timestamp = [
    now.getFullYear(),
    two(now.getMonth() + 1),
    two(now.getDate()),
  ].join('') + '-' + [two(now.getHours()), two(now.getMinutes()), two(now.getSeconds())].join('');
  return 'markview-' + timestamp + '.' + (format === 'jpeg' ? 'jpg' : 'png');
}

export function assertImageSize(width: number, height: number, scale = SCALE): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Preview has no drawable area.');
  }
  if (width * scale > MAX_DIMENSION || height * scale > MAX_DIMENSION ||
      width * height * scale * scale > MAX_PIXELS) {
    throw new Error('Preview is too large to export as one image. Shorten the document.');
  }
}

async function waitForPreview(root: HTMLElement): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (true) {
    if (!root.isConnected) throw new Error('Preview was removed during export.');
    if (root.querySelector('.mermaid-error')) {
      throw new Error('Fix the Mermaid rendering error before exporting.');
    }
    if (!root.querySelector('.mermaid-status')) break;
    if (Date.now() >= deadline) throw new Error('Timed out waiting for Mermaid rendering.');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const images = Array.from(root.querySelectorAll('img'));
  const ready = Promise.all(images.map(async (image) => {
    if (typeof image.decode === 'function') {
      await image.decode();
    } else if (!image.complete || image.naturalWidth === 0) {
      throw new Error('An image in the preview could not be loaded.');
    }
    if (image.naturalWidth === 0) throw new Error('An image in the preview could not be loaded.');
  }));
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => reject(new Error('Timed out waiting for preview images.')), READY_TIMEOUT_MS);
    void ready.finally(() => clearTimeout(id)).catch(() => undefined);
  });
  await Promise.race([ready, timeout]);
  if (document.fonts) await document.fonts.ready;
}

export async function capturePreviewImage(
  surface: HTMLElement, format: ImageFormat, theme: ColorTheme,
): Promise<Blob> {
  await waitForPreview(surface);
  const width = Math.ceil(surface.scrollWidth);
  const height = Math.ceil(surface.scrollHeight);
  assertImageSize(width, height);

  let imageLoadError = false;
  const backgroundColor = theme === 'dark' ? '#151c28' : '#ffffff';
  const canvas = await toCanvas(surface, {
    width,
    height,
    pixelRatio: SCALE,
    backgroundColor,
    skipAutoScale: true,
    onImageErrorHandler: () => { imageLoadError = true; },
  });
  if (imageLoadError) throw new Error('An external preview image could not be embedded (CORS or network error).');

  const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== type) {
        reject(new Error('Browser could not encode the requested image format.'));
      } else {
        resolve(blob);
      }
    }, type, format === 'jpeg' ? 0.92 : undefined);
  });
}

export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Some browsers use the object URL after the synthetic click returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
