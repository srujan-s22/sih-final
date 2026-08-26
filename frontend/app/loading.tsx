import { LoadingState } from "@/components/ui/loading-state";
import { Shell } from "@/components/layout/shell";

export default function Loading() {
  return (
    <Shell className="flex items-center justify-center min-h-[50vh]">
      <LoadingState message="Loading SwasthyaSetu platform..." />
    </Shell>
  );
}
