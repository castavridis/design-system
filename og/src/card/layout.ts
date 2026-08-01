/**
 * The card's layout, as data.
 *
 * `Typography.tsx` used to hold these numbers inline, which was fine while the
 * only way to move the headline was to edit the component. It isn't fine now
 * that the cards are in Figma: a layout expressed as JSX can be read by a
 * designer but not written by one, and a design system where only one side can
 * change the design is a handoff, not a round trip.
 *
 * So the geometry lives in `og/layout/card.json`, `pnpm figma:template` draws
 * it as a real frame with real text nodes, and dragging a block there writes
 * the numbers back here.
 *
 * Two decisions make that round trip possible at all.
 *
 * **Everything is authored at the reference box** — 1200×630 — and scaled by
 * `width / reference.width` at render time. So one Figma template defines the
 * square and the 1920 card too, and the numbers in the JSON are literally the
 * pixel coordinates of the template frame. No normalising, no unit to get
 * wrong; what the designer sees in the Figma inspector is what lands in the
 * file.
 *
 * **A block is anchored, not placed.** It records which edge or corner it hangs
 * from and how far in, so its text flows *away* from that anchor: the message
 * block hangs off the bottom, so a three-line title grows upward and the card
 * still composes. Pinning each element at an absolute y would look identical
 * for the title it was drawn with and fall apart for the next one — and a
 * generator only ever renders titles it has not seen.
 */

import layout from '../../layout/card.json'

/** Which edge or corner a block hangs from. */
export type Anchor =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'middle-left'
	| 'middle-center'
	| 'middle-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right'

export type Align = 'left' | 'center' | 'right'

export interface Block {
	anchor: Anchor
	/** Inset from the anchored edges, in reference pixels. */
	offset: { x: number; y: number }
	/** Block width in reference pixels. `null` hugs the content. */
	measure: number | null
	direction: 'row' | 'column'
	gap: number
	align: Align
}

/** Which palette entry paints a piece of type. */
export type Ink = 'ink' | 'inkMuted' | 'accent' | 'ground'

export interface TypeStyle {
	font: 'serif' | 'sans' | 'mono'
	/** Reference pixels. For the title this is the *unconstrained* size. */
	size: number
	/** `em`, the same unit CSS letter-spacing takes. */
	tracking?: number
	/** Multiple of the font size. Absent means the browser's own normal. */
	leading?: number
	case?: 'upper'
	/** Fraction of the block's measure. Absent means the whole block. */
	measure?: number
	ink: Ink
	/** Title only — the floor its size backs off to. */
	min?: number
	/** Title only — pixels given back per character past `threshold`. */
	backoff?: number
	threshold?: number
}

export interface Layout {
	reference: { width: number; height: number }
	blocks: Record<'brand' | 'meta' | 'message', Block>
	type: Record<'wordmark' | 'chip' | 'eyebrow' | 'title' | 'subtitle', TypeStyle>
	marks: {
		dot: { size: number; glow: number }
		rule: { width: number; height: number; radius: number }
		chip: { padX: number; padY: number; radius: number; fill: number; line: number }
	}
}

export const cardLayout = layout as Layout

export const anchors: Anchor[] = [
	'top-left',
	'top-center',
	'top-right',
	'middle-left',
	'middle-center',
	'middle-right',
	'bottom-left',
	'bottom-center',
	'bottom-right',
]

/**
 * Headline size, backed off as the title grows.
 *
 * A generator cannot ask a designer to shorten a title, so it has to hold the
 * two-or-three-line silhouette itself. Below `threshold` characters the
 * headline runs at full size; past that it gives back `backoff` per character
 * and stops at a floor that still reads in a feed.
 */
export function titleSize(title: string, style: TypeStyle, scale: number): number {
	const floor = style.min ?? style.size
	const overflow = Math.max(0, title.length - (style.threshold ?? Number.POSITIVE_INFINITY))
	return Math.max(floor, style.size - overflow * (style.backoff ?? 0)) * scale
}

/**
 * The CSS that puts a block where its anchor says.
 *
 * `top`/`bottom` rather than a computed `y`, so the browser resolves the block
 * against the edge it hangs from and the content grows the right way. A centred
 * anchor is the one case that needs a transform, because "the middle" is only
 * knowable once the block has a height.
 */
export function blockPosition(block: Block, scale: number): React.CSSProperties {
	const [vertical, horizontal] = block.anchor.split('-') as ['top' | 'middle' | 'bottom', Align | 'center']

	const style: React.CSSProperties = { position: 'absolute' }
	const x = block.offset.x * scale
	const y = block.offset.y * scale

	if (vertical === 'top') style.top = y
	else if (vertical === 'bottom') style.bottom = y
	else style.top = `calc(50% + ${y}px)`

	if (horizontal === 'left') style.left = x
	else if (horizontal === 'right') style.right = x
	else style.left = `calc(50% + ${x}px)`

	const shiftX = horizontal === 'center' ? '-50%' : '0'
	const shiftY = vertical === 'middle' ? '-50%' : '0'
	if (shiftX !== '0' || shiftY !== '0') style.transform = `translate(${shiftX}, ${shiftY})`

	return style
}

const justify: Record<Align, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }

/** Flex layout for a block's own children. */
export function blockFlow(block: Block, scale: number): React.CSSProperties {
	const row = block.direction === 'row'
	return {
		display: 'flex',
		flexDirection: row ? 'row' : 'column',
		gap: block.gap * scale,
		// A row aligns its children across the main axis; a column across the
		// cross axis. Either way `align` means the same thing to a reader: which
		// side of the block the content sits on.
		...(row ? { alignItems: 'center', justifyContent: justify[block.align] } : { alignItems: justify[block.align] }),
		...(block.measure === null ? {} : { width: block.measure * scale }),
		textAlign: block.align,
	}
}

/** The type styles a piece of text shares whatever block it sits in. */
export function typeStyle(style: TypeStyle, palette: Record<Ink, string>, fonts: Record<string, string>, scale: number) {
	return {
		fontFamily: fonts[style.font],
		fontSize: style.size * scale,
		color: palette[style.ink],
		...(style.tracking === undefined ? {} : { letterSpacing: `${style.tracking}em` }),
		...(style.leading === undefined ? {} : { lineHeight: style.leading }),
		...(style.case === 'upper' ? { textTransform: 'uppercase' as const } : {}),
	}
}
