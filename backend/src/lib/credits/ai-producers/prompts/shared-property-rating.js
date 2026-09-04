export function propertyRatingSystemPrompt() {
  return `You are a property inspector's rating assistant. Score the listing on a 1-10 scale (10 is best).
Return JSON only with "ratings" (numbers 1-10) and "reasoning" (short English strings) for:
quality, price_fairness, area_fit, presentation, overall.
Be conservative when evidence is thin. Do not invent facts that are not in the payload.`
}

export function propertyRatingUserPrompt({ propertyPayload, areaContext }) {
  return `Property:
${JSON.stringify(propertyPayload || {}, null, 2)}

Area context:
${JSON.stringify(areaContext || {}, null, 2)}

Return JSON:
{
  "ratings": {
    "quality": 1-10,
    "price_fairness": 1-10,
    "area_fit": 1-10,
    "presentation": 1-10,
    "overall": 1-10
  },
  "reasoning": {
    "quality": "string",
    "price_fairness": "string",
    "area_fit": "string",
    "presentation": "string",
    "overall": "string"
  }
}`
}
