import { describe, expect, it } from 'vitest';

const UNIT = /^should\b/;
const INTEGRATION = /^GIVEN\s+\S[\s\S]*\sWHEN\s+\S[\s\S]*\sTHEN\s+\S/;
const TITLE = /\b(?:it|test)(?:\.(?:only|skip|todo))?\(\s*(['"`])([\s\S]*?)\1/g;

const sources = import.meta.glob(
  ['./**/*.{test,spec}.{ts,tsx}', '../../e2e/**/*.spec.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

function titlesIn(source: string): string[] {
  return [...source.matchAll(TITLE)].map((match) => match[2].replace(/\s+/g, ' ').trim());
}

describe('test titles', () => {
  it('should name unit tests with should and integration tests with GIVEN WHEN THEN', () => {
    const violations = Object.entries(sources).flatMap(([path, source]) =>
      titlesIn(source)
        .filter((title) => !UNIT.test(title) && !INTEGRATION.test(title))
        .map((title) => `${path}: ${title}`),
    );
    expect(violations).toEqual([]);
    expect(Object.keys(sources).length).toBeGreaterThan(5);
  });
});
