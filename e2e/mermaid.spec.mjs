import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const markdown = [
  '# Mermaid preview',
  '~~~mermaid',
  'flowchart TD',
  '  A[利用者] --> B{MFA}',
  '  B -->|成功| C[Application]',
  '  B -->|失敗| D[Denied]',
  '  C --> E[(Database)]',
  '~~~',
  '',
  '~~~mermaid',
  '---',
  'config:',
  '  layout: dagre',
  '  htmlLabels: true',
  '  securityLevel: loose',
  '---',
  'flowchart LR',
  '  A[Explicit layout] --> B[Safe]',
  '  click A href "https://example.invalid/"',
  '~~~',
  '',
  '~~~mermaid',
  'sequenceDiagram',
  '  Client->>Server: 認証',
  '  Server-->>Client: OK',
  '~~~',
].join('\n');

async function load(page, source = markdown) {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({
    name: 'mermaid.md', mimeType: 'text/markdown', buffer: Buffer.from(source),
  });
  await page.getByRole('button', { name: '▤ Preview' }).click();
}
const diagrams = page => page.locator('.preview-body:not(.export-capture-surface .preview-body) .mermaid-svg > svg');

test('presets, explicit configuration, Japanese labels, modal and source preservation', async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await load(page);
  const mode = page.getByRole('combobox', { name: 'Mermaid rendering mode' });
  await expect(mode).toHaveValue('enhanced');
  await expect(diagrams(page)).toHaveCount(3, { timeout: 30000 });
  await expect(diagrams(page).first()).toContainText('利用者');
  await expect(diagrams(page).nth(1)).toContainText('Explicit layout');
  const explicitLabel = diagrams(page).nth(1).locator('foreignObject').filter({ hasText: 'Explicit layout' });
  await expect(explicitLabel).toHaveCount(1);
  await expect(explicitLabel).toBeVisible();
  await expect(diagrams(page).nth(1).locator('a[href*="example.invalid"]')).toHaveCount(0);
  await expect(diagrams(page).locator('script, iframe, object, embed, [onload], [onerror], [onclick], [srcdoc]')).toHaveCount(0);
  const enhanced = await diagrams(page).first().getAttribute('viewBox');
  await page.screenshot({ path: info.outputPath('enhanced.png'), fullPage: true });
  await mode.selectOption('standard');
  await expect(diagrams(page)).toHaveCount(3, { timeout: 30000 });
  await expect.poll(() => diagrams(page).first().getAttribute('viewBox')).not.toBe(enhanced);
  await page.screenshot({ path: info.outputPath('standard.png'), fullPage: true });
  await mode.selectOption('enhanced');
  await expect(diagrams(page)).toHaveCount(3, { timeout: 30000 });
  const viewer = page.locator('.mermaid-viewer').first();
  await viewer.getByRole('button', { name: '100%', exact: true }).click();
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await expect(viewer.getByText('125%', { exact: true })).toBeVisible();
  await viewer.getByRole('button', { name: 'Expand diagram' }).click();
  const modal = page.getByRole('dialog', { name: 'Expanded Mermaid diagram' });
  await expect(modal).toBeVisible();
  await expect(modal.locator('svg').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Expand diagram' })).toBeFocused();
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(diagrams(page)).toHaveCount(3, { timeout: 30000 });
  await page.getByRole('button', { name: 'Copy Raw' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(markdown);
});

test('whole-document PNG and JPG export remains available after zoom', async ({ page }) => {
  await load(page);
  await expect(diagrams(page)).toHaveCount(3, { timeout: 30000 });
  await page.locator('.mermaid-viewer').first().getByRole('button', { name: '100%', exact: true }).click();
  await page.locator('.mermaid-viewer').first().getByRole('button', { name: 'Zoom in' }).click();
  for (const [name, type] of [['Save PNG', 'png'], ['Save JPG', 'jpg']]) {
    await page.locator('.export-menu summary').click();
    const downloaded = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name, exact: true }).click();
    const download = await downloaded;
    const bytes = await readFile(await download.path());
    if (type === 'png') {
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBe(1920);
    } else {
      expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
    }
    expect(bytes.length).toBeGreaterThan(1000);
    await expect(page.locator('.export-capture-host')).toHaveCount(0);
  }
});

test('untrusted diagram labels do not execute embedded event handlers', async ({ page }) => {
  const source = [
    '~~~mermaid',
    '---',
    'config:',
    '  securityLevel: loose',
    '  htmlLabels: true',
    '---',
    'flowchart TD',
    "  A[\"Safe <img src='invalid-markview-image' onerror='window.markviewXss=1'> label\"] --> B[Done]",
    '~~~',
  ].join('\n');
  await load(page, source);
  await expect(diagrams(page)).toHaveCount(1, { timeout: 30000 });
  await expect(diagrams(page)).toContainText('Safe');
  await expect(diagrams(page)).toContainText('Done');
  await expect(diagrams(page).locator('[onerror], [onload], [onclick], script')).toHaveCount(0);
  expect(await page.evaluate(() => window.markviewXss)).toBeUndefined();
});

test('zoom out from Fit never enlarges a diagram below the explicit minimum', async ({ page }) => {
  // A wide real diagram lets us set exact viewport-to-intrinsic-width ratios
  // without mocking the zoom logic or depending on a particular screen size.
  const source = [
    '~~~mermaid',
    'flowchart LR',
    ...Array.from({ length: 12 }, (_, i) => '  N' + i + '[Service ' + i + '] --> N' + (i + 1)),
    '~~~',
  ].join('\n');
  await load(page, source);
  await expect(diagrams(page)).toHaveCount(1, { timeout: 30000 });
  const viewer = page.locator('.mermaid-viewer').first();
  const viewport = viewer.locator('.mermaid-diagram');
  const diagram = viewer.locator('.mermaid-svg');
  const fit = viewer.getByRole('button', { name: 'Fit width' });
  const zoomOut = viewer.getByRole('button', { name: 'Zoom out' });
  await expect(fit).toHaveAttribute('aria-pressed', 'true');

  const intrinsic = await diagram.evaluate(element => Number.parseFloat(element.style.width));
  expect(intrinsic).toBeGreaterThan(400);
  for (const percent of [20, 25, 63]) {
    await fit.click();
    // Set only the test viewport width. Flooring the pixel value ensures
    // the actual 25% boundary is not rounded upward by clientWidth.
    const pixels = Math.floor(intrinsic * percent / 100);
    await viewport.evaluate((element, width) => {
      element.style.width = width + 'px';
      element.style.maxWidth = 'none';
    }, pixels);
    const effective = await viewport.evaluate((element, naturalWidth) =>
      element.clientWidth / naturalWidth * 100, intrinsic);
    expect(effective).toBeCloseTo(percent, 0);
    if (percent <= 25) expect(effective).toBeLessThanOrEqual(25);
    const before = await diagram.evaluate(element => element.getBoundingClientRect().width);
    await zoomOut.click();
    if (percent <= 25) {
      await expect(fit).toHaveAttribute('aria-pressed', 'true');
      await expect(viewer.getByText('Fit', { exact: true })).toBeVisible();
      expect(await diagram.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(before, 1);
    } else {
      await expect(fit).toHaveAttribute('aria-pressed', 'false');
      await expect(viewer.getByText('50%', { exact: true })).toBeVisible();
      expect(await diagram.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(intrinsic / 2, 1);
    }
  }
});
