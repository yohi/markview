import { toCanvas } from 'html-to-image';
import type { ColorTheme } from './markdown';

export type ImageFormat = 'png' | 'jpeg';

const SCALE = 2;
const MIN_SCALE = 0.5;
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
  const pixelsWide = Math.floor(width * scale);
  const pixelsHigh = Math.floor(height * scale);
  if (!Number.isFinite(scale) || scale <= 0 || pixelsWide < 1 || pixelsHigh < 1 ||
      pixelsWide > MAX_DIMENSION || pixelsHigh > MAX_DIMENSION ||
      pixelsWide * pixelsHigh > MAX_PIXELS) {
    throw new Error('Preview is too large to export at this resolution.');
  }
}

/**
 * Fit the *entire* document into one canvas. Never crop or silently truncate.
 * Retry at lower resolutions if the browser cannot allocate the preferred canvas.
 */
export function imageExportScales(width: number, height: number): number[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Preview has no drawable area.');
  }
  const preferred = Math.min(
    SCALE,
    MAX_DIMENSION / width,
    MAX_DIMENSION / height,
    Math.sqrt(MAX_PIXELS / (width * height)),
  );
  if (!Number.isFinite(preferred) || preferred < MIN_SCALE) {
    throw new Error('Preview is too large for one readable image even at reduced resolution. Nothing was cropped or saved.');
  }
  const options = [preferred, Math.min(preferred, 1), MIN_SCALE];
  return options.filter((scale, index) => {
    if (scale < MIN_SCALE || options.indexOf(scale) !== index) return false;
    assertImageSize(width, height, scale);
    return true;
  });
}

/** Reject canvases whose dimensions were altered by the rendering library or browser. */
export function assertCanvasSize(
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>, width: number, height: number, scale: number,
): void {
  assertImageSize(width, height, scale);
  if (canvas.width !== Math.floor(width * scale) || canvas.height !== Math.floor(height * scale)) {
    throw new Error('Browser changed the exported image dimensions. Export cancelled rather than returning a cropped image.');
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
  const scales = imageExportScales(width, height);
  const backgroundColor = theme === 'dark' ? '#151c28' : '#ffffff';
  const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  let lastError: unknown;

  for (const scale of scales) {
    let imageLoadError = false;
    let canvas: HTMLCanvasElement | undefined;
    try {
      canvas = await toCanvas(surface, {
        width,
        height,
        pixelRatio: scale,
        backgroundColor,
        skipAutoScale: true,
        onImageErrorHandler: () => { imageLoadError = true; },
      });
      if (imageLoadError) {
        throw new Error('An external preview image could not be embedded (CORS or network error).');
      }
      assertCanvasSize(canvas, width, height, scale);
      return await new Promise<Blob>((resolve, reject) => {
        canvas!.toBlob((blob) => {
          if (!blob || blob.type !== type) {
            reject(new Error('Browser could not encode the requested image format.'));
          } else {
            resolve(blob);
          }
        }, type, format === 'jpeg' ? 0.92 : undefined);
      });
    } catch (error) {
      // Lowering resolution cannot fix a missing external image.
      if (imageLoadError) {
        throw new Error('An external preview image could not be embedded (CORS or network error).');
      }
      lastError = error;
    } finally {
      // Release the large backing store before the next attempt (or after encoding).
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }

  const detail = lastError instanceof Error ? ' ' + lastError.message : '';
  throw new Error('Browser could not export the full preview as one readable image. Nothing was cropped or saved.' + detail);
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
