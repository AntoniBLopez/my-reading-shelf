import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const COLORS: Array<[number, number, number]> = [
  [220, 40, 40],
  [30, 170, 70],
  [40, 70, 210],
  [230, 150, 30],
  [150, 40, 190],
  [20, 160, 170],
];

async function colorPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const [index, [red, green, blue]] of COLORS.entries()) {
    const sheet = pdf.addPage([420, 600]);
    sheet.drawRectangle({
      x: 0,
      y: 0,
      width: 420,
      height: 600,
      color: rgb(red / 255, green / 255, blue / 255),
    });
    sheet.drawText(`PAGE ${index + 1}`, {
      x: 70,
      y: 300,
      size: 42,
      font,
      color: rgb(1, 1, 1),
    });
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
  mkdirSync('/opt/cursor/artifacts', { recursive: true });
  await installPolyfill(page);
  const b64 = Buffer.from(await colorPdf()).toString('base64');
  const now = new Date().toISOString();
  await page.goto('/');
  await page.evaluate(async ({ pdf, now: stamp }) => {
    const binary = atob(pdf);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
    const book = {
      id: 'book-frames',
      user_id: 'local',
      folder_id: 'folder-1',
      title: 'Frame pages',
      description: null,
      file_path: 'local://book-frames',
      file_name: 'frames.pdf',
      is_read: false,
      read_at: null,
      current_page: 1,
      total_pages: 6,
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
      JSON.stringify({ folderPositions: {}, categoryOrder: [], bookOrder: { 'folder-1': ['book-frames'] } }),
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
        tx.objectStore('blobs').put({ id: 'book-frames', blob: new Blob([data], { type: 'application/pdf' }) });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { pdf: b64, now });
  await page.goto('/?tab=library&book=book-frames');
  await expect(page.locator('.pdf-turn-leaf')).toContainText('PAGE 1', { timeout: 30_000 });
}

async function startFrames(page: Page) {
  await page.evaluate((palette: Array<[number, number, number]>) => {
    const host = window as Window & { __frames?: number[]; __stopFrames?: boolean };
    host.__frames = [];
    host.__stopFrames = false;
    const nearest = (red: number, green: number, blue: number) => {
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (spread < 35 || red + green + blue > 700) return 0;
      let best = 0;
      let score = 80 * 80;
      palette.forEach(([pr, pg, pb], index) => {
        const distance = (red - pr) ** 2 + (green - pg) ** 2 + (blue - pb) ** 2;
        if (distance < score) {
          score = distance;
          best = index + 1;
        }
      });
      return best;
    };
    const read = (canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return 0;
      const votes = new Map<number, number>();
      for (const [xRatio, yRatio] of [[0.5, 0.5], [0.3, 0.4], [0.7, 0.6], [0.5, 0.25]]) {
        try {
          const pixel = context.getImageData(
            Math.floor(canvas.width * xRatio),
            Math.floor(canvas.height * yRatio),
            1,
            1,
          ).data;
          const pageNo = nearest(pixel[0], pixel[1], pixel[2]);
          if (pageNo) votes.set(pageNo, (votes.get(pageNo) ?? 0) + 1);
        } catch {
          return 0;
        }
      }
      let winner = 0;
      let count = 0;
      for (const [pageNo, hits] of votes) {
        if (hits > count) {
          winner = pageNo;
          count = hits;
        }
      }
      return winner;
    };
    const loop = () => {
      if (host.__stopFrames) return;
      const curl = document.querySelector('.pdf-page-curl--ready canvas');
      const leaf = document.querySelector('.pdf-turn-leaf');
      const covered = !!leaf?.classList.contains('pdf-turn-leaf--covered');
      const textMatch = leaf?.textContent?.match(/PAGE (\d+)/);
      const textPage = !covered && textMatch ? Number(textMatch[1]) : 0;
      const top = curl instanceof HTMLCanvasElement && curl.width > 2
        ? curl
        : leaf?.querySelector('canvas');
      const pixelPage = top instanceof HTMLCanvasElement ? read(top) : 0;
      const pageNo = curl instanceof HTMLCanvasElement && pixelPage ? pixelPage : textPage || pixelPage;
      if (pageNo) host.__frames?.push(pageNo);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, COLORS);
}

async function stopFrames(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const host = window as Window & { __frames?: number[]; __stopFrames?: boolean };
    host.__stopFrames = true;
    const frames = host.__frames ?? [];
    const sequence: number[] = [];
    for (const pageNo of frames) {
      if (sequence[sequence.length - 1] !== pageNo) sequence.push(pageNo);
    }
    return sequence;
  });
}

function expectForward(sequence: number[], finalPage: number) {
  expect(sequence.length, `frames ${sequence.join('→')}`).toBeGreaterThan(1);
  for (let index = 1; index < sequence.length; index += 1) {
    expect(sequence[index], `went back in ${sequence.join('→')}`).toBeGreaterThanOrEqual(sequence[index - 1]);
  }
  expect(sequence[sequence.length - 1]).toBe(finalPage);
}

function nextButton(page: Page) {
  return page.locator('button:has(svg.lucide-chevron-right)');
}

async function settleOn(page: Page, pageNo: number) {
  await expect(page.locator('.pdf-turn-leaf')).toContainText(`PAGE ${pageNo}`, { timeout: 8_000 });
  await expect(page.locator('.pdf-page-curl--ready')).toHaveCount(0, { timeout: 8_000 });
}

function cases(title: string) {
  test(`GIVEN a settled page WHEN the next arrow, the keyboard, and a burst run THEN the visible page never steps back ${title}`, async ({ page }) => {
    await openBook(page);
    await startFrames(page);
    await nextButton(page).click();
    await settleOn(page, 2);
    expectForward(await stopFrames(page), 2);

    await startFrames(page);
    await page.keyboard.press('ArrowRight');
    await settleOn(page, 3);
    expectForward(await stopFrames(page), 3);

    await startFrames(page);
    await nextButton(page).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
      button.click();
    });
    await settleOn(page, 6);
    expectForward(await stopFrames(page), 6);
  });
}

test.use({ video: 'on' });

test.describe('desktop arrow frames', () => {
  test.use({ viewport: { width: 1400, height: 900 } });
  cases('on desktop');
});

test.describe('phone arrow frames', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  cases('on a phone');
});
