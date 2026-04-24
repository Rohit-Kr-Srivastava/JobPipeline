import React from "react";
import { createRoot } from "react-dom/client";
import { DashboardApp } from "./DashboardApp";

function mount() {
  const el = document.getElementById("react-dashboard");
  if (!el) return;
  createRoot(el).render(
    <React.StrictMode>
      <DashboardApp />
    </React.StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
