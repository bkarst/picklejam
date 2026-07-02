import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { extractToc, readMinutes, MarkdownBody } from "@/lib/content/render";

/**
 * Unit tests for the Content Hub markdown renderer (PRD §6.5). The load-bearing
 * contract is that `extractToc` re-derives the SAME heading ids `rehype-slug`
 * stamps on the rendered output — otherwise TOC/scroll-spy anchors dangle. We prove
 * it by rendering `MarkdownBody` and asserting the rendered h2/h3 ids equal
 * `extractToc`'s, including duplicate suffixes, GitHub-slugger punctuation handling,
 * the h1-advances-the-counter case, inline-markdown stripping, and code-fence skips.
 */

const DOC = `# Title

Intro paragraph with some words.

## Title

A duplicate of the H1 to prove the slug counter advances across levels.

## Rules & Scoring

Punctuation must slug exactly like github-slugger does.

### The **Kitchen** Rule

Inline emphasis is stripped to text content.

## Overview

## Overview

Two identical H2s → the second gets a \`-1\` suffix.

\`\`\`
## Not A Heading
\`\`\`

#### Deep Heading

## After Code
`;

/** Pull the rendered heading ids (h2/h3 only) in document order. */
function renderedHeadingIds(markdown: string): string[] {
  const html = renderToStaticMarkup(MarkdownBody({ markdown }));
  const ids: string[] = [];
  const re = /<h([1-6])\b[^>]*\bid="([^"]*)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] === "2" || m[1] === "3") ids.push(m[2]);
  }
  return ids;
}

describe("extractToc", () => {
  it("returns only h2/h3 with the expected labels + depths", () => {
    const toc = extractToc(DOC);
    expect(toc).toEqual([
      { id: "title-1", text: "Title", depth: 2, level: 2 },
      { id: "rules--scoring", text: "Rules & Scoring", depth: 2, level: 2 },
      { id: "the-kitchen-rule", text: "The Kitchen Rule", depth: 3, level: 3 },
      { id: "overview", text: "Overview", depth: 2, level: 2 },
      { id: "overview-1", text: "Overview", depth: 2, level: 2 },
      { id: "after-code", text: "After Code", depth: 2, level: 2 },
    ]);
  });

  it("ids EXACTLY match the rendered rehype-slug heading ids (anchor contract)", () => {
    const tocIds = extractToc(DOC).map((e) => e.id);
    expect(renderedHeadingIds(DOC)).toEqual(tocIds);
  });

  it("skips headings inside fenced code blocks", () => {
    const md = "## Before\n\n```\n## Fake Heading\n```\n\n## After";
    expect(extractToc(md).map((e) => e.id)).toEqual(["before", "after"]);
  });

  it("keeps intraword underscores (snake_case) — matches rehype-slug (anchor contract)", () => {
    // CommonMark does NOT treat `snake_case` as emphasis; the slug keeps the underscores.
    const md = "## The snake_case Rule\n\nBody.";
    expect(extractToc(md).map((e) => e.id)).toEqual(renderedHeadingIds(md));
    expect(extractToc(md)[0].text).toBe("The snake_case Rule");
  });

  it("does not let a ~~~ line close a ```-fenced block (fence-char match)", () => {
    const md = "## Before\n\n```\n~~~\n## Still Code\n```\n\n## After";
    expect(extractToc(md).map((e) => e.id)).toEqual(["before", "after"]);
    expect(extractToc(md).map((e) => e.id)).toEqual(renderedHeadingIds(md));
  });

  it("is empty when there are no h2/h3 headings", () => {
    expect(extractToc("# Only an H1\n\nJust body text.")).toEqual([]);
  });
});

describe("readMinutes", () => {
  const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

  it("estimates ~200 wpm, rounding up, floored at 1", () => {
    expect(readMinutes("")).toBe(1);
    expect(readMinutes(words(1))).toBe(1);
    expect(readMinutes(words(200))).toBe(1);
    expect(readMinutes(words(201))).toBe(2);
    expect(readMinutes(words(400))).toBe(2);
    expect(readMinutes(words(600))).toBe(3);
  });
});

describe("MarkdownBody", () => {
  it("renders gfm tables + links without executing raw HTML", () => {
    const md = "| A | B |\n| - | - |\n| 1 | 2 |\n\n[link](https://x.test)\n\n<script>alert(1)</script>";
    const html = renderToStaticMarkup(MarkdownBody({ markdown: md }));
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain('href="https://x.test"');
    // Raw HTML is NOT executed/emitted as a live tag (react-markdown default).
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
