# Producer prompt variants

v1 English prompts are identical across OpenAI and Anthropic. The only
divergence is the structured-output envelope:

- OpenAI: `response_format: { type: 'json_object' }`
- Anthropic: tool-use with a JSON Schema `input_schema` (`tool_choice` forced)

Do not add Arabic templates here. Non-`en` `createAiPost` calls throw
`LANGUAGE_NOT_YET_SUPPORTED`.
