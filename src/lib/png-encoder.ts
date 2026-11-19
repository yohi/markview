/** Browser-only, lossless PNG encoder that never creates a full-page canvas. */
const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const MAX_PNG_DIMENSION = 0x7fffffff;
const DEFLATE_BLOCK_SIZE = 256 * 1024;

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function pngChunk(name: 'IHDR' | 'IDAT' | 'IEND', data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(data.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let index = 0; index < 4; index++) chunk[4 + index] = name.charCodeAt(index);
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (let index = 4; index < chunk.length - 4; index++) {
    crc = CRC_TABLE[(crc ^ chunk[index]) & 0xff] ^ (crc >>> 8);
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  return chunk;
}

export interface PngTile {
  width: number;
  height: number;
  rgba: Uint8Array | Uint8ClampedArray;
}

/**
 * Encode complete RGBA strips in top-to-bottom order into one PNG.
 * Strips remain bounded in memory; only the compressed PNG is accumulated.
 * Failure anywhere aborts without returning a partial file.
 */
export async function encodePngTiles(
  width: number,
  height: number,
  tileHeight: number,
  renderTile: (top: number, rows: number) => Promise<PngTile>,
): Promise<Blob> {
  if (![width, height, tileHeight].every(Number.isSafeInteger) ||
      width < 1 || height < 1 || tileHeight < 1 ||
      width > MAX_PNG_DIMENSION || height > MAX_PNG_DIMENSION ||
      width * 4 + 1 > Number.MAX_SAFE_INTEGER) {
    throw new Error('PNG dimensions are invalid or exceed the PNG format limits.');
  }
  if (typeof CompressionStream === 'undefined') {
    throw new Error('This browser cannot encode full-resolution PNGs (CompressionStream unavailable).');
  }

  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width);
  header.setUint32(4, height);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  const parts: Uint8Array[] = [PNG_SIGNATURE, pngChunk('IHDR', ihdr)];

  const compressor = new CompressionStream('deflate'); // PNG IDAT uses zlib-wrapped DEFLATE.
  const writer = compressor.writable.getWriter();
  const collectCompressed = (async () => {
    const reader = compressor.readable.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value.byteLength > 0) parts.push(pngChunk('IDAT', value));
      }
    } finally {
      reader.releaseLock();
    }
  })();

  const rowBytes = width * 4 + 1;
  const block = new Uint8Array(Math.max(DEFLATE_BLOCK_SIZE, rowBytes));
  let used = 0;
  try {
    for (let top = 0; top < height; top += tileHeight) {
      const rows = Math.min(tileHeight, height - top);
      const tile = await renderTile(top, rows);
      if (tile.width !== width || tile.height !== rows ||
          tile.rgba.length !== width * rows * 4) {
        throw new Error('PNG tile was incomplete or had unexpected dimensions. Nothing was saved.');
      }
      for (let y = 0; y < rows; y++) {
        if (used + rowBytes > block.length) {
          await writer.write(block.slice(0, used));
          used = 0;
        }
        block[used] = 0; // PNG filter: None. No color approximation.
        block.set(tile.rgba.subarray(y * width * 4, (y + 1) * width * 4), used + 1);
        used += rowBytes;
      }
    }
    if (used) await writer.write(block.slice(0, used));
    await writer.close();
    await collectCompressed;
    parts.push(pngChunk('IEND', new Uint8Array()));
    return new Blob(parts, { type: 'image/png' });
  } catch (error) {
    await writer.abort(error).catch(() => undefined);
    await collectCompressed.catch(() => undefined);
    throw error;
  } finally {
    writer.releaseLock();
  }
}
