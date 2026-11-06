/**
 * The `slidecraft` module: everything a vault component may import from the app (vault
 * components plan, V1). Vault code imports only this, `react`, `react/jsx-runtime`,
 * `motion/react` and files in its own folder.
 *
 * This is a public API. Add to it when a vault component needs more; never remove or rename
 * an export, because vault code in people's folders depends on it. `tests/vaultApi.test.ts` keeps
 * a snapshot of the export list so a removal fails.
 */

/** Bumped when exports are added. */
export const API_VERSION = 1

// Defining a component. Templates are MDX files in the vault, so defineTemplate is not here.
export { defineComponent } from '../components/slides/defineComponent'
export type { ComponentDefinition, RegistryConfig, RegistryProp, ToolbarPropEditor, WithChildren } from '../components/slides/defineComponent'

// Colour: accents, tints, pastels.
export * from '../components/slides/accents'

// Motion: the shared variants, springs and style presets.
export * from '../animations/variants'
export * from '../animations/springs'
export * from '../components/slides/styles'

// Steps and builds.
export { ALL_STEPS, MAX_STEPS, readStep, countSteps } from '../animations/steps'
export { useStepState, useStepVisible, StepContext, type StepState } from '../animations/stepContext'
export { useStepMotion } from '../animations/stepMotion'
export { useStages, useLive } from '../components/slides/beats'

// Where the component is: the slide's layout and accent, the deck, thumbnails.
export { useSlideLayout, useAccent, type SlideLayout } from '../components/slides/slideLayoutContext'
export { useDeck, useAsset } from '../components/slides/deckContext'
export { useInThumbnail, StageScaleContext } from '../components/slides/thumbnailContext'

// Diagram helpers: wires, glow, pulses.
export * from '../components/slides/glow'

// Every built-in component, so a vault component can compose them.
export * from '../components/slides'
