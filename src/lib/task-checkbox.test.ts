import { describe, expect, it } from 'vitest';
import { setTaskChecked } from './task-checkbox';

describe('interactive GFM task markers', () => {
  it('updates the selected checkbox and not identical adjacent tasks', () => {
    const raw = '- [ ] same\n- [ ] same\n- [x] done';
    const second = raw.indexOf('- [ ]', 1);
    expect(setTaskChecked(raw, second, true)).toBe('- [ ] same\n- [x] same\n- [x] done');
  });

  it('supports ordered and nested tasks inside blockquotes', () => {
    const raw = '> - [X] top\n>   2. [ ] nested\n  * [ ] indented';
    expect(setTaskChecked(raw, 0, false)).toBe('> - [ ] top\n>   2. [ ] nested\n  * [ ] indented');
    expect(setTaskChecked(raw, raw.indexOf('2. [ ]'), true))
      .toBe('> - [X] top\n>   2. [x] nested\n  * [ ] indented');
    expect(setTaskChecked(raw, raw.indexOf('* [ ]'), true))
      .toBe('> - [X] top\n>   2. [ ] nested\n  * [x] indented');
  });

  it('preserves CRLF and all unrelated Markdown bytes', () => {
    const raw = '# Header\r\n- [ ] todo\r\n\r\n\`\`\`md\r\n- [ ] sample\r\n\`\`\`\r\n';
    expect(setTaskChecked(raw, raw.indexOf('- [ ]'), true))
      .toBe('# Header\r\n- [x] todo\r\n\r\n\`\`\`md\r\n- [ ] sample\r\n\`\`\`\r\n');
  });

  it('does not mutate normal list items or invalid positions', () => {
    const raw = '- regular item\n- [ ] checkbox';
    expect(setTaskChecked(raw, 0, true)).toBe(raw);
    expect(setTaskChecked(raw, -1, true)).toBe(raw);
    expect(setTaskChecked(raw, 1.5, true)).toBe(raw);
    expect(setTaskChecked(raw, raw.length, true)).toBe(raw);
  });

  it('is idempotent when the requested state is already reflected', () => {
    const raw = '- [x] done\n- [ ] todo';
    expect(setTaskChecked(raw, 0, true)).toBe(raw);
    expect(setTaskChecked(raw, raw.indexOf('todo'), false)).toBe(raw);
  });
});
