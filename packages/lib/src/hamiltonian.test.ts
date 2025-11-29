/**
 * Hamiltonian Library Tests
 *
 * Note: WASM-based path finding is tested in Rust (cargo test in packages/crates/hamiltonian-wasm)
 * These tests focus on the TypeScript layer: HoverQueueManager and state management.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { HoverQueueManager } from "./hover-queue"

describe("HoverQueueManager", () => {
  let manager: HoverQueueManager

  beforeEach(() => {
    manager = new HoverQueueManager()
  })

  describe("Grid Initialization", () => {
    it("should initialize grid with all idle cells", () => {
      manager.setGridSize(3, 4)

      const metrics = manager.getMetrics()
      expect(metrics.totalCells).toBe(12)
      expect(metrics.idleCells).toBe(12)
      expect(metrics.exploredCells).toBe(0)
    })

    it("should return correct grid size", () => {
      manager.setGridSize(5, 8)
      const size = manager.getGridSize()
      expect(size.rows).toBe(5)
      expect(size.cols).toBe(8)
    })

    it("should return 2D array of cell states", () => {
      manager.setGridSize(2, 3)
      const states = manager.getAllCellStates()

      expect(states.length).toBe(2)
      expect(states[0]?.length).toBe(3)
      expect(states[1]?.length).toBe(3)
      expect(states[0]?.[0]?.status).toBe("idle")
    })
  })

  describe("Cell State Transitions", () => {
    beforeEach(() => {
      manager.setGridSize(10, 10)
    })

    it("should transition idle -> pending", () => {
      manager.markPending(0, 0)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("pending")

      const metrics = manager.getMetrics()
      expect(metrics.pendingCells).toBe(1)
      expect(metrics.idleCells).toBe(99)
      expect(metrics.totalRequests).toBe(1)
    })

    it("should transition pending -> processing", () => {
      manager.markPending(0, 0)
      manager.markProcessing(0, 0)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("processing")

      const metrics = manager.getMetrics()
      expect(metrics.processingCells).toBe(1)
      expect(metrics.pendingCells).toBe(0)
    })

    it("should transition processing -> found", () => {
      manager.markPending(0, 0)
      manager.markProcessing(0, 0)
      manager.markCompleted(0, 0, true)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("found")

      const metrics = manager.getMetrics()
      expect(metrics.foundCells).toBe(1)
      expect(metrics.exploredCells).toBe(1)
    })

    it("should transition processing -> not_found", () => {
      manager.markPending(0, 0)
      manager.markProcessing(0, 0)
      manager.markCompleted(0, 0, false)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("not_found")

      const metrics = manager.getMetrics()
      expect(metrics.notFoundCells).toBe(1)
      expect(metrics.exploredCells).toBe(1)
    })

    it("should allow pending -> idle (cancel)", () => {
      manager.markPending(0, 0)
      manager.markIdle(0, 0)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("idle")
    })

    it("should allow processing -> idle (cancel)", () => {
      manager.markPending(0, 0)
      manager.markProcessing(0, 0)
      manager.markIdle(0, 0)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("idle")
    })

    it("should not allow found -> idle (final state)", () => {
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)
      manager.markIdle(0, 0) // Should be ignored

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("found")
    })

    it("should not allow not_found -> idle (final state)", () => {
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, false)
      manager.markIdle(0, 0) // Should be ignored

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("not_found")
    })
  })

  describe("Start and Goal Markers", () => {
    beforeEach(() => {
      manager.setGridSize(10, 10)
    })

    it("should mark start cell", () => {
      manager.markStart(0, 0)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("start")
    })

    it("should mark goal cell", () => {
      manager.markGoal(5, 5)

      const state = manager.getCellState(5, 5)
      expect(state?.status).toBe("goal")
    })

    it("should not count start/goal in idle metrics", () => {
      manager.markStart(0, 0)
      manager.markGoal(9, 9)

      const metrics = manager.getMetrics()
      // Start and goal are not counted in idleCells
      expect(metrics.idleCells).toBe(98)
    })

    it("should overwrite explored cell with goal", () => {
      manager.markPending(5, 5)
      manager.markCompleted(5, 5, true)
      manager.markGoal(5, 5)

      const state = manager.getCellState(5, 5)
      expect(state?.status).toBe("goal")
    })
  })

  describe("Cache Hits", () => {
    beforeEach(() => {
      manager.setGridSize(10, 10)
    })

    it("should track cache hits", () => {
      manager.markCached(0, 0, true)
      manager.markCached(0, 1, false)
      manager.markCached(0, 2, true)

      const metrics = manager.getMetrics()
      expect(metrics.cacheHits).toBe(3)
      expect(metrics.totalRequests).toBe(3)
      expect(metrics.foundCells).toBe(2)
      expect(metrics.notFoundCells).toBe(1)
    })

    it("should not update already explored cell on cache hit", () => {
      // First: mark as found through normal flow
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)

      // Second: cache hit returns not_found - should NOT change status
      manager.markCached(0, 0, false)

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("found") // Still found, not changed

      const metrics = manager.getMetrics()
      expect(metrics.cacheHits).toBe(1)
      expect(metrics.totalRequests).toBe(2) // Both requests counted
    })
  })

  describe("Request Counting", () => {
    beforeEach(() => {
      manager.setGridSize(10, 10)
    })

    it("should count requests even for already explored cells", () => {
      // First request: normal flow
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)

      // Second request: same cell, hover again
      manager.markPending(0, 0) // This increments totalRequests

      const metrics = manager.getMetrics()
      expect(metrics.totalRequests).toBe(2)
      expect(metrics.foundCells).toBe(1) // Still just 1 found cell
    })

    it("should not change status when re-pending explored cell", () => {
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)
      manager.markPending(0, 0) // Hover again

      const state = manager.getCellState(0, 0)
      expect(state?.status).toBe("found") // Status unchanged
    })
  })

  describe("Metrics Calculation", () => {
    beforeEach(() => {
      manager.setGridSize(10, 10)
    })

    it("should track average processing time", async () => {
      // Mark pending (starts timer)
      manager.markPending(0, 0)

      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Mark completed
      manager.markCompleted(0, 0, true)

      const metrics = manager.getMetrics()
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(40) // Allow some variance
    })

    it("should return 0 average time when no cells processed", () => {
      const metrics = manager.getMetrics()
      expect(metrics.averageProcessingTime).toBe(0)
    })

    it("should calculate explored cells correctly", () => {
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)

      manager.markPending(0, 1)
      manager.markCompleted(0, 1, false)

      manager.markPending(0, 2)
      manager.markCompleted(0, 2, true)

      const metrics = manager.getMetrics()
      expect(metrics.exploredCells).toBe(3)
      expect(metrics.foundCells).toBe(2)
      expect(metrics.notFoundCells).toBe(1)
    })
  })

  describe("Listeners", () => {
    beforeEach(() => {
      manager.setGridSize(10, 10)
    })

    it("should notify cell state listeners", () => {
      const listener = vi.fn()
      manager.onCellStateChange(listener)

      manager.markPending(0, 0)

      expect(listener).toHaveBeenCalledWith(0, 0, expect.objectContaining({ status: "pending" }))
    })

    it("should notify metrics listeners", () => {
      const listener = vi.fn()
      manager.onMetricsChange(listener)

      manager.markPending(0, 0)

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ pendingCells: 1 }))
    })

    it("should allow unsubscribing", () => {
      const listener = vi.fn()
      const unsubscribe = manager.onCellStateChange(listener)

      manager.markPending(0, 0)
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      manager.markPending(0, 1)
      expect(listener).toHaveBeenCalledTimes(1) // Not called again
    })
  })

  describe("Reset", () => {
    beforeEach(() => {
      manager.setGridSize(10, 10)
    })

    it("should reset all cells to idle", () => {
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)
      manager.markPending(0, 1)
      manager.markCompleted(0, 1, false)
      manager.markStart(1, 0)
      manager.markGoal(9, 9)

      manager.reset()

      const metrics = manager.getMetrics()
      expect(metrics.idleCells).toBe(100)
      expect(metrics.foundCells).toBe(0)
      expect(metrics.notFoundCells).toBe(0)
      expect(metrics.exploredCells).toBe(0)
    })

    it("should reset counters", () => {
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)
      manager.markCached(0, 1, true)

      manager.reset()

      const metrics = manager.getMetrics()
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.cacheHits).toBe(0)
      expect(metrics.averageProcessingTime).toBe(0)
    })
  })

  describe("Large Grid Simulation (NotFound Bias Investigation)", () => {
    it("should demonstrate state tracking for large grid exploration", () => {
      manager.setGridSize(15, 15)

      // Simulate exploring multiple cells with mixed results
      // This mimics the behavior when hovering over cells

      const results: { row: number; col: number; found: boolean }[] = []

      // Simulate 50 hover interactions with realistic found/not_found distribution
      for (let i = 0; i < 50; i++) {
        const row = i % 15
        const col = Math.floor(i / 15) % 15

        manager.markPending(row, col)
        manager.markProcessing(row, col)

        // Simulate that larger grids tend to have more "not found" due to iteration limits
        // In reality this is determined by the WASM algorithm
        const found = Math.random() > 0.6 // 40% found rate for demonstration

        manager.markCompleted(row, col, found)
        results.push({ row, col, found })
      }

      const metrics = manager.getMetrics()

      console.log("\n15x15 Grid Simulation:")
      console.log(`  Total cells: ${metrics.totalCells}`)
      console.log(`  Explored: ${metrics.exploredCells}`)
      console.log(`  Found: ${metrics.foundCells}`)
      console.log(`  Not Found: ${metrics.notFoundCells}`)
      console.log(
        `  Found Rate: ${((metrics.foundCells / metrics.exploredCells) * 100).toFixed(1)}%`,
      )

      // The test passes regardless of found rate - we're just verifying tracking works
      expect(metrics.exploredCells).toBe(50)
      expect(metrics.foundCells + metrics.notFoundCells).toBe(50)
    })

    it("should handle rapid state changes without race conditions", () => {
      manager.setGridSize(10, 10)

      // Simulate rapid hover in/out behavior
      for (let i = 0; i < 20; i++) {
        const row = i % 10
        const col = Math.floor(i / 10)

        // Hover in
        manager.markPending(row, col)

        // Quick hover out before processing
        if (i % 3 === 0) {
          manager.markIdle(row, col)
        } else {
          // Normal completion
          manager.markProcessing(row, col)
          manager.markCompleted(row, col, i % 2 === 0)
        }
      }

      const metrics = manager.getMetrics()

      // 7 cells cancelled (i % 3 === 0: i=0,3,6,9,12,15,18)
      // 13 cells completed
      expect(metrics.exploredCells).toBe(13)
      expect(metrics.idleCells + metrics.exploredCells).toBeLessThanOrEqual(100)
    })
  })

  describe("Edge Cases", () => {
    it("should handle operations on non-existent cells", () => {
      manager.setGridSize(5, 5)

      // These should not throw
      manager.markPending(10, 10) // Out of bounds
      manager.markProcessing(10, 10)
      manager.markCompleted(10, 10, true)
      manager.markCached(10, 10, true)
      manager.markIdle(10, 10)
      manager.markStart(10, 10)
      manager.markGoal(10, 10)

      // Metrics should be unchanged
      const metrics = manager.getMetrics()
      expect(metrics.totalCells).toBe(25)
      expect(metrics.idleCells).toBe(25)
    })

    it("should handle grid resize clearing previous state", () => {
      manager.setGridSize(5, 5)
      manager.markPending(0, 0)
      manager.markCompleted(0, 0, true)

      // Resize clears everything
      manager.setGridSize(3, 3)

      const metrics = manager.getMetrics()
      expect(metrics.totalCells).toBe(9)
      expect(metrics.idleCells).toBe(9)
      expect(metrics.foundCells).toBe(0)
    })

    it("should handle empty grid", () => {
      manager.setGridSize(0, 0)

      const metrics = manager.getMetrics()
      expect(metrics.totalCells).toBe(0)
      expect(metrics.idleCells).toBe(0)
    })
  })
})
