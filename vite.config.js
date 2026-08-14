import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT : remplace "suivi-depenses" par le nom EXACT de ton dépôt GitHub.
// Si ton dépôt s'appelle "budget-app", mets base: "/budget-app/"
// Si ton dépôt s'appelle "<ton-pseudo>.github.io" (site principal), mets base: "/"
export default defineConfig({
  plugins: [react()],
  base: "/suivibudget/",
});
