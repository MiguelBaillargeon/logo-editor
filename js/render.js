/*
 * Rendering of one file of the suite with the current master symbol.
 *
 *  1. "base" = the original file with its background cleaned (compression
 *     speckles removed) and the OLD symbol erased. The text and the square
 *     frame are kept exactly as they are in the original pixels.
 *  2. the NEW master symbol is drawn on top, placed so that the unedited
 *     master would cover exactly the old symbol's bounding box.
 */
(function (root) {
  'use strict';
  const LE = (root.LE = root.LE || {});

  const BG_FILL = { white: '#ffffff', black: '#000000' };

  /** Clean the background and erase the old symbol. Returns a canvas. */
  function makeBase(img, entry) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, W, H);
    const d = id.data;
    if (entry.bg === 'white') {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
        if (mn >= 235 && mx - mn <= 14) { d[i] = d[i + 1] = d[i + 2] = 255; }
        d[i + 3] = 255;
      }
    } else if (entry.bg === 'black') {
      for (let i = 0; i < d.length; i += 4) {
        if (Math.max(d[i], d[i + 1], d[i + 2]) <= 28) { d[i] = d[i + 1] = d[i + 2] = 0; }
        d[i + 3] = 255;
      }
    } else {
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] <= 8) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; }
      }
    }
    ctx.putImageData(id, 0, 0);
    const box = symbolBox(entry, W, H);
    if (box) {
      const m = Math.round(0.02 * Math.max(box[2] - box[0], box[3] - box[1])) + 2;
      const x = Math.max(0, box[0] - m), y = Math.max(0, box[1] - m);
      const w = Math.min(W, box[2] + m) - x, h = Math.min(H, box[3] + m) - y;
      if (entry.bg === 'transparent') ctx.clearRect(x, y, w, h);
      else { ctx.fillStyle = BG_FILL[entry.bg]; ctx.fillRect(x, y, w, h); }
    }
    return c;
  }

  /** The old symbol's box, scaled if the loaded image has a different size than expected. */
  function symbolBox(entry, W, H) {
    if (!entry.symbol) return null;
    const sx = W / entry.w, sy = H / entry.h;
    const b = entry.symbol.bbox;
    return [b[0] * sx, b[1] * sy, b[2] * sx, b[3] * sy];
  }

  function colorFor(role, design) {
    return role === 'green' ? design.colors.green : role;
  }

  /** Draw the new symbol for `entry` onto ctx (ctx in file pixel units). */
  function drawSymbol(ctx, entry, design, symbol, masterBBox, W, H) {
    const box = symbolBox(entry, W, H);
    if (!box) return;
    const pl = LE.geo.placement(masterBBox, box);
    ctx.save();
    ctx.transform(pl.s, 0, 0, pl.s, pl.tx, pl.ty);
    ctx.fillStyle = colorFor(entry.symbol.left, design);
    ctx.fill(new Path2D(symbol.left));
    ctx.fillStyle = colorFor(entry.symbol.right, design);
    ctx.fill(new Path2D(symbol.right));
    ctx.restore();
  }

  /** Full-size render: returns a canvas. */
  function renderFull(base, entry, design, symbol, masterBBox) {
    const c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    drawSymbol(ctx, entry, design, symbol, masterBBox, base.width, base.height);
    return c;
  }

  /** Scaled preview into an existing canvas. */
  function renderPreview(canvas, base, entry, design, symbol, masterBBox, maxSide) {
    const k = Math.min(1, maxSide / Math.max(base.width, base.height));
    const w = Math.round(base.width * k), h = Math.round(base.height * k);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.drawImage(base, 0, 0);
    drawSymbol(ctx, entry, design, symbol, masterBBox, base.width, base.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  /** SVG: original text/frame kept as the cleaned original image + the symbol as true vector paths. */
  function svgFor(base, baseDataURL, entry, design, symbol, masterBBox) {
    const W = base.width, H = base.height;
    let g = '';
    const box = symbolBox(entry, W, H);
    if (box) {
      const pl = LE.geo.placement(masterBBox, box);
      const f = (x) => +x.toFixed(6);
      g = '\n  <g id="symbol" transform="matrix(' + f(pl.s) + ' 0 0 ' + f(pl.s) + ' ' + f(pl.tx) + ' ' + f(pl.ty) + ')">' +
        '\n    <path id="symbol-left" fill="' + esc(colorFor(entry.symbol.left, design)) + '" d="' + symbol.left + '"/>' +
        '\n    <path id="symbol-right" fill="' + esc(colorFor(entry.symbol.right, design)) + '" d="' + symbol.right + '"/>' +
        '\n  </g>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '\n  <title>' + esc(entry.path) + '</title>' +
      '\n  <image id="text-and-background" x="0" y="0" width="' + W + '" height="' + H + '" xlink:href="' + baseDataURL + '"/>' +
      g + '\n</svg>\n';
  }

  function canvasToBytes(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) return reject(new Error('PNG encoding failed'));
        b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)), reject);
      }, 'image/png');
    });
  }

  /** Output names: same name for the PNG; SVG = same name with .svg instead of .png (or appended). */
  function outputNames(path) {
    const svg = /\.png$/i.test(path) ? path.replace(/\.png$/i, '.svg') : path + '.svg';
    return { png: path, svg };
  }

  LE.render = { makeBase, drawSymbol, renderFull, renderPreview, svgFor, canvasToBytes, outputNames, colorFor };
})(typeof window !== 'undefined' ? window : globalThis);
