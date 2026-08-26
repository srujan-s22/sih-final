"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { Shell } from "@/components/layout/shell";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error message to console for developer tracing
    console.error("UI Error Boundary caught an exception:", error.message);
  }, [error]);

  return (
    <Shell className="flex items-center justify-center min-h-[50vh]">
      <ErrorState
        title="Application Experience Interrupted"
        message="A client-side error occurred while rendering this page. Our technical logs have recorded the occurrence."
        onRetry={reset}
      />
    </Shell>
  );
}
