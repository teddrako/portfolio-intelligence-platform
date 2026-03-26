import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({ padding = "md", className = "", children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[
        "rounded-lg border border-gray-800 bg-gray-900",
        paddingClasses[padding],
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className = "", children, ...props }: CardHeaderProps) {
  return (
    <div {...props} className={["flex items-center justify-between pb-3", className].join(" ")}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className = "", children, ...props }: CardTitleProps) {
  return (
    <h3 {...props} className={["text-sm font-semibold text-gray-100", className].join(" ")}>
      {children}
    </h3>
  );
}
