import { describe, expect, it } from 'vitest';
import { encodePngTiles } from './png-encoder';

describe('encodePngTiles', () => {
  it('joins every row into one lossless PNG, including the final partial tile', async () => {
    const calls: Array<[number, number]> = [];
    const blob = await encodePngTiles(3, 7, 2, async (top, rows) => {
      calls.push([top, rows]);
      const rgba = new Uint8Array(3 * rows * 4);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < 3; x++) {
          rgba.set([top + y, x, (top + y) * 17 + x, 255], (y * 3 + x) * 4);
        }
      }
      return { width: 3, height: rows, rgba };
    });

    expect(blob.type).toBe('image/png');
    expect(calls).toEqual([[0, 2], [2, 2], [4, 2], [6, 1]]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(16)).toBe(3);
    expect(view.getUint32(20)).toBe(7);

    let offset = 8;
    const compressed: Uint8Array[] = [];
    const types: string[] = [];
    while (offset < bytes.length) {
      const length = view.getUint32(offset);
      const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
      types.push(type);
      if (type === 'IDAT') compressed.push(bytes.slice(offset + 8, offset + 8 + length));
      offset += 12 + length;
    }
    expect(types[0]).toBe('IHDR');
    expect(types.at(-1)).toBe('IEND');
    expect(offset).toBe(bytes.length);
    const decompressed = new Blob(compressed).stream().pipeThrough(new DecompressionStream('deflate'));
    const rows = new Uint8Array(await new Response(decompressed).arrayBuffer());
    expect(rows.length).toBe(7 * (1 + 3 * 4));
    for (let y = 0; y < 7; y++) {
      const row = rows.subarray(y * 13, (y + 1) * 13);
      expect(row[0]).toBe(0);
      for (let x = 0; x < 3; x++) {
        expect(Array.from(row.subarray(1 + x * 4, 5 + x * 4))).toEqual([y, x, y * 17 + x, 255]);
      }
    }
  });

  it('rejects missing rows and never returns a partial PNG', async () => {
    await expect(encodePngTiles(2, 4, 2, async () => ({
      width: 2, height: 2, rgba: new Uint8Array(2),
    }))).rejects.toThrow(/incomplete/);
    await expect(encodePngTiles(2, 4, 2, async (top) => {
      if (top) throw new Error('A later tile failed');
      return { width: 2, height: 2, rgba: new Uint8Array(2 * 2 * 4) };
    })).rejects.toThrow(/later tile failed/);
  });

  it('rejects PNG dimensions outside the format limits', async () => {
    await expect(encodePngTiles(0, 4, 2, async () => {
      throw new Error('Should not render');
    })).rejects.toThrow(/dimensions/);
    await expect(encodePngTiles(960, 0x80000000, 2, async () => {
      throw new Error('Should not render');
    })).rejects.toThrow(/dimensions/);
  });
});
