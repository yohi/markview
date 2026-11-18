export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function assertMarkdownFile(file: Pick<File, 'name' | 'size'>): void {
  if (!/\.(md|markdown)$/i.test(file.name)) {
    throw new Error('Choose a .md or .markdown file.');
  }
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_IMPORT_BYTES) {
    throw new Error('Markdown file must be 5 MiB or smaller.');
  }
}

export function decodeMarkdownBytes(bytes: ArrayBuffer): string {
  // Fatal decoding prevents broken input from silently replacing source text.
  // Keep source offsets consistent with CodeMirror, which stores line breaks as LF.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n');
}

export async function readMarkdownFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>): Promise<string> {
  assertMarkdownFile(file);
  return decodeMarkdownBytes(await file.arrayBuffer());
}
