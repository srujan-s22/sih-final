"use client";

import React from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { Shell } from "@/components/layout/shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AshaPage() {
  const { userProfile } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["ASHA", "ADMIN"]}>
      <Shell className="py-8 space-y-6">
        <PageHeader
          title="ASHA Field Workspace"
          description="Dedicated healthcare worker workflow and household monitoring."
          badge={<Badge variant="default">ASHA Access</Badge>}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Field Worker Authorization</CardTitle>
              <CardDescription>
                Verified frontline healthcare worker credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Worker Email:</span>
                <span className="font-medium text-slate-800">{userProfile?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Authorized Role:</span>
                <span className="font-medium text-teal-800 font-semibold">{userProfile?.role}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Security Clearance:</span>
                <StatusBadge status="verified" label="Authorized Field Access" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Field Workflows</CardTitle>
              <CardDescription>Upcoming Phases</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                ASHA role-based authorization is verified. Household case management, offline sync, and action tasks will be integrated in subsequent phases.
              </p>
            </CardContent>
          </Card>
        </div>
      </Shell>
    </ProtectedRoute>
  );
}
