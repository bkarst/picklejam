// Mock content for the Pickle Jam platform UI kit.
window.PJ_DATA = {
  stories: [
    { id: 1, badge: "Top Story", badgeVariant: "pink", tag: "News", title: "New Champs Crowned in Austin", excerpt: "A thrilling final goes the distance at the PPA Tour Austin Open, decided 12–10 in the third.", meta: "News · 2h ago", tone: "lime" },
    { id: 2, badge: "Live", badgeVariant: "lime", tag: "Tournaments", title: "Semifinals Underway in Dallas", excerpt: "Follow every point as the bracket narrows to the final four.", meta: "Tournaments · Live", tone: "pink" },
    { id: 3, badge: "Recap", badgeVariant: "ink", tag: "Highlights", title: "Top 5 Dinks of the Weekend", excerpt: "The softest hands in the game, ranked.", meta: "Highlights · 5h ago", tone: "green" },
    { id: 4, tag: "Players", title: "Rookie Watch: Who to Follow in 2026", excerpt: "Five names climbing the rankings fast.", meta: "Players · 1d ago", tone: "cream" },
    { id: 5, tag: "Culture", title: "The Rise of Neighborhood Pickle Clubs", excerpt: "How a backyard game became a movement.", meta: "Culture · 1d ago", tone: "pink" },
    { id: 6, tag: "News", title: "New Paddle Rules Take Effect Next Month", excerpt: "What players need to know before the season opener.", meta: "News · 2d ago", tone: "lime" },
  ],
  tournaments: [
    { id: 1, name: "Austin Open", city: "Austin, TX", date: "Jul 12–14", status: "Live", players: 128, prize: "$25K" },
    { id: 2, name: "Dallas Classic", city: "Dallas, TX", date: "Jul 19–21", status: "Registering", players: 96, prize: "$18K" },
    { id: 3, name: "Denver Rally", city: "Denver, CO", date: "Aug 2–4", status: "Registering", players: 64, prize: "$12K" },
    { id: 4, name: "Bay Area Slam", city: "Oakland, CA", date: "Aug 9–11", status: "Upcoming", players: 112, prize: "$22K" },
  ],
  courts: [
    { id: 1, name: "Zilker Park Courts", city: "Austin, TX", courts: 8, dist: "0.8 mi", open: true, indoor: false },
    { id: 2, name: "Riverside Rec Center", city: "Austin, TX", courts: 6, dist: "1.4 mi", open: true, indoor: true },
    { id: 3, name: "Eastside Pickle Club", city: "Austin, TX", courts: 12, dist: "2.1 mi", open: false, indoor: false },
    { id: 4, name: "Northgate Athletic", city: "Round Rock, TX", courts: 4, dist: "5.6 mi", open: true, indoor: true },
  ],
  groups: [
    { id: 1, name: "Dinkers Anonymous", members: 42, level: "All levels", next: "Sat 9:00 AM" },
    { id: 2, name: "3.5 Grinders", members: 18, level: "3.5–4.0", next: "Sun 8:00 AM" },
    { id: 3, name: "Sunrise Smashers", members: 63, level: "All levels", next: "Tue 6:30 AM" },
  ],
  players: [
    { name: "Anna Leigh W.", rank: 1, rating: 5.9 },
    { name: "Ben Johns", rank: 2, rating: 5.9 },
    { name: "Catherine P.", rank: 3, rating: 5.7 },
    { name: "Tyson McG.", rank: 4, rating: 5.6 },
  ],
  nav: [
    { key: "home", label: "News", icon: "newspaper" },
    { key: "tournaments", label: "Tournaments", icon: "trophy" },
    { key: "courts", label: "Courts", icon: "map-pin" },
    { key: "groups", label: "Groups", icon: "users" },
  ],
};
