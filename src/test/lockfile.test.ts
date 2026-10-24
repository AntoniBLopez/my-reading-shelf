import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(['../../package.json', '../../pnpm-lock.yaml'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function load(suffix: string): string {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(suffix));
  if (!entry) throw new Error(`missing ${suffix}`);
  return entry[1];
}

function sectionSpecifiers(block: string): Record<string, string> {
  const found: Record<string, string> = {};
  const lines = block.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].match(/^ {6}(?:'([^']+)'|([^':]+)):$/);
    const specifier = lines[index + 1]?.match(/^ {8}specifier: ['"]?(.+?)['"]?$/);
    if (name && specifier) found[name[1] ?? name[2]] = specifier[1];
  }
  return found;
}

describe('pnpm lockfile', () => {
  it('should record every package.json dependency specifier in the lockfile', () => {
    const pkg = JSON.parse(load('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const lock = load('pnpm-lock.yaml');
    const importer = lock.slice(lock.indexOf('\n  .:\n'), lock.indexOf('\npackages:\n'));
    const [dependencyBlock, devBlock] = importer.split('\n    devDependencies:\n');
    const dependencies = sectionSpecifiers(dependencyBlock);
    const devDependencies = sectionSpecifiers(devBlock);

    expect(dependencies).toEqual(pkg.dependencies);
    expect(devDependencies).toEqual(pkg.devDependencies);
    expect(dependencies['page-flip']).toBe('2.0.7');
    expect(devDependencies['page-flip']).toBeUndefined();
  });
});
