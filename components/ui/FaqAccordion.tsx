/**
 * FaqAccordion — accessible FAQ using native <details>/<summary>.
 *
 * Server component: the answer text is always in the crawlable HTML (JS-off), so
 * it matches the FAQPage JSON-LD (§3.4/§14.4 render moat). No client JS needed.
 */

export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {items.map((qa) => (
        <details key={qa.question} className="group px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-left font-medium text-foreground marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {qa.question}
            <svg
              viewBox="0 0 24 24"
              className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <p className="pb-4 text-muted">{qa.answer}</p>
        </details>
      ))}
    </div>
  );
}
