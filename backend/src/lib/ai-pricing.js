/**
 * Per-model list prices used only for observability estimates.
 *
 * Unit: USD × 10_000 per 1M tokens (the "micro-USD" unit consumed by
 * estimateCostMicroUsd). Cost is recorded, never enforced.
 *
 * Verified 2026-09-01 against provider docs. Unknown provider:model keys
 * return null from estimateCostMicroUsd so logging still succeeds.
 */
export const AI_PRICING = {
  // Anthropic Claude 3 Haiku — $0.25 / $1.25 per 1M. https://www.anthropic.com/pricing
  'claude:claude-3-haiku-20240307': { inputPerMillionMicroUsd: 2_500, outputPerMillionMicroUsd: 12_500 },
  // OpenAI gpt-4o-mini — $0.15 / $0.60 per 1M. https://platform.openai.com/docs/pricing
  'openai:gpt-4o-mini': { inputPerMillionMicroUsd: 1_500, outputPerMillionMicroUsd: 6_000 },
  // Gemini 1.5 Flash last published (model retired 2025-09-24) — $0.075 / $0.30 per 1M ≤128K.
  'gemini:gemini-1.5-flash': { inputPerMillionMicroUsd: 750, outputPerMillionMicroUsd: 3_000 },
  // Moonshot V1 8K Vision Preview — $0.20 / $2.00 per 1M. https://platform.kimi.ai/docs/pricing/chat-v1
  'kimi:moonshot-v1-8k-vision-preview': { inputPerMillionMicroUsd: 2_000, outputPerMillionMicroUsd: 20_000 },
  // deepseek-chat alias — last documented V3-era rates ($0.27 / $1.10). Alias retired 2026-07-24.
  'deepseek:deepseek-chat': { inputPerMillionMicroUsd: 2_700, outputPerMillionMicroUsd: 11_000 },
  // Qwen-VL-Max International (Model Studio) — $0.229 / $0.573 per 1M.
  // https://docs.modelstudio.console.alibabacloud.com/en/model-studio/qwen-vl-max
  'qwen:qwen-vl-max': { inputPerMillionMicroUsd: 2_290, outputPerMillionMicroUsd: 5_730 },
}
