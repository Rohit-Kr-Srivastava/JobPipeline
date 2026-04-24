import React from "react";

type PillKind = "good" | "warn" | "neutral";

function Pill({ kind, children }: { kind: PillKind; children: React.ReactNode }) {
  const cls =
    kind === "good"
      ? "border-green-200 bg-green-50 text-green-800"
      : kind === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-gray-200 bg-gray-50 text-gray-800";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {children}
    </span>
  );
}

type Props = {
  title: string;
  count: number;
  ok?: boolean;
  status?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export function SectionCard({
  title,
  count,
  ok,
  status,
  ctaLabel = "Add / Edit",
  ctaHref = "/accounts/profile/",
}: Props) {
  const pillKind: PillKind = ok ? "good" : "warn";
  const label = status || (ok ? "Good" : "Needs improvement");
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="mt-1 text-sm text-gray-600">
            {count} {count === 1 ? "item" : "items"}
          </div>
        </div>
        <Pill kind={pillKind}>{label}</Pill>
      </div>
      <div className="mt-4 flex">
        <a
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}
