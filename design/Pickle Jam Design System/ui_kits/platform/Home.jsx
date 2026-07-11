// Pickle Jam platform — app shell + screens. Uses DS primitives via window namespace.
const NS = window.PickleJamDesignSystem_26eda6;
const { Button, IconButton, Input, Icon, Logo, Card, Badge, Tag, Stat, Avatar, StoryCard, SectionHeading } = NS;
const D = window.PJ_DATA;

const TONE_BG = { lime: "var(--pj-lime-500)", pink: "var(--pj-pink-500)", green: "var(--pj-green-900)", cream: "var(--pj-pink-200)" };
const ASSET = "../../assets/";

// Media placeholder — colored panel with the ball motif (no stock photos in brand kit)
function Media({ tone = "lime", h = "100%" }) {
  return (
    <div style={{ width: "100%", height: h, background: TONE_BG[tone] || TONE_BG.lime, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <img src={ASSET + "pickleball.svg"} style={{ width: "38%", opacity: 0.92, filter: tone === "green" ? "none" : "drop-shadow(3px 3px 0 rgba(15,61,46,.25))" }} />
    </div>
  );
}

// ─── Top navigation ────────────────────────────────────────────────
function TopNav({ view, setView, q, setQ }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--pj-green-900)", borderBottom: "3px solid var(--pj-lime-500)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", height: 68, display: "flex", alignItems: "center", gap: 24 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          <Logo variant="full" height={46} assetBase="../../" />
        </button>
        <nav style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {D.nav.map((n) => {
            const active = view === n.key;
            return (
              <button key={n.key} onClick={() => setView(n.key)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: "var(--radius-pill)", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.03em",
                  background: active ? "var(--pj-lime-500)" : "transparent", color: active ? "var(--pj-green-900)" : "var(--pj-cream-100)" }}>
                <Icon name={n.icon} size={16} /> {n.label}
              </button>
            );
          })}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 220 }}><Input full iconLeft={<Icon name="search" size={17} />} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <IconButton variant="lime" label="Notifications" round><Icon name="bell" size={18} /></IconButton>
          <Avatar name="You Player" size={40} />
        </div>
      </div>
    </header>
  );
}

// ─── HOME / news feed ──────────────────────────────────────────────
function HomeScreen({ filter, setFilter }) {
  const cats = ["All", "News", "Tournaments", "Players", "Highlights", "Culture"];
  const [hero, ...rest] = D.stories;
  const list = filter === "All" ? rest : rest.filter((s) => s.tag === filter);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Hero top story */}
      <Card variant="sticker" pad={0} style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", overflow: "hidden" }}>
        <div style={{ padding: 32, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div><Badge variant="pink">{hero.badge}</Badge></div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 46, lineHeight: 0.92, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>{hero.title}</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "var(--text-body)", maxWidth: 420 }}>{hero.excerpt}</p>
          <div style={{ marginTop: 6 }}><Button variant="primary" iconRight={<Icon name="arrow-right" size={18} />}>Read the recap</Button></div>
        </div>
        <Media tone={hero.tone} h={340} />
      </Card>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {cats.map((c) => <Tag key={c} active={filter === c} onClick={() => setFilter(c)}>{c}</Tag>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 28, alignItems: "start" }}>
        {/* Story grid */}
        <div>
          <SectionHeading overline="Latest" title="The Feed" size="md" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 18 }}>
            {list.map((s) => (
              <StoryCard key={s.id} badge={s.badge} badgeVariant={s.badgeVariant} title={s.title} excerpt={s.excerpt} meta={s.meta} media={<Media tone={s.tone} h={160} />} onClick={() => {}} />
            ))}
          </div>
        </div>
        {/* Rankings rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card variant="ink" pad={20}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Icon name="trending-up" size={18} color="var(--pj-lime-500)" />
              <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 17, color: "var(--pj-cream-100)" }}>Top Rankings</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {D.players.map((p) => (
                <div key={p.rank} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--pj-lime-500)", width: 24 }}>{p.rank}</span>
                  <Avatar name={p.name} size={34} ring={false} />
                  <span style={{ color: "var(--pj-cream-100)", fontWeight: 600, fontSize: 14, flex: 1 }}>{p.name}</span>
                  <span style={{ color: "var(--pj-lime-500)", fontWeight: 700, fontSize: 13 }}>{p.rating}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card variant="flat" pad={20} style={{ background: "var(--pj-pink-200)", border: "2px solid var(--pj-green-900)" }}>
            <span style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 18, color: "var(--pj-green-900)", display: "block", lineHeight: 0.95 }}>Get the weekly jam</span>
            <p style={{ margin: "8px 0 12px", fontSize: 13, color: "var(--text-body)" }}>Scores, highlights & culture — every Monday.</p>
            <Button variant="ink" size="sm" full iconRight={<Icon name="bell" size={15} />}>Subscribe</Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

window.PJ_SCREENS = { TopNav, HomeScreen, Media, ASSET };
