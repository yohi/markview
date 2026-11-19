import { describe, expect, it } from 'vitest';
import { assertCanvasSize, assertImageSize, imageExportFilename, imageExportScales, pngCaptureWindow } from './image-export';

describe('imageExportFilename', () => {
  const at = new Date(2026, 10, 17, 13, 8, 9);
  it('formats PNG filenames', () => {
    expect(imageExportFilename('png', at)).toBe('markview-20261117-130809.png');
  });
  it('uses jpg extension for JPEG', () => {
    expect(imageExportFilename('jpeg', at)).toBe('markview-20261117-130809.jpg');
  });
});

describe('adaptive full-document export', () => {
  it('retains 2x resolution when the whole document fits', () => {
    expect(imageExportScales(960, 7000)).toEqual([2, 1, 0.5]);
  });
  it('automatically scales a tall preview instead of refusing or cropping it', () => {
    const scales = imageExportScales(960, 9000);
    expect(scales[0]).toBeCloseTo(16384 / 9000, 8);
    expect(scales).toContain(1);
    expect(() => assertImageSize(960, 9000, scales[0])).not.toThrow();
    expect(Math.floor(9000 * scales[0])).toBe(16384);
  });
  it('honors total canvas pixel limits as well as width and height', () => {
    const scale = imageExportScales(8000, 8000)[0];
    expect(scale).toBeLessThan(1);
    expect(Math.floor(8000 * scale) ** 2).toBeLessThanOrEqual(40_000_000);
  });
  it('handles wide previews by choosing a smaller scale', () => {
    const scale = imageExportScales(10000, 200)[0];
    expect(scale).toBeCloseTo(16384 / 10000, 8);
    expect(() => assertImageSize(10000, 200, scale)).not.toThrow();
  });
  it('refuses unreadably small images instead of producing incomplete output', () => {
    expect(() => imageExportScales(960, 40000)).toThrow(/too large/);
    expect(() => imageExportScales(100000, 200)).toThrow(/too large/);
  });
  it('rejects missing dimensions', () => {
    expect(() => imageExportScales(0, 100)).toThrow(/drawable/);
    expect(() => imageExportScales(Infinity, 10)).toThrow(/drawable/);
  });
  it('detects unexpected browser canvas resizing instead of saving it', () => {
    expect(() => assertCanvasSize({ width: 960, height: 9000 }, 960, 9000, 1)).not.toThrow();
    expect(() => assertCanvasSize({ width: 960, height: 3000 }, 960, 9000, 1)).toThrow(/dimensions/);
    expect(() => assertCanvasSize({ width: 0, height: 0 }, 960, 9000, 1)).toThrow(/dimensions/);
  });
});

describe('full-resolution PNG capture windows', () => {
  it('captures the first tile at the native 2x scale with lower overlap', () => {
    expect(pngCaptureWindow(0, 1536, 9000)).toEqual({
      top: 0, height: 784, cropTop: 0,
    });
  });

  it('includes both overlap margins and crops them before PNG encoding', () => {
    expect(pngCaptureWindow(1536, 1536, 9000)).toEqual({
      top: 752, height: 800, cropTop: 32,
    });
  });

  it('includes the final rows without extending beyond the document', () => {
    expect(pngCaptureWindow(17900, 100, 9000)).toEqual({
      top: 8934, height: 66, cropTop: 32,
    });
  });
});
