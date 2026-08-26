"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Shell } from "@/components/layout/shell";

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testInput, setTestInput] = useState("");

  return (
    <div className="flex flex-col gap-12 md:gap-16 pb-16">
      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white py-12 md:py-20">
        <Shell className="py-0 md:py-0">
          <div className="flex flex-col items-start max-w-3xl space-y-6">
            <Badge variant="default" className="text-xs font-semibold uppercase tracking-wider">
              National Healthcare Entitlement Architecture
            </Badge>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Bridging Household Healthcare Access Gaps into Actionable Entitlement
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed">
              SwasthyaSetu helps households identify healthcare access gaps, understand what is
              needed, and connect those needs to action.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2 w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto"
              >
                Explore Platform Architecture
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const el = document.getElementById("foundation-preview");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="w-full sm:w-auto"
              >
                Review Design System
              </Button>
            </div>
          </div>
        </Shell>
      </section>

      {/* Core Architectural Pillars */}
      <Shell as="section" className="py-0 md:py-0">
        <SectionHeader
          title="System Capabilities"
          description="Designed to systematically analyze eligibility, detect documentation disparities, and guide households to healthcare resolution."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-2">
                01
              </div>
              <CardTitle>Gap Detection</CardTitle>
              <CardDescription>
                Identifies missing documentation, scheme lapse risks, and coverage deficits across household members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deterministic rule evaluation evaluates household parameters against state and national healthcare criteria without ambiguity.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-2">
                02
              </div>
              <CardTitle>Entitlement Mapping</CardTitle>
              <CardDescription>
                Matches families to verified government health schemes including AB-PMJAY and state-level programs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Evaluates income tiers, social categories, and family composition to determine exact benefit limits and coverage scope.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center font-bold mb-2">
                03
              </div>
              <CardTitle>Action Resolution</CardTitle>
              <CardDescription>
                Converts identified gaps into step-by-step resolution tasks with evidence verification and follow-ups.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-relaxed">
                Empowers both citizens and frontline healthcare workers (ASHAs) with structured, actionable workflows.
              </p>
            </CardContent>
          </Card>
        </div>
      </Shell>

      {/* Design System & Foundational UI Showcase */}
      <Shell as="section" id="foundation-preview" className="py-0 md:py-0">
        <PageHeader
          title="UI Design System Foundation"
          description="A calm, accessible, neutral-first healthcare design language tested across all mobile and desktop viewports."
          badge={<Badge variant="neutral">Phase 1 Primitives</Badge>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Inputs & Form Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Form Elements & Interactive States</CardTitle>
              <CardDescription>
                Accessible, keyboard-navigable inputs with semantic labels and error validation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Household Identifier"
                placeholder="e.g. HH-2026-00412"
                helperText="Enter the official household survey identification number"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
              />

              <Select
                label="Healthcare Scheme Category"
                options={[
                  { value: "pmjay", label: "Ayushman Bharat — PMJAY" },
                  { value: "state_health", label: "State Universal Health Scheme" },
                  { value: "maternal_care", label: "Maternal & Child Health Program" },
                ]}
              />

              <div className="pt-2 flex flex-wrap gap-2">
                <Button variant="primary" size="sm">Primary Action</Button>
                <Button variant="secondary" size="sm">Secondary</Button>
                <Button variant="outline" size="sm">Outline</Button>
                <Button variant="ghost" size="sm">Ghost</Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Indicators & Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>Restrained Status & Semantic Badges</CardTitle>
              <CardDescription>
                Clear, high-contrast visual indicators communicating verification and action states.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2.5">
                <StatusBadge status="verified" label="Entitlement Verified" />
                <StatusBadge status="pending" label="Document Review Pending" />
                <StatusBadge status="gap" label="Coverage Gap Detected" />
                <StatusBadge status="action_required" label="Action Required" />
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Modal Dialog Verification
                </h4>
                <p className="text-xs text-slate-500">
                  Accessible dialogs feature focus-trapping, backdrop blur, and escape-key handling.
                </p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
                    Trigger Modal Dialog
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Shell>

      {/* Modal Dialog Demo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="SwasthyaSetu Project Architecture"
        description="Core technical foundations establishing the full-functional SIH 2026 system."
        footer={
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
            Close Architecture Summary
          </Button>
        }
      >
        <div className="space-y-3 text-xs md:text-sm text-slate-600">
          <p>
            <strong className="text-slate-900">Frontend:</strong> Next.js 16 App Router with Tailwind CSS v4 and strict TypeScript typing.
          </p>
          <p>
            <strong className="text-slate-900">Backend:</strong> Node.js + Fastify with correlation ID tracking, RFC-compliant error structures, and Zod validation.
          </p>
          <p>
            <strong className="text-slate-900">Data Boundary:</strong> Server-side Firebase Admin SDK ensures privileged Firestore operations remain securely isolated on the backend.
          </p>
        </div>
      </Modal>
    </div>
  );
}
