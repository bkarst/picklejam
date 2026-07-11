import React from "react";
export interface InputProps {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  iconLeft?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  full?: boolean;
}
/** Pill-shaped text / search input. */
export function Input(props: InputProps): JSX.Element;
