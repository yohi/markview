/**
 * Update precisely one GFM task marker using the list item's parser position.
 * The caller must ensure the position belongs to the source currently shown
 * in Preview. Never search for identical task text elsewhere in the document.
 */
export function setTaskChecked(source: string, itemOffset: number, checked: boolean): string {
  if (!Number.isInteger(itemOffset) || itemOffset < 0 || itemOffset >= source.length) return source;

  const lineStart = source.lastIndexOf('\n', itemOffset - 1) + 1;
  const nextNewline = source.indexOf('\n', itemOffset);
  const lineEnd = nextNewline === -1 ? source.length : nextNewline;
  const line = source.slice(lineStart, lineEnd);

  // Supports nested lists, ordered lists and list items inside blockquotes.
  // Match only a task marker at the start of the list-item source line.
  const match = /^([ \t]*(?:>[ \t]*)*[ \t]*(?:[-+*]|[0-9]+[.)])[ \t]+)\[([ xX])\](?=[ \t\r]|$)/.exec(line);
  if (!match) return source;

  const currentChecked = match[2].toLowerCase() === 'x';
  if (currentChecked === checked) return source;

  const markerOffset = lineStart + match[1].length + 1;
  return source.slice(0, markerOffset) + (checked ? 'x' : ' ') + source.slice(markerOffset + 1);
}
