import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

// Saat `npm run dev`, arahkan /api ke `vercel dev` (port 3000) bila dijalankan.
// Untuk pengembangan penuh dengan serverless function, gunakan: `vercel dev`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
