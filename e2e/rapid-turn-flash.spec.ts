import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ARTIFACTS = '/opt/cursor/artifacts';
const WORDS = ['PAGE 1', 'PAGE 2', 'PAGE 3', 'PAGE 4', 'PAGE 5', 'PAGE 6', 'PAGE 7', 'PAGE 8'];

type Sample = { leaf: string; under: string; turn: string; text: string };

async function flashPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const [index, word] of WORDS.entries()) {
    const sheet = pdf.addPage([612, 792]);
    sheet.drawText(`${word} marker ${index + 1}`, { x: 72, y: 700, size: 32, font, color: rgb(0, 0, 0) });
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

async function openBook(page: Page) {
  mkdirSync(ARTIFACTS, { recursive: true });
  await installPolyfill(page);
  const bytes = await flashPdf();
  const b64 = Buffer.from(bytes).toString('base64');
  const now = new Date().toISOString();
  await page.goto('/');
  await page.evaluate(async ({ pdf, now: stamp }) => {
    const binary = atob(pdf);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
    const book = {
      id: 'book-flash',
      user_id: 'local',
      folder_id: 'folder-1',
      title: 'Flash pages',
      description: null,
      file_path: 'local://book-flash',
      file_name: 'flash.pdf',
      is_read: false,
      read_at: null,
      current_page: 1,
      total_pages: 8,
      position: 0,
      created_at: stamp,
      updated_at: stamp,
    };
    const folder = {
      id: 'folder-1',
      user_id: 'local',
      name: 'Lecturas',
      description: null,
      created_at: stamp,
      updated_at: stamp,
    };
    localStorage.setItem('reading-shelf-folders', JSON.stringify([folder]));
    localStorage.setItem('reading-shelf-books', JSON.stringify([book]));
    localStorage.setItem(
      'reading-shelf-layout',
      JSON.stringify({ folderPositions: {}, categoryOrder: [], bookOrder: { 'folder-1': ['book-flash'] } }),
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
        tx.objectStore('blobs').put({ id: 'book-flash', blob: new Blob([data], { type: 'application/pdf' }) });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { pdf: b64, now });
  await page.goto('/?tab=library&book=book-flash');
  await expect(page.locator('.pdf-turn-leaf')).toContainText('PAGE 1', { timeout: 30_000 });
}

function nextButton(page: Page) {
  return page.locator('button:has(svg.lucide-chevron-right)');
}

async function burst(page: Page) {
  const next = nextButton(page);
  await next.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(page.locator('.pdf-turn-leaf')).toContainText('PAGE 4', { timeout: 15_000 });
  const box = await page.locator('.pdf-turn-leaf canvas').boundingBox();
  if (!box) throw new Error('missing page');
  const y = box.y + box.height * 0.55;
  await page.mouse.move(box.x + box.width - 18, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.12, y, { steps: 4 });
  await page.mouse.up();
}

async function settledLeaf(page: Page): Promise<number> {
  let found = 0;
  await expect.poll(async () => {
    found = await page.evaluate(() => {
      const text = document.querySelector('.pdf-turn-leaf')?.textContent ?? '';
      const match = text.match(/PAGE (\d+)/);
      const canvas = document.querySelector('.pdf-turn-leaf canvas');
      const stamped = canvas instanceof HTMLCanvasElement ? canvas.dataset.page ?? '' : '';
      return match && stamped === match[1] ? Number(match[1]) : 0;
    });
    return found;
  }, { timeout: 8_000 }).toBeGreaterThanOrEqual(4);
  return found;
}

async function startSampling(page: Page) {
  await page.evaluate(() => {
    const host = window as Window & { __turnSamples?: Sample[]; __turnStop?: boolean };
    host.__turnSamples = [];
    host.__turnStop = false;
    const loop = () => {
      if (host.__turnStop) return;
      const scene = document.querySelector('.pdf-turn-scene');
      const turn = scene?.getAttribute('data-turn') ?? '';
      const leafCanvas = document.querySelector('.pdf-turn-leaf canvas');
      const underNode = turn ? document.querySelector(`.pdf-turn-under--${turn} canvas`) : null;
      host.__turnSamples?.push({
        leaf: leafCanvas instanceof HTMLCanvasElement ? (leafCanvas.dataset.page ?? '') : '',
        under: underNode instanceof HTMLCanvasElement ? (underNode.dataset.page ?? '') : '',
        turn,
        text: document.querySelector('.pdf-turn-leaf')?.textContent ?? '',
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

async function stopSampling(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const host = window as Window & { __turnSamples?: Sample[]; __turnStop?: boolean };
    host.__turnStop = true;
    return host.__turnSamples ?? [];
  });
}

function assertNoPreviousAfterCommit(samples: Sample[], origin: string, destination: string, midDrag: boolean) {
  const turning = samples.filter((sample) => sample.turn === 'next' && sample.under !== '');
  expect(turning.some((sample) => sample.under === destination), `page ${destination} was revealed`).toBe(true);
  expect(turning.some((sample) => sample.under === origin), `page ${origin} flashed in the hole`).toBe(false);
  if (midDrag) {
    expect(
      samples.some((sample) => sample.turn === 'next' && sample.leaf === origin && sample.under === destination),
    ).toBe(true);
  }
  let committed = false;
  for (const sample of samples) {
    if (sample.leaf === destination) committed = true;
    if (committed && sample.under === origin) {
      throw new Error(`previous page ${origin} appeared after commit to ${destination}`);
    }
  }
}

async function slowDrag(page: Page, origin: string, destination: string, shot: string) {
  const box = await page.locator('.pdf-turn-leaf canvas').boundingBox();
  if (!box) throw new Error('missing page');
  const y = box.y + box.height * 0.58;
  await startSampling(page);
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.18, y, { steps: 18 });
  await expect(page.locator('.pdf-page-curl--ready')).toBeVisible({ timeout: 8_000 });
  await page.evaluate(() => {
    const host = window as Window & { __turnSamples?: Sample[] };
    host.__turnSamples = [];
  });
  await page.screenshot({ path: `${ARTIFACTS}/${shot}.png` });
  await page.mouse.up();
  await expect(page.locator('.pdf-turn-leaf')).toContainText(WORDS[Number(destination) - 1], { timeout: 8_000 });
  const samples = await stopSampling(page);
  assertNoPreviousAfterCommit(samples, origin, destination, true);
  await expect(page.locator('.pdf-turn-leaf')).not.toContainText(WORDS[Number(origin) - 1]);
}

async function slowArrow(page: Page, origin: string, destination: string) {
  await expect(page.locator('.pdf-page-curl--ready')).toHaveCount(0, { timeout: 8_000 });
  await startSampling(page);
  await page.evaluate(() => {
    const host = window as Window & { __turnSamples?: Sample[] };
    host.__turnSamples = [];
  });
  await nextButton(page).click();
  await expect(page.locator('.pdf-turn-leaf')).toContainText(WORDS[Number(destination) - 1], { timeout: 8_000 });
  const samples = await stopSampling(page);
  assertNoPreviousAfterCommit(samples, origin, destination, false);
  await expect(page.locator('.pdf-turn-leaf')).not.toContainText(WORDS[Number(origin) - 1]);
}

function cases(title: string, shot: string) {
  test(`GIVEN a burst of turns WHEN a slow drag and arrow follow THEN the previous page never returns ${title}`, async ({ page }) => {
    await openBook(page);
    await burst(page);
    const stable = await settledLeaf(page);
    expect(stable).toBeGreaterThanOrEqual(4);
    expect(stable).toBeLessThan(7);
    await nextButton(page).evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    const origin = String(stable + 1);
    const destination = String(stable + 2);
    await slowDrag(page, origin, destination, shot);
    await page.screenshot({ path: `${ARTIFACTS}/${shot}-settled.png` });
    await slowArrow(page, destination, String(stable + 3));
  });
}

test.describe('desktop rapid turn flash', () => {
  test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
  cases('on desktop', 'rapid-turn-desktop');
});

test.describe('phone rapid turn flash', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  cases('on a phone', 'rapid-turn-phone');
});
