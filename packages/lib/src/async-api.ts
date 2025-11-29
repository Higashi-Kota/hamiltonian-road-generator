/**
 * Async API for Hamiltonian path calculations using Web Workers
 * Provides non-blocking computation on a background thread
 */

// Worker message types
interface WorkerRequest {
  id: number
  type: "findPath" | "pathToRoadGrid" | "getCellParity" | "hasDifferentParity"
  payload: unknown
}

interface WorkerResponse {
  id: number
  type: "result" | "error"
  payload: unknown
}

// Types (shared with sync API)
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

// Worker management
let worker: Worker | null = null
let messageId = 0
const pendingRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()

/**
 * Initialize the Web Worker with an existing Worker instance
 * The Worker should be created by the app using Vite's worker import
 */
export function initWorkerWithInstance(workerInstance: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    if (worker) {
      resolve()
      return
    }

    try {
      worker = workerInstance

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, type, payload } = event.data
        const pending = pendingRequests.get(id)

        if (pending) {
          pendingRequests.delete(id)
          if (type === "error") {
            pending.reject(new Error(payload as string))
          } else {
            pending.resolve(payload)
          }
        }
      }

      worker.onerror = (error) => {
        reject(new Error(`Worker error: ${error.message}`))
      }

      // Send a test message to ensure worker is initialized
      const testId = messageId++
      pendingRequests.set(testId, {
        resolve: () => resolve(),
        reject,
      })

      worker.postMessage({
        id: testId,
        type: "getCellParity",
        payload: { row: 0, col: 0 },
      } satisfies WorkerRequest)
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

/**
 * Terminate the Web Worker
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
    pendingRequests.clear()
  }
}

/**
 * Send a message to the worker and wait for response
 */
function sendMessage<T>(type: WorkerRequest["type"], payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error("Worker not initialized. Call initWorker() first."))
      return
    }

    const id = messageId++
    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    })

    worker.postMessage({ id, type, payload } satisfies WorkerRequest)
  })
}

/**
 * Find a Hamiltonian path in a grid (async)
 */
export function findHamiltonianPathAsync(
  start: Point,
  end: Point,
  gridSize: GridSize,
  maxIterations: number = 500000,
): Promise<PathResult> {
  return sendMessage<PathResult>("findPath", {
    start,
    end,
    gridSize,
    maxIterations,
  })
}

/**
 * Convert a path to a road grid with connection data (async)
 */
export function pathToRoadGridAsync(path: Point[], gridSize: GridSize): Promise<RoadGrid> {
  return sendMessage<RoadGrid>("pathToRoadGrid", { path, gridSize })
}

/**
 * Get the parity (checkerboard color) of a cell (async)
 */
export function getCellParityAsync(row: number, col: number): Promise<number> {
  return sendMessage<number>("getCellParity", { row, col })
}

/**
 * Check if two points have different parity (async)
 */
export function hasDifferentParityAsync(p1: Point, p2: Point): Promise<boolean> {
  return sendMessage<boolean>("hasDifferentParity", { p1, p2 })
}

/**
 * Create an empty road grid (sync - no WASM needed)
 */
export function createEmptyGrid(gridSize: GridSize): RoadGrid {
  return Array(gridSize.rows)
    .fill(null)
    .map(() => Array(gridSize.cols).fill(null))
}
