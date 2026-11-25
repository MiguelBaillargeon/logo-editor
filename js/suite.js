/*
 * The logo suite: every file the editor re-exports, with its exact size,
 * background, where its symbol sits (bounding box in that file's pixels) and
 * which colour each half of the symbol uses ("green" = the master green).
 * Measured from the originals with tools/measure/suite_manifest.py.
 * Contains numbers only — no logo images are stored in this repository.
 */
(function (root) {
  'use strict';
  const LE = (root.LE = root.LE || {});
  LE.SUITE = [
    { path: "Logo_text.png", w: 1254, h: 1254, bg: 'white', symbol: null },
    { path: "Logo_white bg.png", w: 1448, h: 1086, bg: 'white', symbol: { bbox: [177, 368, 489, 711], left: "green", right: "#000000" } },
    { path: "logo grey", w: 1448, h: 1086, bg: 'white', symbol: { bbox: [177, 368, 488, 711], left: "green", right: "#929292" } },
    { path: "logo white on black.png", w: 1254, h: 1254, bg: 'black', symbol: { bbox: [380, 309, 873, 877], left: "#ffffff", right: "#ffffff" } },
    { path: "logo_black on white.png", w: 1448, h: 1086, bg: 'white', symbol: { bbox: [178, 368, 489, 712], left: "#000000", right: "#000000" } },
    { path: "logo_favicon.png", w: 1204, h: 1306, bg: 'white', symbol: { bbox: [127, 113, 1090, 1185], left: "green", right: "#000000" } },
    { path: "logo_secondary (stacked).png", w: 1122, h: 1402, bg: 'white', symbol: { bbox: [401, 342, 721, 714], left: "green", right: "#000000" } },
    { path: "logo_square black on white.png", w: 1254, h: 1254, bg: 'white', symbol: { bbox: [379, 308, 874, 877], left: "#000000", right: "#000000" } },
    { path: "logo_square original.png", w: 1254, h: 1254, bg: 'white', symbol: { bbox: [390, 314, 865, 869], left: "green", right: "#000000" } },
    { path: "logo_white on black.png", w: 1448, h: 1086, bg: 'black', symbol: { bbox: [177, 368, 487, 710], left: "#ffffff", right: "#ffffff" } },
    { path: "nobg/Logo_text_nobg.png", w: 1254, h: 1254, bg: 'transparent', symbol: null },
    { path: "nobg/Logo_white bg_nobg.png", w: 1448, h: 1086, bg: 'transparent', symbol: { bbox: [177, 368, 489, 711], left: "green", right: "#000000" } },
    { path: "nobg/logo nbg.png", w: 1254, h: 1254, bg: 'transparent', symbol: { bbox: [90, 17, 1164, 1197], left: "green", right: "#ffffff" } },
    { path: "nobg/logo_black on white_nobg.png", w: 1448, h: 1086, bg: 'transparent', symbol: { bbox: [177, 368, 489, 712], left: "#000000", right: "#000000" } },
    { path: "nobg/logo_favicon_nobg.png", w: 1204, h: 1306, bg: 'transparent', symbol: { bbox: [127, 112, 1090, 1185], left: "green", right: "#000000" } },
    { path: "nobg/logo_secondary stacked_nobg.png", w: 1122, h: 1402, bg: 'transparent', symbol: { bbox: [400, 342, 721, 715], left: "green", right: "#000000" } },
    { path: "nobg/logo_square black on white_nobg.png", w: 1254, h: 1254, bg: 'transparent', symbol: { bbox: [379, 308, 874, 878], left: "#000000", right: "#000000" } },
    { path: "nobg/logo_square original_nobg.png", w: 1254, h: 1254, bg: 'transparent', symbol: { bbox: [390, 314, 866, 869], left: "green", right: "#000000" } },
    { path: "nobg/logo_white on black_nobg.png", w: 1448, h: 1086, bg: 'transparent', symbol: { bbox: [176, 367, 488, 711], left: "#ffffff", right: "#ffffff" } },
    { path: "nobg/pour broderie", w: 1774, h: 887, bg: 'transparent', symbol: { bbox: [86, 183, 530, 671], left: "green", right: "#ffffff" } },
  ];
  /** Files in the Drive folder that are deliberately NOT part of the suite. */
  LE.IGNORED = ['nobg/3D', 'nobg/ChatGPT Image 27 août 2026, 17_01_02.png', '.DS_Store'];
})(typeof window !== 'undefined' ? window : globalThis);
