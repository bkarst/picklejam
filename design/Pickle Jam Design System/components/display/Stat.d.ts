import React from "react";
export interface StatProps {
  value?: React.ReactNode;
  label?: React.ReactNode;
  accent?: "lime" | "pink" | "ink";
}
/** Large display number with an uppercase caption. */
export function Stat(props: StatProps): JSX.Element;
