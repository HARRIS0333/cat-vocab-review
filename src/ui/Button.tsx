import type { ComponentProps } from "react";

export type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "small" | "medium" | "large";
};

export function Button({
  variant = "primary",
  size = "medium",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "button",
    `button-${variant}`,
    size === "medium" ? undefined : `button-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} type={type} {...props} />;
}
