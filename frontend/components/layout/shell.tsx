import React from "react";
import { cn } from "@/lib/utils";

export interface ShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: React.ElementType;
}

export function Shell({
  children,
  className,
  as: Comp = "main",
  ...props
}: ShellProps) {
  return (
    <Comp
      className={cn(
        "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
