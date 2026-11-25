/* Run with:  node tests/geometry.test.js   (no install needed) */
'use strict';
require('../js/geometry.js');
require('../js/master.js');
require('../js/suite.js');
require('../js/zip.js');
const assert = require('assert');
const G = LE.geo;

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, (msg || '') + ` expected ${b}, got ${a}`);

/** Parse our own SVG path output (M/L/A/Z with absolute coordinates). */
function parsePath(d) {
  const cmds = [];
  const re = /([MLAZ])([^MLAZ]*)/g;
  let m;
  while ((m = re.exec(d))) cmds.push({ c: m[1], a: m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [] });
  return cmds;
}

test('master polygons reproduce the corners measured on logo_square original.png (within 2.5 px)', () => {
  const measured = { // absolute pixels in the original file (fit_radii.py output)
    T: [627.2, 310.1], UL: [390.0, 452.6], LL: [390.0, 731.5], ILL: [463.0, 687.0], IUL: [463.0, 497.4], TI: [626.6, 399.6],
    G8: [709.4, 448.1], G9: [783.1, 402.9], B0: [813.1, 420.8], V1: [726.6, 473.4], V2: [639.6, 630.5], V3: [574.9, 515.0],
    V4: [487.2, 515.0], V5: [619.4, 751.6], V6: [694.9, 698.6], V7: [789.0, 525.6], ILR: [789.0, 685.6], LR: [864.0, 733.7], UR: [864.0, 452.1],
  };
  const polys = G.buildPolygons(LE.MASTER);
  polys.left.concat(polys.right).forEach((p) => {
    const m = measured[p.id];
    if (!m) return;
    close(p.x + 627, m[0], 2.5, p.id + '.x');
    close(p.y + 592.5, m[1], 2.5, p.id + '.y');
  });
});

test('master is exactly left/right symmetric (outer + inner hexagon, gap, radii)', () => {
  const d = G.symmetrize(G.clone(LE.MASTER));
  assert.deepStrictEqual(d.points, LE.MASTER.points);
  assert.deepStrictEqual(d.radii, LE.MASTER.radii);
  const p = G.buildPolygons(LE.MASTER);
  const get = (id) => p.left.concat(p.right).find((q) => q.id === id);
  [['G3', 'B10'], ['G4', 'B9'], ['UL', 'UR'], ['LL', 'LR'], ['ILL', 'ILR']].forEach(([a, b]) => {
    close(get(a).x, -get(b).x, 1e-9, a + '/' + b + ' x');
    close(get(a).y, get(b).y, 1e-9, a + '/' + b + ' y');
  });
});

test('every rounded corner is a TRUE circular arc of the requested radius', () => {
  const d = G.clone(LE.MASTER);
  const polys = G.buildPolygons(d);
  ['left', 'right'].forEach((side) => {
    const rp = G.roundedPath(polys[side]);
    rp.pts.forEach((q, i) => {
      const want = polys[side][i].r;
      if (want === 0) return;
      close(q.r, want, 1e-9, polys[side][i].id + ' radius'); // nothing clamped on the master
      // both tangent points are exactly r away from the centre
      close(Math.hypot(q.A.x - q.center.x, q.A.y - q.center.y), want, 1e-6);
      close(Math.hypot(q.B.x - q.center.x, q.B.y - q.center.y), want, 1e-6);
    });
    // and the SVG path writes that same radius
    const arcs = parsePath(rp.d).filter((c) => c.c === 'A');
    arcs.forEach((a) => assert.strictEqual(a.a[0], a.a[1], 'circular, not elliptical'));
  });
});

test('same radius gives same roundness whatever the corner angle (no angle-dependent rounding)', () => {
  // a sharp 30° corner and a flat 150° corner, both with r = 20
  const sharp = [{ x: 0, y: 0, r: 20 }, { x: 400, y: 0, r: 0 }, { x: 400 * Math.cos(Math.PI / 6), y: 400 * Math.sin(Math.PI / 6), r: 0 }];
  const flat = [{ x: 0, y: 0, r: 20 }, { x: 400, y: 0, r: 0 }, { x: -400 * Math.cos(Math.PI / 6), y: 400 * Math.sin(Math.PI / 6), r: 0 }];
  close(G.roundedPath(sharp).pts[0].r, 20, 1e-9);
  close(G.roundedPath(flat).pts[0].r, 20, 1e-9);
});

test('too-large radii are reduced (never overlapping) and reported', () => {
  const d = G.clone(LE.MASTER);
  d.radii.V3 = 200; d.radii.V4 = 200;
  const s = G.buildSymbol(d);
  const ids = s.clamped.map((c) => c.id);
  assert.ok(ids.includes('V3') && ids.includes('V4'));
});

test('gaps: bottom gap width and top gap width are exact', () => {
  const d = G.clone(LE.MASTER);
  d.gaps.bottom = 40; d.gaps.top = 20;
  const p = G.buildPolygons(d);
  const get = (id) => p.left.concat(p.right).find((q) => q.id === id);
  close(get('B10').x - get('G3').x, 40, 1e-9);
  close(get('B9').x - get('G4').x, 40, 1e-9);
  // perpendicular distance between the two cut lines of the top gap
  const u = G.norm(G.sub(d.points.UL, d.points.T));
  const nrm = { x: -u.y, y: u.x };
  close(Math.abs(G.dot(G.sub(get('B0'), get('G9')), nrm)), 20, 1e-6);
});

test('placement maps the master onto logo_square original.png almost 1:1', () => {
  const sym = G.buildSymbol(LE.MASTER);
  const sq = LE.SUITE.find((e) => e.path === 'logo_square original.png');
  const pl = G.placement(sym.bbox, sq.symbol.bbox);
  close(pl.s, 1, 0.01, 'scale');
});

test('suite: 20 files, unique names, sizes present', () => {
  assert.strictEqual(LE.SUITE.length, 20);
  const names = LE.SUITE.map((e) => e.path.split('/').pop());
  assert.strictEqual(new Set(names).size, names.length);
  LE.SUITE.forEach((e) => assert.ok(e.w > 0 && e.h > 0));
});

test('zip: CRC32 known value and valid structure', () => {
  assert.strictEqual(LE.zip.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const z = LE.zip.makeZip([{ name: 'Logo/a.txt', data: new TextEncoder().encode('hello') }]);
  const dv = new DataView(z.buffer);
  assert.strictEqual(dv.getUint32(0, true), 0x04034b50);
  assert.strictEqual(dv.getUint32(z.length - 22, true), 0x06054b50);
});

console.log(`\nall ${n} tests passed`);
