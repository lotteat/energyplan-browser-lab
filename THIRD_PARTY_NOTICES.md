# Third-party software and data

This repository contains the workshop interface together with third-party binaries, libraries, and example data. Their inclusion does not change ownership or their existing licenses. No repository-wide license is declared by this export.

| Component | Included location | Source and licensing information |
| --- | --- | --- |
| EnergyPLAN 16.3 and selected data | `dist/engine/energyplan.zip`; scenario text in `dist/model.json` | Developed at Aalborg University. [Official website](https://energyplan.eu/). The copy used here came from [HyRES-FBK/moea at commit 5f5df07](https://github.com/HyRES-FBK/moea/tree/5f5df07ebe31d269a8c92832f9f020fe1e5e833a/EnergyPLAN163). It is not relicensed by this repository. |
| Boxedwine build 140 | `dist/engine/boxedwine*`; emulator shell in `dist/engine.html` | [Matching source](https://github.com/danoon2/Boxedwine/tree/2f02aca8714222209b97f6f2d1b90cabce8ddf12); bundled [GPL text](dist/licenses/BOXEDWINE-LICENSE.txt). |
| Wine 11 / TinyCore runtime image | Downloaded by `scripts/prepare.py`; served as `dist/engine/root-*.bin` | The image is not tracked in Git. The script verifies and splits the [original filesystem ZIP](https://boxedwine.org/v2/41/TinyCore15Wine11.0-web.zip). [Wine 11 source](https://github.com/wine-mirror/wine/tree/wine-11.0); bundled [Wine LGPL text](dist/licenses/WINE-LICENSE.txt). The image also contains other operating-system components with their own notices. |
| coi-serviceworker 0.1.7 | `dist/coi-serviceworker.js` | [Upstream](https://github.com/gzuidhof/coi-serviceworker); [MIT license](dist/licenses/COI-SERVICEWORKER-LICENSE.txt). |
| fflate 0.8.2 | `dist/engine/fflate.js` | [Upstream](https://github.com/101arrowz/fflate); [MIT license](dist/licenses/FFLATE-LICENSE.txt). |

Retain upstream notices and check the applicable terms when redistributing or changing these components. This file records provenance; it is not a replacement for the original license texts or a grant of additional rights.

The original author and publication history of `Aalborg2050.txt` have not been independently established. The fact that it is present in a public repository does not establish scientific validation or an unrestricted data license.
