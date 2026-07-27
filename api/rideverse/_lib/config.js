// Swappable AI model configuration. Changing the model for text, vision, or image
// generation is a one-line env var change here — no call-site changes required.
export const AI_CONFIG = {
  textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  visionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
  imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
}

// Path (relative to this repo) to the official "Velia #001 — Riviera" reference
// sheet, checked in at rideverse/design/official-velia-001-reference.png. It is
// currently used only as a written style note (see veriaDesignReference.js) —
// see that file's comment for why the raw multi-panel sheet isn't fed directly
// into image generation yet.
export const OFFICIAL_REFERENCE_IMAGE_PATH = 'rideverse/design/official-velia-001-reference.png'
