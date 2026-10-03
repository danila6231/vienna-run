# Vienna Run: art brief

Vienna Run is a 40-second booth game. A Viennese waiter (Herr Ober) runs down a Vienna street
from Stephansdom to the Riesenrad, collecting treats and dodging Krampus and bombs. The look is a
**pop-up book**: flat, illustrated paper cutouts standing in a 3D street. To see it moving, open
`docs/prototypes/style-test.html` (option A) in Chrome. Everything there is placeholder art that
your files will replace.

## The short version
- **Everything is a flat image. No 3D models.** The game handles perspective, movement,
  rotation, bobbing and shadows.
- **Format:** transparent PNG (sRGB). WebP is fine too. Max 2048 px on any side.
- **Hard edges only.** The game cuts each image out at its edge, so soft glows, feathered edges
  and painted-in shadows get clipped off.
- **Leave out:** no white paper border, no drop shadow, no ground shadow. The game adds the
  paper edge and shadow to every cutout so they all match.
- **Padding:** leave about 3% transparent padding on every side of a cutout, so the added paper
  edge has room. Facades and tiling textures are the exception (see below).
- **View:** flat, front-on elevation. No vanishing points.
- **Light:** always from the upper left.
- **Outline:** dark brown ink (`#3A2A22`), about 3–4 px at 1024 px size.
- **Budget:** about 12 MB in total. The offline USB copy packs every image into one file.

## Palette (from the prototype)
| Use | Hex |
|---|---|
| Schönbrunn yellow | `#F1CD68` |
| Cream | `#EFE2C6` |
| Dusty pink | `#EBBFAC` |
| Pale mint | `#C7D7CD` |
| Stone grey | `#DAD5CD` |
| Ochre | `#E8D5A2` |
| Copper-green roofs and domes | `#6F9F8B` |
| Ink outline | `#3A2A22` |
| Austrian red | `#C8102E` |
| Paper white (added by the game) | `#FFFAF0` |

## File list
Put finished files in `src/assets/art/` using exactly these names. Any file you haven't delivered
yet keeps its placeholder, so you can deliver piece by piece.

| File name | Count | Size (px) | Notes |
|---|---|---|---|
| `facade-01.png` … `facade-08.png` | 6–8 | 1024×1536 (2:3) | One building front, 8 m wide × 12 m tall. Ground floor touches the bottom edge. **Left and right edges straight and flush, no padding** (buildings stand side by side). Transparent sky above an interesting roofline (gables, domes, statues). Vary the shop signs: Café, Konditorei, Bäckerei, Apotheke… |
| `back-01.png` … | 4–6 | 640×1024 (5:8) | Buildings in the second row. Simpler and low contrast; the game adds haze. |
| `landmark-stephansdom.png` | 1 | long side 2048 | Shown 33 m tall. Any aspect ratio. The zigzag roof tiles are the signature. |
| `landmark-karlskirche.png` | 1 | long side 2048 | Shown 23.4 m tall. Dome, portico, two big columns. |
| `landmark-hofburg.png` | 1 | long side 2048 | Shown 21 m tall. Michaelertor-style dome. |
| `landmark-tram.png` | 1 | about 2048×512 | Side view of a red-and-white Vienna tram, shown 14 m long. |
| `riesenrad-wheel.png` | 1 | 2048×2048 | The wheel only: rims and spokes, **no cabins**. The wheel's center must be the image center (the game spins it). Shown 29 m wide. |
| `riesenrad-cabin.png` | 1 | 256×256 | One red cabin, hanging upright. The game places 15 of them around the wheel. |
| `riesenrad-support.png` | 1 | 2048 wide | Legs and base building. The hub point is **top center**; the bottom edge is the ground. |
| `item-sacher.png`, `item-kipferl.png`, `item-melange.png`, `item-mozart.png`, `item-krampus.png`, `item-bomb.png` | 6 | 512×512 | Object fills about 70% of the canvas, centered, 3/4 front view. Must read clearly at 60–90 px on screen. Treats warm and tasty-looking; Krampus and the bomb dark/red and instantly "bad". |
| `waiter-run-01.png` … `waiter-run-08.png` | 6–8 | 512×768 per frame | Herr Ober **seen from behind**: black tailcoat, slick hair, right arm raised holding a silver tray, white napkin over the left forearm. One full running cycle. |
| `waiter-stumble-01.png` … | 0–2 | 512×768 | Optional: hit by a bomb. If missing, the game wobbles the run frames instead. |
| `waiter-celebrate-01.png` … | 0–2 | 512×768 | Optional: crossing the finish. |
| `prop-lamp.png` | 1 | about 200×1024 | Ornate Viennese street lantern, shown 4.5 m tall. |
| `banner-finish.png` | 1 | 1024×200 | "ZIEL · FINISH" banner, shown 10.4 m wide. Poles and the checkered line are drawn by the game. |
| `cloud-01.png` … | 1–3 | 512×240 | Paper clouds. |
| `skyline.png` | 1 | 4096×512 | Far-away Vienna skyline silhouette, transparent above. Shown 560 m wide behind haze, so low contrast is fine. |
| `sky.png` | 0–1 | 2048×1024 | Optional painted sky (no transparency). Without it the game uses a soft gradient. |
| `texture-road.png` | 1 | 1024×1024 | **Seamless tiling** cobblestones, no transparency, **no lane lines** (the game draws them). One tile covers 9 m × 9 m (the full 3-lane road width). |
| `texture-sidewalk.png` | 1 | 512×512 | **Seamless tiling** paving slabs; one tile covers 3.4 m × 3.4 m. |
| `gift-0.png`, `gift-1.png` … | — | 512×512 | **Not used right now** (gift display was removed from the game). Skip unless it comes back. |
| `logo.svg` | 0–1 | vector | Optional; replaces the "Vienna Run" title on the start screen. |

## Two anchors that must match across waiter frames
- **Feet:** bottom center of every frame (x = 256, y = 768).
- **Tray center:** the same pixel in every frame, ideally **x = 376, y = 72**. Collected treats
  stack on this point. If you put the tray elsewhere, tell the developer the pixel and they'll
  change one constant (`TRAY` in `src/render/runner.ts`).

## How a file goes live
1. Save it into `src/assets/art/` with the exact name above.
2. Run the game (`npm run dev`). The self-check page (`?check=1`) lists every image and whether
   it's coming from your file or a placeholder.
