/**
 * phone.ts — display + dialable formatting for phone numbers.
 *
 * Court phones are ingested raw from source data (Google Places, seeds), so they
 * arrive in every shape: "8287576230", "+18287576230", "828-757-6230",
 * "(828) 757-6230", "+1 828 757 6230". {@link formatPhone} normalizes NANP
 * (US/Canada) numbers to one readable form; anything non-NANP or unparseable is
 * returned trimmed and untouched so international numbers are never mangled.
 */

/** A North American Numbering Plan number: 10 digits, with an optional leading `1`. */
const NANP = /^1?(\d{3})(\d{3})(\d{4})$/;

/** Human-readable display form, e.g. `(828) 757-6230`. Non-NANP input passes through trimmed. */
export function formatPhone(raw: string): string {
  const m = NANP.exec(raw.replace(/\D/g, ""));
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : raw.trim();
}

/** `tel:` href value — E.164 (`+1…`) for NANP numbers, else the trimmed original digits. */
export function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const m = NANP.exec(digits);
  if (m) return `+1${m[1]}${m[2]}${m[3]}`;
  // Preserve a leading + for already-international numbers; otherwise dial the digits.
  return raw.trim().startsWith("+") ? `+${digits}` : digits || raw.trim();
}
