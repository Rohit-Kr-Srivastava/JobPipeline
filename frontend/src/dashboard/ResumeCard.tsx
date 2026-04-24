import React, { useRef, useState } from "react";
import type { ResumeStatus } from "./types";

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
  return "";
}

function getCsrfToken() {
  const input = document.querySelector<HTMLInputElement>('[name="csrfmiddlewaretoken"]');
  if (input?.value) return input.value;
  return getCookie("csrftoken") || "";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

async function pollParseStatus(ingestionId: number): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const csrftoken = getCsrfToken();
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    const resp = await fetch("/api/resume/parse/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrftoken,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ ingestion_id: ingestionId }),
    });
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) {
      return { ok: false, message: String(data.error || data.detail || "Could not check parse status.") };
    }
    if (data.status === "error") {
      return { ok: false, message: String(data.error || "Parse request failed.") };
    }
    if (data.status === "failed") {
      return { ok: false, message: String(data.error || "We could not parse this resume. Your file is saved.") };
    }
    if (data.status === "completed") {
      return { ok: true };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, message: "Parsing is taking longer than expected. Refresh and try again." };
}

type Props = {
  resumeStatus: ResumeStatus;
  onRefresh: () => void;
};

function StatusPill({ children, kind }: { children: React.ReactNode; kind: "good" | "warn" | "neutral" }) {
  const cls =
    kind === "good"
      ? "border-green-200 bg-green-50 text-green-800"
      : kind === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-gray-200 bg-gray-50 text-gray-800";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>
  );
}

export function ResumeCard({ resumeStatus, onRefresh }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ui, setUi] = useState<{
    kind: "idle" | "loading_upload" | "loading_parse";
    message: string;
  }>({ kind: "idle", message: "" });
  const [error, setError] = useState("");

  const uploaded = !!resumeStatus.uploaded;
  const parsed = !!resumeStatus.parsed;
  const processing = !!resumeStatus.processing;
  const parseFailed = !!resumeStatus.parse_failed;
  const ingestionId = resumeStatus.ingestion_id;

  function chooseFile() {
    fileRef.current?.click();
  }

  async function upload(file: File) {
    const csrftoken = getCsrfToken();
    if (!csrftoken) {
      setError("Session expired. Refresh and try again.");
      return;
    }
    setError("");
    setUi({ kind: "loading_upload", message: "Uploading…" });
    const fd = new FormData();
    fd.append("file", file);
    try {
      const resp = await fetch("/api/profile/upload-resume/", {
        method: "POST",
        headers: { "X-CSRFToken": csrftoken, "X-Requested-With": "XMLHttpRequest" },
        body: fd,
      });
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      if (!resp.ok || data.status !== "success") {
        setError(String(data.error || data.detail || "Upload failed."));
        setUi({ kind: "idle", message: "" });
        return;
      }
      setUi({ kind: "idle", message: "" });
      onRefresh();
    } catch {
      setError("Network error. Try again.");
      setUi({ kind: "idle", message: "" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runParse() {
    if (ingestionId == null) {
      setError("Upload your resume from this dashboard to enable parsing.");
      return;
    }
    const csrftoken = getCsrfToken();
    if (!csrftoken) {
      setError("Session expired. Refresh and try again.");
      return;
    }
    setError("");
    setUi({ kind: "loading_parse", message: parsed ? "Re-parsing…" : "Parsing…" });
    try {
      const result = await pollParseStatus(ingestionId);
      if (!result.ok) {
        setError(result.message);
        setUi({ kind: "idle", message: "" });
        onRefresh();
        return;
      }
      setUi({ kind: "idle", message: "" });
      onRefresh();
    } catch {
      setError("Network error. Try again.");
      setUi({ kind: "idle", message: "" });
    }
  }

  function onFileChange() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    upload(f);
  }

  const busy = ui.kind === "loading_upload" || ui.kind === "loading_parse";
  const canParse = Boolean(ingestionId) && !processing && !busy;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Resume</h2>
          <p className="mt-1 text-sm text-gray-600">
            {uploaded
              ? "Manage your file and keep parsed data in sync with your profile."
              : "Upload a resume to improve matching and ATS strength."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill kind={uploaded ? "good" : "warn"}>{uploaded ? "Uploaded" : "Not uploaded"}</StatusPill>
          {uploaded ? (
            <StatusPill kind={processing ? "neutral" : parsed ? "good" : parseFailed ? "warn" : "warn"}>
              {processing ? "Parsing…" : parsed ? "Parsed" : parseFailed ? "Parse failed" : "Not parsed"}
            </StatusPill>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current file</div>
          <div className="mt-1 truncate text-sm font-medium text-gray-900">{resumeStatus.filename || "—"}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last updated</div>
          <div className="mt-1 text-sm font-medium text-gray-900">{fmtDate(resumeStatus.last_updated)}</div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={chooseFile}
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60 sm:w-auto"
        >
          {ui.kind === "loading_upload" ? "Uploading…" : uploaded ? "Upload / Replace" : "Upload resume"}
        </button>

        {uploaded && ingestionId != null ? (
          <button
            type="button"
            onClick={runParse}
            disabled={!canParse}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-60 sm:w-auto"
          >
            {ui.kind === "loading_parse" ? ui.message : parsed ? "Re-parse" : "Parse resume"}
          </button>
        ) : null}

        {uploaded && resumeStatus.resume_url ? (
          <a
            href={resumeStatus.resume_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50 sm:w-auto"
          >
            Download
          </a>
        ) : null}

        <a
          href="/resume/create/"
          className="inline-flex w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 sm:w-auto"
        >
          Resume builder
        </a>
      </div>

      <p className="mt-2 text-xs text-gray-500">Supported formats: PDF, DOC, DOCX · max 5 MB</p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
    </div>
  );
}
