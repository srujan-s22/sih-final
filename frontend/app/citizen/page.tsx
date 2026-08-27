"use client";

import React from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { Shell } from "@/components/layout/shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";

export default function CitizenPage() {
  const { userProfile } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["CITIZEN", "ASHA", "ADMIN"]}>
      <Shell className="py-8 space-y-6">
        <PageHeader
          title="Citizen Access Portal"
          description="Your authenticated healthcare entitlement space."
          badge={<Badge variant="default">Citizen Access</Badge>}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Account & Verification Status</CardTitle>
              <CardDescription>
                Verified identity and active consent record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Email Address:</span>
                <span className="font-medium text-slate-800">{userProfile?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Display Name:</span>
                <span className="font-medium text-slate-800">{userProfile?.displayName || "Not specified"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Authorized Role:</span>
                <span className="font-medium text-slate-800">{userProfile?.role}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Consent Status:</span>
                <StatusBadge status="verified" label="Accepted (v1.0)" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
              <CardDescription>Phase 3 Household Management</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Authentication, security boundary, and consent validation are complete. Household profile and entitlement onboarding will be enabled in Phase 3.
              </p>
            </CardContent>
          </Card>
        </div>
      </Shell>
    </ProtectedRoute>
  );
}
