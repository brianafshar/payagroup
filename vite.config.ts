import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api, /media and /files are forwarded to the local site API (`cd server && npm start`).
const api = process.env.DEV_API || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { "/api": api, "/media": api, "/files": api },
  },
});
