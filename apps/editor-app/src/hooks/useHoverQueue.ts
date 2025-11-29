/**
 * useHoverQueue - React hook for cell-based hover request state management
 */

import {
  type CellState,
  type CellStatus,
  HoverQueueManager,
  type QueueMetrics,
} from "@hamiltonian/lib"
import { useCallback, useEffect, useRef, useState } from "react"

export interface UseHoverQueueResult {
  metrics: QueueMetrics
  cellStates: CellState[][]
  gridSize: { rows: number; cols: number }
  setGridSize: (rows: number, cols: number) => void
  markPending: (row: number, col: number) => void
  markProcessing: (row: number, col: number) => void
  markCompleted: (row: number, col: number, found: boolean) => void
  markCached: (row: number, col: number, found: boolean) => void
  markIdle: (row: number, col: number) => void
  markStart: (row: number, col: number) => void
  markGoal: (row: number, col: number) => void
  getCellState: (row: number, col: number) => CellState | undefined
  reset: () => void
}

const initialMetrics: QueueMetrics = {
  totalCells: 0,
  exploredCells: 0,
  foundCells: 0,
  notFoundCells: 0,
  pendingCells: 0,
  processingCells: 0,
  idleCells: 0,
  totalRequests: 0,
  cacheHits: 0,
  averageProcessingTime: 0,
}

export function useHoverQueue(): UseHoverQueueResult {
  // Use lazy initialization to ensure manager is created only once
  const managerRef = useRef<HoverQueueManager | null>(null)
  if (managerRef.current === null) {
    managerRef.current = new HoverQueueManager()
  }
  const manager = managerRef.current

  const [metrics, setMetrics] = useState<QueueMetrics>(initialMetrics)
  const [cellStates, setCellStates] = useState<CellState[][]>([])
  const [gridSize, setGridSizeState] = useState<{ rows: number; cols: number }>({
    rows: 0,
    cols: 0,
  })

  // Subscribe to changes (manager is stable, so this runs once)
  useEffect(() => {
    const unsubMetrics = manager.onMetricsChange((m) => {
      setMetrics(m)
    })

    const unsubCellState = manager.onCellStateChange(() => {
      setCellStates(manager.getAllCellStates())
    })

    return () => {
      unsubMetrics()
      unsubCellState()
    }
  }, [manager])

  const setGridSize = useCallback(
    (rows: number, cols: number) => {
      manager.setGridSize(rows, cols)
      setGridSizeState({ rows, cols })
      setCellStates(manager.getAllCellStates())
      setMetrics(manager.getMetrics())
    },
    [manager],
  )

  const markPending = useCallback(
    (row: number, col: number) => {
      manager.markPending(row, col)
    },
    [manager],
  )

  const markProcessing = useCallback(
    (row: number, col: number) => {
      manager.markProcessing(row, col)
    },
    [manager],
  )

  const markCompleted = useCallback(
    (row: number, col: number, found: boolean) => {
      manager.markCompleted(row, col, found)
    },
    [manager],
  )

  const markCached = useCallback(
    (row: number, col: number, found: boolean) => {
      manager.markCached(row, col, found)
    },
    [manager],
  )

  const markIdle = useCallback(
    (row: number, col: number) => {
      manager.markIdle(row, col)
    },
    [manager],
  )

  const markStart = useCallback(
    (row: number, col: number) => {
      manager.markStart(row, col)
    },
    [manager],
  )

  const markGoal = useCallback(
    (row: number, col: number) => {
      manager.markGoal(row, col)
    },
    [manager],
  )

  const getCellState = useCallback(
    (row: number, col: number) => {
      return manager.getCellState(row, col)
    },
    [manager],
  )

  const reset = useCallback(() => {
    manager.reset()
    setCellStates(manager.getAllCellStates())
    setMetrics(manager.getMetrics())
  }, [manager])

  // Return stable object reference
  return {
    metrics,
    cellStates,
    gridSize,
    setGridSize,
    markPending,
    markProcessing,
    markCompleted,
    markCached,
    markIdle,
    markStart,
    markGoal,
    getCellState,
    reset,
  }
}

export type { CellState, CellStatus, QueueMetrics }
