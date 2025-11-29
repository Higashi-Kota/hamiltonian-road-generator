/**
 * Web Worker for Hamiltonian path calculations
 * Runs WASM computations off the main thread
 */

import {
  findHamiltonianPath,
  getCellParity,
  hasDifferentParity,
  initWasm,
  pathToRoadGrid,
} from "@hamiltonian/lib"

// Message types
export interface WorkerRequest {
  id: number
  type: "findPath" | "pathToRoadGrid" | "getCellParity" | "hasDifferentParity"
  payload: unknown
}

export interface WorkerResponse {
  id: number
  type: "result" | "error"
  payload: unknown
}

// Track initialization state
let initialized = false
let initPromise: Promise<void> | null = null

async function ensureInitialized(): Promise<void> {
  if (initialized) return

  if (!initPromise) {
    initPromise = initWasm().then(() => {
      initialized = true
    })
  }

  return initPromise
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data

  try {
    await ensureInitialized()

    let result: unknown

    switch (type) {
      case "findPath": {
        const { start, end, gridSize, maxIterations } = payload as {
          start: { row: number; col: number }
          end: { row: number; col: number }
          gridSize: { rows: number; cols: number }
          maxIterations: number
        }
        result = findHamiltonianPath(start, end, gridSize, maxIterations)
        break
      }

      case "pathToRoadGrid": {
        const { path, gridSize } = payload as {
          path: { row: number; col: number }[]
          gridSize: { rows: number; cols: number }
        }
        result = pathToRoadGrid(path, gridSize)
        break
      }

      case "getCellParity": {
        const { row, col } = payload as { row: number; col: number }
        result = getCellParity(row, col)
        break
      }

      case "hasDifferentParity": {
        const { p1, p2 } = payload as {
          p1: { row: number; col: number }
          p2: { row: number; col: number }
        }
        result = hasDifferentParity(p1, p2)
        break
      }

      default:
        throw new Error(`Unknown message type: ${type}`)
    }

    const response: WorkerResponse = { id, type: "result", payload: result }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type: "error",
      payload: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}
