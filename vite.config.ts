/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "小咪学生字",
        short_name: "小咪学生字",
        description: "四年级上册生字认读与手写练习",
        lang: "zh-CN",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "any",
        background_color: "#FFF9F7",
        theme_color: "#D96C8A",
        icons: [
          {
            src: "icons/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,svg,txt}"],
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH ?? "/",
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
});
