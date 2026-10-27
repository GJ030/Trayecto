/**
 * Regla de dependencias entre capas: shared → data → maps → features → app.
 * ESLint ya la vigila para los imports con `@/`; esta prueba revisa todos los imports (también los
 * relativos y los dinámicos) y comprueba que el verificador detecta las violaciones.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const LAYERS = ['shared', 'data', 'maps', 'features', 'app'] as const;
type Layer = (typeof LAYERS)[number];

interface Place {
  layer: Layer | 'root';
  feature?: string;
  /** Nombre del módulo sin extensión (p. ej. `trips.repo`). */
  module: string;
}
/** Capa, funcionalidad y módulo de una ruta dentro de src/ (con separador `/`). */
function locate(rel: string): Place {
  const parts = rel.replace(/\.(ts|css)$/, '').split('/');
  const layer = parts[0] as Layer;
  if (!LAYERS.includes(layer)) return { layer: 'root', module: parts.join('/') };
  return {
    layer,
    feature: layer === 'features' ? parts[1] : undefined,
    module: parts[parts.length - 1],
  };
}

interface Import {
  spec: string;
  typeOnly: boolean;
}
const IMPORT_RE =
  /(?:^|[\n;])\s*(import|export)\s+(type\s+)?([^'"`;]*?)\s*(?:from\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
/** Imports de un archivo. `import type {…}` y `import { type A, type B }` cuentan como solo de tipos. */
export function importsOf(code: string): Import[] {
  const out: Import[] = [];
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const m of clean.matchAll(IMPORT_RE)) {
    if (m[5]) {
      out.push({ spec: m[5], typeOnly: false });
      continue;
    }
    if (m[1] === 'export' && !/\bfrom\b/.test(m[0])) continue;
    const clause = (m[3] || '').trim();
    const named = clause.match(/^\{([\s\S]*)\}$/);
    const allInline =
      !!named &&
      named[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .every((s) => s.startsWith('type '));
    out.push({ spec: m[4], typeOnly: !!m[2] || allInline });
  }
  return out;
}

/** Ruta (relativa a src, con `/`) a la que apunta un import, o null si es de un paquete. */
function resolveSpec(fromRel: string, spec: string): string | null {
  if (spec.startsWith('@/')) return spec.slice(2);
  if (spec.startsWith('.')) {
    const abs = resolve(SRC, dirname(fromRel), spec);
    return relative(SRC, abs).split(sep).join('/');
  }
  return null;
}

/** Violaciones de la regla de capas para un archivo. */
export function violations(fromRel: string, code: string): string[] {
  const from = locate(fromRel);
  if (from.layer === 'root') return [];
  const bad: string[] = [];
  for (const { spec, typeOnly } of importsOf(code)) {
    const target = resolveSpec(fromRel, spec);
    if (target === null || typeOnly) continue;
    const to = locate(target);
    if (to.layer === 'root') continue;
    if (LAYERS.indexOf(to.layer) > LAYERS.indexOf(from.layer))
      bad.push(`${fromRel} importa «${spec}»: ${from.layer} no puede depender de ${to.layer}`);
    else if (
      from.layer === 'features' &&
      to.layer === 'features' &&
      from.feature !== to.feature &&
      !/\.(repo|calc)$/.test(to.module)
    )
      bad.push(
        `${fromRel} importa «${spec}»: de otra funcionalidad solo se puede usar su *.repo o su *.calc`,
      );
  }
  return bad;
}

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'testing' ? [] : sourceFiles(p);
    return /\.ts$/.test(name) && !/\.(test|d)\.ts$/.test(name) ? [p] : [];
  });
}
const rel = (p: string) => relative(SRC, p).split(sep).join('/');

describe('capas: shared → data → maps → features → app', () => {
  const files = sourceFiles();

  it('hay código en cada capa (la prueba no está vacía)', () => {
    for (const l of LAYERS) expect(files.some((f) => rel(f).startsWith(l + '/'))).toBe(true);
  });
  it('ningún archivo importa de una capa superior ni de otra funcionalidad (salvo *.repo y *.calc)', () => {
    const bad = files.flatMap((f) => violations(rel(f), readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
  it('los repositorios no dependen de vistas ni formularios', () => {
    const bad = files
      .filter((f) => /\.repo\.ts$/.test(f))
      .flatMap((f) =>
        importsOf(readFileSync(f, 'utf8'))
          .filter(
            (i) =>
              !i.typeOnly &&
              /\.(view|form|actions|ui)$|shared\/ui\/(dom|toast|modal|drawer)/.test(i.spec),
          )
          .map((i) => `${rel(f)} importa «${i.spec}»`),
      );
    expect(bad).toEqual([]);
  });
  it('trips.repo no importa lugares (places.repo depende de trips.repo, nunca al revés)', () => {
    const f = files.find((x) => rel(x) === 'features/trips/trips.repo.ts')!;
    const targets = importsOf(readFileSync(f, 'utf8')).map((i) => i.spec);
    expect(targets.filter((s) => /places/.test(s))).toEqual([]);
  });
  it('solo app/ y main.ts importan app/', () => {
    const bad = files
      .filter((f) => !rel(f).startsWith('app/') && rel(f) !== 'main.ts')
      .flatMap((f) =>
        importsOf(readFileSync(f, 'utf8'))
          .filter((i) => !i.typeOnly && resolveSpec(rel(f), i.spec)?.startsWith('app/'))
          .map((i) => `${rel(f)} importa «${i.spec}»`),
      );
    expect(bad).toEqual([]);
  });
});

describe('el verificador detecta violaciones', () => {
  it('capa inferior importando una superior', () => {
    expect(violations('shared/utils/x.ts', "import { S } from '@/data/store';")).toHaveLength(1);
    expect(violations('data/x.ts', "import { go } from '@/app/nav';")).toHaveLength(1);
    expect(
      violations('maps/x.ts', "import { a } from '@/features/trips/trips.repo';"),
    ).toHaveLength(1);
    expect(violations('features/trips/x.ts', "import { a } from '@/app/nav';")).toHaveLength(1);
  });
  it('también con rutas relativas y con import dinámico o reexportación', () => {
    expect(violations('shared/ui/x.ts', "import { S } from '../../data/store';")).toHaveLength(1);
    expect(
      violations('shared/ui/x.ts', "const m = await import('../../data/store');"),
    ).toHaveLength(1);
    expect(violations('shared/ui/x.ts', "export { S } from '../../data/store';")).toHaveLength(1);
    expect(violations('data/storage/x.ts', "import '../../app/nav';")).toHaveLength(1);
  });
  it('funcionalidades: solo *.repo y *.calc de otra', () => {
    const src = (m: string) => `import { a } from '@/features/places/${m}';`;
    expect(violations('features/trips/trips.view.ts', src('places.repo'))).toEqual([]);
    expect(violations('features/trips/trips.view.ts', src('places.calc'))).toEqual([]);
    expect(violations('features/trips/trips.view.ts', src('places.view'))).toHaveLength(1);
    expect(violations('features/trips/trips.view.ts', src('places.form'))).toHaveLength(1);
    expect(
      violations('features/trips/trips.view.ts', "import { a } from '../places/places.ui';"),
    ).toHaveLength(1);
    expect(
      violations('features/places/places.view.ts', "import { a } from './places.form';"),
    ).toEqual([]);
  });
  it('los imports de solo tipos están permitidos en cualquier dirección', () => {
    expect(violations('shared/ui/x.ts', "import type { AppData } from '@/data/schema';")).toEqual(
      [],
    );
    expect(violations('shared/ui/x.ts', "import { type A, type B } from '@/data/schema';")).toEqual(
      [],
    );
    expect(violations('shared/ui/x.ts', "export type { A } from '@/data/schema';")).toEqual([]);
    expect(violations('shared/ui/x.ts', "import { type A, b } from '@/data/schema';")).toHaveLength(
      1,
    );
  });
  it('permite capas inferiores, paquetes y recursos', () => {
    const code = `
      import { esc } from '@/shared/utils/format';
      import { S } from '@/data/store';
      import maplibre from 'maplibre-gl';
      import './x.css';
    `;
    expect(violations('features/trips/trips.view.ts', code)).toEqual([]);
    expect(violations('app/nav.ts', code)).toEqual([]);
  });
  it('ignora imports dentro de comentarios', () => {
    expect(
      violations(
        'shared/ui/x.ts',
        "// import { S } from '@/data/store';\n/* import '@/app/nav' */",
      ),
    ).toEqual([]);
  });
});
