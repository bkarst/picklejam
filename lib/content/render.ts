/**
 * render.ts — trusted-markdown rendering + article metadata (PRD §6.5/§6.6).
 *
 * Content Hub bodies are DB-stored MARKDOWN authored by us (trusted), so we render
 * with `react-markdown` (which does NOT execute raw HTML by default — the body stays
 * sanitized + component-free) plus:
 *   • `remark-gfm`   — tables / strikethrough / autolinks / task lists
 *   • `rehype-slug`  — deterministic heading `id`s so the article TOC anchors resolve
 *
 * `extractToc` re-derives those exact ids WITHOUT rendering (for the sidebar /
 * scroll-spy) by feeding heading text through the SAME slugger `rehype-slug` uses
 * (`github-slugger`) in document order — including its duplicate-suffix behavior —
 * so a TOC anchor is guaranteed to match the rendered heading's `id`.
 *
 * `readMinutes` is a ~200-wpm estimate used on cards + the article header.
 *
 * NOTE: `react-markdown` v10 is ESM. It imports cleanly under Next server
 * components, vitest, and tsx (verified), so the imports live at module scope; only
 * `MarkdownBody` actually pulls the renderer in — `extractToc`/`readMinutes` are pure.
 */

import { createElement, type ReactElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import GithubSlugger from "github-slugger";

// ── TOC + reading time (pure) ────────────────────────────────────────────────

export interface TocEntry {
  /** Heading `id` (matches `rehype-slug`'s rendered id → anchor target). */
  id: string;
  /** Plain-text heading label (inline markdown stripped). */
  text: string;
  /** Heading level (2 = h2, 3 = h3). */
  depth: 2 | 3;
  /** Alias of {@link depth} — matches the client `TocItem.level` the sidebar reads. */
  level: 2 | 3;
}

/** Strip the inline markdown syntax a heading may carry down to its text content
 *  (what `hast-util-to-string`/`rehype-slug` slugs). Order matters: images before
 *  links, then emphasis (bold before italic so `**`/`__` aren't half-eaten by `*`/`_`).
 *  Per CommonMark, `*` emphasis may be intraword but `_` may NOT — so underscore
 *  markers are only stripped at word boundaries, leaving `snake_case` intact (else the
 *  slug would diverge from `rehype-slug`, breaking the TOC anchor). */
function stripInline(input: string): string {
  return input
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // image → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // link → text
    .replace(/`([^`]+)`/g, "$1") // inline code → contents
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold** (intraword allowed)
    .replace(/(^|[^\w])__(?!\s)(.+?)(?<!\s)__(?!\w)/g, "$1$2") // __bold__ (word-boundary only)
    .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, "$1") // *italic* (intraword allowed)
    .replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1$2") // _italic_ (word-boundary only)
    .replace(/~~(.*?)~~/g, "$2") // strikethrough
    .trim();
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
/** A fenced-code delimiter — captures the run of ` or ~ so we can match open↔close. */
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Extract the h2/h3 outline of a markdown body with ids that match `rehype-slug`.
 *
 * ALL heading levels (h1–h6) are fed to the slugger in document order so its
 * duplicate-suffix counter advances identically to the render pass (a later
 * duplicate becomes `foo-1`, `foo-2`, …); only h2/h3 are returned for the TOC.
 * Fenced code blocks are skipped so a `# comment` inside a code sample is never
 * mistaken for a heading.
 */
export function extractToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const out: TocEntry[] = [];
  let fenceChar: "`" | "~" | null = null; // the fence char that opened the current block

  for (const line of markdown.split(/\r?\n/)) {
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const char = fence[1][0] as "`" | "~";
      // A block opened with ``` closes only on ``` (not ~~~), per CommonMark — so a
      // ~~~ line INSIDE a ```-fenced sample is literal content, not a close.
      if (fenceChar === null) fenceChar = char;
      else if (char === fenceChar) fenceChar = null;
      continue;
    }
    if (fenceChar !== null) continue;

    const m = HEADING_RE.exec(line);
    if (!m) continue;

    const depth = m[1].length;
    const text = stripInline(m[2]);
    const id = slugger.slug(text); // advance the counter for EVERY heading
    if (depth === 2 || depth === 3) out.push({ id, text, depth, level: depth });
  }
  return out;
}

/** Estimated reading time in whole minutes (~200 wpm, floored at 1). */
export function readMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ── rendering ────────────────────────────────────────────────────────────────

/** Base prose container — brand typography + spacing (Tailwind tokens ← theme). */
const PROSE =
  "font-sans text-[1.0625rem] leading-7 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

type MdProps = { node?: unknown; className?: string; children?: ReactNode } & Record<
  string,
  unknown
>;

/** A styled element factory that drops react-markdown's `node` prop and overrides
 *  the incoming className, but PRESERVES every other prop — crucially the `id` that
 *  `rehype-slug` sets, so TOC anchors resolve. */
function mk(tag: string, className: string) {
  const C = (props: MdProps): ReactElement => {
    const rest: Record<string, unknown> = { ...props };
    delete rest.node; // not a valid DOM attribute
    delete rest.className; // replaced by our brand class
    return createElement(tag, { ...rest, className });
  };
  C.displayName = `Md(${tag})`;
  return C;
}

/** Tailwind class map (Light + Dark via theme tokens). Headings get `scroll-mt-24`
 *  so anchored navigation clears the sticky header. */
const components = {
  h1: mk("h1", "mt-8 mb-4 scroll-mt-24 font-display text-3xl font-bold tracking-tight text-foreground"),
  h2: mk("h2", "mt-10 mb-3 scroll-mt-24 font-display text-2xl font-semibold tracking-tight text-foreground"),
  h3: mk("h3", "mt-8 mb-2 scroll-mt-24 text-xl font-semibold text-foreground"),
  h4: mk("h4", "mt-6 mb-2 scroll-mt-24 text-lg font-semibold text-foreground"),
  p: mk("p", "my-4 leading-7 text-foreground"),
  a: mk("a", "font-medium text-link underline underline-offset-2 hover:opacity-80"),
  ul: mk("ul", "my-4 list-disc space-y-1.5 pl-6 marker:text-muted"),
  ol: mk("ol", "my-4 list-decimal space-y-1.5 pl-6 marker:text-muted"),
  li: mk("li", "leading-7"),
  blockquote: mk("blockquote", "my-6 border-l-4 border-accent/40 pl-4 italic text-muted"),
  hr: mk("hr", "my-8 border-t border-border"),
  strong: mk("strong", "font-semibold text-foreground"),
  em: mk("em", "italic"),
  code: mk("code", "rounded bg-muted/15 px-1.5 py-0.5 font-mono text-[0.9em]"),
  pre: mk("pre", "my-5 overflow-x-auto rounded-xl border border-border bg-surface p-4 text-sm [&_code]:bg-transparent [&_code]:p-0"),
  img: mk("img", "my-5 h-auto max-w-full rounded-xl"),
  table: mk("table", "my-5 w-full border-collapse overflow-hidden text-sm"),
  thead: mk("thead", "border-b border-border text-left"),
  th: mk("th", "px-3 py-2 text-left font-semibold text-foreground"),
  td: mk("td", "border-t border-border px-3 py-2 align-top"),
} as unknown as Components;

/**
 * Render a trusted markdown body as sanitized React elements (server component /
 * pure element helper). Heading `id`s come from `rehype-slug` and line up with
 * {@link extractToc}. No raw-HTML execution (react-markdown default).
 */
export function MarkdownBody({ markdown }: { markdown: string }): ReactElement {
  return createElement(
    "div",
    { className: PROSE },
    createElement(
      Markdown,
      { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug], components },
      markdown,
    ),
  );
}
