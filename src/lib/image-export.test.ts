import { describe, expect, it } from 'vitest';
import { assertImageSize, imageExportFilename } from './image-export';

describe('imageExportFilename', () => {
  const at = new Date(2026, 10, 17, 13, 8, 9);
  it('formats PNG filenames', () => {
    expect(imageExportFilename('png', at)).toBe('markview-20261117-130809.png');
  });
  it('uses jpg extension for JPEG', () => {
    expect(imageExportFilename('jpeg', at)).toBe('markview-20261117-130809.jpg');
  });
});

describe('assertImageSize', () => {
  it('accepts a regular full-length preview', () => {
    expect(() => assertImageSize(960, 7000)).not.toThrow();
  });
  it('rejects enormous previews rather than returning cropped images', () => {
    expect(() => assertImageSize(960, 9000)).toThrow(/too large/);
    expect(() => assertImageSize(10000, 200)).toThrow(/too large/);
  });
  it('rejects missing dimensions', () => {
    expect(() => assertImageSize(0, 100)).toThrow(/drawable/);
  });
});
