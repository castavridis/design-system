# @pmndrs/og

Programmatic Open Graph images. A card is described by a JSON spec and rendered
by a headless browser: a live three.js scene, a video sampled at a timestamp,
or an image — all through the same camera, the same effect chain and the same
design tokens.

Every colour and measurement comes from `pmndrs-design-tokens`, pulled in as a
workspace dependency through the same entry points an outside consumer would
use. Re-seed a ramp in `src/pmndrs-design-book.ts` and every card changes on
the next render.

```bash
pnpm og -- specs/react-three-fiber.json --out out/r3f.png
pnpm og -- specs/site.json --manifest
pnpm og -- --title "Postprocessing" --accent teal --scene prism
pnpm og:studio          # live preview; scrub the timeline, edit props
pnpm og:demo            # re-render the gallery at /demo/og.html
```

Run from the repo root. `pnpm og` builds the tokens first, so a card is never
rendered against a stale palette.

Every card this package can produce is on one page — `/demo/og.html`, served by
`pnpm demo` — with each one next to the spec field it demonstrates.

## What it is built on

| | |
| --- | --- |
| [`@react-three/fiber`](https://github.com/pmndrs/react-three-fiber) | the scenes |
| [`@react-three/drei`](https://github.com/pmndrs/drei) | `<Environment>`, `<Lightformer>`, `<Text>` |
| [`@react-three/postprocessing`](https://github.com/pmndrs/react-postprocessing) + [`postprocessing`](https://github.com/pmndrs/postprocessing) | bloom, fringing, vignette |
| [`troika-three-text`](https://github.com/protectwise/troika) via drei's `<Text>` | the 3D wordmark |
| [Remotion](https://remotion.dev) | the frame clock, the video decode, the capture |

## The spec

Only `title` is required. `src/lib/spec.ts` holds the defaults and is the one
place they live.

```jsonc
{
  "title": "React Three Fiber",
  "eyebrow": "pmndrs",              // small tracked line above the title
  "subtitle": "A React renderer…",  // one clause, below it
  "meta": "github.com/pmndrs/…",    // chip, top right
  "accent": "purple",               // any ramp: purple red orange yellow green teal blue dark light
  "theme": "dark",                  // which neutral ramp is the ground
  "size": "og",                     // og (1200×630) | square (1200×1200) | wide (1920×1080)
  "wordmark": "…",                  // 3D type in the scene; "" for none
  "seed": 1,                        // fixes every random placement
  "atSeconds": 2.4,                 // where on the timeline the card is sampled
  "loopSeconds": 6,                 // the period a scene repeats over
  "source": { "kind": "scene", "name": "ramp-orbit" },
  "effects": { "bloom": 0.9, "chromaticAberration": 0.0016, "noise": 0.045, "vignette": 0.5 }
}
```

`width` and `height` override `size` when you need an exact box.

### Sources

```jsonc
{ "kind": "scene", "name": "ramp-orbit" }        // ramp-orbit | token-grid | prism
{ "kind": "image", "src": "shot.png",  "fit": "cover" }
{ "kind": "video", "src": "demo.mp4",  "fit": "cover" }
```

A `src` that names a file on disk is copied into the served directory
automatically, so `--image ~/Desktop/shot.png` works. Anything that is already
a URL is left alone; anything else resolves against `og/public/`.

**A relative `src` is read from where the command runs**, not from the spec
file — including inside a manifest, where `outDir` is manifest-relative and
this is not. A path that matches nothing stops the run and says where it
looked, because the alternative is worse: the plate comes back empty, and the
card renders slightly wrong with no error anywhere.

Media is drawn as a textured plate *inside* the scene rather than composited
behind the canvas, so a photo card takes the same grade as a generated one.

### Manifests

A manifest renders many cards from one bundle and one browser, which is most of
the wall clock — five cards take about as long as one.

```jsonc
{ "outDir": "../out", "cards": [ { "out": "drei.png", "title": "Drei", … } ] }
```

`outDir` is relative to the manifest. A card without `out` is named from its
title.

### Stills as JPEG

`--format jpeg` renders stills as JPEG and names them `.jpg`, whatever the
manifest said. PNG is the default and is what you want for a card you ship —
flat type over a gradient is exactly what it is good at. JPEG is for a page
that *displays* a lot of cards at once: the gallery is thirteen stills and a
clip, at about a quarter of the bytes.

### The gallery manifests

`pnpm og:demo` renders `/demo/og.html` in four passes, in this order, because
the last one consumes what the others write:

| | |
| --- | --- |
| `specs/demo-loop.json --mp4` | the animated loop, into `demo/og/loop.mp4` |
| `specs/demo-loop.json` | the same frame as a still — the video's `poster` |
| `specs/demo.json` | ten cards — every scene, theme, size, and the effect pair |
| `specs/demo-media.json` | the image and video cards, sourced from the above |

That ordering is why it is four commands rather than one manifest: media is
staged into the bundle *before* any card in a run renders, so a card cannot
consume a file that same run is about to write.

## Animated cards

`--gif` or `--mp4` renders one loop instead of a still. The loop is seamless:
every rate in a scene is rounded to a whole number of cycles per `loopSeconds`,
so the last frame leads back into the first.

```bash
pnpm og -- specs/react-three-fiber.json --gif                 # endless loop, 15fps
pnpm og -- specs/react-three-fiber.json --gif --fps 10 --loops 3
pnpm og -- specs/react-three-fiber.json --mp4                 # far smaller, if the target takes it
```

Verified rather than asserted: a still at `t=0` and one at `t=loopSeconds` are
byte-identical for all three scenes.

**GIF is expensive.** At 1200×630, six seconds, 15fps it comes out around
23 MB — too big for anything. Cut the dimensions and the loop, which is what
the format wants:

```jsonc
{ "width": 600, "height": 315, "loopSeconds": 4 }   // ≈3 MB at 10fps
```

`--fps` thins the clip by dropping frames rather than slowing it down, so
motion keeps its speed — but only whole divisors of 30 are reachable
(30, 15, 10, 7.5…). The line the CLI prints is the rate you actually got.

An animated card is a real Open Graph option: the spec allows `image/gif`.
Support for actually *playing* it varies by platform, so treat the first frame
as the card and the motion as a bonus — which is why `atSeconds` still picks
the frame a still would use, and the loop runs from there.

Video sources can be animated too, but they cannot loop seamlessly: the clip is
whatever the file does over that span.

## Scenes

| | |
| --- | --- |
| `ramp-orbit` | solids circling a lit core, one ramp step each |
| `token-grid` | a travelling wave; height picks the ramp step |
| `prism` | polished slabs, mostly reflections — the quietest of the three |

A scene is plain React Three Fiber and imports nothing from Remotion. It
receives `{ time, palette, seed }` and must be a pure function of them.

**That is a hard rule, not a style preference.** A still is produced by seeking
straight to one frame, with no frames rendered before it. Anything that
accumulates — `useFrame` deltas, a `THREE.Clock`, drei's `<Float>`,
`Math.random()` — has no history to accumulate from and will render differently
every time. Derive motion from `time` and jitter from `mulberry32(seed)`.

Verified: the same spec rendered twice is byte-identical.

A scene must also be *periodic* over `loopSeconds`, or animated output jumps
where it repeats. Run every rate through `loopSpeed()` and keep the arithmetic
downstream in whole multiples — `sin(angle * 2)` is fine, `sin(angle * 1.3)` is
not, and neither is `[spin, spin * 0.7, 0]`. Both of those were real bugs here.

## Adding a scene

Write the component, then add one line to `src/scenes/registry.ts`. The
registry is the source of both the `SceneName` type and the list a bad spec is
validated against, so nothing else needs touching.

## Things that will bite you

Four failures cost real time to find and none of them announce themselves.

**Fonts must be WOFF, not WOFF2.** The 3D wordmark is typeset by troika, which
parses the file itself instead of handing it to the browser, and its parser
only understands WOFF — the bundled `woff2otf` is a *WOFF*-to-OTF converter
with no Brotli decoder. Given a `.woff2` it logs `Failure loading font`, never
calls its callback, and the render hangs until `delayRender` times out 28
seconds later. `scripts/fonts.ts` copies `.woff` for this reason.

**Instance transforms must be written in a layout effect.** drei's
`<Instances>` uploads its matrices from a `useFrame`, but `<ThreeCanvas>` draws
the captured frame from a passive effect — and React runs every layout effect
before any passive one. The draw therefore happens while the instance buffer is
still zero-filled, every instance collapses to zero scale, and the card renders
empty with no error. `src/three/InstancedBodies.tsx` writes the buffer during
layout instead.

**Late content needs a redraw.** With `frameloop="never"` the canvas is drawn
once. A video frame or texture that resolves after that updates React state but
never reaches the framebuffer. `<Settle>` holds a `delayRender` handle from
mount and redraws on every animation frame for a bounded window. Watching for
React commits does *not* work: the texture is state inside the plate component,
so a sibling never re-renders.

**`preserveDrawingBuffer` is required.** The screenshot happens on its own
schedule after the draw; without it the browser may have discarded the buffer,
and the card comes out black.

## Rendering environment

- **WebGL** runs on SwiftShader behind ANGLE (`gl: 'swangle'`). A GPU-less
  machine otherwise produces a blank canvas rather than an error.
- **Chromium** is reused if one is already on the machine — `$OG_BROWSER_EXECUTABLE`
  first, then a Playwright cache, then the usual system paths — and only
  downloaded if none is found. Renders work offline once a browser and the
  fonts are in place.
- **Video** is decoded by Remotion's compositor rather than a `<video>` element,
  because the rendering Chromium ships without proprietary codecs and would
  decode nothing for H.264. In the Studio, where your own browser has the
  codecs, a real `<video>` element is used instead.
- `og/public/` and `og/out/` are generated and git-ignored.

## If a render dies before it starts

```
Cannot find native binding … @rspack/binding-linux-arm64-gnu
You installed esbuild for another platform than the one you're currently using
```

Both mean the same thing: pnpm linked a native binary for the wrong platform.
It happens when the same `node_modules` or store is written from two places —
a macOS host and a Linux container over a bind mount, or two worktrees
installing at once. Neither is caused by anything in this package, and the fix
is the same:

```bash
CI=true pnpm install --force
```

`--force` re-resolves the optional platform packages instead of trusting what
is on disk; `CI=true` lets pnpm purge `node_modules` without a TTY to confirm
at. Remotion's bundler is the first thing a render loads, so this surfaces as
a crash before any card is touched.

## Licensing

`@react-three/*`, `postprocessing`, `troika-three-text` and `@fontsource/*` are
MIT/OFL. **Remotion is not** — it is source-available under the
[Remotion License](https://remotion.dev/license), free for individuals and
companies of up to three people and requiring a paid company licence beyond
that. It is a development dependency of this package only: it renders the
cards, and nothing it provides is redistributed in the token package this repo
publishes.

The scene layer is deliberately Remotion-free — scenes are plain R3F components
that take `{ time, palette, seed }` — so the renderer underneath is replaceable
if that licence is a problem. `<Settle>`, `<BrandFonts>` and the media plates
are the only files that import from `remotion`.
