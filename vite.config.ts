import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api, /media, /files, /sitemap.xml and exercise pages are forwarded to the local site API (`cd server && npm start`).
const api = process.env.DEV_API || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { "/api": api, "/media": api, "/files": api, "/sitemap.xml": api, "^/(fa|en)/exercises/[0-9]+$": api },
  },
});
