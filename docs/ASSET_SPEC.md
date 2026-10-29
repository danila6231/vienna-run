# Step into Vienna: art brief

Step into Vienna is a 40-second booth game. A Mozart-style musician runs down a Vienna street
from Stephansdom to the Riesenrad, catching music (a piano, a violin, sheet music, notes) and dodging Krampus and bombs. The houses
and landmarks are **3D models built in code** (`src/render/buildings/`), lit from the upper left
in the palette below. Everything else is a flat, illustrated paper cutout standing in that street:
the musician, the rewards, lamps, clouds, the tram, the finish banner. This brief covers those
cutouts, plus the paper houses and landmarks that staff can switch to on a PC too weak for 3D
(settings → Graphics → Paper); those rows are marked *Paper look only* and matter least. To see the street, run `npm run demo:buildings` and open
`dist-demo/step-into-vienna-street-looks.html`.

## The short version
- **Every file here is a flat image.** The buildings are not files; they are built in code. The
  game handles perspective, movement, rotation, bobbing and shadows.
- **Format:** transparent PNG (sRGB). WebP is fine too. Max 2048 px on any side.
- **Hard edges only.** The game cuts each image out at its edge, so soft glows, feathered edges
  and painted-in shadows get clipped off.
- **Leave out:** no white paper border, no drop shadow, no ground shadow. The game adds the
  paper edge and shadow to every cutout so they all match.
- **Padding:** leave about 3% transparent padding on every side of a cutout, so the added paper
  edge has room. Tiling textures are the exception (see below).
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
| `facade-01.png` … `facade-08.png` | 6–8 | 1024×1536 (2:3) | One building front, 8 m wide × 12 m tall. Ground floor touches the bottom edge. **Left and right edges straight and flush, no padding** (buildings stand side by side). Transparent sky above an interesting roofline (gables, domes, statues). Vary the shop signs: Café, Konditorei, Bäckerei, Apotheke… *Paper look only.* |
| `back-01.png` … | 4–6 | 640×1024 (5:8) | Buildings in the second row. Simpler and low contrast; the game adds haze. *Paper look only.* |
| `landmark-stephansdom.png` | 1 | long side 2048 | Shown 33 m tall. Any aspect ratio. The zigzag roof tiles are the signature. *Paper look only.* |
| `landmark-karlskirche.png` | 1 | long side 2048 | Shown 23.4 m tall. Dome, portico, two big columns. *Paper look only.* |
| `landmark-hofburg.png` | 1 | long side 2048 | Shown 21 m tall. Michaelertor-style dome. *Paper look only.* |
| `landmark-tram.png` | 1 | about 2048×512 | Side view of a red-and-white Vienna tram, shown 14 m long. |
| `riesenrad-wheel.png` | 1 | 2048×2048 | The wheel only: rims and spokes, **no cabins**. The wheel's center must be the image center (the game spins it). Shown 29 m wide. *Paper look only.* |
| `riesenrad-cabin.png` | 1 | 256×256 | One red cabin, hanging upright. The game places 15 of them around the wheel. *Paper look only.* |
| `riesenrad-support.png` | 1 | 2048 wide | Legs and base building. The hub point is **top center**; the bottom edge is the ground. *Paper look only.* |
| `item-piano.png`, `item-violin.png`, `item-sheet.png`, `item-notes.png`, `item-question.png`, `item-krampus.png`, `item-bomb.png` | 7 | 512×512 | Object fills about 70% of the canvas, centered, 3/4 front view. Must read clearly at 60–90 px on screen. The four rewards are a piano, a violin, sheet music and notes (the placeholders are 🎹 🎻 🎼 🎶), bright and inviting; the question mark (placeholder ❓) stands three in a row across the road and opens a quiz question; Krampus and the bomb dark/red and instantly "bad". **Filled for now** with Apple-style emoji (`item-*.webp`, 256×256, from iamcal/emoji-data `img-apple-160`) so the items look the same on every platform; drop a designer `item-*.png` in and delete the matching `.webp` to replace one. |
| `musician-run-01.png` … `musician-run-08.png` | 6–8 | 512×768 per frame | A Mozart-style musician **seen from behind**: white powdered wig with side curls and a queue tied with a black bow, red frock coat with gold trim, knee breeches, white stockings, black shoes; right arm raised holding a conductor's baton. One full running cycle. |
| `musician-stumble-01.png` … | 0–2 | 512×768 | Optional: hit by a bomb. If missing, the game wobbles the run frames instead. |
| `musician-celebrate-01.png` … | 0–2 | 512×768 | Optional: crossing the finish. |
| `prop-lamp.png` | 1 | about 200×1024 | Ornate Viennese street lantern, shown 4.5 m tall. |
| `banner-finish.png` | 1 | 1024×200 | "ZIEL · FINISH" banner, shown 10.4 m wide. Poles and the checkered line are drawn by the game. |
| `cloud-01.png` … | 1–3 | 512×240 | Paper clouds. |
| `skyline.png` | 1 | 4096×512 | Far-away Vienna skyline silhouette, transparent above. Shown 560 m wide behind haze, so low contrast is fine. |
| `sky.png` | 0–1 | 2048×1024 | Optional painted sky (no transparency). Without it the game uses a soft gradient. |
| `texture-road.png` | 1 | 1024×1024 | **Seamless tiling** cobblestones, no transparency, **no lane lines** (the game draws them). One tile covers 9 m × 9 m (the full 3-lane road width). |
| `texture-sidewalk.png` | 1 | 512×512 | **Seamless tiling** paving slabs; one tile covers 3.4 m × 3.4 m. |
| `gift-0.png`, `gift-1.png` … | — | 512×512 | **Not used right now** (gift display was removed from the game). Skip unless it comes back. |
| `logo.svg` | 0–1 | vector | Optional; replaces the "Step into Vienna" title on the start screen. |

## Two anchors that must match across musician frames
- **Feet:** bottom center of every frame (x = 256, y = 768).
- **Baton tip:** the same pixel in every frame, ideally **x = 424, y = 24**. Collected music
  floats in a column above this point. If you put the baton elsewhere, tell the developer the pixel
  and they'll change one constant (`BATON` in `src/render/runner.ts`).

## How a file goes live
1. Save it into `src/assets/art/` with the exact name above.
2. Run the game (`npm run dev`). The self-check page (`?check=1`) lists every image and whether
   it's coming from your file or a placeholder.
