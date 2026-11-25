/*
 * The MASTER symbol: one shape used for every file of the suite.
 *
 * Measured on "logo_square original.png" (symbol ≈ 475 px wide) with
 * tools/measure/fit_radii.py: straight edges are least-squares fitted, sharp
 * corners are the intersections of those edges, and each corner radius is the
 * TRUE circular radius (in pixels) that best fits the rounded pixels (typical
 * fit error 0.2–0.3 px).
 *
 * Units: pixels of logo_square original.png. Origin: centre of the hexagon.
 * Mirror pairs were averaged so the left and right sides match exactly.
 */
(function (root) {
  'use strict';
  const LE = (root.LE = root.LE || {});

  /** Raw radii as measured on the original (before averaging mirror pairs). */
  const MEASURED_RADII = {
    T: 26.0, UL: 33.75, LL: 35.0, G3: 0.75, G4: 17.25, ILL: 28.0, IUL: 30.5, TI: 15.0, G8: 14.75, G9: 4.0,
    B0: 14.25, V1: 1.75, V2: 3.25, V3: 9.25, V4: 6.25, V5: 12.75, V6: 0.0, V7: 1.75,
    ILR: 24.0, B9: 22.0, B10: 4.25, LR: 33.25, UR: 27.5,
  };

  const MASTER = {
    version: 1,
    symmetric: true,
    points: {
      // outer hexagon
      T: { x: 0, y: -282.4 },
      UL: { x: -237, y: -140.15 }, UR: { x: 237, y: -140.15 },
      LL: { x: -237, y: 140.1 }, LR: { x: 237, y: 140.1 },
      BV: { x: 0, y: 284.5 },
      // inner hexagon
      TI: { x: 0, y: -192.9 },
      IUL: { x: -163, y: -95.1 }, IUR: { x: 163, y: -95.1 },
      ILL: { x: -163, y: 93.8 }, ILR: { x: 163, y: 93.8 },
      BVI: { x: 0, y: 193.4 },
      // the V
      V1: { x: 99.6, y: -119.1 },
      V2: { x: 12.6, y: 38.0 },
      V3: { x: -52.1, y: -77.5 },
      V4: { x: -139.8, y: -77.5 },
      V5: { x: -7.6, y: 159.1 },
      V6: { x: 67.9, y: 106.1 },
      V7: { x: 162, y: -66.9 },
    },
    gaps: {
      bottom: 25,     // width of the vertical slot at the bottom (px)
      top: 30.8,      // width of the slot on the upper-right edge (px)
      topPos: 0.722,  // where that slot sits along the upper-right edge (0 = top corner, 1 = right corner)
    },
    radii: {
      T: 26, UL: 30.5, UR: 30.5, LL: 34, LR: 34,
      G3: 2.5, B10: 2.5, G4: 19.5, B9: 19.5,
      ILL: 26, ILR: 26, IUL: 30.5, TI: 15, G8: 15, G9: 4,
      B0: 14.5, V1: 2, V2: 3, V3: 9, V4: 6.5, V5: 13, V6: 0, V7: 2,
    },
    colors: {
      green: '#10f904', // measured on logo_square original.png
    },
  };

  /** Human labels for each corner (shown in the side panel). */
  const LABELS = {
    T: 'Top corner', UL: 'Upper-left corner', UR: 'Upper-right corner', LL: 'Lower-left corner', LR: 'Lower-right corner',
    BV: 'Bottom point (hidden by the gap)', TI: 'Inner top corner', IUL: 'Inner upper-left corner', IUR: 'Inner upper-right (guide)',
    ILL: 'Inner lower-left corner', ILR: 'Inner lower-right corner', BVI: 'Inner bottom point (hidden by the gap)',
    G3: 'Green bottom tip (outer)', G4: 'Green bottom tip (inner)', B10: 'Black bottom tip (outer)', B9: 'Black bottom tip (inner)',
    G8: 'Green end (inner)', G9: 'Green end (outer)', B0: 'Black start (outer)',
    V1: 'V right arm, top', V2: 'V notch', V3: 'V left arm, top-right', V4: 'V left arm, top-left',
    V5: 'V bottom point', V6: 'V bottom-right bend', V7: 'V right arm tip',
  };

  LE.MASTER = MASTER;
  LE.MEASURED_RADII = MEASURED_RADII;
  LE.LABELS = LABELS;
})(typeof window !== 'undefined' ? window : globalThis);
