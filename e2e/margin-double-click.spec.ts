import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function samplePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 4; index += 1) {
    const sheet = pdf.addPage([612, 792]);
    sheet.drawText(`Pagina ${index + 1}`, { x: 72, y: 720, size: 28, font, color: rgb(0, 0, 0) });
  }
  return pdf.save();
}

async function openBook(page: Page) {
  await page.addInitScript(() => {
    const maps = Map.prototype as Map<unknown, unknown> & {
      getOrInsertComputed?: (key: unknown, compute: (key: unknown) => unknown) => unknown;
    };
    if (typeof maps.getOrInsertComputed !== 'function') {
      maps.getOrInsertComputed = function getOrInsertComputed(key, compute) {
        if (this.has(key)) return this.get(key);
        const value = compute(key);
        this.set(key, value);
        return value;
      };
    }
  });
  const bytes = await samplePdf();
  const b64 = Buffer.from(bytes).toString('base64');
  const now = new Date().toISOString();
  const book = {
    id: 'book-margin',
    user_id: 'local',
    folder_id: 'folder-1',
    title: 'Margen',
    description: null,
    file_path: 'local://book-margin',
    file_name: 'margen.pdf',
    is_read: false,
    read_at: null,
    current_page: 1,
    total_pages: 4,
    position: 0,
    created_at: now,
    updated_at: now,
  };
  const folder = {
    id: 'folder-1',
    user_id: 'local',
    name: 'Lecturas',
    description: null,
    created_at: now,
    updated_at: now,
  };
  await page.goto('/');
  await page.evaluate(async ({ pdf, bookRow, folderRow }) => {
    const binary = atob(pdf);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
    localStorage.setItem('reading-shelf-folders', JSON.stringify([folderRow]));
    localStorage.setItem('reading-shelf-books', JSON.stringify([bookRow]));
    localStorage.setItem(
      'reading-shelf-layout',
      JSON.stringify({ folderPositions: {}, categoryOrder: [], bookOrder: { 'folder-1': ['book-margin'] } }),
    );
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('reading-shelf-pdfs', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put({ id: 'book-margin', blob: new Blob([data], { type: 'application/pdf' }) });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { pdf: b64, bookRow: book, folderRow: folder });
  await page.goto('/?tab=library&book=book-margin');
  await expect(page.locator('canvas[data-page="1"]')).toBeVisible({ timeout: 30_000 });
}

async function selectedText(page: Page) {
  return page.evaluate(() => window.getSelection()?.toString() ?? '');
}

async function gutterPoint(page: Page, side: 'left' | 'right') {
  const viewport = await page.locator('[data-reader-viewport]').boundingBox();
  const book = await page.locator('[data-reader-page]').boundingBox();
  if (!viewport || !book) throw new Error('missing reader boxes');
  const y = viewport.y + Math.min(24, viewport.height / 2);
  const x = side === 'left' ? viewport.x + 6 : viewport.x + viewport.width - 6;
  const outsideBook = side === 'left' ? x < book.x : x > book.x + book.width;
  expect(outsideBook).toBe(true);
  return { x, y };
}

test('GIVEN an open book WHEN the empty gutter is double clicked THEN the page turns once with or without borders', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openBook(page);
  const pageField = page.getByTitle('Número de página');
  await expect(pageField).toHaveValue('1');
  const zoomOut = page.getByTitle('Menos zoom');
  for (let step = 0; step < 4; step += 1) await zoomOut.click();

  const right = await gutterPoint(page, 'right');
  await page.mouse.dblclick(right.x, right.y);
  await expect(pageField).toHaveValue('2');
  expect(await selectedText(page)).toBe('');
  await page.waitForTimeout(500);
  await expect(pageField).toHaveValue('2');

  const left = await gutterPoint(page, 'left');
  await page.mouse.dblclick(left.x, left.y);
  await expect(pageField).toHaveValue('1');
  expect(await selectedText(page)).toBe('');

  await page.getByTitle('Mostrar borde del libro').click();
  const rightWithBorder = await gutterPoint(page, 'right');
  await page.mouse.dblclick(rightWithBorder.x, rightWithBorder.y);
  await expect(pageField).toHaveValue('2');
  expect(await selectedText(page)).toBe('');

  const topLeft = await gutterPoint(page, 'left');
  const viewport = await page.locator('[data-reader-viewport]').boundingBox();
  if (!viewport) throw new Error('missing viewport');
  await page.mouse.dblclick(topLeft.x, viewport.y + viewport.height - 8);
  await expect(pageField).toHaveValue('1');
  expect(await selectedText(page)).toBe('');

  await page.getByTitle('Ocultar borde del libro').dblclick();
  await expect(pageField).toHaveValue('1');

  await page.keyboard.press('ArrowRight');
  await expect(pageField).toHaveValue('2');

  const word = page.locator('.textLayer span').first();
  await expect(word).toBeVisible();
  const wordBox = await word.boundingBox();
  if (!wordBox) throw new Error('missing page text');
  await page.mouse.move(wordBox.x + 1, wordBox.y + wordBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(wordBox.x + wordBox.width - 1, wordBox.y + wordBox.height / 2);
  await page.mouse.up();
  expect(await selectedText(page)).not.toBe('');
});
