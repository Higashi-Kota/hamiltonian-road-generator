/**
 * @hamiltonian/lib
 * Hamiltonian Path Finder library powered by WebAssembly
 */

import init, {
  cell_parity,
  find_hamiltonian_path,
  has_different_parity,
  path_to_road_grid,
} from "@hamiltonian/wasm/pkg/hamiltonian_wasm"

// Types
export interface Point {
  row: number
  col: number
}

export interface GridSize {
  rows: number
  cols: number
}

export interface PathResult {
  found: boolean
  path: Point[]
  iterations: number
}

export interface CellData {
  connections: string[]
  path_index: number
}

export type RoadGrid = (CellData | null)[][]

// WASM initialization state
let wasmInitialized = false
let initPromise: Promise<void> | null = null

/**
 * Initialize the WASM module
 * Safe to call multiple times
 */
export async function initWasm(): Promise<void> {
  if (wasmInitialized) {
    return
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = init().then(() => {
    wasmInitialized = true
  })

  return initPromise
}

/**
 * Ensure WASM is initialized
 */
function ensureWasmInitialized(): void {
  if (!wasmInitialized) {
    throw new Error("WASM module not initialized. Call initWasm() first.")
  }
}

/**
 * Find a Hamiltonian path in a grid
 */
export function findHamiltonianPath(
  start: Point,
  end: Point,
  gridSize: GridSize,
  maxIterations: number = 500000,
): PathResult {
  ensureWasmInitialized()

  const result = find_hamiltonian_path(
    start.row,
    start.col,
    end.row,
    end.col,
    gridSize.rows,
    gridSize.cols,
    maxIterations,
  )

  return result as PathResult
}

/**
 * Convert a path to a road grid with connection data
 */
export function pathToRoadGrid(path: Point[], gridSize: GridSize): RoadGrid {
  ensureWasmInitialized()

  const result = path_to_road_grid(path, gridSize.rows, gridSize.cols)

  return result as RoadGrid
}

/**
 * Get the parity (checkerboard color) of a cell
 */
export function getCellParity(row: number, col: number): number {
  ensureWasmInitialized()

  return cell_parity(row, col)
}

/**
 * Check if two points have different parity
 */
export function hasDifferentParity(p1: Point, p2: Point): boolean {
  ensureWasmInitialized()

  return has_different_parity(p1.row, p1.col, p2.row, p2.col)
}

/**
 * Create an empty road grid
 */
export function createEmptyGrid(gridSize: GridSize): RoadGrid {
  return Array(gridSize.rows)
    .fill(null)
    .map(() => Array(gridSize.cols).fill(null))
}

// Re-export types
export type { PathResult as PathResultType, CellData as CellDataType }

// Re-export async API
export {
  findHamiltonianPathAsync,
  getCellParityAsync,
  hasDifferentParityAsync,
  initWorkerWithInstance,
  pathToRoadGridAsync,
  terminateWorker,
} from "./async-api"
export {
  type CellState,
  type CellStateListener,
  type CellStatus,
  HoverQueueManager,
  type MetricsListener,
  type QueueMetrics,
} from "./hover-queue"
