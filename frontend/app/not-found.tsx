import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Shell } from "@/components/layout/shell";

export default function NotFound() {
  return (
    <Shell className="flex items-center justify-center min-h-[50vh]">
      <EmptyState
        title="Page Not Found"
        description="The healthcare resource or portal page you requested does not exist or has been relocated."
        action={
          <Link href="/">
            <Button variant="primary">Return to Homepage</Button>
          </Link>
        }
      />
    </Shell>
  );
}
