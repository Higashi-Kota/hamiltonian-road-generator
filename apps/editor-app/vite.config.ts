import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: [{ find: "@", replacement: resolve(__dirname, "./src") }],
  },
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [".."],
    },
  },
  preview: {
    port: 5173,
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@hamiltonian/lib", "@hamiltonian/wasm"],
  },
  build: {
    target: "esnext",
    sourcemap: false,
  },
  assetsInclude: ["**/*.wasm"],
})
