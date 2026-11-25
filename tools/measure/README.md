# Measurement scripts

These scripts are how the numbers in `js/master.js` and `js/suite.js` were measured. You don't need them to use the editor.
They expect your original files in `orig/Logo/...` and the editor's export unzipped in `out/Logo/...`, both next to the scripts. Never commit those folders.

Requirements: Python 3, `pip install numpy pillow opencv-python-headless`.

| Script | What it does |
|---|---|
| `fit_radii.py "orig/Logo/logo_square original.png" 14 green:1:0 dark:1:0` | For each corner of the symbol, it fits straight lines to the edges and puts the sharp corner where they meet. It then finds the **true circular radius** (in px) that best fits the rounded pixels. |
| `suite_components.py` then `suite_manifest.py` | For each file, finds the background, where the symbol is (bounding box) and its colours, and writes `manifest.json`, the data behind `js/suite.js`. |
| `verify_export.py` | Compares the export with the originals: same size, pixels outside the symbol unchanged, and how much the new symbol overlaps the old one. |
