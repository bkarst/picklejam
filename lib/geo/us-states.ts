/**
 * us-states.ts — US state slug → 2-letter abbreviation (for "{City}, {ST}" titles,
 * §3.3). v1 is US-only (§13 international deferred). Falls back to the uppercased
 * slug if unknown.
 */

const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district-of-columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new-hampshire": "NH", "new-jersey": "NJ", "new-mexico": "NM", "new-york": "NY",
  "north-carolina": "NC", "north-dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode-island": "RI", "south-carolina": "SC",
  "south-dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west-virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "puerto-rico": "PR",
};

/** 2-letter abbreviation for a state slug ("kansas" → "KS"). */
export function stateAbbr(stateSlug: string): string {
  return US_STATE_ABBR[stateSlug] ?? stateSlug.replace(/-/g, " ").toUpperCase();
}
