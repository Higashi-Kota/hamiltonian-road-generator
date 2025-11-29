import { defineConfig } from "@rslib/core"

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.ts",
    },
  },
  lib: [
    {
      format: "esm",
      dts: true,
      bundle: true,
      autoExtension: true,
      syntax: "esnext",
    },
  ],
  output: {
    target: "web",
    distPath: {
      root: "./dist",
    },
    externals: {
      "@hamiltonian/wasm/pkg/hamiltonian_wasm": "@hamiltonian/wasm/pkg/hamiltonian_wasm",
    },
  },
})
