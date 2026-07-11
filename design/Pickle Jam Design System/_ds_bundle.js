/* @ds-bundle: {"format":4,"namespace":"PickleJamDesignSystem_26eda6","components":[{"name":"Icon","sourcePath":"components/brand/Icon.jsx"},{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"SectionHeading","sourcePath":"components/display/SectionHeading.jsx"},{"name":"Stat","sourcePath":"components/display/Stat.jsx"},{"name":"StoryCard","sourcePath":"components/display/StoryCard.jsx"},{"name":"Tag","sourcePath":"components/display/Tag.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"}],"sourceHashes":{"components/brand/Icon.jsx":"1c7613cfbb35","components/brand/Logo.jsx":"f42c3b065df1","components/display/Avatar.jsx":"ffce30a13a42","components/display/Badge.jsx":"6507b685ad2f","components/display/Card.jsx":"b7450a1d424c","components/display/SectionHeading.jsx":"e5a9ff0af144","components/display/Stat.jsx":"0771635650d9","components/display/StoryCard.jsx":"f9f02198adfd","components/display/Tag.jsx":"e625d5b160d0","components/forms/Button.jsx":"4c0b46b22671","components/forms/IconButton.jsx":"1da93a5b9584","components/forms/Input.jsx":"ab17cb59f925","ui_kits/platform/Home.jsx":"be19314aee7e","ui_kits/platform/Screens.jsx":"18e49b46da20","ui_kits/platform/data.js":"0d630db1696c"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PickleJamDesignSystem_26eda6 = window.PickleJamDesignSystem_26eda6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Icon — outlined line icons matching Pickle Jam's sporty stroke style.
 * Paths are from Lucide (MIT, https://lucide.dev), the closest match to the
 * brand guide's 2px rounded-outline icon set. Stroke inherits currentColor.
 */
const PATHS = {
  "search": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.3-4.3"
  })),
  "menu": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "4",
    x2: "20",
    y1: "6",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    x2: "20",
    y1: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    x2: "20",
    y1: "18",
    y2: "18"
  })),
  "bell": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
  })),
  "arrow-right": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m12 5 7 7-7 7"
  })),
  "chevron-right": /*#__PURE__*/React.createElement("path", {
    d: "m9 18 6-6-6-6"
  }),
  "play": /*#__PURE__*/React.createElement("polygon", {
    points: "6 3 20 12 6 21 6 3"
  }),
  "trophy": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 22h16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 2H6v7a6 6 0 0 0 12 0V2Z"
  })),
  "users": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 21v-2a4 4 0 0 0-3-3.87"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 0 1 0 7.75"
  })),
  "calendar": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "4",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    x2: "16",
    y1: "2",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    x2: "8",
    y1: "2",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    x2: "21",
    y1: "10",
    y2: "10"
  })),
  "trending-up": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "22 7 13.5 15.5 8.5 10.5 2 17"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 7 22 7 22 13"
  })),
  "map-pin": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "3"
  })),
  "mic": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 10v2a7 7 0 0 1-14 0v-2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    x2: "12",
    y1: "19",
    y2: "22"
  })),
  "camera": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "3"
  })),
  "message-circle": /*#__PURE__*/React.createElement("path", {
    d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
  }),
  "sparkles": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
  })),
  "newspaper": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 14h-8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15 18h-5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 6h8v4h-8V6Z"
  })),
  "heart": /*#__PURE__*/React.createElement("path", {
    d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
  }),
  "share": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 6 12 2 8 6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    x2: "12",
    y1: "2",
    y2: "15"
  })),
  "clock": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 6 12 12 16 14"
  })),
  "check": /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }),
  "plus": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14"
  })),
  "x": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m6 6 12 12"
  })),
  "star": /*#__PURE__*/React.createElement("polygon", {
    points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
  })
};
function Icon({
  name,
  size = 22,
  strokeWidth = 2,
  color = "currentColor",
  style = {},
  ...rest
}) {
  const body = PATHS[name] || PATHS["sparkles"];
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: "inline-block",
      flexShrink: 0,
      ...style
    },
    "aria-hidden": "true"
  }, rest), body);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Icon.jsx", error: String((e && e.message) || e) }); }

// components/brand/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Pickle Jam wordmark / lockup. Renders the brand SVGs shipped in /assets.
 * variant: "full" (net + PICKLE JAM), "badge" (lime PJ circle), "ball".
 */
function Logo({
  variant = "full",
  height = 64,
  assetBase = "",
  style = {},
  ...rest
}) {
  const files = {
    full: "logo.svg",
    badge: "pj-badge.svg",
    ball: "pickleball.svg",
    net: "net.svg"
  };
  const ratios = {
    full: 1866 / 1490,
    badge: 1,
    ball: 1,
    net: 2
  };
  const src = `${assetBase}assets/${files[variant] || files.full}`;
  return /*#__PURE__*/React.createElement("img", _extends({
    src: src,
    alt: "Pickle Jam",
    height: height,
    width: height * (ratios[variant] || 1),
    style: {
      display: "block",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Circular player/user avatar with dark-green ring. */
function Avatar({
  src,
  name = "",
  size = 44,
  ring = true,
  ...rest
}) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      overflow: "hidden",
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--pj-lime-500)",
      color: "var(--pj-green-900)",
      border: ring ? "2px solid var(--pj-green-900)" : "none",
      fontFamily: "var(--font-display)",
      fontSize: size * 0.36
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Loud status pill — "TOP STORY", "LIVE", "NEW". */
function Badge({
  children,
  variant = "pink",
  size = "md",
  dot = false,
  ...rest
}) {
  const variants = {
    pink: {
      background: "var(--pj-pink-500)",
      color: "#fff"
    },
    lime: {
      background: "var(--pj-lime-500)",
      color: "var(--pj-green-900)"
    },
    ink: {
      background: "var(--pj-green-900)",
      color: "var(--pj-cream-100)"
    },
    cream: {
      background: "var(--pj-cream-100)",
      color: "var(--pj-green-900)"
    }
  };
  const pad = size === "sm" ? "3px 8px" : "5px 11px";
  const fs = size === "sm" ? 10 : 11;
  const v = variants[variant] || variants.pink;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: pad,
      fontFamily: "var(--font-body)",
      fontWeight: 700,
      fontSize: fs,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      lineHeight: 1,
      borderRadius: "var(--radius-sm)",
      ...v
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "currentColor",
      opacity: 0.9
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card surface. variant "flat" (soft shadow) or "sticker" (dark outline +
 * hard offset shadow — the signature Pickle Jam look).
 */
function Card({
  children,
  variant = "flat",
  pad = 20,
  style = {},
  ...rest
}) {
  const looks = {
    flat: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      boxShadow: "var(--shadow-card)"
    },
    sticker: {
      background: "var(--surface-card)",
      border: "2px solid var(--pj-green-900)",
      boxShadow: "var(--shadow-sticker)"
    },
    ink: {
      background: "var(--pj-green-900)",
      border: "2px solid var(--pj-green-900)",
      color: "var(--pj-cream-100)",
      boxShadow: "var(--shadow-card)"
    }
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: "var(--radius-lg)",
      padding: pad,
      overflow: "hidden",
      ...(looks[variant] || looks.flat),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/SectionHeading.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Eyebrow overline + heavy display title, with optional trailing action. */
function SectionHeading({
  overline,
  title,
  action = null,
  align = "left",
  size = "md",
  ...rest
}) {
  const titleSize = {
    sm: 22,
    md: 30,
    lg: 40
  }[size] || 30;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 16,
      textAlign: align
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, overline && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "var(--text-accent)"
    }
  }, overline), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: titleSize,
      lineHeight: 0.95,
      letterSpacing: "-0.01em",
      color: "var(--text-strong)"
    }
  }, title)), action);
}
Object.assign(__ds_scope, { SectionHeading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/SectionHeading.jsx", error: String((e && e.message) || e) }); }

// components/display/Stat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Big number + label stat block. */
function Stat({
  value,
  label,
  accent = "lime",
  ...rest
}) {
  const colors = {
    lime: "var(--pj-lime-600)",
    pink: "var(--pj-pink-500)",
    ink: "var(--pj-green-900)"
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 40,
      lineHeight: 0.95,
      color: colors[accent] || colors.lime,
      textShadow: accent === "lime" ? "1.5px 1.5px 0 var(--pj-green-900)" : "none"
    }
  }, value), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Stat.jsx", error: String((e && e.message) || e) }); }

// components/display/StoryCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Composed news/story card: image slot, badge, headline, meta.
 * Pass an `image` URL or a child node for the media area.
 */
function StoryCard({
  badge = null,
  badgeVariant = "pink",
  title,
  excerpt,
  meta,
  image,
  media = null,
  variant = "flat",
  onClick,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, _extends({
    variant: variant,
    pad: 0,
    onClick: onClick,
    style: {
      cursor: onClick ? "pointer" : "default",
      display: "flex",
      flexDirection: "column"
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      aspectRatio: "16 / 10",
      background: "var(--pj-lime-500)",
      overflow: "hidden"
    }
  }, media || (image ? /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : null), badge && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      left: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: badgeVariant
  }, badge))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 21,
      lineHeight: 0.98,
      letterSpacing: "-0.01em",
      color: "var(--text-strong)"
    }
  }, title), excerpt && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-body)",
      fontSize: 14,
      lineHeight: 1.5,
      color: "var(--text-body)"
    }
  }, excerpt), meta && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontWeight: 600,
      fontSize: 12,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, meta)));
}
Object.assign(__ds_scope, { StoryCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/StoryCard.jsx", error: String((e && e.message) || e) }); }

// components/display/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Soft rounded category chip — News, Tournaments, Players… */
function Tag({
  children,
  active = false,
  iconLeft = null,
  onClick,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 14px",
      fontFamily: "var(--font-body)",
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1,
      cursor: onClick ? "pointer" : "default",
      borderRadius: "var(--radius-pill)",
      border: "2px solid " + (active ? "var(--pj-green-900)" : "var(--border-subtle)"),
      background: active ? "var(--pj-green-900)" : "transparent",
      color: active ? "var(--pj-cream-100)" : "var(--text-strong)",
      transition: "all var(--dur) var(--ease-out)"
    }
  }, rest), iconLeft, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Pickle Jam Button — chunky, rounded, sporty.
 * Variants: primary (hot pink), accent (lime), ink (dark green), outline, ghost.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  iconRight = null,
  iconLeft = null,
  disabled = false,
  full = false,
  as = "button",
  ...rest
}) {
  const sizes = {
    sm: {
      padding: "8px 16px",
      fontSize: 13,
      gap: 6,
      radius: "var(--radius-md)"
    },
    md: {
      padding: "13px 24px",
      fontSize: 15,
      gap: 8,
      radius: "var(--radius-md)"
    },
    lg: {
      padding: "17px 32px",
      fontSize: 17,
      gap: 10,
      radius: "var(--radius-lg)"
    }
  };
  const variants = {
    primary: {
      background: "var(--action-primary)",
      color: "var(--action-primary-text)",
      border: "2px solid var(--action-primary)"
    },
    accent: {
      background: "var(--action-accent)",
      color: "var(--action-accent-text)",
      border: "2px solid var(--action-accent)"
    },
    ink: {
      background: "var(--action-ink)",
      color: "var(--pj-cream-100)",
      border: "2px solid var(--action-ink)"
    },
    outline: {
      background: "transparent",
      color: "var(--pj-green-900)",
      border: "2px solid var(--pj-green-900)"
    },
    ghost: {
      background: "transparent",
      color: "var(--pj-green-900)",
      border: "2px solid transparent"
    }
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;
  const Comp = as;
  return /*#__PURE__*/React.createElement(Comp, _extends({
    disabled: as === "button" ? disabled : undefined,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      width: full ? "100%" : "auto",
      padding: s.padding,
      fontFamily: "var(--font-body)",
      fontWeight: 700,
      fontSize: s.fontSize,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      textDecoration: "none",
      lineHeight: 1,
      borderRadius: s.radius,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1,
      transition: "transform var(--dur-fast) var(--ease-out), background var(--dur) var(--ease-out), filter var(--dur) var(--ease-out)",
      ...v
    },
    onMouseDown: e => !disabled && (e.currentTarget.style.transform = "translateY(1px) scale(0.98)"),
    onMouseUp: e => e.currentTarget.style.transform = "",
    onMouseLeave: e => e.currentTarget.style.transform = ""
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Square/round icon-only button. */
function IconButton({
  children,
  variant = "ink",
  size = "md",
  round = false,
  label,
  ...rest
}) {
  const dims = {
    sm: 34,
    md: 42,
    lg: 52
  }[size] || 42;
  const variants = {
    ink: {
      background: "var(--pj-green-900)",
      color: "var(--pj-cream-100)",
      border: "2px solid var(--pj-green-900)"
    },
    lime: {
      background: "var(--pj-lime-500)",
      color: "var(--pj-green-900)",
      border: "2px solid var(--pj-lime-500)"
    },
    pink: {
      background: "var(--pj-pink-500)",
      color: "#fff",
      border: "2px solid var(--pj-pink-500)"
    },
    outline: {
      background: "transparent",
      color: "var(--pj-green-900)",
      border: "2px solid var(--pj-green-900)"
    },
    ghost: {
      background: "transparent",
      color: "var(--pj-green-900)",
      border: "2px solid transparent"
    }
  };
  const v = variants[variant] || variants.ink;
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: dims,
      height: dims,
      borderRadius: round ? "999px" : "var(--radius-md)",
      cursor: "pointer",
      transition: "transform var(--dur-fast) var(--ease-out), filter var(--dur) var(--ease-out)",
      ...v
    },
    onMouseDown: e => e.currentTarget.style.transform = "scale(0.92)",
    onMouseUp: e => e.currentTarget.style.transform = "",
    onMouseLeave: e => e.currentTarget.style.transform = ""
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text input with optional leading icon, sized for search + forms. */
function Input({
  value,
  onChange,
  placeholder = "",
  type = "text",
  iconLeft = null,
  size = "md",
  full = false,
  ...rest
}) {
  const pad = {
    sm: "8px 12px",
    md: "12px 16px",
    lg: "15px 18px"
  }[size] || "12px 16px";
  const fs = {
    sm: 13,
    md: 15,
    lg: 16
  }[size] || 15;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      width: full ? "100%" : "auto",
      padding: pad,
      background: "var(--pj-white)",
      border: "2px solid var(--border-subtle)",
      borderRadius: "var(--radius-pill)",
      transition: "border-color var(--dur) var(--ease-out)"
    },
    onFocusCapture: e => e.currentTarget.style.borderColor = "var(--pj-green-900)",
    onBlurCapture: e => e.currentTarget.style.borderColor = "var(--border-subtle)"
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--text-muted)"
    }
  }, iconLeft), /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    type: type,
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-body)",
      fontWeight: 500,
      fontSize: fs,
      color: "var(--text-strong)"
    }
  }, rest)));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/Home.jsx
try { (() => {
// Pickle Jam platform — app shell + screens. Uses DS primitives via window namespace.
const NS = window.PickleJamDesignSystem_26eda6;
const {
  Button,
  IconButton,
  Input,
  Icon,
  Logo,
  Card,
  Badge,
  Tag,
  Stat,
  Avatar,
  StoryCard,
  SectionHeading
} = NS;
const D = window.PJ_DATA;
const TONE_BG = {
  lime: "var(--pj-lime-500)",
  pink: "var(--pj-pink-500)",
  green: "var(--pj-green-900)",
  cream: "var(--pj-pink-200)"
};
const ASSET = "../../assets/";

// Media placeholder — colored panel with the ball motif (no stock photos in brand kit)
function Media({
  tone = "lime",
  h = "100%"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: h,
      background: TONE_BG[tone] || TONE_BG.lime,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: ASSET + "pickleball.svg",
    style: {
      width: "38%",
      opacity: 0.92,
      filter: tone === "green" ? "none" : "drop-shadow(3px 3px 0 rgba(15,61,46,.25))"
    }
  }));
}

// ─── Top navigation ────────────────────────────────────────────────
function TopNav({
  view,
  setView,
  q,
  setQ
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      background: "var(--pj-green-900)",
      borderBottom: "3px solid var(--pj-lime-500)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1160,
      margin: "0 auto",
      padding: "0 24px",
      height: 68,
      display: "flex",
      alignItems: "center",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView("home"),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    variant: "full",
    height: 46,
    assetBase: "../../"
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 4,
      marginLeft: 8
    }
  }, D.nav.map(n => {
    const active = view === n.key;
    return /*#__PURE__*/React.createElement("button", {
      key: n.key,
      onClick: () => setView(n.key),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 14px",
        borderRadius: "var(--radius-pill)",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: 13,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        background: active ? "var(--pj-lime-500)" : "transparent",
        color: active ? "var(--pj-green-900)" : "var(--pj-cream-100)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 16
    }), " ", n.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220
    }
  }, /*#__PURE__*/React.createElement(Input, {
    full: true,
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 17
    }),
    placeholder: "Search\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement(IconButton, {
    variant: "lime",
    label: "Notifications",
    round: true
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 18
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "You Player",
    size: 40
  }))));
}

// ─── HOME / news feed ──────────────────────────────────────────────
function HomeScreen({
  filter,
  setFilter
}) {
  const cats = ["All", "News", "Tournaments", "Players", "Highlights", "Culture"];
  const [hero, ...rest] = D.stories;
  const list = filter === "All" ? rest : rest.filter(s => s.tag === filter);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 28
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "sticker",
    pad: 0,
    style: {
      display: "grid",
      gridTemplateColumns: "1.15fr 1fr",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    variant: "pink"
  }, hero.badge)), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 46,
      lineHeight: 0.92,
      letterSpacing: "-0.01em",
      color: "var(--text-strong)"
    }
  }, hero.title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 16,
      lineHeight: 1.5,
      color: "var(--text-body)",
      maxWidth: 420
    }
  }, hero.excerpt), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-right",
      size: 18
    })
  }, "Read the recap"))), /*#__PURE__*/React.createElement(Media, {
    tone: hero.tone,
    h: 340
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, cats.map(c => /*#__PURE__*/React.createElement(Tag, {
    key: c,
    active: filter === c,
    onClick: () => setFilter(c)
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: 28,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHeading, {
    overline: "Latest",
    title: "The Feed",
    size: "md"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 20,
      marginTop: 18
    }
  }, list.map(s => /*#__PURE__*/React.createElement(StoryCard, {
    key: s.id,
    badge: s.badge,
    badgeVariant: s.badgeVariant,
    title: s.title,
    excerpt: s.excerpt,
    meta: s.meta,
    media: /*#__PURE__*/React.createElement(Media, {
      tone: s.tone,
      h: 160
    }),
    onClick: () => {}
  })))), /*#__PURE__*/React.createElement("aside", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "ink",
    pad: 20
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trending-up",
    size: 18,
    color: "var(--pj-lime-500)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 17,
      color: "var(--pj-cream-100)"
    }
  }, "Top Rankings")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, D.players.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.rank,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 20,
      color: "var(--pj-lime-500)",
      width: 24
    }
  }, p.rank), /*#__PURE__*/React.createElement(Avatar, {
    name: p.name,
    size: 34,
    ring: false
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--pj-cream-100)",
      fontWeight: 600,
      fontSize: 14,
      flex: 1
    }
  }, p.name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--pj-lime-500)",
      fontWeight: 700,
      fontSize: 13
    }
  }, p.rating))))), /*#__PURE__*/React.createElement(Card, {
    variant: "flat",
    pad: 20,
    style: {
      background: "var(--pj-pink-200)",
      border: "2px solid var(--pj-green-900)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 18,
      color: "var(--pj-green-900)",
      display: "block",
      lineHeight: 0.95
    }
  }, "Get the weekly jam"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 12px",
      fontSize: 13,
      color: "var(--text-body)"
    }
  }, "Scores, highlights & culture \u2014 every Monday."), /*#__PURE__*/React.createElement(Button, {
    variant: "ink",
    size: "sm",
    full: true,
    iconRight: /*#__PURE__*/React.createElement(Icon, {
      name: "bell",
      size: 15
    })
  }, "Subscribe")))));
}
window.PJ_SCREENS = {
  TopNav,
  HomeScreen,
  Media,
  ASSET
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/Home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/Screens.jsx
try { (() => {
// Pickle Jam platform — Tournaments, Courts, Groups screens.
const NS2 = window.PickleJamDesignSystem_26eda6;
const {
  Button: B2,
  IconButton: IB2,
  Icon: I2,
  Card: C2,
  Badge: BG2,
  Tag: TG2,
  Stat: ST2,
  Avatar: AV2,
  SectionHeading: SH2
} = NS2;
const DD = window.PJ_DATA;
const Media2 = window.PJ_SCREENS.Media;
const statusVariant = {
  Live: "lime",
  Registering: "pink",
  Upcoming: "cream"
};
function TournamentsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    overline: "This Season",
    title: "Tournaments",
    action: /*#__PURE__*/React.createElement(B2, {
      variant: "primary",
      iconRight: /*#__PURE__*/React.createElement(I2, {
        name: "plus",
        size: 17
      })
    }, "Create tournament")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
      gap: 20
    }
  }, DD.tournaments.map(t => /*#__PURE__*/React.createElement(C2, {
    key: t.id,
    variant: "sticker",
    pad: 0,
    style: {
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(Media2, {
    tone: t.status === "Live" ? "pink" : "lime",
    h: 120
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      left: 12
    }
  }, /*#__PURE__*/React.createElement(BG2, {
    variant: statusVariant[t.status],
    dot: t.status === "Live"
  }, t.status))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 22,
      color: "var(--text-strong)",
      lineHeight: 0.95
    }
  }, t.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      color: "var(--text-muted)",
      fontSize: 13,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(I2, {
    name: "map-pin",
    size: 14
  }), " ", t.city, /*#__PURE__*/React.createElement("span", {
    style: {
      margin: "0 2px"
    }
  }, "\xB7"), /*#__PURE__*/React.createElement(I2, {
    name: "calendar",
    size: 14
  }), " ", t.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 24,
      borderTop: "1px solid var(--border-subtle)",
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement(ST2, {
    value: t.players,
    label: "Players",
    accent: "ink"
  }), /*#__PURE__*/React.createElement(ST2, {
    value: t.prize,
    label: "Prize pool",
    accent: "pink"
  })), /*#__PURE__*/React.createElement(B2, {
    variant: t.status === "Registering" ? "accent" : "outline",
    size: "sm",
    full: true
  }, t.status === "Registering" ? "Register now" : t.status === "Live" ? "Watch live" : "View details"))))));
}
function CourtsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    overline: "Near You",
    title: "Find Courts",
    action: /*#__PURE__*/React.createElement(B2, {
      variant: "outline",
      size: "sm",
      iconLeft: /*#__PURE__*/React.createElement(I2, {
        name: "map-pin",
        size: 16
      })
    }, "Austin, TX")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1.1fr",
      gap: 24,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, DD.courts.map(c => /*#__PURE__*/React.createElement(C2, {
    key: c.id,
    variant: "flat",
    pad: 16,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 54,
      height: 54,
      borderRadius: "var(--radius-md)",
      background: "var(--pj-lime-500)",
      border: "2px solid var(--pj-green-900)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(I2, {
    name: "map-pin",
    size: 24,
    color: "var(--pj-green-900)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 17,
      color: "var(--text-strong)",
      lineHeight: 1
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 6,
      fontSize: 12.5,
      fontWeight: 600,
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null, c.courts, " courts"), /*#__PURE__*/React.createElement("span", null, c.dist), /*#__PURE__*/React.createElement("span", null, c.indoor ? "Indoor" : "Outdoor"))), /*#__PURE__*/React.createElement(BG2, {
    variant: c.open ? "lime" : "ink",
    dot: c.open
  }, c.open ? "Open" : "Closed")))), /*#__PURE__*/React.createElement(C2, {
    variant: "sticker",
    pad: 0,
    style: {
      overflow: "hidden",
      position: "sticky",
      top: 92
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 440,
      background: "repeating-linear-gradient(0deg,#EAF3D6,#EAF3D6 38px,#E2EFC7 38px,#E2EFC7 39px),repeating-linear-gradient(90deg,#EAF3D6,#EAF3D6 38px,#E2EFC7 38px,#E2EFC7 39px)"
    }
  }, [{
    t: 60,
    l: 80
  }, {
    t: 150,
    l: 260
  }, {
    t: 260,
    l: 130
  }, {
    t: 320,
    l: 330
  }].map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: "absolute",
      top: p.t,
      left: p.l,
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: "50% 50% 50% 2px",
      background: i === 0 ? "var(--pj-pink-500)" : "var(--pj-green-900)",
      transform: "rotate(45deg)",
      border: "2px solid var(--pj-cream-100)",
      boxShadow: "0 3px 8px rgba(0,0,0,.2)"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 14,
      left: 14
    }
  }, /*#__PURE__*/React.createElement(BG2, {
    variant: "cream"
  }, "4 courts nearby"))))));
}
function GroupsScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(SectionHeading, {
    overline: "Your Community",
    title: "Groups",
    action: /*#__PURE__*/React.createElement(B2, {
      variant: "primary",
      iconRight: /*#__PURE__*/React.createElement(I2, {
        name: "plus",
        size: 17
      })
    }, "Create group")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
      gap: 20
    }
  }, DD.groups.map(g => /*#__PURE__*/React.createElement(C2, {
    key: g.id,
    variant: "sticker",
    pad: 20,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: "var(--radius-md)",
      background: "var(--pj-pink-500)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(I2, {
    name: "users",
    size: 24,
    color: "#fff"
  })), /*#__PURE__*/React.createElement(TG2, null, g.level)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: "var(--font-display)",
      textTransform: "uppercase",
      fontSize: 20,
      color: "var(--text-strong)",
      lineHeight: 0.95
    }
  }, g.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "center",
      marginTop: 8,
      color: "var(--text-muted)",
      fontSize: 13,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(I2, {
    name: "clock",
    size: 14
  }), " Next play \xB7 ", g.next)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: "1px solid var(--border-subtle)",
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center"
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      marginLeft: i ? -10 : 0
    }
  }, /*#__PURE__*/React.createElement(AV2, {
    name: "P " + (i + 1),
    size: 30
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 12.5,
      fontWeight: 700,
      color: "var(--text-muted)"
    }
  }, g.members, " members")), /*#__PURE__*/React.createElement(B2, {
    variant: "accent",
    size: "sm"
  }, "Join"))))));
}
window.PJ_SCREENS.TournamentsScreen = TournamentsScreen;
window.PJ_SCREENS.CourtsScreen = CourtsScreen;
window.PJ_SCREENS.GroupsScreen = GroupsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/platform/data.js
try { (() => {
// Mock content for the Pickle Jam platform UI kit.
window.PJ_DATA = {
  stories: [{
    id: 1,
    badge: "Top Story",
    badgeVariant: "pink",
    tag: "News",
    title: "New Champs Crowned in Austin",
    excerpt: "A thrilling final goes the distance at the PPA Tour Austin Open, decided 12–10 in the third.",
    meta: "News · 2h ago",
    tone: "lime"
  }, {
    id: 2,
    badge: "Live",
    badgeVariant: "lime",
    tag: "Tournaments",
    title: "Semifinals Underway in Dallas",
    excerpt: "Follow every point as the bracket narrows to the final four.",
    meta: "Tournaments · Live",
    tone: "pink"
  }, {
    id: 3,
    badge: "Recap",
    badgeVariant: "ink",
    tag: "Highlights",
    title: "Top 5 Dinks of the Weekend",
    excerpt: "The softest hands in the game, ranked.",
    meta: "Highlights · 5h ago",
    tone: "green"
  }, {
    id: 4,
    tag: "Players",
    title: "Rookie Watch: Who to Follow in 2026",
    excerpt: "Five names climbing the rankings fast.",
    meta: "Players · 1d ago",
    tone: "cream"
  }, {
    id: 5,
    tag: "Culture",
    title: "The Rise of Neighborhood Pickle Clubs",
    excerpt: "How a backyard game became a movement.",
    meta: "Culture · 1d ago",
    tone: "pink"
  }, {
    id: 6,
    tag: "News",
    title: "New Paddle Rules Take Effect Next Month",
    excerpt: "What players need to know before the season opener.",
    meta: "News · 2d ago",
    tone: "lime"
  }],
  tournaments: [{
    id: 1,
    name: "Austin Open",
    city: "Austin, TX",
    date: "Jul 12–14",
    status: "Live",
    players: 128,
    prize: "$25K"
  }, {
    id: 2,
    name: "Dallas Classic",
    city: "Dallas, TX",
    date: "Jul 19–21",
    status: "Registering",
    players: 96,
    prize: "$18K"
  }, {
    id: 3,
    name: "Denver Rally",
    city: "Denver, CO",
    date: "Aug 2–4",
    status: "Registering",
    players: 64,
    prize: "$12K"
  }, {
    id: 4,
    name: "Bay Area Slam",
    city: "Oakland, CA",
    date: "Aug 9–11",
    status: "Upcoming",
    players: 112,
    prize: "$22K"
  }],
  courts: [{
    id: 1,
    name: "Zilker Park Courts",
    city: "Austin, TX",
    courts: 8,
    dist: "0.8 mi",
    open: true,
    indoor: false
  }, {
    id: 2,
    name: "Riverside Rec Center",
    city: "Austin, TX",
    courts: 6,
    dist: "1.4 mi",
    open: true,
    indoor: true
  }, {
    id: 3,
    name: "Eastside Pickle Club",
    city: "Austin, TX",
    courts: 12,
    dist: "2.1 mi",
    open: false,
    indoor: false
  }, {
    id: 4,
    name: "Northgate Athletic",
    city: "Round Rock, TX",
    courts: 4,
    dist: "5.6 mi",
    open: true,
    indoor: true
  }],
  groups: [{
    id: 1,
    name: "Dinkers Anonymous",
    members: 42,
    level: "All levels",
    next: "Sat 9:00 AM"
  }, {
    id: 2,
    name: "3.5 Grinders",
    members: 18,
    level: "3.5–4.0",
    next: "Sun 8:00 AM"
  }, {
    id: 3,
    name: "Sunrise Smashers",
    members: 63,
    level: "All levels",
    next: "Tue 6:30 AM"
  }],
  players: [{
    name: "Anna Leigh W.",
    rank: 1,
    rating: 5.9
  }, {
    name: "Ben Johns",
    rank: 2,
    rating: 5.9
  }, {
    name: "Catherine P.",
    rank: 3,
    rating: 5.7
  }, {
    name: "Tyson McG.",
    rank: 4,
    rating: 5.6
  }],
  nav: [{
    key: "home",
    label: "News",
    icon: "newspaper"
  }, {
    key: "tournaments",
    label: "Tournaments",
    icon: "trophy"
  }, {
    key: "courts",
    label: "Courts",
    icon: "map-pin"
  }, {
    key: "groups",
    label: "Groups",
    icon: "users"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/platform/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.SectionHeading = __ds_scope.SectionHeading;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.StoryCard = __ds_scope.StoryCard;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

})();
