/* Logo symbol editor — UI wiring. Plain script (no modules) so it runs from file://. */
(function () {
  'use strict';
  const G = LE.geo;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'logo-editor-design-v1';

  // ---------------------------------------------------------------- state
  const ORIGINAL = G.buildSymbol(LE.MASTER);
  const MASTER_BBOX = ORIGINAL.bbox; // placement reference for every file
  const ORIGINAL_POLYS = G.buildPolygons(LE.MASTER);

  const state = {
    design: loadSaved() || G.clone(LE.MASTER),
    undo: [], redo: [],
    selected: null,
    showGhost: true, showPixels: true,
    files: new Map(), // suite path -> { entry, img, base, baseURL, card, canvas }
    view: null,
  };
  let symbol = G.buildSymbol(state.design);

  function loadSaved() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (!s) return null;
      const d = JSON.parse(s);
      return validDesign(d) ? d : null;
    } catch (e) { return null; }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.design)); } catch (e) { /* private mode: ignore */ }
  }
  function validDesign(d) {
    if (!d || !d.points || !d.gaps || !d.radii) return false;
    return Object.keys(LE.MASTER.points).every((k) => d.points[k] && isFinite(d.points[k].x) && isFinite(d.points[k].y)) &&
      ['bottom', 'top', 'topPos'].every((k) => isFinite(d.gaps[k]));
  }

  // ---------------------------------------------------------------- history
  function checkpoint() {
    state.undo.push(JSON.stringify(state.design));
    if (state.undo.length > 200) state.undo.shift();
    state.redo = [];
  }
  function undo() {
    if (!state.undo.length) return;
    state.redo.push(JSON.stringify(state.design));
    state.design = JSON.parse(state.undo.pop());
    changed();
  }
  function redo() {
    if (!state.redo.length) return;
    state.undo.push(JSON.stringify(state.design));
    state.design = JSON.parse(state.redo.pop());
    changed();
  }

  /** Call after every change of state.design. */
  function changed(opts) {
    if (state.design.symmetric) G.symmetrize(state.design);
    symbol = G.buildSymbol(state.design);
    persist();
    drawEditor();
    syncPanel(opts);
    schedulePreviews();
  }

  // ---------------------------------------------------------------- handle model
  const FREE = ['T', 'UL', 'LL', 'ILL', 'IUL', 'TI', 'V2', 'V3', 'V4', 'V5', 'V6', 'ILR', 'LR', 'UR'];
  const VIRTUAL = ['BV', 'BVI', 'IUR'];
  const BOTTOM_GAP = ['G3', 'G4', 'B9', 'B10'];
  const TOP_GAP = ['G8', 'G9', 'B0'];
  const LINE_PTS = ['V1', 'V7'];
  const PARTNER = {};
  Object.keys(G.PAIRS).forEach((l) => { PARTNER[l] = G.PAIRS[l]; PARTNER[G.PAIRS[l]] = l; });
  const R_PARTNER = {};
  Object.keys(G.RADIUS_PAIRS).forEach((l) => { R_PARTNER[l] = G.RADIUS_PAIRS[l]; R_PARTNER[G.RADIUS_PAIRS[l]] = l; });

  function handleList() {
    const out = [];
    const verts = symbol.polys.left.concat(symbol.polys.right);
    verts.forEach((p) => {
      let kind = 'free';
      if (BOTTOM_GAP.includes(p.id) || TOP_GAP.includes(p.id)) kind = 'gap';
      out.push({ id: p.id, x: p.x, y: p.y, kind });
    });
    VIRTUAL.forEach((id) => {
      const p = state.design.points[id];
      out.push({ id, x: p.x, y: p.y, kind: 'virt' });
    });
    return out;
  }
  const isVertex = (id) => !VIRTUAL.includes(id);

  function setPoint(id, m) {
    const P = state.design.points;
    const sym = state.design.symmetric;
    if (sym && G.AXIS.includes(id)) m = { x: 0, y: m.y };
    P[id] = { x: m.x, y: m.y };
    if (sym && PARTNER[id]) P[PARTNER[id]] = { x: -m.x, y: m.y };
  }

  function dragTo(id, m) {
    const d = state.design;
    if (BOTTOM_GAP.includes(id)) {
      d.gaps.bottom = round2(Math.max(0, Math.min(200, 2 * Math.abs(m.x))));
    } else if (TOP_GAP.includes(id)) {
      const T = d.points.T, UR = d.points.UR;
      const e = G.sub(UR, T);
      const t = G.dot(G.sub(m, T), e) / G.dot(e, e);
      d.gaps.topPos = round2(Math.max(0.05, Math.min(0.95, t)), 4);
    } else {
      setPoint(id, { x: round2(m.x), y: round2(m.y) });
    }
  }
  const round2 = (x, k) => { const f = Math.pow(10, k || 2); return Math.round(x * f) / f; };

  // ---------------------------------------------------------------- editor canvas
  const cv = $('editor');
  const ctx = cv.getContext('2d');
  let dpr = 1;

  function fitView() {
    const r = cv.getBoundingClientRect();
    const b = MASTER_BBOX;
    const s = Math.min(r.width / (b.w * 1.35), r.height / (b.h * 1.22));
    state.view = { s, ox: r.width / 2 - b.cx * s, oy: r.height / 2 - b.cy * s };
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    if (!state.view) fitView();
    drawEditor();
  }
  const toScreen = (p) => ({ x: state.view.ox + p.x * state.view.s, y: state.view.oy + p.y * state.view.s });
  const toMaster = (x, y) => ({ x: (x - state.view.ox) / state.view.s, y: (y - state.view.oy) / state.view.s });

  function drawEditor() {
    if (!state.view) return;
    const W = cv.width / dpr, H = cv.height / dpr;
    const V = state.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // original pixels underneath (logo_square original.png), aligned with the master
    const sq = state.files.get('logo_square original.png');
    if (state.showPixels && sq && sq.img) {
      const pl = G.placement(MASTER_BBOX, scaledBox(sq));
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.setTransform(dpr * V.s / pl.s, 0, 0, dpr * V.s / pl.s, dpr * (V.ox - V.s * pl.tx / pl.s), dpr * (V.oy - V.s * pl.ty / pl.s));
      ctx.drawImage(sq.img, 0, 0);
      ctx.restore();
    }

    // symmetry axis
    if (state.design.symmetric) {
      ctx.save();
      ctx.strokeStyle = 'rgba(31,111,235,.35)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      const a = toScreen({ x: 0, y: MASTER_BBOX.y0 - 40 }), b = toScreen({ x: 0, y: MASTER_BBOX.y1 + 40 });
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }

    // current symbol
    ctx.save();
    ctx.setTransform(dpr * V.s, 0, 0, dpr * V.s, dpr * V.ox, dpr * V.oy);
    ctx.globalAlpha = state.showPixels && sq ? 0.78 : 1;
    ctx.fillStyle = state.design.colors.green;
    ctx.fill(new Path2D(symbol.left));
    ctx.fillStyle = '#111';
    ctx.fill(new Path2D(symbol.right));
    ctx.globalAlpha = 1;
    // original outline
    if (state.showGhost) {
      ctx.lineWidth = 1.5 / V.s;
      ctx.setLineDash([5 / V.s, 4 / V.s]);
      ctx.strokeStyle = '#e0368b';
      ctx.stroke(new Path2D(ORIGINAL.left));
      ctx.stroke(new Path2D(ORIGINAL.right));
      ctx.setLineDash([]);
    }
    ctx.restore();

    // selected corner: show its circle
    if (state.selected && isVertex(state.selected)) {
      const info = cornerInfo(state.selected);
      if (info && info.center && info.r > 0) {
        const c = toScreen(info.center);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,122,0,.9)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(c.x, c.y, info.r * V.s, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,122,0,.9)';
        ctx.beginPath(); ctx.arc(c.x, c.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // handles
    handleList().forEach((h) => {
      const p = toScreen(h);
      const sel = h.id === state.selected || (state.design.symmetric && (PARTNER[state.selected] === h.id || R_PARTNER[state.selected] === h.id));
      ctx.save();
      ctx.lineWidth = 2;
      if (h.kind === 'gap') {
        ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = sel ? '#ff7a00' : '#fff';
        ctx.strokeStyle = '#1f6feb';
        ctx.fillRect(-4.5, -4.5, 9, 9); ctx.strokeRect(-4.5, -4.5, 9, 9);
      } else if (h.kind === 'virt') {
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = '#676d72';
        ctx.fillStyle = sel ? '#ff7a00' : 'rgba(255,255,255,.6)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = sel ? '#ff7a00' : '#fff';
        ctx.strokeStyle = '#16181a';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    });
  }

  function cornerInfo(id) {
    for (const key of ['left', 'right']) {
      const verts = symbol.polys[key];
      const i = verts.findIndex((p) => p.id === id);
      if (i >= 0) { const rp = G.roundedPath(verts); return rp.pts[i]; }
    }
    return null;
  }

  // pointer interaction
  let drag = null;
  function hit(x, y) {
    let best = null, bd = 12;
    handleList().forEach((h) => {
      const p = toScreen(h);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = h; }
    });
    return best;
  }
  function localXY(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    const q = localXY(e);
    const h = hit(q.x, q.y);
    if (h) {
      state.selected = h.id;
      checkpoint();
      drag = { type: 'handle', id: h.id, moved: false, off: (() => { const p = toScreen(h); return { x: p.x - q.x, y: p.y - q.y }; })() };
      drawEditor(); syncPanel();
    } else {
      drag = { type: 'pan', x: q.x, y: q.y, ox: state.view.ox, oy: state.view.oy };
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const q = localXY(e);
    if (!drag) { cv.style.cursor = hit(q.x, q.y) ? 'grab' : 'default'; return; }
    if (drag.type === 'pan') {
      state.view.ox = drag.ox + (q.x - drag.x); state.view.oy = drag.oy + (q.y - drag.y);
      drawEditor();
    } else {
      drag.moved = true;
      cv.style.cursor = 'grabbing';
      dragTo(drag.id, toMaster(q.x + drag.off.x, q.y + drag.off.y));
      changed({ fromDrag: true });
    }
  });
  const endDrag = () => {
    if (drag && drag.type === 'handle' && !drag.moved) state.undo.pop(); // click only: no history entry
    drag = null; cv.style.cursor = 'default';
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const q = localXY(e);
    const k = Math.exp(-e.deltaY * 0.0015);
    const V = state.view;
    const ns = Math.max(0.1, Math.min(40, V.s * k));
    const m = toMaster(q.x, q.y);
    V.s = ns; V.ox = q.x - m.x * ns; V.oy = q.y - m.y * ns;
    drawEditor();
  }, { passive: false });
  $('zoom-fit').onclick = () => { fitView(); drawEditor(); };
  new ResizeObserver(resize).observe(cv);

  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const inField = tag === 'input' || tag === 'select' || tag === 'textarea';
    const numField = tag === 'input' && ['number', 'range', 'checkbox'].includes(e.target.type);
    if (!inField || numField) {
      // Undo/redo also work while a number box or slider has focus (they have no useful undo of their own).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (numField) e.target.blur(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); if (numField) e.target.blur(); redo(); return; }
    }
    if (e.key === 'Escape') { closeModal(); return; }
    if (inField) return;
    const id = state.selected;
    if (!id || !(FREE.includes(id) || VIRTUAL.includes(id) || LINE_PTS.includes(id))) return;
    const step = e.shiftKey ? 5 : 0.5;
    const dirs = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!dirs[e.key]) return;
    e.preventDefault();
    checkpoint();
    const p = state.design.points[id];
    setPoint(id, { x: round2(p.x + dirs[e.key][0]), y: round2(p.y + dirs[e.key][1]) });
    changed();
  });

  // ---------------------------------------------------------------- side panel
  function bindPair(rangeId, numId, get, set, scale) {
    scale = scale || 1;
    const r = $(rangeId), n = $(numId);
    const apply = (val, commit) => {
      if (!isFinite(val)) return;
      if (commit) checkpoint();
      set(val / scale);
      changed({ skip: [rangeId, numId] });
      r.value = val; n.value = val;
    };
    r.addEventListener('pointerdown', () => checkpoint());
    r.addEventListener('keydown', () => checkpoint());
    r.addEventListener('input', () => apply(parseFloat(r.value), false));
    n.addEventListener('change', () => apply(parseFloat(n.value), true));
    return () => { const v = +(get() * scale).toFixed(2); r.value = v; n.value = v; };
  }
  const syncBottom = bindPair('gap-bottom-r', 'gap-bottom', () => state.design.gaps.bottom, (v) => { state.design.gaps.bottom = Math.max(0, v); });
  const syncTop = bindPair('gap-top-r', 'gap-top', () => state.design.gaps.top, (v) => { state.design.gaps.top = Math.max(0, v); });
  const syncPos = bindPair('gap-pos-r', 'gap-pos', () => state.design.gaps.topPos, (v) => { state.design.gaps.topPos = Math.max(0.05, Math.min(0.95, v)); }, 100);
  const syncSelR = bindPair('sel-r-r', 'sel-r', () => state.design.radii[state.selected] || 0, (v) => setRadius(state.selected, Math.max(0, v)));

  function setRadius(id, r) {
    if (!id) return;
    state.design.radii[id] = round2(r);
    if (state.design.symmetric && R_PARTNER[id]) state.design.radii[R_PARTNER[id]] = round2(r);
  }

  $('sym').addEventListener('change', (e) => { checkpoint(); state.design.symmetric = e.target.checked; changed(); });
  $('show-ghost').addEventListener('change', (e) => { state.showGhost = e.target.checked; drawEditor(); });
  $('show-pixels').addEventListener('change', (e) => { state.showPixels = e.target.checked; drawEditor(); });

  ['sel-x', 'sel-y'].forEach((fid, k) => {
    $(fid).addEventListener('change', (e) => {
      const id = state.selected; const v = parseFloat(e.target.value);
      if (!id || !isFinite(v)) return;
      checkpoint();
      const p = Object.assign({}, state.design.points[id]);
      if (k === 0) p.x = v; else p.y = v;
      setPoint(id, p); changed();
    });
  });

  const GROUPS = {
    outer: ['T', 'UL', 'UR', 'LL', 'LR'],
    inner: ['TI', 'IUL', 'ILL', 'ILR'],
    tips: ['G3', 'B10', 'G9'],
    v: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'],
  };
  $('grp-apply').onclick = () => {
    const r = parseFloat($('grp-r').value);
    if (!isFinite(r) || r < 0) return;
    checkpoint();
    GROUPS[$('grp').value].forEach((id) => { state.design.radii[id] = round2(r); });
    changed();
  };

  $('undo').onclick = undo;
  $('redo').onclick = redo;
  $('reset').onclick = () => {
    if (!confirm('Go back to the measured original symbol? (You can undo this.)')) return;
    checkpoint();
    state.design = G.clone(LE.MASTER);
    changed();
  };
  $('save-design').onclick = () => {
    const blob = new Blob([JSON.stringify(state.design, null, 2)], { type: 'application/json' });
    download(blob, 'logo-design.json');
  };
  $('load-design').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!validDesign(d)) throw new Error('not a logo design file');
      checkpoint();
      state.design = Object.assign(G.clone(LE.MASTER), d);
      changed();
    } catch (err) { alert('Could not load this design: ' + err.message); }
  });

  function syncPanel(opts) {
    const d = state.design;
    $('sym').checked = d.symmetric;
    const skip = (opts && opts.skip) || [];
    if (!skip.includes('gap-bottom')) syncBottom();
    if (!skip.includes('gap-top')) syncTop();
    if (!skip.includes('gap-pos')) syncPos();
    $('undo').disabled = !state.undo.length;
    $('redo').disabled = !state.redo.length;

    const id = state.selected;
    $('sel-none').hidden = !!id;
    $('sel-box').hidden = !id;
    if (id) {
      const partner = d.symmetric ? (PARTNER[id] || R_PARTNER[id]) : null;
      $('sel-name').textContent = (LE.LABELS[id] || id) + (partner ? '  ↔  ' + (LE.LABELS[partner] || partner) : '');
      const vert = isVertex(id);
      $('sel-r').disabled = $('sel-r-r').disabled = !vert;
      if (vert && !skip.includes('sel-r')) syncSelR();
      const meas = LE.MEASURED_RADII[id];
      let txt = '';
      if (vert && meas != null) {
        txt = 'Measured on the original: ' + meas + ' px';
        const pm = partner && LE.MEASURED_RADII[partner];
        if (pm != null && R_PARTNER[id]) txt += ' (mirror corner: ' + pm + ' px — averaged for symmetry)';
      } else if (!vert) txt = 'Guide point: it has no roundness of its own; it sets the direction of the edges.';
      if (BOTTOM_GAP.includes(id)) txt += (txt ? ' · ' : '') + 'Drag it sideways to change the bottom gap.';
      if (TOP_GAP.includes(id)) txt += (txt ? ' · ' : '') + 'Drag it along the edge to move the top-right gap.';
      if (LINE_PTS.includes(id)) txt += (txt ? ' · ' : '') + 'This corner slides along the gap edge; dragging it tilts the V arm.';
      $('sel-measured').textContent = txt;
      const movable = FREE.includes(id) || VIRTUAL.includes(id) || LINE_PTS.includes(id);
      $('sel-xy').hidden = !movable;
      if (movable) {
        const p = d.points[id];
        $('sel-x').value = +p.x.toFixed(2); $('sel-y').value = +p.y.toFixed(2);
        $('sel-x').disabled = d.symmetric && G.AXIS.includes(id);
      }
    }
    renderRadiiTable();
    const w = $('clamp-warn');
    if (symbol.clamped.length) {
      w.hidden = false;
      w.textContent = 'Some corners are too round for their edges and were reduced: ' +
        symbol.clamped.map((c) => (LE.LABELS[c.id] || c.id) + ' (' + c.wanted + ' → ' + c.actual.toFixed(1) + ' px)').join(', ');
    } else w.hidden = true;
  }

  let tableBuilt = false;
  const ORDER = ['T', 'UL', 'UR', 'LL', 'LR', 'TI', 'IUL', 'ILL', 'ILR', 'G3', 'B10', 'G4', 'B9', 'G9', 'G8', 'B0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'];
  function renderRadiiTable() {
    const tb = $('radii-table');
    if (!tableBuilt) {
      tb.innerHTML = ORDER.map((id) => '<tr data-id="' + id + '"><td>' + LE.LABELS[id] + ' <span class="meas">orig. ' + LE.MEASURED_RADII[id] + '</span></td><td><input type="number" min="0" step="0.25"> px</td></tr>').join('');
      tb.querySelectorAll('tr').forEach((tr) => {
        const id = tr.dataset.id;
        tr.querySelector('input').addEventListener('change', (e) => {
          const v = parseFloat(e.target.value);
          if (!isFinite(v) || v < 0) return;
          checkpoint(); setRadius(id, v); state.selected = id; changed();
        });
        tr.addEventListener('click', () => { if (state.selected !== id) { state.selected = id; drawEditor(); syncPanel(); } });
      });
      tableBuilt = true;
    }
    tb.querySelectorAll('tr').forEach((tr) => {
      const id = tr.dataset.id;
      const inp = tr.querySelector('input');
      if (document.activeElement !== inp) inp.value = state.design.radii[id];
      tr.classList.toggle('sel', id === state.selected);
    });
  }

  // ---------------------------------------------------------------- files
  const byName = new Map(LE.SUITE.map((e) => [baseName(e.path), e]));
  function baseName(p) { return p.split('/').pop(); }
  function scaledBox(f) {
    const e = f.entry, W = f.img.naturalWidth, H = f.img.naturalHeight;
    const b = e.symbol.bbox, sx = W / e.w, sy = H / e.h;
    return [b[0] * sx, b[1] * sy, b[2] * sx, b[3] * sy];
  }

  const ignored = [];
  async function addFiles(fileList) {
    const jobs = [];
    for (const file of fileList) {
      const name = file.name;
      const entry = byName.get(name);
      if (!entry) { if (name !== '.DS_Store') ignored.push(name); continue; }
      jobs.push(loadOne(entry, file));
    }
    await Promise.all(jobs);
    buildPreviews();
    updateFileStatus();
    drawEditor();
  }
  function loadOne(entry, file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const base = LE.render.makeBase(img, entry);
        state.files.set(entry.path, { entry, img, base, baseURL: null, sizeOk: img.naturalWidth === entry.w && img.naturalHeight === entry.h });
        resolve();
      };
      img.onerror = () => { ignored.push(entry.path + ' (could not be read)'); resolve(); };
      img.src = url;
    });
  }
  function updateFileStatus() {
    const n = state.files.size, N = LE.SUITE.length;
    const st = $('file-status');
    st.textContent = n + ' of ' + N + ' logo files loaded.' + (n < N ? ' Missing files will simply not be exported.' : ' Everything is ready.');
    st.className = 'status ' + (n === N ? 'ok' : 'muted');
    const list = $('file-list');
    list.innerHTML = '';
    LE.SUITE.forEach((e) => {
      const f = state.files.get(e.path);
      const li = document.createElement('li');
      if (!f) { li.className = 'bad'; li.textContent = e.path + ' — not loaded'; }
      else li.textContent = e.path + ' — ' + f.img.naturalWidth + '×' + f.img.naturalHeight + (f.sizeOk ? '' : ' (size differs from the original ' + e.w + '×' + e.h + ')');
      list.appendChild(li);
    });
    ignored.forEach((name) => { const li = document.createElement('li'); li.className = 'ign'; li.textContent = name + ' — not part of the suite, ignored'; list.appendChild(li); });
    $('file-details').hidden = false;
    $('export').disabled = n === 0;
  }

  $('pick-folder').addEventListener('change', (e) => { addFiles(Array.from(e.target.files)); e.target.value = ''; });
  $('pick-files').addEventListener('change', (e) => { addFiles(Array.from(e.target.files)); e.target.value = ''; });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || e.target === document.documentElement) drop.classList.remove('over'); }));
  document.addEventListener('drop', async (e) => {
    const items = Array.from(e.dataTransfer.items || []);
    const entries = items.map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
    if (!entries.length) { addFiles(Array.from(e.dataTransfer.files || [])); return; }
    const files = [];
    async function walk(en) {
      if (en.isFile) { files.push(await new Promise((res, rej) => en.file(res, rej))); return; }
      const reader = en.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const c of batch) await walk(c);
      } while (batch.length);
    }
    for (const en of entries) await walk(en);
    addFiles(files);
  });

  // ---------------------------------------------------------------- previews
  function buildPreviews() {
    const box = $('previews');
    box.innerHTML = '';
    LE.SUITE.forEach((e) => {
      const f = state.files.get(e.path);
      const card = document.createElement('div');
      card.className = 'pv' + (f ? '' : ' missing');
      const thumb = document.createElement('div'); thumb.className = 'thumb';
      const c = document.createElement('canvas');
      thumb.appendChild(c); card.appendChild(thumb);
      const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = e.path; card.appendChild(nm);
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = f ? e.w + '×' + e.h + ' · PNG + SVG' : 'not loaded';
      card.appendChild(meta);
      box.appendChild(card);
      if (f) { f.canvas = c; card.onclick = () => openModal(e.path); }
    });
    renderPreviews();
  }
  let pvTimer = null;
  function schedulePreviews() { clearTimeout(pvTimer); pvTimer = setTimeout(renderPreviews, 80); }
  function renderPreviews() {
    state.files.forEach((f) => { if (f.canvas) LE.render.renderPreview(f.canvas, f.base, f.entry, state.design, symbol, MASTER_BBOX, 380); });
    if (modalPath) drawModal(false);
  }

  // ---------------------------------------------------------------- compare modal
  let modalPath = null;
  function openModal(path) { modalPath = path; $('modal').hidden = false; $('modal-title').textContent = path; drawModal(false); }
  function closeModal() { modalPath = null; $('modal').hidden = true; }
  function drawModal(original) {
    const f = state.files.get(modalPath); if (!f) return;
    const c = $('modal-canvas');
    c.width = f.base.width; c.height = f.base.height;
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    if (original) x.drawImage(f.img, 0, 0);
    else { x.drawImage(f.base, 0, 0); LE.render.drawSymbol(x, f.entry, state.design, symbol, MASTER_BBOX, f.base.width, f.base.height); }
  }
  $('modal-close').onclick = closeModal;
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
  const flip = $('modal-flip');
  ['pointerdown'].forEach((t) => flip.addEventListener(t, () => drawModal(true)));
  ['pointerup', 'pointerleave'].forEach((t) => flip.addEventListener(t, () => drawModal(false)));
  $('modal-png').onclick = async () => {
    const f = state.files.get(modalPath); if (!f) return;
    const bytes = await LE.render.canvasToBytes(LE.render.renderFull(f.base, f.entry, state.design, symbol, MASTER_BBOX));
    download(new Blob([bytes], { type: 'image/png' }), baseName(LE.render.outputNames(f.entry.path).png));
  };
  $('modal-svg').onclick = () => {
    const f = state.files.get(modalPath); if (!f) return;
    download(new Blob([svgOf(f)], { type: 'image/svg+xml' }), baseName(LE.render.outputNames(f.entry.path).svg));
  };
  function svgOf(f) {
    if (!f.baseURL) f.baseURL = f.base.toDataURL('image/png');
    return LE.render.svgFor(f.base, f.baseURL, f.entry, state.design, symbol, MASTER_BBOX);
  }

  // ---------------------------------------------------------------- export
  $('export').onclick = async () => {
    const btn = $('export'), st = $('export-status');
    btn.disabled = true;
    try {
      const out = [];
      const enc = new TextEncoder();
      const list = LE.SUITE.filter((e) => state.files.has(e.path));
      for (let i = 0; i < list.length; i++) {
        const f = state.files.get(list[i].path);
        st.textContent = 'Rendering ' + (i + 1) + ' / ' + list.length + '…';
        await new Promise((r) => setTimeout(r, 0));
        const names = LE.render.outputNames(f.entry.path);
        const png = await LE.render.canvasToBytes(LE.render.renderFull(f.base, f.entry, state.design, symbol, MASTER_BBOX));
        out.push({ name: 'Logo/' + names.png, data: png });
        out.push({ name: 'Logo/' + names.svg, data: enc.encode(svgOf(f)) });
      }
      out.push({ name: 'logo-design.json', data: enc.encode(JSON.stringify(state.design, null, 2)) });
      st.textContent = 'Packing ZIP…';
      await new Promise((r) => setTimeout(r, 0));
      download(new Blob([LE.zip.makeZip(out)], { type: 'application/zip' }), 'Logo.zip');
      st.textContent = 'Done: ' + list.length + ' files exported (PNG + SVG).';
    } catch (err) {
      st.textContent = 'Export failed: ' + err.message;
    } finally { btn.disabled = false; }
  };

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }

  // ---------------------------------------------------------------- start
  buildPreviews();
  resize();
  changed();
  state.undo = [];
  syncPanel();
  // exposed for automated checks
  window.__app = { state, get symbol() { return symbol; }, MASTER_BBOX, addFiles, changed };
})();
