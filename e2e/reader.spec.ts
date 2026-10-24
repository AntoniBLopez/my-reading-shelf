import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ARTIFACTS = '/opt/cursor/artifacts';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAIklEQVQY02P8z8BQz0BFwAQQYGBg+A8DAwPDfwYGBgYGAAAf8C/1nQ1v0AAAAABJRU5ErkJggg==',
  'base64',
);

async function samplePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let image;
  try {
    image = await pdf.embedPng(PNG);
  } catch {
    image = null;
  }
  const page = pdf.addPage([612, 792]);
  page.drawText('Ve Figura 1.1 ahora.', { x: 72, y: 720, size: 18, font, color: rgb(0, 0, 0) });
  if (image) page.drawImage(image, { x: 72, y: 500, width: 160, height: 120 });
  else page.drawRectangle({ x: 72, y: 500, width: 160, height: 120, color: rgb(0.2, 0.35, 0.7) });
  page.drawText('Figura 1.1', { x: 72, y: 470, size: 14, font, color: rgb(0, 0, 0) });
  const next = pdf.addPage([612, 792]);
  next.drawText('Segunda pagina con mas texto para pasar.', {
    x: 72,
    y: 720,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });
  return pdf.save();
}

test('GIVEN an open book WHEN RSVP and a page drag run THEN playback stays paused, the figure paints, and the page curls', async ({ page }) => {
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
  const bytes = await samplePdf();
  const b64 = Buffer.from(bytes).toString('base64');
  const now = new Date().toISOString();
  const book = {
    id: 'book-fig',
    user_id: 'local',
    folder_id: 'folder-1',
    title: 'Libro de figuras',
    description: null,
    file_path: 'local://book-fig',
    file_name: 'figuras.pdf',
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
      JSON.stringify({ folderPositions: {}, categoryOrder: [], bookOrder: { 'folder-1': ['book-fig'] } }),
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
        tx.objectStore('blobs').put({ id: 'book-fig', blob: new Blob([data], { type: 'application/pdf' }) });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { pdf: b64, bookRow: book, folderRow: folder });

  await page.goto('/?tab=library&book=book-fig');
  const canvas = page.locator('canvas[data-page="1"]');
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Lectura rápida' }).click();
  const stage = page.getByRole('button', { name: 'Reproducir lectura' });
  await expect(stage).toBeVisible();
  await expect(stage).toContainText('Ve');
  const word = stage.locator('[data-rsvp-word]');
  await expect(word).toHaveCSS('text-align', 'center');
  await page.screenshot({ path: `${ARTIFACTS}/rsvp-paused-centered.png` });

  await page.waitForTimeout(2000);
  await expect(stage).toContainText('Ve');
  await expect(stage).not.toContainText('Figura');

  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  const figure = page.getByRole('img', { name: 'Figura 1.1' });
  await expect(figure).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  const natural = await figure.evaluate((node) => (node as HTMLImageElement).naturalWidth);
  expect(natural).toBeGreaterThan(0);
  await page.screenshot({ path: `${ARTIFACTS}/rsvp-figure-continuar.png` });

  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('missing page box');
  const startX = box.x + box.width - 24;
  const startY = box.y + box.height * 0.72;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.5, { steps: 12 });
  const curl = page.locator('.pdf-page-curl--ready canvas');
  await expect(curl).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${ARTIFACTS}/page-curl-mid-drag.png` });
  const spread = await curl.evaluate((node) => {
    const canvasNode = node as HTMLCanvasElement;
    const context = canvasNode.getContext('2d');
    if (!context) return 0;
    const { width, height } = canvasNode;
    const pixels = context.getImageData(0, 0, width, height).data;
    const edges: number[] = [];
    const step = Math.max(1, Math.floor(height / 24));
    for (let y = Math.floor(height * 0.2); y < height * 0.85; y += step) {
      let darkest = 255 * 3;
      let darkestX = 0;
      for (let x = 0; x < width; x += 2) {
        const offset = (y * width + x) * 4;
        const lum = pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
        if (lum < darkest) {
          darkest = lum;
          darkestX = x;
        }
      }
      if (darkest < 720) edges.push(darkestX);
    }
    if (edges.length < 2) return 0;
    return Math.max(...edges) - Math.min(...edges);
  });
  expect(spread).toBeGreaterThan(12);
  await expect(page.locator('.pdf-turn-leaf')).not.toHaveAttribute('style', /rotateY/);
  await page.screenshot({ path: `${ARTIFACTS}/page-curl-mid-drag.png` });
  await page.mouse.up();
});
