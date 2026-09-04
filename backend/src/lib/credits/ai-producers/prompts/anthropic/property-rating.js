import { propertyRatingSystemPrompt, propertyRatingUserPrompt } from '../shared-property-rating.js'

export { propertyRatingSystemPrompt, propertyRatingUserPrompt }

const SCORE = { type: 'number', minimum: 1, maximum: 10 }
const REASON = { type: 'string', minLength: 1 }
const DIMENSIONS = ['quality', 'price_fairness', 'area_fit', 'presentation', 'overall']

export function propertyRatingTool() {
  const ratingProperties = {}
  const reasoningProperties = {}
  for (const key of DIMENSIONS) {
    ratingProperties[key] = SCORE
    reasoningProperties[key] = REASON
  }
  return {
    name: 'submit_property_rating',
    description: 'Submit structured 1-10 property ratings with per-dimension reasoning.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ratings: {
          type: 'object',
          additionalProperties: false,
          properties: ratingProperties,
          required: [...DIMENSIONS],
        },
        reasoning: {
          type: 'object',
          additionalProperties: false,
          properties: reasoningProperties,
          required: [...DIMENSIONS],
        },
      },
      required: ['ratings', 'reasoning'],
    },
  }
}
