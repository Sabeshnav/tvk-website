# TVK concept site: the full build (v1, 15 Oct 2026)

Open `index.html` in Chrome, Safari or Edge. It's one self-contained file (about 1.7 MB): fonts, images and code are all inside, so it works offline and needs no server.

Concept only, not an official TVK website. Wording is placeholder until the final copy pass.

## The page, top to bottom
| # | Part | Asset | What happens |
|---|---|---|---|
| 0 | Intro | A01 brass whistle | The whistle turns in its studio. Press and hold anywhere for 1 second to blow it: a ring fills, it trembles, a whistle sounds (made in code), gold rings burst and the screen opens from the centre onto the hero. "Skip intro" is in the corner. |
| 1 | Hero | A02 flag hoist | Scroll hoists the flag, then the title comes in. |
| 2 | Leadership | A03 + carousel | Locks on arrival. One swipe plays Vijay's slash sequence. Then each swipe (up/down or left/right, or the arrows and dots) moves the carousel: Vijay → Aadhav Arjuna → N. Anand, with a gold brush wipe between them. A swipe past N. Anand releases the scroll. |
| 3 | Ideology | A04 Kural, A05 pledge | The Kural on the palm leaf (locks and plays), then the four stones smashed at once. |
| 4 | Our Journey | A06 Milestone Road | A sunrise bridge (dark to bright) leads into the road. |
| 5 | Join us | A07 Find Your Place | Tap the glowing place, then Join TVK (tvk.family). |
| | Footer | | Party name, motto, Join TVK, socials, the concept notice. |

**Around it:** a floating nav (hides while you scroll down, comes back when you scroll up, and stays hidden during the locked sections), a phone menu, chapter dots on the right (desktop), a thin gold progress line at the top, and chapter bridges (02 Leadership, 03 Ideology, 04 Our Journey, 05 Join us) between sections. Nav jumps use a quick maroon-and-gold wipe.

The five guiding leaders are left out, by decision.

## Changes after Sabesh's first review (v1.1, 15 Oct 2026)
- **The page waits for each section's content.** Scrolling now stops until the content has fully appeared (`src/fence.js`):
  - **Hero:** the page holds at the end until the title is in.
  - **Leadership:** each leader's copy finishes (about 1.7 s) before the next swipe counts.
  - **Kural:** releases only after the meaning and core idea have fully faded in, even when fast-forwarded.
  - **Pledge:** holds until the stones break and the pledge text is in.
  - **Journey:** stops at each milestone until its card has been on screen for about 1.6 s, and at the intro and closing titles.
  - **Join us:** each panel gets read.
  - Chapter jumps and scrolling back up are never blocked.
- **Kural is now in a light, hopeful morning setting:**
  - cream background with sunbeams;
  - sunlit teak table and soft daylight;
  - maroon letterbox bars;
  - maroon and brown text.
  - The Ideology chapter bridge rises from maroon into that morning light. A short dusk band leads from the Kural into the (still dark) pledge.
- **Other fixes:**
  - The page always starts at the top on reload.
  - If 3D isn't available, the intro steps aside instead of trapping the visitor.
  - A chapter jump releases a locked section, and replays it if it lands on it.
  - Reaching the Kural from below shows it finished instead of an empty table.
  - The chapter dots are now visible on light sections.
  - The "Swipe for next leader" hint moved off the photos.
  - The Join bridge no longer repeats the Join section's line.
  - Added a tab icon.

## Smoothness rebuild (v1.2, 15 Oct 2026)
Sabesh reported that it "gets stuck, the animations are breaking" on desktop Chrome. Measured causes and fixes:

| What was wrong | Evidence | Fix |
|---|---|---|
| **Scroll fighting.** The browser's smooth wheel scrolling fought the scroll holds and locks, which snapped the page back. That caused judder and "stuck" moments. | Code review plus tests | One scroll controller (`src/scroller.js`) owns wheel and keys. The page eases to a target and glides to a stop at a hold, never snapping. Touch stays native. |
| **Locked sections ignored swipes.** A swipe only counted after a 180 ms pause in wheel input, so continuous scrolling or trackpad momentum was ignored. | Code review | A new swipe detector (`src/swipe.js`) recognises a fresh flick even during momentum, plus a repeat for a wheel that keeps spinning. A swipe made while a leader's text is still coming in is kept and applied right after. Unit-tested with synthetic flicks. |
| **Shader compiles mid-scroll.** The first view of new things (Journey props, smashed stones, the Join newcomer) froze the page for a moment. Journey compiled about 20 new shaders along the road. | `?perf`: shader count grew 30 → 50 while driving, with multi-second frames in the test browser | Props carry lights, so hiding them changed the scene's light count and recompiled everything. They're now parked underground instead. Every scene is also drawn once with everything switched on (`gpu.js warmUp`), and rehearsed in its key states during the intro. Shader count is now constant after loading. |
| **Scenes built mid-scroll.** Each 3D scene was built when you got close, freezing the page then. | Long tasks at each section start | The intro is now the loader. All sections are built and warmed one after another before "Hold" is enabled. |
| **Several 3D loops running at once.** The hero rendered under the intro, and neighbours ran within 60 % of the screen. | Gate review | Loops run only within 8 % of the screen, and nothing runs under the intro. |
| **High resolution.** The canvases rendered at up to 2× pixel density. | Renderer info | Capped at 1.5× (Join at 1.25×). A frame-rate governor lowers a section's resolution a notch if it can't hold about 45 fps. |
| **Costly page effects.** Blended film grain, CSS blurs over live 3D, and frosted-glass panels re-blurred every frame. | Style review | Grain is now a plain layer and the blurs are removed. Panels are solid glass colours. The hero crowd's far and front layers redraw at 30 fps, and the front layer gets its softness from lower resolution. |

`?perf` adds timing data (`window.__perf`).

## Performance
- Each section starts only when you get near it, and its animation stops when it's off screen.
- The intro's 3D scene is thrown away after it opens.
- The locked sections hold still against phone flings.
- `index.html?nointro` skips the intro, which is handy for screen-recording reels.

## Rebuilding
```bash
npm install          # three 0.185.1, three-bvh-csg, three-mesh-bvh, esbuild
python3 build.py     # writes dist/index.html
```
- `src/shell.html` and `src/shell.js` are the page frame: intro markup, nav, bridges, footer, lazy starts and jumps.
- `src/intro/intro.js` is the hold-to-blow intro.
- `src/sections/<name>/` holds each section's own sources, copied from the confirmed assets with these changes:
  - leader: the carousel was added;
  - hero: its loop runs through the shared scheduler;
  - leader and kural: they lock only when scrolled into, and hold still while locked.
- `build.py` scopes each section's CSS so they can't clash. It wraps each `main.js` so it can start lazily, and inlines the fonts and images.

## Leader roles (placeholder, check before launch)
- **Aadhav Arjuna:** General Secretary (Election Campaign Management), MLA for Villivakkam.
- **N. Anand:** General Secretary; Minister for Rural Development & Water Resources; MLA for Thiyagarayanagar.

## Before launch
- Final wording pass.
- Test on a mid-range phone, especially Journey and Join Us.
- Get the painter's OK for the Vijay artwork.
- Get permission for the leader photos.
