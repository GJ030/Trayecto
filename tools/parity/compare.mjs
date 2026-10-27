// Uso: node compare.mjs a.json b.json
import { readFileSync } from 'node:fs';
const [, , fa, fb] = process.argv;
const A = JSON.parse(readFileSync(fa, 'utf8')),
  B = JSON.parse(readFileSync(fb, 'utf8'));
let bad = 0;
const rep = (m) => {
  bad++;
  console.log('DIFF', m);
};
if (JSON.stringify(A.errors) !== JSON.stringify(B.errors)) rep(`errores: ${JSON.stringify(A.errors)} vs ${JSON.stringify(B.errors)}`);
for (const k of ['exported', 'csvTrips', 'csvFuel']) if (A[k] !== B[k]) rep(k);
if (A.snaps.length !== B.snaps.length) rep(`n snaps ${A.snaps.length} vs ${B.snaps.length}`);
const skipShot = process.env.NO_SHOTS === '1';
for (let i = 0; i < Math.min(A.snaps.length, B.snaps.length); i++) {
  const a = A.snaps[i],
    b = B.snaps[i];
  for (const k of Object.keys(a)) {
    if (skipShot && (k === 'shot' || k === 'shotFull')) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      let detail = '';
      if (typeof a[k] === 'string' && typeof b[k] === 'string') {
        let j = 0;
        while (j < a[k].length && a[k][j] === b[k][j]) j++;
        detail = `\n   A: …${a[k].slice(Math.max(0, j - 60), j + 100)}\n   B: …${b[k].slice(Math.max(0, j - 60), j + 100)}`;
      }
      rep(`#${i} ${a.label} :: ${k}${detail}`);
    }
  }
}
console.log(bad ? `${bad} diferencias` : 'IDÉNTICO');
process.exit(bad ? 1 : 0);
