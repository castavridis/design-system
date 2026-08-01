# Design language

The character behind the tokens. Values live in the tokens; this is the taste
that keeps an experiment recognizably *pmndrs* rather than merely colourful.
It carries no token values on purpose — those come from the brief above, which
is generated, so nothing here can drift.

## Who this is for

pmndrs (poimandres) is the open-source collective behind React Three Fiber,
drei, zustand, and the wider creative-web / three.js ecosystem. The audience is
developers who build playful, visual, interactive things. On-brand work leans
**technical but joyful**: generative, physical, a little irreverent — not
corporate SaaS.

## Principles

- **Neutral ground, vivid accents.** Let a page rest on `brand.dark` or
  `brand.light` and spend the seven accents deliberately. A wall of six saturated
  colours reads as noise; one or two accents against a warm neutral reads as
  brand. The neutrals are *warm* (a green/khaki cast), not pure grey — keep that
  warmth; don't reach for `#000`/`#fff`.
- **One gradient, used well.** The 3-stop gradient is a signature. One confident
  gradient as a hero, a highlight, or a glow beats gradients everywhere.
- **Serif display, sans body.** Faculty Glyphic (`fonts.serif`) is the voice —
  use it big for headlines. Geist (`fonts.sans`) carries everything readable.
  Geist Mono for anything that wants to feel like code, data, or a coordinate.
- **Generous, rounded, spacious.** 16px base rhythm and 16px corners give a soft,
  friendly feel. Compose spacing from multiples of the base; don't sprinkle
  arbitrary pixel values.
- **Motion and depth welcome.** This ecosystem is WebGL and animation. Subtle
  motion, 3D, canvas, shaders, parallax — all on-brand when they serve the idea.

## Do

- Pair a warm neutral ground with 1–2 accents per view.
- Use a brand gradient for one focal moment (hero, CTA, glow, data highlight).
- Set headlines in the serif at a confident size; keep body in the sans.
- Derive every colour, space and radius from a token / CSS var.
- Reach for interactivity: hover states, canvas, generative variation, motion.

## Don't

- Don't use `brand.dark` / `brand.light` as gradient stops — they're grounds.
- Don't place two of the same colour adjacent in a gradient (the rule is enforced
  in code for a reason).
- Don't hardcode a hex that duplicates a token — bind to the `var(--…)` instead.
- Don't flatten the warm neutrals to pure black/white.
- Don't crowd every accent into one screen; restraint is the brand.

## Experiment starters

Good on-brand things to build (each is a single self-contained artifact):

- A landing / hero page for a fictional creative-coding library.
- A generative gradient playground (pick stops → live `linear-gradient`).
- A palette / token specimen sheet (swatches, type scale, spacing bars).
- An animated loader, badge, or 404 using an accent + the gradient.
- A small dashboard or stat-card set in mono, accents for series colour.
- A `<canvas>` toy — particles, noise field, orbit — coloured from the accents.
