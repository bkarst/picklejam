import React from "react";
import { Card } from "./Card.jsx";
import { Badge } from "./Badge.jsx";

/**
 * Composed news/story card: image slot, badge, headline, meta.
 * Pass an `image` URL or a child node for the media area.
 */
export function StoryCard({
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
  return (
    <Card
      variant={variant}
      pad={0}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", display: "flex", flexDirection: "column" }}
      {...rest}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 10", background: "var(--pj-lime-500)", overflow: "hidden" }}>
        {media || (image ? (
          <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null)}
        {badge && (
          <div style={{ position: "absolute", top: 12, left: 12 }}>
            <Badge variant={badgeVariant}>{badge}</Badge>
          </div>
        )}
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            fontSize: 21,
            lineHeight: 0.98,
            letterSpacing: "-0.01em",
            color: "var(--text-strong)",
          }}
        >
          {title}
        </h3>
        {excerpt && (
          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.5, color: "var(--text-body)" }}>
            {excerpt}
          </p>
        )}
        {meta && (
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            {meta}
          </span>
        )}
      </div>
    </Card>
  );
}
