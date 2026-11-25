# logo-editor

An offline editor for the **Les Constructions Viens** logo suite. You adjust the hexagon + V symbol once, and the app re-exports every logo file with the same names and pixel sizes, as both PNG and SVG.

- **No install and no internet.** Double-click `index.html` and it opens in your browser.
- **Your logos stay on your computer.** No logo image is stored in this repository, which is public. The app reads your files only when you pick your folder.

## How to use it

1. Download this repository: on GitHub, click **Code → Download ZIP**, then unzip it.
2. Double-click **`index.html`**. Chrome, Edge, Firefox and Safari all work.
3. Click **Choose the Logo folder…** and pick your `Logo` folder (the one that contains `nobg`). You can also drag the folder onto the page.
4. Change the symbol:
   - **White dots** are corners. Drag them, and the mirror corner follows while **Keep left/right symmetry** is ticked.
   - **Blue diamonds** are gap edges. Drag them to change the gaps, or use the **Gaps** sliders.
   - **Click any dot** to set its **corner radius** in pixels. The orange circle shows the exact arc.
   - The pink dashed line is the original shape, and your original image appears faded underneath so you can compare.
5. Look over the previews at the bottom. Click one to compare it with the original by holding **Hold to see original**.
6. Click **Export all files (PNG + SVG) as ZIP**. You get `Logo.zip` with the same folder structure (`Logo/…` and `Logo/nobg/…`) and the same file names, plus `logo-design.json`, which saves your design.

Your work is saved automatically in the browser. **Save design… / Load design…** let you keep or share a version as a file.

## How it works (and the rules it follows)

- **One master symbol for all files.** The symbol was slightly different across your files (square, stacked, "logo nbg", favicon). The editor redraws the same master shape everywhere, scaled to where the old symbol was.
- **Corner roundness is a true circular radius in pixels.** It was measured on `logo_square original.png` by fitting circles to the rounded pixels, with a typical fit error of 0.2–0.3 px. A radius of 20 px is a 20 px circle whatever the corner angle. Mirror corners in the original did not match (upper-left 33.75 px vs upper-right 27.5 px, for example), so each pair was averaged. The original values are shown next to each corner in the app.
- **Sizes are in pixels of `logo_square original.png`**, where the symbol is about 475 px wide. In larger or smaller files they scale with the symbol.
- **The text "LES CONSTRUCTIONS VIENS" is never redrawn.** It is copied pixel for pixel from each original file. Only the symbol area is erased and redrawn. Off-white backgrounds and compression specks are cleaned to pure white, pure black or full transparency.
- **SVG files:** the symbol is real vector shapes, and the text and frame are your original image embedded inside the SVG. That is why the text is identical, but it isn't vector.
- **Colours:** the green is one master green, `#10f904`, measured on `logo_square original.png`. The black, white and grey parts keep each file's own colour.
- **Files not exported:** `3D`, the `ChatGPT Image…` file and `.DS_Store`.

## For developers

- Plain HTML/CSS/JS with no build step and no dependencies. Scripts are classic (not modules) so they work from `file://`.
- `js/geometry.js`: the shape model (polygons, true-radius corner rounding, gaps, symmetry, placement).
- `js/master.js`: the measured master symbol. `js/suite.js`: the list of files (sizes, symbol boxes, colours; numbers only).
- `js/render.js`: background cleanup, erasing the old symbol, PNG and SVG output. `js/zip.js`: a small ZIP writer. `js/app.js`: the user interface.
- Tests: `node tests/geometry.test.js`
- `tools/measure/`: the Python scripts used to take the measurements.
