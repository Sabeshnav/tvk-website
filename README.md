# tvk-website

An immersive scroll concept site for Tamilaga Vettri Kazhagam. **Concept only, not an official TVK website.**

**Live site:** https://sabeshnav.github.io/tvk-website/ (once GitHub Pages is switched on, see below)

## What's here
- `index.html`: the whole site in one self-contained file (code, fonts and images inside). This is what GitHub Pages serves.
- `source/`: the sources. `source/README.md` explains each section; `source/build.py` rebuilds `index.html`.
- `.nojekyll`: tells GitHub Pages to serve the files as they are.

## Hosting on GitHub Pages
1. On GitHub, open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Pick the **main** branch and the **/ (root)** folder, then **Save**.
4. After a minute the site is live at `https://sabeshnav.github.io/tvk-website/`.

## Rebuilding after changes
```bash
cd source
npm install          # three.js 0.185.1 + esbuild
python3 build.py     # writes source/dist/index.html and the root index.html
```
Then commit and push; Pages updates on its own.
