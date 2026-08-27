"use client";

import React from "react";
import Link from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Shell } from "@/components/layout/shell";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { userProfile, signOut } = useAuth();

  const getAuthorizedPath = () => {
    if (userProfile?.role === "ADMIN") return "/admin";
    if (userProfile?.role === "ASHA") return "/asha";
    return "/citizen";
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth/sign-in");
  };

  return (
    <Shell className="min-h-[70vh] flex flex-col justify-center items-center py-12">
      <div className="w-full max-w-md">
        <Card className="border-rose-200">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 bg-rose-50 text-rose-700 rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-3 border border-rose-200">
              403
            </div>
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              You don&apos;t have access to this page.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 text-center pt-2">
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Your account with role <strong className="text-slate-800 font-semibold">{userProfile?.role || "Citizen"}</strong> is not authorized to access this resource.
            </p>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => router.replace(getAuthorizedPath())}
                className="w-full"
              >
                Go to your authorized area
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={handleSignOut}
                className="w-full"
              >
                Sign out / Switch account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
