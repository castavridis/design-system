> Part of the [figma-token-sync skill](../SKILL.md). The authoritative,
> repo-specific mapping between `src/pmndrs-design-book.ts` tokens and Figma
> variables. Read before Phase 1 of either workflow.

# Token mapping — code ↔ Figma

The generator of record is `scripts/emit-figma-tokens.mjs` **in the repo**
(`pnpm figma:emit`), not a copy inside this skill: after
`pnpm build` it reads `dist/tokens.w3c.json` and writes `dist/figma-tokens.json`
with one entry per token. This doc explains **why** each field is what it is, so
the values in that file are trusted rather than re-derived.

## Naming — one identity, three spellings

| Layer | Form | Example |
|---|---|---|
| Code token path | `scope.name` (dot) | `brand.dark` |
| Figma variable name | `scope/name` (slash) | `brand/dark` |
| CSS custom property | `--scope-name` | `--brand-dark` |
| Figma WEB code syntax | `var(--scope-name)` | `var(--brand-dark)` |

The **code path** (`key` in the emitted file) is the round-trip identity — it
matches `dist/tokens.json` keys exactly. WEB code syntax **always** wraps in
`var(...)`; ANDROID/iOS would not (not used here — web-only project).

## Collections & modes

One Figma **collection per top-level scope**, each with a **single mode named
`Value`**:

- `family` — the bare typeface names: `family.mono` / `family.sans` /
  `family.serif` / `family.legible`
- `brand` — colours, `brand.space`, `brand.radius`, `brand.headline`
- `fonts` — the CSS stacks: `fonts.mono` / `fonts.sans` / `fonts.serif` /
  `fonts.legible`

No Light/Dark modes: the code defines none. If the user later wants theming, that
is a deliberate new feature (add modes in code first, then here) — not something
to invent during a sync.

## Type & scope per token

| Token(s) | `$type` (W3C) | Figma type | Scopes |
|---|---|---|---|
| `brand.dark`, `brand.light` (neutrals) | color | COLOR | `FRAME_FILL, SHAPE_FILL` |
| `brand.purple`/`red`/`orange`/`yellow`/`green`/`teal`/`blue` (accents) | color | COLOR | `FRAME_FILL, SHAPE_FILL, STROKE_COLOR` |
| `brand.space` | dimension | FLOAT | `GAP` |
| `brand.radius` | dimension (`{brand.space}` ref) | FLOAT | `CORNER_RADIUS` |
| `brand.headline` | fontFamily (`{family.serif}` ref) | STRING | `FONT_FAMILY` |
| `family.*` | fontFamily | STRING | `FONT_FAMILY` |
| `fonts.*` | fontFamily | STRING | *(none — see Fonts)* |

**Never `ALL_SCOPES`.** Scopes are assigned in `emit-figma-tokens.mjs` by leaf
name (`SCOPE_BY_NAME`) with a per-type fallback (`SCOPE_BY_TYPE`); extend those
tables when the token set grows rather than tagging variables ad hoc.

## The aliases — `brand.radius → brand.space`, `brand.headline → family.serif`

In code, `brand.set('radius', ref('brand.space'))`. The emitted entry therefore
carries `aliasOf: "brand.space"` and **no `value`**. In Figma it must be created
as a `VARIABLE_ALIAS` to the `brand/space` variable:

```javascript
radiusVar.setValueForMode(valueMode, figma.variables.createVariableAlias(spaceVar))
```

Never write a literal `16` — the alias is what keeps the live-reference behaviour
(theming `--brand-space` cascades to `--brand-radius`) intact across the bridge.
Create `brand/space` **before** `brand/radius`.

`brand.headline` works the same way, pointing at `family.serif`. It predates the
`family` collection and holds the same string, but it is aliased rather than
deleted: the push only ever **upserts**, so removing a token from the book would
strand `brand/headline` in the file — still bound to whatever uses it, no longer
reachable from code. This is the general rule for retiring a token, not a
one-off. `assertAliasOrder` enforces the ordering, which is why the `family`
scope is declared before `brand` in the design book.

## Colour values — already Figma-ready

The emitted `value` for a colour is `{ r, g, b, a, hex }` where `r/g/b` are the
**0–1 sRGB components** straight from the W3C artifact — exactly what the Plugin
API wants. Use them directly:

```javascript
colorVar.setValueForMode(valueMode, { r: v.value.r, g: v.value.g, b: v.value.b })
```

If you ever start from a raw hex instead, convert 0–255 → 0–1:

```javascript
function hexToRgb(hex) {
  const c = hex.replace('#', '')
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  }
}
```

**Do not read colour values from `dist/tokens.json`** — those are OKLCH strings,
not sRGB. Colour values come only from the W3C artifact / the emitted plan.

## OKLCH round-trip (pull direction)

`dist/tokens.json` holds the authored OKLCH strings; `dist/figma-tokens.json`
holds the resolved hex. When pulling from Figma:

1. Compare Figma's colour to the token's resolved `value.hex`.
2. Equal hex ⇒ no change (OKLCH vs sRGB notation is not a diff).
3. Different hex ⇒ re-author in `src/pmndrs-design-book.ts` as
   `brand.set('<name>', color('oklch(<L% C H>)')) // #newhex`, converting the new
   hex to OKLCH. Keep the hex as the trailing comment. **Never** replace an
   `oklch(...)` value with a bare hex string.

## Fonts

Every typeface exists twice, in the two shapes the two consumers can use. Both
are generated from `families` in the design book, so they cannot drift.

- **`family.*` — one family name, no fallbacks** (`Faculty Glyphic`). Scoped
  `FONT_FAMILY`. This is the *only* shape Figma can bind: a text style's
  `fontName` is a single `{ family, style }`, and a variable bound to it has to
  resolve to a font the file has loaded.
- **`fonts.*` — the full CSS stack** (`"Faculty Glyphic", serif`). Scoped to
  **nothing**. Figma has no stack concept, so in the `FONT_FAMILY` scope these
  showed up in the picker beside the real families and produced bindings that
  could not resolve. They stay as variables for their WEB code syntax, which is
  what Dev Mode should show a developer, and an empty scope list is how Figma
  says "exists, but is not offered for binding". Figma accepts `scopes = []` and
  reads it back unchanged — verified against the live file.

Store both verbatim; a stack is not a colour and never needs conversion. When the
actual webfont must render in Figma (text specimens), load it with
`figma.loadFontAsync` and verify availability with `figma.listAvailableFontsAsync`
first — `family.*` holds exactly the strings those two APIs match on, which is
why it is the vendor's spelling rather than a self-hosted alias.
