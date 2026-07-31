/**
 * Studio and CLI configuration.
 *
 * This file is read by `remotion studio` and the Remotion CLI only — the
 * programmatic renderer in `scripts/render.ts` does not load it, so anything
 * that has to hold for a render is set there as well. The two are kept in step
 * deliberately rather than shared, because `@remotion/cli` should not become a
 * dependency of the render path.
 */

import { Config } from '@remotion/cli/config'

Config.setEntryPoint('./src/index.ts')

// PNG: cards are flat colour, type and gradients, where JPEG's ringing shows
// up along the headline.
Config.setVideoImageFormat('png')

/**
 * SwiftShader behind ANGLE.
 *
 * The render machine has no GPU, and Chromium's default renderer gives no
 * WebGL at all there — the canvas would come out blank rather than fail. This
 * is the software path that actually draws.
 */
Config.setChromiumOpenGlRenderer('swangle')
