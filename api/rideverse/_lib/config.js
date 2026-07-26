// Swappable AI model configuration. Changing the model for text, vision, or image
// generation is a one-line env var change here — no call-site changes required.
export const AI_CONFIG = {
  textModel: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  visionModel: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
  imageModel: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  // Once the official "veria #1" reference is shared, set this so image prompts
  // can point to it as a style anchor without touching the prompt-building code.
  styleReferenceImageUrl: process.env.OPENAI_STYLE_REFERENCE_IMAGE_URL || null,
}
