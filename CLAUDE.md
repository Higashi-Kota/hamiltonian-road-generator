# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hamiltonian path finder application that visualizes Hamiltonian paths on a grid. It uses Rust compiled to WebAssembly for the path-finding algorithm and a React frontend for the UI.

## Commands

### Development
```bash
pnpm install          # Install all dependencies
pnpm build:wasm       # Build WASM module (required before other builds)
pnpm build:prepare    # Build all packages except editor-app
pnpm dev              # Start dev server at http://localhost:5173
```

### Build
```bash
pnpm build            # Full production build (wasm → lib → editor-app)
pnpm preview          # Preview production build
```

### Testing & Quality
```bash
pnpm typecheck        # TypeScript type checking (all packages)
pnpm lint             # Biome linting
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format code with Biome
pnpm --filter @hamiltonian/wasm test  # Run Rust tests (cargo test)
```

### Package-specific Commands
```bash
# WASM (packages/crates/hamiltonian-wasm)
pnpm --filter @hamiltonian/wasm build          # Debug build
pnpm --filter @hamiltonian/wasm build:release  # Release build

# Lib (packages/lib)
pnpm --filter @hamiltonian/lib build   # Build TypeScript library
pnpm --filter @hamiltonian/lib dev     # Watch mode

# Editor App (apps/editor-app)
pnpm --filter @hamiltonian/editor-app dev       # Dev server
pnpm --filter @hamiltonian/editor-app build     # Production build
pnpm --filter @hamiltonian/editor-app preview   # Preview build
```

### Maintenance
```bash
pnpm clean            # Clean all build artifacts and node_modules
pnpm package:check    # Check for outdated packages (taze)
pnpm package:update   # Update packages (taze -w --install)
```

## Architecture

### Package Structure
- **apps/editor-app**: React + Vite frontend using Tailwind CSS v4
- **packages/crates/hamiltonian-wasm**: Rust WASM crate containing the Hamiltonian path algorithm
- **packages/lib**: TypeScript wrapper around WASM, exports typed API (`@hamiltonian/lib`)
  - `index.ts`: Sync API (direct WASM calls)
  - `async-api.ts`: Async API using Web Worker for non-blocking computation
- **packages/shared-config**: Shared Biome and TypeScript configurations

### Data Flow
1. App initializes WASM via `initWasm()` and Web Worker via `initWorkerWithInstance()`
2. User clicks grid cells to set start/end points
3. `findHamiltonianPathAsync()` sends request to Web Worker → WASM computes path
4. `pathToRoadGridAsync()` converts the path to connection data for rendering road tiles
5. React component caches computed paths and renders grid with road tiles

### Algorithm (lib.rs)
- **Backtracking with enhanced Warnsdorff's heuristic**
- **VisitedBitset**: Compact u64 array for O(1) visited checks (supports up to 20×20 grids)
- **Heuristics**: Neighbor count + corner priority + distance-to-target + urgency bonus
- **Connectivity pruning**: DFS check to skip paths that would disconnect remaining cells
- **Parity check**: Early exit for impossible start/end combinations based on checkerboard coloring

### Key Files
- `packages/crates/hamiltonian-wasm/src/lib.rs`: Core algorithm with `find_hamiltonian_path`, `path_to_road_grid` WASM exports
- `packages/lib/src/index.ts`: Sync TypeScript API wrapping WASM functions
- `packages/lib/src/async-api.ts`: Async API with Web Worker message protocol
- `apps/editor-app/src/components/HamiltonianRoadGenerator.tsx`: Main React component with grid rendering, path caching, and hover preview

## Code Style

Uses Biome with these notable rules:
- 2-space indentation, no semicolons, single quotes for JSX
- `useImportType`/`useExportType` enforced
- `noExplicitAny` is an error
- 100 character line width
