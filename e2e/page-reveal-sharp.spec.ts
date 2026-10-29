import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ARTIFACTS = '/opt/cursor/artifacts';

async function sharpPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const first = pdf.addPage([612, 792]);
  first.drawText('Page one stays here.', { x: 72, y: 720, size: 28, font, color: rgb(0, 0, 0) });
  const next = pdf.addPage([612, 792]);
  next.drawRectangle({ x: 430, y: 280, width: 140, height: 220, color: rgb(0, 0, 0) });
  for (let i = 0; i < 18; i += 1) {
    next.drawRectangle({
      x: 448 + (i % 2) * 8,
      y: 300 + i * 10,
      width: 70,
      height: 4,
      color: rgb(1, 1, 1),
    });
  }
  next.drawText('SHARP', { x: 450, y: 520, size: 28, font, color: rgb(0, 0, 0) });
  return pdf.save();
}

async function openSharpBook(page: Page) {
  mkdirSync(ARTIFACTS, { recursive: true });
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
  const bytes = await sharpPdf();
  const b64 = Buffer.from(bytes).toString('base64');
  const now = new Date().toISOString();
  const book = {
    id: 'book-sharp',
    user_id: 'local',
    folder_id: 'folder-1',
    title: 'Sharp pages',
    description: null,
    file_path: 'local://book-sharp',
    file_name: 'sharp.pdf',
    is_read: false,
    read_at: null,
    current_page: 1,
    total_pages: 2,
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
      JSON.stringify({ folderPositions: {}, categoryOrder: [], bookOrder: { 'folder-1': ['book-sharp'] } }),
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
        tx.objectStore('blobs').put({ id: 'book-sharp', blob: new Blob([data], { type: 'application/pdf' }) });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { pdf: b64, bookRow: book, folderRow: folder });
  await page.goto('/?tab=library&book=book-sharp');
  await expect(page.locator('canvas[data-page="1"]')).toBeVisible({ timeout: 30_000 });
}

async function holdReveal(page: Page) {
  const canvas = page.locator('canvas[data-page="1"]');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing page');
  const startX = box.x + box.width - 28;
  const startY = box.y + box.height * 0.62;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.28, box.y + box.height * 0.48, { steps: 18 });
  await expect(page.locator('.pdf-page-curl--ready canvas')).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(250);
  return box;
}

function patternClip(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
) {
  const raw = {
    x: box.x + box.width * 0.78,
    y: box.y + box.height * 0.55,
    width: Math.max(24, box.width * 0.18),
    height: Math.max(24, box.height * 0.22),
  };
  const x = Math.max(0, Math.min(raw.x, viewport.width - 24));
  const y = Math.max(0, Math.min(raw.y, viewport.height - 24));
  return {
    x,
    y,
    width: Math.max(24, Math.min(raw.width, viewport.width - x)),
    height: Math.max(24, Math.min(raw.height, viewport.height - y)),
  };
}

async function edgePeak(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const png = await page.screenshot({ clip, type: 'png' });
  return page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const lum = (x: number, y: number) => {
      const offset = (y * width + x) * 4;
      return data[offset] + data[offset + 1] + data[offset + 2];
    };
    const peaks: number[] = [];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const dx = Math.abs(lum(x + 1, y) - lum(x - 1, y));
        const dy = Math.abs(lum(x, y + 1) - lum(x, y - 1));
        peaks.push(Math.max(dx, dy));
      }
    }
    peaks.sort((a, b) => a - b);
    return peaks[Math.max(0, Math.floor(peaks.length * 0.995) - 1)] ?? 0;
  }, png.toString('base64'));
}

async function revealState(page: Page) {
  return page.evaluate(() => {
    const describe = (selector: string) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLCanvasElement)) return null;
      const css = node.getBoundingClientRect();
      const filter = getComputedStyle(node).filter;
      return {
        ratio: css.width > 0 ? node.width / css.width : 0,
        filter,
      };
    };
    const curl = document.querySelector('.pdf-page-curl--ready canvas');
    let transparent = 0;
    if (curl instanceof HTMLCanvasElement) {
      const context = curl.getContext('2d', { willReadFrequently: true });
      if (context) {
        const pixels = context.getImageData(0, 0, curl.width, curl.height).data;
        for (let index = 3; index < pixels.length; index += 16) {
          if (pixels[index] === 0) transparent += 1;
        }
      }
    }
    const coarse = window.matchMedia('(pointer: coarse), (hover: none)').matches;
    const dpr = window.devicePixelRatio || 1;
    return {
      expected: coarse ? Math.min(dpr, 2) : dpr,
      leaf: describe('.pdf-turn-leaf canvas'),
      revealed: describe('.pdf-turn-under--next canvas'),
      curlFilter: curl instanceof HTMLCanvasElement ? getComputedStyle(curl).filter : '',
      transparent,
      singlePage: document.querySelectorAll('.pdf-turn-leaf').length === 1,
    };
  });
}

async function expectSharpHold(page: Page, shot: string) {
  const box = await holdReveal(page);
  const state = await revealState(page);
  expect(state.singlePage).toBe(true);
  expect(state.leaf?.ratio).toBeCloseTo(state.expected, 1);
  expect(state.revealed?.ratio).toBeCloseTo(state.expected, 1);
  expect(state.revealed?.filter ?? '').not.toContain('blur');
  expect(state.curlFilter).not.toContain('blur');
  expect(state.transparent).toBeGreaterThan(20);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('missing viewport');
  const clip = patternClip(box, viewport);
  const mid = await edgePeak(page, clip);
  await page.screenshot({ path: `${ARTIFACTS}/${shot}-mid-drag.png` });
  await page.screenshot({ path: `${ARTIFACTS}/${shot}-mid-drag-crop.png`, clip });
  await page.mouse.up();
  await expect(page.locator('canvas[data-page="2"]')).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(400);
  const settled = await edgePeak(page, clip);
  await page.screenshot({ path: `${ARTIFACTS}/${shot}-settled.png` });
  expect(mid, `revealed edge ${mid} vs settled ${settled}`).toBeGreaterThan(settled * 0.7);
}

test.describe('desktop reveal', () => {
  test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 3 });

  test('GIVEN a desktop page WHEN a drag reveals the next page THEN that page stays as sharp as the settled page', async ({ page }) => {
    await openSharpBook(page);
    await expectSharpHold(page, 'page-reveal-after');
  });

  test('GIVEN dark mode WHEN a drag reveals the next page THEN that page stays as sharp as the settled page', async ({ page }) => {
    await openSharpBook(page);
    await page.getByRole('dialog').locator('button[title="Modo oscuro"]').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expectSharpHold(page, 'page-reveal-after-dark');
  });
});

test.describe('phone reveal', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });

  test('GIVEN a phone WHEN a drag reveals the next page THEN that page uses the settled page resolution', async ({ page }) => {
    await openSharpBook(page);
    await expectSharpHold(page, 'page-reveal-after-phone');
  });
});
