/**
 * The type layer, in the DOM.
 *
 * The headline is deliberately *not* 3D. Troika sets type into an SDF atlas,
 * which is the right trade for a wordmark buried in the scene but the wrong
 * one for the line someone has to read at thumbnail size in a timeline: the
 * browser's own rasteriser has the hinting and subpixel positioning, and the
 * card is being captured through a browser regardless. The scene keeps the
 * wordmark; this keeps the message.
 *
 * Nothing here decides where anything goes. Every measurement comes from
 * `og/layout/card.json` — see `layout.ts` for why — so this file is only the
 * arrangement of three blocks and what goes in them. Colours still come from
 * the palette, and the whole layout is drawn against the reference box and
 * scaled, so a square or a 1920 card is the same design rather than the same
 * pixel sizes in a wider box.
 */

import { AbsoluteFill } from 'remotion'
import { alpha } from '../lib/color'
import type { Palette } from '../lib/palette'
import type { ResolvedSpec } from '../lib/spec'
import { blockFlow, blockPosition, cardLayout, titleSize, typeStyle, type Block, type Ink } from './layout'

/** A block, positioned by its anchor and flowing its own children. */
function Region({
	block,
	scale,
	children,
}: {
	block: Block
	scale: number
	children: React.ReactNode
}) {
	return <div style={{ ...blockPosition(block, scale), ...blockFlow(block, scale) }}>{children}</div>
}

export function Typography({ spec, palette }: { spec: ResolvedSpec; palette: Palette }) {
	const { blocks, type, marks, reference } = cardLayout
	const scale = spec.width / reference.width

	/* The palette entries the layout is allowed to name. */
	const ink: Record<Ink, string> = {
		ink: palette.ink,
		inkMuted: palette.inkMuted,
		accent: palette.accent,
		ground: palette.ground,
	}
	const style = (name: keyof typeof type) => typeStyle(type[name], ink, palette.fonts, scale)

	const messageWidth = blocks.message.measure ?? reference.width

	return (
		<AbsoluteFill>
			<Region block={blocks.brand} scale={scale}>
				<span
					style={{
						width: marks.dot.size * scale,
						height: marks.dot.size * scale,
						borderRadius: '50%',
						background: palette.accent,
						// The dot is the brightest small thing on the card; let it
						// glow rather than sit flat.
						boxShadow: `0 0 ${marks.dot.glow * scale}px ${alpha(palette.accent, 0.9)}`,
						flexShrink: 0,
					}}
				/>
				<span style={style('wordmark')}>pmndrs</span>
			</Region>

			{spec.meta === '' ? null : (
				<Region block={blocks.meta} scale={scale}>
					<span
						style={{
							...style('chip'),
							border: `1px solid ${alpha(palette.ink, marks.chip.line)}`,
							borderRadius: marks.chip.radius * scale,
							padding: `${marks.chip.padY * scale}px ${marks.chip.padX * scale}px`,
							// Nearly opaque. The chip is small monospaced text that can
							// land on any part of any scene, and it is the first thing
							// to become unreadable when the artwork behind it is bright.
							background: alpha(palette.ground, marks.chip.fill),
							whiteSpace: 'nowrap',
						}}
					>
						{spec.meta}
					</span>
				</Region>
			)}

			<Region block={blocks.message} scale={scale}>
				<span
					style={{
						width: marks.rule.width * scale,
						height: marks.rule.height * scale,
						borderRadius: marks.rule.radius * scale,
						background: palette.accent,
						flexShrink: 0,
					}}
				/>

				{spec.eyebrow === '' ? null : <span style={style('eyebrow')}>{spec.eyebrow}</span>}

				<h1
					style={{
						margin: 0,
						fontWeight: 400,
						...style('title'),
						fontSize: titleSize(spec.title, type.title, scale),
						maxWidth: (type.title.measure ?? 1) * messageWidth * scale,
						// Chromium evens the ragged edge itself, which beats any break
						// the generator could guess at.
						textWrap: 'balance',
					}}
				>
					{spec.title}
				</h1>

				{spec.subtitle === '' ? null : (
					<p
						style={{
							margin: 0,
							fontWeight: 400,
							...style('subtitle'),
							maxWidth: (type.subtitle.measure ?? 1) * messageWidth * scale,
						}}
					>
						{spec.subtitle}
					</p>
				)}
			</Region>
		</AbsoluteFill>
	)
}
