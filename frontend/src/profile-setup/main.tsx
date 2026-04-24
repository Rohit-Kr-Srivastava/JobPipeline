import React from "react";
import { createRoot } from "react-dom/client";
import { ResumeUploadWidget } from "./resume-upload-widget";

function mount() {
  const el = document.getElementById("react-resume-upload");
  if (!el) return;
  createRoot(el).render(<ResumeUploadWidget />);
}

mount();

