# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hamiltonian path finder application that visualizes Hamiltonian paths on a grid. It uses Rust compiled to WebAssembly for the path-finding algorithm and a React frontend for the UI.

## Commands

### Development
```bash
pnpm install                    # Install all dependencies
pnpm --filter @hamiltonian/wasm build  # Build WASM module (required before other builds)
pnpm --filter @hamiltonian/lib build   # Build the TypeScript library
pnpm --filter @hamiltonian/editor-app dev     # Start dev server at http://localhost:5173
```

### Build
```bash
pnpm --filter @hamiltonian/wasm build:release  # Production WASM build
pnpm --filter @hamiltonian/editor-app build           # Production app build
```

### Testing & Quality
```bash
pnpm --filter @hamiltonian/wasm test   # Run Rust tests (cargo test)
pnpm --filter @hamiltonian/editor-app typecheck  # TypeScript type checking
pnpm --filter @hamiltonian/editor-app lint       # Biome linting
pnpm --filter @hamiltonian/editor-app lint:fix   # Auto-fix lint issues
```

## Architecture

### Package Structure
- **apps/editor-app**: React + Vite frontend using Tailwind CSS v4
- **packages/crates/hamiltonian-wasm**: Rust WASM crate containing the Hamiltonian path algorithm
- **packages/lib**: TypeScript wrapper around WASM, exports typed API (`@hamiltonian/lib`)
- **packages/shared-config**: Shared Biome and TypeScript configurations

### Data Flow
1. App initializes WASM via `initWasm()` from `@hamiltonian/lib`
2. User clicks grid cells to set start/end points
3. `findHamiltonianPath()` calls into WASM to compute the path using backtracking with Warnsdorff's heuristic
4. `pathToRoadGrid()` converts the path to connection data for rendering road tiles

### Key Files
- `packages/crates/hamiltonian-wasm/src/lib.rs`: Core algorithm with `find_hamiltonian_path`, `path_to_road_grid` WASM exports
- `packages/lib/src/index.ts`: TypeScript API wrapping WASM functions
- `apps/editor-app/src/components/HamiltonianRoadGenerator.tsx`: Main React component with grid rendering

## Code Style

Uses Biome with these notable rules:
- 2-space indentation, no semicolons, single quotes for JSX
- `useImportType`/`useExportType` enforced
- `noExplicitAny` is an error
- 100 character line width
