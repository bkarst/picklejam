# Next.js 16.2.9 Conventions Reference (PickleLoko)

> Verified against the docs shipped **inside this repo** at
> `node_modules/next/dist/docs/01-app/` for the exact installed version
> **`next@16.2.9`** (see `node_modules/next/package.json`). Every claim below cites the
> doc file it came from. Where a doc contradicts pre-16 "common knowledge," it is
> flagged. This is the source of truth for rendering code in this project.

---

## 0. TL;DR — the two caching models, and which one WE use

Next 16 has **two mutually-exclusive caching/rendering models**, gated by one config flag:

| Model | Enabled by | What you use |
| --- | --- | --- |
| **Legacy / "Previous Model"** (what THIS repo uses today) | `cacheComponents` **absent/false** | `export const revalidate`, `export const dynamic`, `export const dynamicParams`, `export const fetchCache`, `fetch` cache options, `unstable_cache`, `revalidatePath`, `revalidateTag` |
| **Cache Components (PPR)** | `cacheComponents: true` in `next.config.ts` | `use cache` directive, `cacheLife`, `cacheTag`, `updateTag`, `revalidateTag`; **`dynamic`/`dynamicParams`/`revalidate`/`fetchCache` segment configs are REMOVED** |

**This project's `next.config.ts` does NOT set `cacheComponents`**, so we are on the **Legacy model**. All the classic `getStaticProps`/`getStaticPaths`-era App Router equivalents (`generateStaticParams`, `export const revalidate = n`, `export const dynamicParams`) are available and are the right tools. The Cache Components APIs are documented in §11 in case we opt in later — but do not mix them in unless we flip the flag.
Source: `05-config/01-next-config-js/cacheComponents.md`, `03-file-conventions/02-route-segment-config/index.md` (Version History: "`v16.0.0` — `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` removed when Cache Components is enabled"), `02-guides/caching-without-cache-components.md`.

---

## 1. Async Request APIs — REQUIRED `await` in v16 (breaking vs pre-15)

In **Next 16 the synchronous fallback is fully removed**. These are all now **async** and MUST be `await`ed (or read with React's `use()`):

- `params` and `searchParams` (in `page.js`; `params` in `layout.js`, `route.js`, `default.js`, `opengraph-image`, `icon`, etc.)
- `cookies()` and `headers()` from `next/headers`
- `draftMode()` from `next/headers`

```tsx
// app/blog/[slug]/page.tsx
import { cookies, headers } from 'next/headers'

export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params            // Promise
  const query = await props.searchParams          // Promise
  const cookieStore = await cookies()             // Promise
  const h = await headers()                        // Promise
}
```

- `params`/`searchParams` are **`Promise`-typed** everywhere (see every `page.tsx` snippet: `params: Promise<{ slug: string }>`).
- Type helpers `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>` are **globally available** after `next dev`/`next build`/`next typegen` — no import needed.

Source: `02-guides/upgrading/version-16.md` ("Async Request APIs (Breaking change)"), `04-functions/cookies.md`, `04-functions/headers.md`, `04-functions/draft-mode.md`, `04-functions/generate-static-params.md`.

---

## 2. RSC data fetching + caching semantics

### Fetching in Server Components
Make the component `async` and `await`. Use `fetch` **or** an ORM/DB client directly (credentials stay server-side).

```tsx
export default async function Page() {
  const res = await fetch('https://api.example.com/blog')
  const posts = await res.json()
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

### DEFAULT CACHE BEHAVIOR — the big v16 change
- **`fetch` is NOT cached by default.** Default is `cache: 'auto no cache'`: fetched on every request in dev; during `next build` it is fetched once if the route is statically prerendered; if any request-time API is used on the route, it fetches per request.
- Opt **in** to caching per-request: `fetch(url, { cache: 'force-cache' })`.
- Opt **out** explicitly: `fetch(url, { cache: 'no-store' })`.
- Time-based per fetch: `fetch(url, { next: { revalidate: 3600 } })` (`false` = cache indefinitely, `0` = never cache, `number` = max lifetime seconds).
- Tag per fetch (for on-demand invalidation): `fetch(url, { next: { tags: ['posts'] } })` (max 256 chars/tag, 128 tags).
- `GET` `fetch` with identical URL+options is **memoized within a single render pass** (shared across components, layouts, `generateStaticParams`, `generateMetadata`). Memoization does **not** apply in Route Handlers.

Source: `04-functions/fetch.md`, `01-getting-started/06-fetching-data.md`, `02-guides/caching-without-cache-components.md`.

### Caching non-`fetch` work (DB/ORM) — `unstable_cache`
On the legacy model, wrap DB queries with **`unstable_cache`** (from `next/cache`). Signature:

```ts
import { unstable_cache } from 'next/cache'
const getCachedUser = unstable_cache(
  async (id: string) => db.select().from(users).where(eq(users.id, id)),
  ['user'],                       // keyParts (extra cache-key parts)
  { tags: ['user'], revalidate: 3600 } // options: tags[], revalidate seconds|false
)
```

> The doc explicitly notes: **"This API has been replaced by `use cache` in Next.js 16"** and recommends opting into Cache Components. It still works on the legacy model. `headers`/`cookies` cannot be read inside `unstable_cache` — pass values as args.
Source: `04-functions/unstable_cache.md`, `02-guides/caching-without-cache-components.md`.

### Per-request de-dup without fetch — React `cache`
Use `import { cache } from 'react'` to memoize an async function within a single request (works for ORM/db). Scope is per-request only.
Source: `01-getting-started/06-fetching-data.md` ("Sharing data with context and `React.cache`"), `02-guides/caching-without-cache-components.md`.

### Streaming
Wrap slow/uncached components in `<Suspense>` or add a `loading.js` (auto-wraps `page.js` in a Suspense boundary). Client Components can read a server-passed promise with React `use()`.
Source: `01-getting-started/06-fetching-data.md`.

---

## 3. Static generation — `generateStaticParams` (the SSG / `getStaticPaths` replacement)

`generateStaticParams` statically pre-renders dynamic segments at build time. It **replaces `getStaticPaths`**. Usable in `page`, `layout`, and `route` files.

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((r) => r.json())
  return posts.map((post) => ({ slug: post.slug })) // { slug: string }[]
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
}
```

Return-type by route shape: `/product/[id]` → `{ id: string }[]`; `/[cat]/[prod]` → `{ category: string, product: string }[]`; `/[...slug]` → `{ slug: string[] }[]`.

### Head vs long tail (pre-render a subset, defer the rest)
Return a **partial** list to statically build the "head"; the rest are generated on first request (see §5 `dynamicParams`):

```tsx
export async function generateStaticParams() {
  const posts = await fetch('https://.../posts').then((r) => r.json())
  return posts.slice(0, 10).map((post) => ({ slug: post.slug })) // first 10 at build
}
```

- All at runtime: `return []` (must always return an array — returning nothing forces dynamic).
- `generateStaticParams` runs **before** the route is generated; it is **NOT re-run during ISR revalidation**.
- **Cache Components caveat (only if we enable that flag):** it must return **≥1 param**; empty arrays are a build error.

Source: `04-functions/generate-static-params.md`.

---

## 4. ISR — `export const revalidate` + on-demand (legacy model)

### Segment-level time-based ISR
```tsx
// app/blog/[id]/page.tsx
export const revalidate = 60 // seconds; invalidate at most once/60s

export async function generateStaticParams() { /* ... */ }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { /* ... */ }
```
- Values: `false` (default, cache indefinitely), `0` (always dynamic), or `number` seconds.
- Must be **statically analyzable** (`revalidate = 600` ok; `revalidate = 60 * 10` NOT ok).
- Lowest `revalidate` across a route's layouts+page wins for the whole route.
- Stale-while-revalidate: stale page served immediately, fresh one regenerated in background.
- Node.js runtime only; not supported with static export.
- Observe via `x-nextjs-cache` header: `HIT` / `STALE` / `MISS` / `REVALIDATED`.

Source: `02-guides/incremental-static-regeneration.md`, `02-guides/caching-without-cache-components.md` ("Route segment config `revalidate`").

### On-demand revalidation — exact names
Both from `next/cache`, callable in **Server Actions or Route Handlers**:

```ts
import { revalidatePath, revalidateTag } from 'next/cache'
revalidatePath('/blog/post-1')            // literal path
revalidatePath('/blog/[slug]', 'page')    // dynamic pattern REQUIRES type: 'page' | 'layout'
revalidateTag('posts', 'max')             // ⚠ SECOND ARG NOW REQUIRED (see §12)
```

- `revalidatePath(path: string, type?: 'page' | 'layout'): void` — `type` is **required** when `path` has a dynamic segment.
- `revalidateTag(tag: string, profile: string | { expire?: number }): void` — see §12 gotcha; single-arg form is **deprecated**.
- Route Handlers only *mark* for revalidation (happens on next visit); Server Functions update UI immediately.

Source: `04-functions/revalidatePath.md`, `04-functions/revalidateTag.md`.

---

## 5. `fallback: 'blocking'` equivalent — `dynamicParams`

`export const dynamicParams` **replaces `getStaticPaths`'s `fallback: true | false | 'blocking'`**.

```tsx
export const dynamicParams = true // default
```
- **`true` (default)** = **`fallback: 'blocking'`**: params not returned by `generateStaticParams` are generated **on first request, then cached** (on-demand ISR).
- **`false`** = **`fallback: false`**: unlisted params return **404** (for catch-all routes, they match).

> Combine with a partial `generateStaticParams` (§3) for "pre-render the head, generate-on-first-request the long tail."
> ⚠ `dynamicParams` is **NOT available when `cacheComponents` is enabled**.

Source: `03-file-conventions/02-route-segment-config/dynamicParams.md`, `04-functions/generate-static-params.md`.

---

## 6. Route Handlers — `app/**/route.ts`

Supported exports: `GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS`. Use Web `Request`/`Response`; `request` is actually a **`NextRequest`**.

```ts
// app/users/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  const { id } = await ctx.params            // ⚠ params is a Promise (async)
  const q = req.nextUrl.searchParams.get('q')
  return Response.json({ id, q })
}
```

- **`context.params` is a `Promise`** (changed in 15.0.0-RC) — must `await`.
- **`GET` handlers default to DYNAMIC**, not static (changed in 15.0.0-RC). Opt back into caching with `export const dynamic = 'force-static'` or `export const revalidate = n` (legacy model).
- `RouteContext<'/route'>` global helper types `params`; no import needed.
- Read cookies/headers via `await cookies()` / `await headers()` from `next/headers`, or `request.cookies` / `request.headers`.
- Body: `await request.json()` / `await request.formData()` / `await request.text()`.
- `NextResponse` (from `next/server`) adds convenience methods: `NextResponse.json()`, `.redirect()`, `.rewrite()`, `.next()`, and `.cookies.set/get/getAll/has/delete`.
- `generateStaticParams` works in route handlers to statically build API responses for known params.
- Segment configs (legacy): `dynamic`, `dynamicParams`, `revalidate`, `fetchCache`, `runtime`, `preferredRegion`.

Source: `03-file-conventions/route.md`, `04-functions/next-response.md`, `04-functions/next-request.md`.

---

## 7. Metadata API

Two forms, **Server Components only**, cannot export both from one segment. File-based metadata overrides these.

### Static object
```tsx
import type { Metadata } from 'next'
export const metadata: Metadata = { title: '...', description: '...' }
```

### Dynamic `generateMetadata`
```tsx
import type { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(
  { params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string,string|string[]|undefined>> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params                 // async
  const product = await fetch(`https://.../${id}`).then((r) => r.json())
  const prevImages = (await parent).openGraph?.images || []
  return { title: product.title, openGraph: { images: ['/og.jpg', ...prevImages] } }
}
```

### Key fields (verbatim shape)
```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://acme.com'), // set once in root layout; lets URL fields be relative
  title: { default: 'Acme', template: '%s | Acme', absolute: 'X' }, // or plain string
  description: '...',
  alternates: {
    canonical: '/',                          // → <link rel="canonical" ...>
    languages: {                             // → hreflang alternates
      'en-US': '/en-US',
      'de-DE': '/de-DE',
    },
  },
  openGraph: { title, description, url, siteName, images: [{ url, width, height, alt }], locale, type },
  twitter: { card: 'summary_large_image', title, description, creator: '@x', images: ['https://.../og.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, 'max-image-preview': 'large' } },
}
```

- **Canonical** = `alternates.canonical`. **hreflang** = `alternates.languages` (`Languages<string>` map).
- With `metadataBase` set, URL fields (`canonical`, `languages`, `openGraph.images`) may be **relative**; without it, relative URLs throw a build error.
- `og:image` / `twitter:image` must be absolute URLs (or resolved via `metadataBase`).
- Metadata merges **shallowly**, root→leaf; duplicate nested keys (`openGraph`, `robots`) are **replaced**, not deep-merged.
- Metadata **streams** by default (v15.2+): resolved tags append to `<body>` for JS bots; HTML-limited bots still get it in `<head>` (blocking). Configurable via `htmlLimitedBots`.
- `themeColor`/`colorScheme`/`viewport` in `metadata` are **deprecated** → use `generateViewport` / the `viewport` export.

Source: `04-functions/generate-metadata.md`.

---

## 8. `ImageResponse` (OG image generation)

**Import from `next/og`** (moved from `next/server` in v14.0.0 — do NOT use `next/server`).

```tsx
import { ImageResponse } from 'next/og'

new ImageResponse(element: ReactElement, {
  width?: number = 1200,
  height?: number = 630,
  fonts?: { name: string; data: ArrayBuffer; weight: number; style: 'normal'|'italic' }[],
  emoji?, debug?, status?, statusText?, headers?
})
```

### File-convention OG image (`app/**/opengraph-image.tsx`)
```tsx
import { ImageResponse } from 'next/og'
export const alt = 'My site'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    <div style={{ fontSize: 128, background: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>My site</div>,
    { ...size }
  )
}
```

### Route handler variant
Return `new ImageResponse(<jsx/>, { width, height })` directly from a `GET` handler.

Notes: only flexbox + subset of CSS (no `display:grid`); ≤500KB bundle; fonts `ttf`/`otf`/`woff` only. Generated images are **statically optimized** unless they use request-time APIs. If using `generateImageMetadata`, the `Image` function receives `params`/`id` as **Promises** (v16 breaking change).

Source: `04-functions/image-response.md`, `03-file-conventions/01-metadata/opengraph-image.md`, `02-guides/upgrading/version-16.md`.

---

## 9. `sitemap.ts` / `robots.ts`

### `app/sitemap.ts` → `MetadataRoute.Sitemap`
```ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://acme.com', lastModified: new Date(), changeFrequency: 'yearly', priority: 1 },
    { url: 'https://acme.com/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5,
      alternates: { languages: { es: 'https://acme.com/es/blog', de: 'https://acme.com/de/blog' } } },
  ]
}
```
Entry type:
```ts
type Sitemap = Array<{
  url: string
  lastModified?: string | Date
  changeFrequency?: 'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never'
  priority?: number
  alternates?: { languages?: Languages<string> }
  images?: string[]            // image sitemaps
  videos?: {...}[]             // video sitemaps
}>
```
- `sitemap.js`/`robots.js` are **special Route Handlers, cached by default** unless they use a request-time API or a dynamic config option.

### Segmented / multiple sitemaps — `generateSitemaps`
Two ways to split: (a) nest `sitemap.ts` under multiple segments (`app/sitemap.ts`, `app/products/sitemap.ts`), or (b) `generateSitemaps`:

```ts
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }] // array of { id }
}

// ⚠ v16 BREAKING: id is now a Promise<string>
export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const resolvedId = await id
  const start = Number(resolvedId) * 50000  // Google limit 50k URLs/sitemap
  // ...
}
```
Output URLs: `/products/sitemap/1.xml`, etc.

### `app/robots.ts` → `MetadataRoute.Robots`
```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/private/' }, // or an array of rule objects
    sitemap: 'https://acme.com/sitemap.xml',
    host: 'https://acme.com',
  }
}
```
`Robots` type: `rules` is a single object **or array** of `{ userAgent?, allow?, disallow?, crawlDelay? }`; plus `sitemap?: string|string[]` and `host?: string`.

Source: `03-file-conventions/01-metadata/sitemap.md`, `04-functions/generate-sitemaps.md`, `03-file-conventions/01-metadata/robots.md`.

---

## 10. Draft / preview mode — `draftMode()` (async)

`draftMode()` from `next/headers` is **async** (v15+; sync fully removed in 16). Returns `{ isEnabled, enable(), disable() }`.

```ts
// Check in a Server Component
import { draftMode } from 'next/headers'
export default async function Page() {
  const { isEnabled } = await draftMode()
}

// Enable/disable ONLY in a Route Handler (or Server Action)
export async function GET() {
  const draft = await draftMode()
  draft.enable()   // sets __prerender_bypass cookie
  return new Response('Draft mode enabled')
}
```
- `enable()`/`disable()` only work in Route Handlers / Server Actions (not Server Components).
- A fresh bypass cookie is generated each `next build`.
- When linking to the enable route via `<Link>`, pass `prefetch={false}` so prefetch doesn't toggle the cookie.

Source: `04-functions/draft-mode.md`.

---

## 11. Cache Components model (ONLY if we later set `cacheComponents: true`)

Not active in this repo today. If enabled (`next.config.ts` → `cacheComponents: true`), it turns on **Partial Prerendering (PPR)** by default and swaps the legacy segment-config caching for directive-based caching.

- **`use cache`** directive (from being enabled by the flag) — mark a file / component / async function cacheable. Default profile: stale 5 min (client), revalidate 15 min (server), never time-expires. Cannot read `cookies()`/`headers()`/`searchParams` inside — pass as args (they become part of the cache key).
- **`cacheLife(profile | {stale,revalidate,expire})`** from `next/cache` — profiles: `seconds|minutes|hours|days|weeks|max`.
- **`cacheTag('tag', ...)`** from `next/cache` — up to 128 tags/call, ≤256 chars each.
- **`updateTag(tag: string)`** — Server-Actions-ONLY; immediate expire + refresh (read-your-own-writes).
- Under this model `dynamic`, `dynamicParams`, `revalidate`, `fetchCache` segment configs are **removed**; `generateStaticParams` must return ≥1 param.

```tsx
import { cacheLife, cacheTag } from 'next/cache'
async function getProducts() {
  'use cache'
  cacheLife('hours')
  cacheTag('products')
  return db.query('SELECT * FROM products')
}
```

Source: `05-config/01-next-config-js/cacheComponents.md`, `01-app/01-getting-started/08-caching.md`, `01-app/01-getting-started/09-revalidating.md`, `01-directives/use-cache.md`, `04-functions/updateTag.md`.

---

## 12. Gotchas / deltas from older Next.js

1. **`fetch` is NOT cached by default** (was `force-cache` in Next 13). Opt in with `cache: 'force-cache'`. (`04-functions/fetch.md`)
2. **`GET` Route Handlers default to DYNAMIC** now (changed 15.0-RC). Add `export const dynamic = 'force-static'` for the old static behavior. (`03-file-conventions/route.md`)
3. **Everything async**: `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` — sync access **removed** in 16 (was a temporary shim in 15). Must `await`. (`02-guides/upgrading/version-16.md`)
4. **`revalidateTag` now takes a SECOND arg**: `revalidateTag(tag, profile)`. Recommended `revalidateTag('posts', 'max')` (stale-while-revalidate). Single-arg `revalidateTag('posts')` is **deprecated** and produces a TS error (still works if TS errors suppressed; behavior = immediate expire = old behavior). For immediate expire in a Server Action prefer `updateTag`; for webhooks needing immediate expire use `revalidateTag(tag, { expire: 0 })`. (`04-functions/revalidateTag.md`, `02-guides/upgrading/version-16.md`)
   - ⚠ Note the in-repo legacy guide (`caching-without-cache-components.md`) still shows the single-arg form; the **function reference is authoritative** — use two args.
5. **`ImageResponse` import is `next/og`** (moved from `next/server` in v14). (`04-functions/image-response.md`)
6. **`generateSitemaps` `id` and `opengraph-image`/`icon` `params`+`id` are now Promises** (v16 breaking). `await` them. (`02-guides/upgrading/version-16.md`)
7. **`unstable_cache` is deprecated** ("replaced by `use cache`") but still usable on the legacy model. (`04-functions/unstable_cache.md`)
8. **`middleware` → `proxy`**: `middleware.ts` deprecated, renamed to `proxy.ts` (function `proxy`); `proxy` runs Node runtime only (no edge). Config flags like `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`. (`02-guides/upgrading/version-16.md`)
9. **PPR flag changes**: `experimental.ppr` and `experimental_ppr` segment config **removed**; use `cacheComponents: true`. `experimental.dynamicIO`/`experimental.useCache` deprecated → `cacheComponents`. (`version-16.md`, `cacheComponents.md`)
10. **Turbopack is the default** for `next dev`/`next build` (no `--turbopack` flag needed; custom `webpack` config now fails the build unless you pass `--webpack`). (`version-16.md`)
11. **Parallel routes require explicit `default.js`** in every slot or the build fails. (`version-16.md`)
12. **Removed**: `next lint` (use ESLint/Biome directly; `next build` no longer lints), AMP, `serverRuntimeConfig`/`publicRuntimeConfig` (use env vars + `connection()`), `images.domains` (deprecated → `remotePatterns`), `next/legacy/image`, `unstable_rootParams`. (`version-16.md`)
13. **Min platform**: Node.js 20.9+, TypeScript 5.1+, React 19.2. (`version-16.md`)
14. **`next/image` defaults changed**: `minimumCacheTTL` 60s→4h; `qualities` now `[75]` only; `16` removed from `imageSizes`; local IPs blocked by default; max 3 redirects. (`version-16.md`)
15. **No `Card` DOM nesting concern here, but**: `cacheComponents` navigation keeps recent routes mounted via React `<Activity>` (state preserved on back-nav) — relevant only if the flag is on. (`cacheComponents.md`)

---

## 13. PRD render-mode → real Next 16 API mapping (legacy model)

| PRD mode | Next 16 (this repo, legacy model) implementation |
| --- | --- |
| **SSG** | Static route (no request-time APIs) + `generateStaticParams` for dynamic segments. Force with `export const dynamic = 'force-static'`. Built at `next build`. |
| **ISR(n)** | `export const revalidate = n` at the segment (or `fetch(url, { next: { revalidate: n } })`). On-demand: `revalidatePath()` / `revalidateTag(tag, 'max')`. `dynamicParams = true` (default) generates the long tail on first request. |
| **SSR** | Dynamic rendering: use a request-time API (`await cookies()`/`headers()`/`searchParams`) or `export const dynamic = 'force-dynamic'` (≈ `fetch` `no-store` everywhere). Rendered per request. |
| **CSR** | `'use client'` component; fetch on the client via React `use()` on a passed promise, or SWR/React Query. Server component can still shell it. |
| **RSC** | Default: any `async` Server Component doing `await fetch(...)` / ORM calls. Stream slow parts with `<Suspense>` / `loading.js`. This is the baseline for all of the above. |

> If we adopt **Cache Components** later, the mapping shifts: SSG/ISR become `use cache` + `cacheLife`, SSR becomes "uncached component in `<Suspense>`", and everything is PPR (static shell + streamed dynamic holes) by default. See §11.

Source: `02-guides/caching-without-cache-components.md` (`dynamic`, `revalidate`), `02-guides/incremental-static-regeneration.md`, `04-functions/generate-static-params.md`, `03-file-conventions/02-route-segment-config/dynamicParams.md`, `01-getting-started/06-fetching-data.md`.
