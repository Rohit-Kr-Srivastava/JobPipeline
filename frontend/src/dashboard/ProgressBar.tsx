import React from "react";

type Props = {
  value: number;
  label?: string;
};

export function ProgressBar({ value, label = "Profile completion" }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900">{label}</span>
        <span className="tabular-nums text-gray-700">{pct}%</span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-2.5 rounded-full bg-gray-900 transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
