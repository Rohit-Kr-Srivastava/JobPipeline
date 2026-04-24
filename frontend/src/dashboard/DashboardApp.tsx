import React, { useCallback, useEffect, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { ResumeCard } from "./ResumeCard";
import { SectionCard } from "./SectionCard";
import { SuggestionCard } from "./SuggestionCard";
import type { DashboardPayload } from "./types";

function StrengthPill({ label }: { label: string }) {
  const kind = label === "Strong" ? "good" : label === "Intermediate" ? "neutral" : "warn";
  const cls =
    kind === "good"
      ? "border-green-200 bg-green-50 text-green-800"
      : kind === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-gray-200 bg-gray-50 text-gray-800";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-7 w-48 rounded-lg bg-gray-200" />
        <div className="mt-4 h-4 w-full max-w-md rounded bg-gray-100" />
        <div className="mt-6 h-2.5 w-full rounded-full bg-gray-100" />
        <div className="mt-6 flex gap-3">
          <div className="h-10 w-28 rounded-xl bg-gray-200" />
          <div className="h-10 w-28 rounded-xl bg-gray-100" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="h-48 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="mt-4 h-16 rounded-2xl bg-gray-100" />
            <div className="mt-3 h-16 rounded-2xl bg-gray-100" />
          </div>
        </div>
        <div className="h-80 rounded-3xl border border-gray-200 bg-white shadow-sm" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="h-40 rounded-3xl border border-gray-200 bg-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}

export function DashboardApp() {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: DashboardPayload }
  >({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const resp = await fetch("/api/dashboard/", {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
      });
      const data = (await resp.json().catch(() => ({}))) as DashboardPayload & { detail?: string };
      if (!resp.ok) throw new Error(data.detail || "Failed to load dashboard.");
      setState({ kind: "ready", data: data as DashboardPayload });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Failed to load dashboard.",
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === "loading") {
    return <DashboardSkeleton />;
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">{state.message}</div>
    );
  }

  const d = state.data;
  const section = d.section_status || {};
  const counts = d.counts || {};
  const suggestions = Array.isArray(d.suggestions) ? d.suggestions : [];

  return (
    <div className="space-y-6 [animation:dashboardFade_0.35s_ease-out]">
      <style>{`@keyframes dashboardFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">Profile analytics, resume status, and prioritized next steps.</p>
          </div>
          <StrengthPill label={d.profile_strength || "—"} />
        </div>
        <div className="mt-5">
          <ProgressBar value={d.profile_completion_percentage || 0} />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Strength: <span className="font-medium text-gray-700">{d.profile_strength}</span> — driven by basics, resume
          parsing, and core profile sections.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="/accounts/profile/"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            Edit profile
          </a>
          <a
            href="/jobs/"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
          >
            Browse jobs
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-gray-900">Smart suggestions</h2>
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-800">
                {suggestions.length ? `Top ${Math.min(5, suggestions.length)}` : "All clear"}
              </span>
            </div>
            {suggestions.length ? (
              <div className="mt-4 space-y-3">
                {suggestions.map((s, i) => (
                  <SuggestionCard key={`${s.id}-${i}`} suggestion={s} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                No suggestions right now — your profile looks in good shape.
              </div>
            )}
          </div>
        </div>
        <div>
          <ResumeCard resumeStatus={d.resume_status} onRefresh={load} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Profile sections</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SectionCard
            title="Education"
            count={counts.education_count || 0}
            ok={section.education?.ok}
            status={section.education?.status}
            ctaHref="/accounts/profile/"
          />
          <SectionCard
            title="Experience"
            count={counts.experience_count || 0}
            ok={section.experience?.ok}
            status={section.experience?.status}
            ctaHref="/accounts/profile/"
          />
          <SectionCard
            title="Skills"
            count={counts.skills_count || 0}
            ok={section.skills?.ok}
            status={section.skills?.status}
            ctaHref="/accounts/profile/"
          />
          <SectionCard
            title="Certifications"
            count={counts.certifications_count || 0}
            ok={section.certifications?.ok}
            status={section.certifications?.status}
            ctaHref="/accounts/profile/"
          />
        </div>
      </div>
    </div>
  );
}
