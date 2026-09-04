import { DEFAULT_POST_CHANNELS } from '../../config.js'
import { postCreationSystemPrompt, postCreationUserPrompt } from '../shared-post-creation.js'

export { postCreationSystemPrompt, postCreationUserPrompt }

export function postCreationTool(channels = DEFAULT_POST_CHANNELS) {
  const properties = {}
  for (const channel of channels) {
    properties[channel] = { type: 'string', description: `${channel} caption` }
  }
  return {
    name: 'submit_captions',
    description: 'Submit per-channel English social captions derived from the listing description.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        captions: {
          type: 'object',
          additionalProperties: false,
          properties,
          required: [...channels],
        },
      },
      required: ['captions'],
    },
  }
}
