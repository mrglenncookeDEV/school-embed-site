import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: "/houses/",   // 👈 ADD THIS LINE

  plugins: [react()],

  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },

  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts")) return "charts";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("canvas-confetti")) return "effects";
          if (id.includes("react-router")) return "react-vendor";
          if (id.includes("react-dom") || id.includes("react")) return "react-vendor";
        },
      },
    },
  },
});
