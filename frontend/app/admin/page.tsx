"use client";

import React from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { Shell } from "@/components/layout/shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";

export default function AdminPage() {
  const { userProfile } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <Shell className="py-8 space-y-6">
        <PageHeader
          title="System Administration"
          description="Administrative control and system security governance."
          badge={<Badge variant="neutral">Administrative Area</Badge>}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Administrator Identity</CardTitle>
              <CardDescription>
                Server-validated administrative security context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs sm:text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Admin Email:</span>
                <span className="font-medium text-slate-800">{userProfile?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Security Clearance:</span>
                <span className="font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {userProfile?.role}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Privileged APIs:</span>
                <StatusBadge status="verified" label="Authorized for Role Governance" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Governance</CardTitle>
              <CardDescription>Role Security</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Administrative token verification is active. Server-side role assignment APIs (`/api/v1/auth/role/assign`) are strictly restricted to this role.
              </p>
            </CardContent>
          </Card>
        </div>
      </Shell>
    </ProtectedRoute>
  );
}
