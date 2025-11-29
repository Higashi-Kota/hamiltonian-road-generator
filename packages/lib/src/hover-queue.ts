/**
 * Hover Request Queue Manager
 * Cell-based request state management with metrics collection
 */

export type CellStatus =
  | "idle"
  | "pending"
  | "processing"
  | "found"
  | "not_found"
  | "start"
  | "goal"

export interface CellState {
  row: number
  col: number
  status: CellStatus
  lastRequestTime: number
  processingTime?: number
}

export interface QueueMetrics {
  // Cell-based metrics (counts unique cells, not requests)
  totalCells: number
  exploredCells: number // Cells that have been checked (found + not_found)
  foundCells: number // Cells with path found
  notFoundCells: number // Cells with no path
  pendingCells: number
  processingCells: number
  idleCells: number

  // Request-based metrics (counts every hover request)
  totalRequests: number
  cacheHits: number

  // Timing
  averageProcessingTime: number
}

export type CellStateListener = (row: number, col: number, state: CellState) => void
export type MetricsListener = (metrics: QueueMetrics) => void

export class HoverQueueManager {
  private cellStates: Map<string, CellState> = new Map()
  private gridSize: { rows: number; cols: number } = { rows: 0, cols: 0 }

  private cellStateListeners: Set<CellStateListener> = new Set()
  private metricsListeners: Set<MetricsListener> = new Set()

  // Request-based counters
  private totalRequests = 0
  private cacheHits = 0
  private totalProcessingTime = 0
  private processedCount = 0

  private getCellKey(row: number, col: number): string {
    return `${row},${col}`
  }

  /**
   * Initialize or resize the grid
   */
  setGridSize(rows: number, cols: number): void {
    this.gridSize = { rows, cols }
    this.cellStates.clear()
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.cellStates.set(this.getCellKey(row, col), {
          row,
          col,
          status: "idle",
          lastRequestTime: 0,
        })
      }
    }
    this.notifyMetricsListeners()
  }

  /**
   * Get current grid size
   */
  getGridSize(): { rows: number; cols: number } {
    return { ...this.gridSize }
  }

  /**
   * Get cell state
   */
  getCellState(row: number, col: number): CellState | undefined {
    return this.cellStates.get(this.getCellKey(row, col))
  }

  /**
   * Get all cell states as a 2D array
   */
  getAllCellStates(): CellState[][] {
    const result: CellState[][] = []
    for (let row = 0; row < this.gridSize.rows; row++) {
      const rowStates: CellState[] = []
      for (let col = 0; col < this.gridSize.cols; col++) {
        const state = this.cellStates.get(this.getCellKey(row, col))
        if (state) {
          rowStates.push(state)
        }
      }
      result.push(rowStates)
    }
    return result
  }

  /**
   * Mark a cell as pending (hover started, calculation queued)
   * Only counts as new request, doesn't change cell metrics if already explored
   */
  markPending(row: number, col: number): void {
    const key = this.getCellKey(row, col)
    const existing = this.cellStates.get(key)
    if (!existing) return

    this.totalRequests++

    // Only change status if cell hasn't been explored yet
    if (existing.status === "idle") {
      const state: CellState = {
        ...existing,
        status: "pending",
        lastRequestTime: Date.now(),
      }
      this.cellStates.set(key, state)
      this.notifyCellStateListeners(row, col, state)
    }

    this.notifyMetricsListeners()
  }

  /**
   * Mark a cell as processing (calculation started)
   */
  markProcessing(row: number, col: number): void {
    const key = this.getCellKey(row, col)
    const existing = this.cellStates.get(key)
    if (!existing) return

    // Only change if pending
    if (existing.status === "pending") {
      const state: CellState = {
        ...existing,
        status: "processing",
      }
      this.cellStates.set(key, state)
      this.notifyCellStateListeners(row, col, state)
      this.notifyMetricsListeners()
    }
  }

  /**
   * Mark a cell as completed with result
   */
  markCompleted(row: number, col: number, found: boolean): void {
    const key = this.getCellKey(row, col)
    const existing = this.cellStates.get(key)
    if (!existing) return

    // Only update if not already in a final state
    if (existing.status === "pending" || existing.status === "processing") {
      const processingTime = Date.now() - existing.lastRequestTime
      const state: CellState = {
        ...existing,
        status: found ? "found" : "not_found",
        processingTime,
      }
      this.cellStates.set(key, state)
      this.totalProcessingTime += processingTime
      this.processedCount++
      this.notifyCellStateListeners(row, col, state)
      this.notifyMetricsListeners()
    }
  }

  /**
   * Mark a cell as cached hit (instant result from cache)
   */
  markCached(row: number, col: number, found: boolean): void {
    const key = this.getCellKey(row, col)
    const existing = this.cellStates.get(key)
    if (!existing) return

    this.totalRequests++
    this.cacheHits++

    // Only update cell status if it hasn't been explored yet
    if (existing.status === "idle" || existing.status === "pending") {
      const state: CellState = {
        ...existing,
        status: found ? "found" : "not_found",
        processingTime: 0,
      }
      this.cellStates.set(key, state)
      this.notifyCellStateListeners(row, col, state)
    }

    this.notifyMetricsListeners()
  }

  /**
   * Reset a cell back to idle (e.g., when mouse leaves before completion)
   */
  markIdle(row: number, col: number): void {
    const key = this.getCellKey(row, col)
    const existing = this.cellStates.get(key)
    if (!existing || existing.status === "idle") return

    // Only reset if currently pending or processing (not completed)
    if (existing.status === "pending" || existing.status === "processing") {
      const state: CellState = {
        ...existing,
        status: "idle",
      }
      this.cellStates.set(key, state)
      this.notifyCellStateListeners(row, col, state)
      this.notifyMetricsListeners()
    }
  }

  /**
   * Mark a cell as start point
   */
  markStart(row: number, col: number): void {
    const key = this.getCellKey(row, col)
    const existing = this.cellStates.get(key)
    if (!existing) return

    const state: CellState = {
      ...existing,
      status: "start",
    }
    this.cellStates.set(key, state)
    this.notifyCellStateListeners(row, col, state)
    this.notifyMetricsListeners()
  }

  /**
   * Mark a cell as goal point (overwrites previous status)
   */
  markGoal(row: number, col: number): void {
    const key = this.getCellKey(row, col)
    const existing = this.cellStates.get(key)
    if (!existing) return

    const state: CellState = {
      ...existing,
      status: "goal",
    }
    this.cellStates.set(key, state)
    this.notifyCellStateListeners(row, col, state)
    this.notifyMetricsListeners()
  }

  /**
   * Get current queue metrics
   */
  getMetrics(): QueueMetrics {
    let foundCells = 0
    let notFoundCells = 0
    let pendingCells = 0
    let processingCells = 0
    let idleCells = 0

    for (const state of this.cellStates.values()) {
      switch (state.status) {
        case "found":
          foundCells++
          break
        case "not_found":
          notFoundCells++
          break
        case "pending":
          pendingCells++
          break
        case "processing":
          processingCells++
          break
        case "idle":
          idleCells++
          break
        case "start":
        case "goal":
          // Start and goal cells are not counted in idle/explored metrics
          break
      }
    }

    const totalCells = this.gridSize.rows * this.gridSize.cols
    const exploredCells = foundCells + notFoundCells

    return {
      totalCells,
      exploredCells,
      foundCells,
      notFoundCells,
      pendingCells,
      processingCells,
      idleCells,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      averageProcessingTime:
        this.processedCount > 0 ? this.totalProcessingTime / this.processedCount : 0,
    }
  }

  /**
   * Subscribe to cell state changes
   */
  onCellStateChange(listener: CellStateListener): () => void {
    this.cellStateListeners.add(listener)
    return () => this.cellStateListeners.delete(listener)
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsChange(listener: MetricsListener): () => void {
    this.metricsListeners.add(listener)
    return () => this.metricsListeners.delete(listener)
  }

  /**
   * Reset all metrics and cell states
   */
  reset(): void {
    this.totalRequests = 0
    this.cacheHits = 0
    this.totalProcessingTime = 0
    this.processedCount = 0

    for (const [key, state] of this.cellStates) {
      const newState: CellState = {
        ...state,
        status: "idle",
        lastRequestTime: 0,
        processingTime: undefined,
      }
      this.cellStates.set(key, newState)
    }

    this.notifyMetricsListeners()
  }

  private notifyCellStateListeners(row: number, col: number, state: CellState): void {
    for (const listener of this.cellStateListeners) {
      listener(row, col, state)
    }
  }

  private notifyMetricsListeners(): void {
    const metrics = this.getMetrics()
    for (const listener of this.metricsListeners) {
      listener(metrics)
    }
  }
}
