import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, id: customId, type = "text", ...props }, ref) => {
    const autoId = useId();
    const inputId = customId || autoId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            "w-full h-10 px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-md border transition-colors duration-150",
            "border-slate-300 hover:border-slate-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 focus-visible:border-teal-700",
            "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
            error && "border-red-600 focus-visible:ring-red-600 focus-visible:border-red-600",
            className
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-xs text-red-600 font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
