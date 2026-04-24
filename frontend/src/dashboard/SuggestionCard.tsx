import React from "react";
import type { DashboardSuggestion } from "./types";

type Props = {
  suggestion: DashboardSuggestion;
  rank: number;
};

export function SuggestionCard({ suggestion, rank }: Props) {
  return (
    <div className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition-colors duration-200 hover:border-gray-200 hover:bg-white">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white transition-transform duration-200 group-hover:scale-105">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900">{suggestion.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{suggestion.body}</p>
          {suggestion.cta_label && suggestion.cta_href ? (
            <a
              href={suggestion.cta_href}
              className="mt-3 inline-flex items-center text-sm font-semibold text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900"
            >
              {suggestion.cta_label}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
