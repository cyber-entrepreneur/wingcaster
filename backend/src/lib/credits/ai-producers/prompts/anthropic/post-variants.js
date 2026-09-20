export function postVariantsTool(channels, tones) {
  const captionProps = {}
  for (const channel of channels) {
    captionProps[channel] = { type: 'string', description: `${channel} caption` }
  }
  const variantItems = {
    type: 'object',
    additionalProperties: false,
    properties: {
      tone: { type: 'string', enum: [...tones] },
      label: { type: 'string' },
      captions: {
        type: 'object',
        additionalProperties: false,
        properties: captionProps,
        required: [...channels],
      },
    },
    required: ['tone', 'label', 'captions'],
  }
  return {
    name: 'submit_variant_captions',
    description: 'Submit multiple English caption variants per channel.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        variants: {
          type: 'array',
          minItems: tones.length,
          items: variantItems,
        },
      },
      required: ['variants'],
    },
  }
}
