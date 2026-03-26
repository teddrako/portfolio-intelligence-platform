import * as React from "react";

export type BadgeVariant = "default" | "success" | "danger" | "warning" | "info";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-800 text-gray-300",
  success: "bg-emerald-950 text-emerald-400",
  danger: "bg-red-950 text-red-400",
  warning: "bg-amber-950 text-amber-400",
  info: "bg-blue-950 text-blue-400",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={[
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
