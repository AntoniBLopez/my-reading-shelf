import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const WORDS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

async function identityPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const [index, word] of WORDS.entries()) {
    const sheet = pdf.addPage([612, 792]);
    sheet.drawText(`${word} page ${index + 1}`, { x: 72, y: 700, size: 32, font, color: rgb(0, 0, 0) });
  }
  return pdf.save();
}

async function installPolyfill(page: Page) {
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
    const promises = Promise as PromiseConstructor & {
      try?: (action: (...args: unknown[]) => unknown, ...args: unknown[]) => Promise<unknown>;
    };
    if (typeof promises.try !== 'function') {
      promises.try = (action, ...args) =>
        new Promise((resolve, reject) => {
          try {
            resolve(action(...args));
          } catch (error) {
            reject(error);
          }
        });
    }
  });
}

async function openBook(page: Page, startPage: number) {
  await installPolyfill(page);
  const bytes = await identityPdf();
  const b64 = Buffer.from(bytes).toString('base64');
  await page.goto('/');
  await page.evaluate(async ({ pdf, startPage: current }) => {
    const binary = atob(pdf);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
    const book = {
      id: 'book-identity',
      user_id: 'local',
      folder_id: 'folder-1',
      title: 'Identity pages',
      description: null,
      file_path: 'local://book-identity',
      file_name: 'identity.pdf',
      is_read: false,
      read_at: null,
      current_page: current,
      total_pages: 4,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const folder = {
      id: 'folder-1',
      user_id: 'local',
      name: 'Lecturas',
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem('reading-shelf-folders', JSON.stringify([folder]));
    localStorage.setItem('reading-shelf-books', JSON.stringify([book]));
    localStorage.setItem(
      'reading-shelf-layout',
      JSON.stringify({ folderPositions: {}, categoryOrder: [], bookOrder: { 'folder-1': ['book-identity'] } }),
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
        tx.objectStore('blobs').put({ id: 'book-identity', blob: new Blob([data], { type: 'application/pdf' }) });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { pdf: b64, startPage });
  await page.goto('/?tab=library&book=book-identity');
  await expect(page.locator('.pdf-turn-leaf')).toContainText(WORDS[startPage - 1], { timeout: 30_000 });
}

async function readIdentity(page: Page) {
  return page.evaluate(() => {
    const pageOf = (selector: string) => {
      const node = document.querySelector(selector);
      return node instanceof HTMLCanvasElement ? node.dataset.page ?? '' : '';
    };
    return {
      leaf: pageOf('.pdf-turn-leaf canvas'),
      next: pageOf('.pdf-turn-under--next canvas'),
      prev: pageOf('.pdf-turn-under--prev canvas'),
      text: document.querySelector('.pdf-turn-leaf')?.textContent ?? '',
      curl: !!document.querySelector('.pdf-page-curl--ready'),
    };
  });
}

async function drag(page: Page, toward: 'next' | 'prev', commit: boolean) {
  const canvas = page.locator('.pdf-turn-leaf canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing page');
  const startX = toward === 'next' ? box.x + box.width - 24 : box.x + 24;
  const endX = commit
    ? toward === 'next'
      ? box.x + box.width * 0.2
      : box.x + box.width * 0.8
    : startX + (toward === 'next' ? -36 : 36);
  await page.mouse.move(startX, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(endX, box.y + box.height * 0.5, { steps: 16 });
  if (commit) await expect(page.locator('.pdf-page-curl--ready')).toBeVisible({ timeout: 8_000 });
  return readIdentity(page);
}

async function expectSamePageAfterDrop(page: Page, revealed: string, word: string, slot: 'next' | 'prev') {
  await page.mouse.up();
  await expect.poll(async () => {
    const state = await readIdentity(page);
    const hole = slot === 'next' ? state.next : state.prev;
    if (state.curl && hole !== revealed) throw new Error(`hole ${hole} departed from ${revealed}`);
    if (!state.curl && state.leaf === revealed && state.text.includes(word)) return 'settled';
    return 'waiting';
  }, { timeout: 8_000 }).toBe('settled');
}

function cases(title: string) {
  test(`GIVEN page one WHEN the next page is dragged and dropped THEN that same page stays ${title}`, async ({ page }) => {
    await openBook(page, 1);
    const mid = await drag(page, 'next', true);
    expect(mid.leaf).toBe('1');
    expect(mid.next).toBe('2');
    expect(mid.text).toContain('ALPHA');
    await expectSamePageAfterDrop(page, '2', 'BRAVO', 'next');
  });

  test(`GIVEN page two WHEN the previous page is dragged and dropped THEN that same page stays ${title}`, async ({ page }) => {
    await openBook(page, 2);
    const mid = await drag(page, 'prev', true);
    expect(mid.leaf).toBe('2');
    expect(mid.prev).toBe('1');
    expect(mid.text).toContain('BRAVO');
    await expectSamePageAfterDrop(page, '1', 'ALPHA', 'prev');
  });

  test(`GIVEN page one WHEN the drag is cancelled THEN the original text stays ${title}`, async ({ page }) => {
    await openBook(page, 1);
    const mid = await drag(page, 'next', false);
    expect(mid.leaf).toBe('1');
    await page.mouse.up();
    await expect.poll(async () => readIdentity(page), { timeout: 8_000 }).toMatchObject({
      leaf: '1',
      curl: false,
    });
    await expect(page.locator('.pdf-turn-leaf')).toContainText('ALPHA');
    await expect(page.locator('.pdf-turn-leaf')).not.toContainText('BRAVO');
  });
}

test.describe('desktop page identity', () => {
  test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  cases('on desktop');
});

test.describe('phone page identity', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  cases('on a phone');
});
