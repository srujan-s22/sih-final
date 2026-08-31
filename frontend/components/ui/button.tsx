import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ButtonSize, ButtonVariant } from "@/types/ui";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer rounded-lg select-none";

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        "bg-teal-800 text-white hover:bg-teal-900 active:bg-teal-950 border border-teal-800 shadow-2xs",
      secondary:
        "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 shadow-2xs",
      outline:
        "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 shadow-2xs",
      ghost:
        "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
      destructive:
        "bg-red-700 text-white hover:bg-red-800 active:bg-red-900 border border-red-700 shadow-2xs",
      success:
        "bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900 border border-emerald-700 shadow-2xs",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "min-h-[32px] px-3 py-1 text-xs gap-1.5",
      md: "min-h-[40px] px-4 py-2 text-xs sm:text-sm gap-2",
      lg: "min-h-[44px] px-5 py-2.5 text-sm sm:text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
