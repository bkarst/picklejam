import React from "react";
export interface LogoProps {
  /** @default "full" */
  variant?: "full" | "badge" | "ball" | "net";
  height?: number;
  /** Prefix to reach /assets from the consuming page, e.g. "../../". */
  assetBase?: string;
  style?: React.CSSProperties;
}
/** Brand wordmark / badge / ball mark. */
export function Logo(props: LogoProps): JSX.Element;
