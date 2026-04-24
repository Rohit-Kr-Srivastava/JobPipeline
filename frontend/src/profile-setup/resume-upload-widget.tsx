import React, { useMemo, useRef, useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT_EXT = [".pdf", ".doc", ".docx"];

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "parsing"; fileName: string; ingestionId: number }
  | {
      kind: "success";
      fileName: string;
      parseWarning?: string;
      extractedPreview?: { headline?: string; text?: string } | null;
      structuredResume?: Record<string, unknown> | null;
      extractedData?: Record<string, unknown> | null;
    }
  | { kind: "error"; message: string };

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

function validateResumeFile(file: File): string | null {
  if (!file) return "Please choose a file.";
  if (file.size > MAX_BYTES) return "File is too large. Maximum size is 5 MB.";
  if (file.size === 0) return "The file appears to be empty.";
  const name = (file.name || "").toLowerCase();
  if (!ACCEPT_EXT.some((ext) => name.endsWith(ext))) {
    return "Please upload a PDF or Word document (.pdf, .doc, or .docx).";
  }
  return null;
}

function setIfEmpty(fieldName: string, value: string) {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${fieldName}"]`);
  if (!el) return;
  if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) return;
  const current = String((el as HTMLInputElement).value || "").trim();
  if (current) return;
  (el as HTMLInputElement).value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function toMultilineText(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val
      .map((x) => {
        if (x && typeof x === "object") {
          return Object.keys(x as object)
            .map((k) => `${k}: ${String((x as Record<string, unknown>)[k] ?? "")}`)
            .join(", ");
        }
        return String(x);
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(val);
}

function applyAutofill(autofill: Record<string, unknown> | null | undefined) {
  if (!autofill || typeof autofill !== "object") return;

  if (autofill.full_name) setIfEmpty("full_name", String(autofill.full_name));
  if (autofill.preferred_name) setIfEmpty("preferred_name", String(autofill.preferred_name));
  if (autofill.phone_number) setIfEmpty("phone_number", String(autofill.phone_number));
  if (autofill.location) setIfEmpty("location", String(autofill.location));
  if (autofill.experience_years !== null && autofill.experience_years !== undefined && autofill.experience_years !== "") {
    setIfEmpty("experience_years", String(autofill.experience_years));
  }
  if (autofill.primary_skills) {
    const s = Array.isArray(autofill.primary_skills)
      ? autofill.primary_skills.join(", ")
      : String(autofill.primary_skills);
    if (s.trim()) setIfEmpty("primary_skills", s);
  }
  if (autofill.role_preferences) {
    const s = Array.isArray(autofill.role_preferences)
      ? autofill.role_preferences.join(", ")
      : String(autofill.role_preferences);
    if (s.trim()) setIfEmpty("role_preferences", s);
  }
  if (autofill.linkedin_url) setIfEmpty("linkedin_url", String(autofill.linkedin_url));
  if (autofill.github_url) setIfEmpty("github_url", String(autofill.github_url));
  if (autofill.portfolio_links) {
    const pl = Array.isArray(autofill.portfolio_links)
      ? autofill.portfolio_links.join("\n")
      : String(autofill.portfolio_links);
    if (pl.trim()) setIfEmpty("portfolio_links", pl);
  }

  const edu = toMultilineText(autofill.education);
  if (edu.trim()) setIfEmpty("education", edu);
  const cert = toMultilineText(autofill.certifications);
  if (cert.trim()) setIfEmpty("certifications", cert);
  const proj = toMultilineText(autofill.projects);
  if (proj.trim()) setIfEmpty("projects", proj);
}

async function pollParseStatus(ingestionId: number): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; message: string }
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
      return { ok: true, data };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, message: "Parsing is taking longer than expected. Refresh the page and try again." };
}

export function ResumeUploadWidget() {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const supportedText = useMemo(() => "Supported formats: PDF, DOC, DOCX (max 5 MB)", []);

  async function upload(file: File) {
    const invalid = validateResumeFile(file);
    if (invalid) {
      setState({ kind: "error", message: invalid });
      return;
    }
    const csrftoken = getCsrfToken();
    if (!csrftoken) {
      setState({ kind: "error", message: "Session expired. Refresh and try again." });
      return;
    }
    setState({ kind: "uploading" });
    setShowPreview(false);

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
        setState({ kind: "error", message: String(data.error || data.detail || "Upload failed.") });
        return;
      }
      const ingestionId = data.ingestion_id;
      if (ingestionId === undefined || ingestionId === null) {
        setState({ kind: "error", message: "Upload succeeded but parsing could not be started." });
        return;
      }
      const iid = Number(ingestionId);
      setState({ kind: "parsing", fileName: file.name || "resume", ingestionId: iid });

      const parsed = await pollParseStatus(iid);
      if (!parsed.ok) {
        setState({ kind: "error", message: parsed.message });
        return;
      }

      applyAutofill((parsed.data.autofill as Record<string, unknown>) || {});
      const parseWarning =
        typeof parsed.data.parse_warning === "string" ? parsed.data.parse_warning : "";
      const extractedPreview = parsed.data.extracted_preview as
        | { headline?: string; text?: string }
        | null
        | undefined;
      const structuredResume = (parsed.data.structured_resume as Record<string, unknown>) || null;
      const extractedData = (parsed.data.extracted_data as Record<string, unknown>) || null;
      setState({
        kind: "success",
        fileName: file.name || "resume",
        parseWarning: parseWarning || undefined,
        extractedPreview: extractedPreview ?? null,
        structuredResume,
        extractedData,
      });
    } catch {
      setState({ kind: "error", message: "Network error. Try again." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onChoose() {
    fileRef.current?.click();
  }

  function onFileChange() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    upload(f);
  }

  const busyUpload = state.kind === "uploading";
  const hasResume = state.kind === "parsing" || state.kind === "success";

  return (
    <div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-auto">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            type="button"
            onClick={onChoose}
            disabled={busyUpload}
            className="inline-flex w-full sm:w-auto cursor-pointer items-center justify-center rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {busyUpload ? "Uploading…" : hasResume ? "Replace resume" : "Upload Resume"}
          </button>
          <p className="mt-2 text-xs text-gray-500">{supportedText}</p>

          {hasResume ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
              <span className="truncate">{state.fileName}</span>
              {state.kind === "success" ? (
                <button
                  type="button"
                  className="ml-auto inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? "Hide review" : "Review extracted data"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <a
          href="/resume/create/"
          className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Create resume
        </a>
      </div>

      {state.kind === "parsing" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Resume uploaded.
            <span className="mt-1 block text-xs text-green-900/90">{state.fileName}</span>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
              aria-hidden="true"
            />
            <span>Parsing in progress…</span>
          </div>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</div>
      ) : null}

      {state.kind === "success" ? (
        <>
          {state.parseWarning ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{state.parseWarning}</div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Resume parsed. We filled empty profile fields where we could—please review and edit anything below.
          </div>
        </>
      ) : null}

      {showPreview && state.kind === "success" && state.extractedPreview ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900">
          <div className="font-semibold">{state.extractedPreview.headline || "Review extracted data"}</div>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-xs text-gray-700">
            {state.extractedPreview.text || ""}
          </pre>
        </div>
      ) : null}

      {showPreview && state.kind === "success" ? (
        <div className="mt-4 grid grid-cols-1 gap-4">
          {state.structuredResume ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900">
              <div className="font-semibold">Structured highlights</div>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Location</div>
                  <div className="mt-1 break-words text-sm font-medium text-gray-900">
                    {String((state.structuredResume as any)?.location || "—")}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Work history</div>
                {Array.isArray((state.structuredResume as any)?.experience) &&
                ((state.structuredResume as any).experience as any[]).length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {((state.structuredResume as any).experience as any[]).map((ex, idx) => {
                      const company = String(ex?.company || "").trim();
                      const role = String(ex?.role || "").trim();
                      const dates = String(ex?.dates || "").trim();
                      const loc = String(ex?.location || "").trim();
                      const bullets = Array.isArray(ex?.bullets) ? (ex.bullets as unknown[]).map(String).filter(Boolean) : [];
                      return (
                        <div key={idx} className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                          <div className="text-sm font-semibold text-gray-900">
                            {[role || "Role", company].filter(Boolean).join(" · ")}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-600">
                            {[dates, loc].filter((x) => String(x || "").trim()).join(" · ") || "—"}
                          </div>
                          {bullets.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800">
                              {bullets.map((b, bi) => (
                                <li key={bi} className="break-words">
                                  {b}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-2 text-xs text-gray-500">No bullets extracted for this role.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500">No experience extracted.</div>
                )}
              </div>
            </div>
          ) : null}

          {state.structuredResume ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900">
              <div className="font-semibold">LLM structured output (parsed)</div>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700">
                {JSON.stringify(state.structuredResume, null, 2)}
              </pre>
            </div>
          ) : null}

          {state.extractedData ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900">
              <div className="font-semibold">Debug: raw pipeline output</div>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-700">
                {JSON.stringify(state.extractedData, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
