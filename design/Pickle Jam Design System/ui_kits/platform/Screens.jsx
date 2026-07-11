// Pickle Jam platform — Tournaments, Courts, Groups screens.
const NS2 = window.PickleJamDesignSystem_26eda6;
const { Button: B2, IconButton: IB2, Icon: I2, Card: C2, Badge: BG2, Tag: TG2, Stat: ST2, Avatar: AV2, SectionHeading: SH2 } = NS2;
const DD = window.PJ_DATA;
const Media2 = window.PJ_SCREENS.Media;

const statusVariant = { Live: "lime", Registering: "pink", Upcoming: "cream" };

function TournamentsScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeading overline="This Season" title="Tournaments"
        action={<B2 variant="primary" iconRight={<I2 name="plus" size={17} />}>Create tournament</B2>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 20 }}>
        {DD.tournaments.map((t) => (
          <C2 key={t.id} variant="sticker" pad={0} style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "relative" }}>
              <Media2 tone={t.status === "Live" ? "pink" : "lime"} h={120} />
              <div style={{ position: "absolute", top: 12, left: 12 }}>
                <BG2 variant={statusVariant[t.status]} dot={t.status === "Live"}>{t.status}</BG2>
              </div>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 22, color: "var(--text-strong)", lineHeight: 0.95 }}>{t.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
                  <I2 name="map-pin" size={14} /> {t.city}
                  <span style={{ margin: "0 2px" }}>·</span>
                  <I2 name="calendar" size={14} /> {t.date}
                </div>
              </div>
              <div style={{ display: "flex", gap: 24, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
                <ST2 value={t.players} label="Players" accent="ink" />
                <ST2 value={t.prize} label="Prize pool" accent="pink" />
              </div>
              <B2 variant={t.status === "Registering" ? "accent" : "outline"} size="sm" full>
                {t.status === "Registering" ? "Register now" : t.status === "Live" ? "Watch live" : "View details"}
              </B2>
            </div>
          </C2>
        ))}
      </div>
    </div>
  );
}

function CourtsScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeading overline="Near You" title="Find Courts"
        action={<B2 variant="outline" size="sm" iconLeft={<I2 name="map-pin" size={16} />}>Austin, TX</B2>} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DD.courts.map((c) => (
            <C2 key={c.id} variant="flat" pad={16} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 54, height: 54, borderRadius: "var(--radius-md)", background: "var(--pj-lime-500)", border: "2px solid var(--pj-green-900)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <I2 name="map-pin" size={24} color="var(--pj-green-900)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 17, color: "var(--text-strong)", lineHeight: 1 }}>{c.name}</div>
                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
                  <span>{c.courts} courts</span><span>{c.dist}</span><span>{c.indoor ? "Indoor" : "Outdoor"}</span>
                </div>
              </div>
              <BG2 variant={c.open ? "lime" : "ink"} dot={c.open}>{c.open ? "Open" : "Closed"}</BG2>
            </C2>
          ))}
        </div>
        {/* Map placeholder */}
        <C2 variant="sticker" pad={0} style={{ overflow: "hidden", position: "sticky", top: 92 }}>
          <div style={{ position: "relative", height: 440, background: "repeating-linear-gradient(0deg,#EAF3D6,#EAF3D6 38px,#E2EFC7 38px,#E2EFC7 39px),repeating-linear-gradient(90deg,#EAF3D6,#EAF3D6 38px,#E2EFC7 38px,#E2EFC7 39px)" }}>
            {[{ t: 60, l: 80 }, { t: 150, l: 260 }, { t: 260, l: 130 }, { t: 320, l: 330 }].map((p, i) => (
              <div key={i} style={{ position: "absolute", top: p.t, left: p.l, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50% 50% 50% 2px", background: i === 0 ? "var(--pj-pink-500)" : "var(--pj-green-900)", transform: "rotate(45deg)", border: "2px solid var(--pj-cream-100)", boxShadow: "0 3px 8px rgba(0,0,0,.2)" }} />
              </div>
            ))}
            <div style={{ position: "absolute", bottom: 14, left: 14 }}><BG2 variant="cream">4 courts nearby</BG2></div>
          </div>
        </C2>
      </div>
    </div>
  );
}

function GroupsScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeading overline="Your Community" title="Groups"
        action={<B2 variant="primary" iconRight={<I2 name="plus" size={17} />}>Create group</B2>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
        {DD.groups.map((g) => (
          <C2 key={g.id} variant="sticker" pad={20} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "var(--pj-pink-500)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <I2 name="users" size={24} color="#fff" />
              </div>
              <TG2>{g.level}</TG2>
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 20, color: "var(--text-strong)", lineHeight: 0.95 }}>{g.name}</h3>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>
                <I2 name="clock" size={14} /> Next play · {g.next}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {[0, 1, 2].map((i) => <div key={i} style={{ marginLeft: i ? -10 : 0 }}><AV2 name={"P " + (i + 1)} size={30} /></div>)}
                <span style={{ marginLeft: 8, fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)" }}>{g.members} members</span>
              </div>
              <B2 variant="accent" size="sm">Join</B2>
            </div>
          </C2>
        ))}
      </div>
    </div>
  );
}

window.PJ_SCREENS.TournamentsScreen = TournamentsScreen;
window.PJ_SCREENS.CourtsScreen = CourtsScreen;
window.PJ_SCREENS.GroupsScreen = GroupsScreen;
