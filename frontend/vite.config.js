import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../DSG/static/react",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        profileSetup: "src/profile-setup/main.tsx",
        dashboard: "src/dashboard/main.tsx",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});

