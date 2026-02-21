import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
    plugins: [react()],
    // prevent vite from obscuring rust errors
    clearScreen: false,
    server: {
        // Tauri expects a fixed port, fail if that port is not available
        strictPort: true,
        // Use a port that's unlikely to conflict
        port: 1420,
    },
    // env variables with TAURI_ prefix are available to the frontend
    envPrefix: ["VITE_", "TAURI_"],
    build: {
        // Tauri uses Chromium on Windows and WebKit on macOS and Linux
        target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari14",
        // don't minify for debug builds
        minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
        rollupOptions: {
            output: {
                manualChunks: {
                    xterm: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-webgl"],
                },
            },
        },
    },
});
