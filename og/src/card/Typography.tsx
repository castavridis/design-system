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
 * Every measurement descends from `brand.space`, and every colour from the
 * palette, so the layout re-proportions itself if the spacing token moves.
 */

import { tokens } from 'pmndrs-design-tokens'
import { AbsoluteFill } from 'remotion'
import { alpha } from '../lib/color'
import type { Palette } from '../lib/palette'
import type { ResolvedSpec } from '../lib/spec'

/** The spacing rhythm, as a number so it can be scaled. */
const unit = Number.parseFloat(tokens['brand.space'])
const radiusInput = Number.parseFloat(tokens['radius.input'])
const radiusSmall = Number.parseFloat(tokens['radius.small'])

/** The width the type scale was drawn against. */
const referenceWidth = 1200

/**
 * Headline size, backed off as the title grows.
 *
 * A generator cannot ask a designer to shorten a title, so it has to hold the
 * two-or-three-line silhouette itself. Below ~22 characters the headline runs
 * at full size; past that it gives back a little per character and stops at a
 * floor that still reads in a feed.
 */
function titleSize(title: string, scale: number): number {
	const full = referenceWidth * 0.079
	const floor = referenceWidth * 0.042
	const overflow = Math.max(0, title.length - 22)

	return Math.max(floor, full - overflow * 1.9) * scale
}

/** A pill — used for the meta chip. */
function chipStyle(palette: Palette, scale: number): React.CSSProperties {
	return {
		fontFamily: palette.fonts.mono,
		fontSize: 17 * scale,
		letterSpacing: '0.02em',
		color: palette.inkMuted,
		border: `1px solid ${alpha(palette.ink, 0.16)}`,
		borderRadius: radiusInput * scale,
		padding: `${0.4 * unit * scale}px ${0.75 * unit * scale}px`,
		// Nearly opaque. The chip is small monospaced text that can land on any
		// part of any scene, and it is the first thing to become unreadable
		// when the artwork behind it is bright.
		background: alpha(palette.ground, 0.78),
		whiteSpace: 'nowrap',
	}
}

export function Typography({ spec, palette }: { spec: ResolvedSpec; palette: Palette }) {
	// Everything is drawn at 1200px wide and scaled, so a square or a 1920
	// card is the same design rather than the same pixel sizes in a wider box.
	const scale = spec.width / referenceWidth
	const pad = 4.25 * unit * scale

	return (
		<AbsoluteFill
			style={{
				padding: pad,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
			}}
		>
			<header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 0.6 * unit * scale }}>
					<span
						style={{
							width: 0.7 * unit * scale,
							height: 0.7 * unit * scale,
							borderRadius: '50%',
							background: palette.accent,
							// The dot is the brightest small thing on the card; let
							// it glow rather than sit flat.
							boxShadow: `0 0 ${1.4 * unit * scale}px ${alpha(palette.accent, 0.9)}`,
						}}
					/>
					<span
						style={{
							fontFamily: palette.fonts.mono,
							fontSize: 20 * scale,
							letterSpacing: '0.04em',
							color: palette.ink,
						}}
					>
						pmndrs
					</span>
				</div>

				{spec.meta === '' ? null : <span style={chipStyle(palette, scale)}>{spec.meta}</span>}
			</header>

			<footer style={{ display: 'flex', flexDirection: 'column', gap: 0.75 * unit * scale }}>
				<span
					style={{
						width: 3.5 * unit * scale,
						height: 3 * scale,
						borderRadius: radiusSmall * scale,
						background: palette.accent,
					}}
				/>

				{spec.eyebrow === '' ? null : (
					<span
						style={{
							fontFamily: palette.fonts.mono,
							fontSize: 19 * scale,
							letterSpacing: '0.16em',
							textTransform: 'uppercase',
							color: palette.accent,
						}}
					>
						{spec.eyebrow}
					</span>
				)}

				<h1
					style={{
						margin: 0,
						fontFamily: palette.fonts.serif,
						fontWeight: 400,
						fontSize: titleSize(spec.title, scale),
						lineHeight: 1.03,
						letterSpacing: '-0.015em',
						color: palette.ink,
						maxWidth: '76%',
						// Chromium evens the ragged edge itself, which beats any
						// break the generator could guess at.
						textWrap: 'balance',
					}}
				>
					{spec.title}
				</h1>

				{spec.subtitle === '' ? null : (
					<p
						style={{
							margin: 0,
							fontFamily: palette.fonts.sans,
							fontWeight: 400,
							fontSize: 26 * scale,
							lineHeight: 1.35,
							color: palette.inkMuted,
							maxWidth: '58%',
						}}
					>
						{spec.subtitle}
					</p>
				)}
			</footer>
		</AbsoluteFill>
	)
}
