/*
 * Geometry engine for the Les Constructions Viens symbol.
 *
 * The symbol is two filled polygons ("left" = the green C-shaped band,
 * "right" = the black band + V). Every corner is rounded with a TRUE circular
 * arc of a fixed radius in pixels (never a radius that depends on the angle).
 *
 * Coordinates are "master pixels": pixels of logo_square original.png, with the
 * origin at the centre of the hexagon. y grows downwards (screen / SVG style).
 */
(function (root) {
  'use strict';
  const LE = (root.LE = root.LE || {});

  // ---------- small vector helpers ----------
  const v = (x, y) => ({ x, y });
  const add = (a, b) => v(a.x + b.x, a.y + b.y);
  const sub = (a, b) => v(a.x - b.x, a.y - b.y);
  const mul = (a, k) => v(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const len = (a) => Math.hypot(a.x, a.y);
  const norm = (a) => { const l = len(a) || 1; return v(a.x / l, a.y / l); };
  const mirror = (p) => v(-p.x, p.y);

  /** Intersection of line (p1 + t*d1) and (p2 + s*d2). Returns null if parallel. */
  function intersect(p1, d1, p2, d2) {
    const den = cross(d1, d2);
    if (Math.abs(den) < 1e-9) return null;
    const t = cross(sub(p2, p1), d2) / den;
    return add(p1, mul(d1, t));
  }
  /** Line through a and b intersected with the vertical line x = X. */
  function atX(a, b, X) {
    return intersect(a, sub(b, a), v(X, 0), v(0, 1)) || v(X, a.y);
  }

  /** Mirror pairs: left id -> right id. Axis points have their x locked to 0. */
  const PAIRS = { UL: 'UR', LL: 'LR', IUL: 'IUR', ILL: 'ILR' };
  const AXIS = ['T', 'BV', 'TI', 'BVI'];
  /** Radius pairs (vertex ids that must share one radius when symmetric). */
  const RADIUS_PAIRS = { UL: 'UR', LL: 'LR', ILL: 'ILR', G3: 'B10', G4: 'B9' };

  /**
   * Build the two polygons (sharp corners, before rounding) from a design.
   * Returns { left: [{id,x,y,r}], right: [...], guides: {...} }.
   */
  function buildPolygons(design) {
    const P = design.points;
    const p = (id) => v(P[id].x, P[id].y);
    const T = p('T'), UL = p('UL'), LL = p('LL'), UR = p('UR'), LR = p('LR'), BV = p('BV');
    const TI = p('TI'), IUL = p('IUL'), ILL = p('ILL'), IUR = p('IUR'), ILR = p('ILR'), BVI = p('BVI');
    const g = design.gaps;

    // Bottom gap: a vertical slot of width g.bottom centred on the axis.
    const hb = g.bottom / 2;
    const G3 = atX(LL, BV, -hb);
    const G4 = atX(ILL, BVI, -hb);
    const B10 = atX(LR, BV, hb);
    const B9 = atX(ILR, BVI, hb);

    // Top-right gap: a slot parallel to the upper-left edge (T -> UL),
    // centred at fraction g.topPos along the outer upper-right edge (T -> UR).
    const u = norm(sub(UL, T));                 // slot direction
    let n = v(-u.y, u.x);                       // slot normal
    const C = add(T, mul(sub(UR, T), g.topPos)); // slot centre on the outer edge
    if (dot(n, sub(T, C)) < 0) n = mul(n, -1);  // n points toward the green side
    const c1 = add(C, mul(n, g.top / 2));        // green end line passes here
    const c2 = add(C, mul(n, -g.top / 2));       // black start line passes here
    const G9 = intersect(c1, u, T, sub(UR, T));
    const G8 = intersect(c1, u, TI, sub(IUR, TI));
    const B0 = intersect(c2, u, T, sub(UR, T));
    const V2 = p('V2');
    const B1 = intersect(c2, u, V2, sub(p('V1'), V2));
    // Tip of the V's right arm sits on the inner right edge of the band.
    const V6 = p('V6');
    const B7 = intersect(ILR, sub(IUR, ILR), V6, sub(p('V7'), V6));

    const R = design.radii;
    const mk = (id, q) => ({ id, x: q.x, y: q.y, r: R[id] != null ? R[id] : 0 });
    const left = [
      mk('T', T), mk('UL', UL), mk('LL', LL), mk('G3', G3), mk('G4', G4),
      mk('ILL', ILL), mk('IUL', IUL), mk('TI', TI), mk('G8', G8), mk('G9', G9),
    ];
    const right = [
      mk('B0', B0), mk('V1', B1), mk('V2', V2), mk('V3', p('V3')), mk('V4', p('V4')),
      mk('V5', p('V5')), mk('V6', V6), mk('V7', B7), mk('ILR', ILR), mk('B9', B9),
      mk('B10', B10), mk('LR', LR), mk('UR', UR),
    ];
    return { left, right, guides: { BV, BVI, IUR } };
  }

  /**
   * Round every corner of a closed polygon with a true circular arc.
   * If two neighbouring arcs would overlap on a short edge, both are reduced
   * proportionally and the vertex is reported in `clamped`.
   */
  function roundedPath(verts, fmt) {
    fmt = fmt || ((x) => +x.toFixed(3));
    const n = verts.length;
    const info = verts.map((P, i) => {
      const prev = verts[(i - 1 + n) % n], next = verts[(i + 1) % n];
      const a = norm(sub(prev, P)), b = norm(sub(next, P));
      const theta = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
      const tanHalf = Math.tan(theta / 2);
      const r = Math.max(0, P.r || 0);
      const t = tanHalf > 1e-6 ? r / tanHalf : 0;
      return { P, a, b, theta, tanHalf, r, t };
    });
    // Clamp tangent lengths so arcs never overlap along an edge.
    const scale = info.map(() => 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const L = len(sub(verts[j], verts[i]));
      const need = info[i].t + info[j].t;
      if (need > L && need > 0) {
        const k = L / need;
        scale[i] = Math.min(scale[i], k);
        scale[j] = Math.min(scale[j], k);
      }
    }
    const clamped = [];
    let d = '';
    const pts = [];
    info.forEach((c, i) => {
      const t = c.t * scale[i];
      const rEff = t * c.tanHalf;
      if (scale[i] < 0.999 && c.r > 0) clamped.push({ id: c.P.id, wanted: c.r, actual: rEff });
      const A = add(c.P, mul(c.a, t)), B = add(c.P, mul(c.b, t));
      const turn = cross(sub(c.P, verts[(i - 1 + n) % n]), sub(verts[(i + 1) % n], c.P));
      pts.push({ A, B, r: rEff, sweep: turn > 0 ? 1 : 0, center: rEff > 1e-6 ? add(c.P, mul(norm(add(c.a, c.b)), rEff / Math.sin(c.theta / 2))) : null });
    });
    pts.forEach((q, i) => {
      d += (i === 0 ? 'M' : 'L') + fmt(q.A.x) + ' ' + fmt(q.A.y);
      if (q.r > 1e-6) d += 'A' + fmt(q.r) + ' ' + fmt(q.r) + ' 0 0 ' + q.sweep + ' ' + fmt(q.B.x) + ' ' + fmt(q.B.y);
    });
    d += 'Z';
    return { d, clamped, pts };
  }

  /** Exact bounding box of a rounded polygon (lines + arcs). */
  function roundedBBox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const addP = (p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
    pts.forEach((q) => {
      addP(q.A); addP(q.B);
      if (q.center) {
        // include axis-extreme points of the arc that lie between A and B
        const a0 = Math.atan2(q.A.y - q.center.y, q.A.x - q.center.x);
        const a1 = Math.atan2(q.B.y - q.center.y, q.B.x - q.center.x);
        let span = a1 - a0;
        if (q.sweep === 1) { while (span < 0) span += 2 * Math.PI; } else { while (span > 0) span -= 2 * Math.PI; }
        for (let k = -4; k <= 4; k++) {
          const ang = (k * Math.PI) / 2;
          let rel = ang - a0;
          if (q.sweep === 1) { rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (rel <= span) addP(v(q.center.x + q.r * Math.cos(ang), q.center.y + q.r * Math.sin(ang))); }
          else { rel = ((rel % (2 * Math.PI)) - 2 * Math.PI) % (2 * Math.PI); if (rel >= span) addP(v(q.center.x + q.r * Math.cos(ang), q.center.y + q.r * Math.sin(ang))); }
        }
      }
    });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  /** Full symbol: both rounded paths + combined bbox + clamping warnings. */
  function buildSymbol(design) {
    const polys = buildPolygons(design);
    const L = roundedPath(polys.left), Rt = roundedPath(polys.right);
    const b1 = roundedBBox(L.pts), b2 = roundedBBox(Rt.pts);
    const x0 = Math.min(b1.x0, b2.x0), y0 = Math.min(b1.y0, b2.y0), x1 = Math.max(b1.x1, b2.x1), y1 = Math.max(b1.y1, b2.y1);
    return {
      polys,
      left: L.d, right: Rt.d,
      clamped: L.clamped.concat(Rt.clamped),
      bbox: { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 },
    };
  }

  /** Enforce left/right symmetry on a design (left side is the reference). */
  function symmetrize(design) {
    const P = design.points;
    Object.keys(PAIRS).forEach((l) => { const m = mirror(P[l]); P[PAIRS[l]] = { x: m.x, y: m.y }; });
    AXIS.forEach((id) => { P[id].x = 0; });
    Object.keys(RADIUS_PAIRS).forEach((l) => { design.radii[RADIUS_PAIRS[l]] = design.radii[l]; });
    return design;
  }

  /** Placement of the master symbol into a file: maps the ORIGINAL master bbox onto the file's symbol bbox. */
  function placement(masterBBox, fileBBox) {
    const [fx0, fy0, fx1, fy1] = fileBBox;
    const fw = fx1 - fx0, fh = fy1 - fy0;
    const s = Math.sqrt((fw / masterBBox.w) * (fh / masterBBox.h));
    const tx = (fx0 + fx1) / 2 - s * masterBBox.cx;
    const ty = (fy0 + fy1) / 2 - s * masterBBox.cy;
    return { s, tx, ty };
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));

  LE.geo = { v, add, sub, mul, dot, cross, len, norm, mirror, intersect, atX, buildPolygons, roundedPath, roundedBBox, buildSymbol, symmetrize, placement, clone, PAIRS, AXIS, RADIUS_PAIRS };
})(typeof window !== 'undefined' ? window : globalThis);
