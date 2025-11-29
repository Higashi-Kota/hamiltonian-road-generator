/**
 * Hamiltonian Road Generator - React UI Component
 *
 * This component handles all UI rendering and user interactions.
 * It delegates computation to the @hamiltonian/lib WASM module.
 */

import {
  type CellData,
  createEmptyGrid,
  findHamiltonianPath,
  type GridSize,
  getCellParity,
  hasDifferentParity,
  type Point,
  pathToRoadGrid,
  type RoadGrid,
} from "@hamiltonian/lib"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

// ============================================================================
// Types
// ============================================================================

type Mode = "start" | "end" | "done"

interface State {
  grid: RoadGrid
  path: Point[]
  previewPath: Point[]
  startPoint: Point | null
  endPoint: Point | null
  hoverPoint: Point | null
  mode: Mode
  status: string
  isCalculating: boolean
}

// ============================================================================
// UI Components
// ============================================================================

interface GridCellProps {
  row: number
  col: number
  cell: CellData | null
  isStart: boolean
  isEnd: boolean
  isHover: boolean
  isPreviewMode: boolean
  hasPreviewPath: boolean
  parity: number
  mode: Mode
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

const GridCell = React.memo(function GridCell({
  row,
  col,
  cell,
  isStart,
  isEnd,
  isHover,
  isPreviewMode,
  hasPreviewPath,
  parity,
  mode,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GridCellProps) {
  const cellClass = useMemo(() => {
    const classes = [
      "w-10 h-10 md:w-12 md:h-12 flex items-center justify-center",
      "border border-gray-300 cursor-pointer relative",
      "transition-all duration-100",
    ]

    if (!cell) {
      classes.push(parity === 0 ? "bg-white" : "bg-gray-100")
    }
    if (isStart) classes.push("ring-2 ring-inset ring-green-500")
    if (isEnd) classes.push("ring-2 ring-inset ring-red-500")
    if (isHover && !isStart) classes.push("ring-2 ring-inset ring-blue-400")
    if (mode === "end" && !isStart) classes.push("hover:bg-blue-50")
    if (mode === "start") classes.push("hover:bg-green-50")

    return classes.join(" ")
  }, [cell, parity, isStart, isEnd, isHover, mode])

  const strokeColor = isPreviewMode ? "#3b82f6" : "#1f2937"

  return (
    <button
      type='button'
      aria-label={`セル (${row}, ${col})${isStart ? " - 始点" : ""}${isEnd ? " - 終点" : ""}`}
      className={cellClass}
      style={{ backgroundColor: cell ? "#fff" : undefined }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Road tile SVG */}
      {cell && (
        <svg
          viewBox='0 0 100 100'
          aria-hidden='true'
          className={`w-full h-full absolute inset-0 ${isPreviewMode ? "opacity-60" : ""}`}
        >
          {cell.connections.includes("up") && (
            <line
              x1='50'
              y1='0'
              x2='50'
              y2='50'
              stroke={strokeColor}
              strokeWidth='8'
              strokeLinecap='round'
            />
          )}
          {cell.connections.includes("down") && (
            <line
              x1='50'
              y1='50'
              x2='50'
              y2='100'
              stroke={strokeColor}
              strokeWidth='8'
              strokeLinecap='round'
            />
          )}
          {cell.connections.includes("left") && (
            <line
              x1='0'
              y1='50'
              x2='50'
              y2='50'
              stroke={strokeColor}
              strokeWidth='8'
              strokeLinecap='round'
            />
          )}
          {cell.connections.includes("right") && (
            <line
              x1='50'
              y1='50'
              x2='100'
              y2='50'
              stroke={strokeColor}
              strokeWidth='8'
              strokeLinecap='round'
            />
          )}
          <circle cx='50' cy='50' r='4' fill={strokeColor} />
        </svg>
      )}

      {/* Start marker */}
      {isStart && (
        <div className='absolute inset-1 border-2 border-green-500 rounded flex items-center justify-center bg-green-50 bg-opacity-90 z-10'>
          <div className='text-center'>
            <div className='text-blue-500 text-lg'>&#9654;</div>
            <div className='text-xs text-green-600 font-bold'>START</div>
          </div>
        </div>
      )}

      {/* End marker (confirmed) */}
      {isEnd && mode === "done" && (
        <div className='absolute inset-1 border-2 border-red-500 rounded flex items-center justify-center bg-red-50 bg-opacity-90 z-10'>
          <div className='text-center'>
            <div className='text-red-500 text-lg'>&#9678;</div>
            <div className='text-xs text-red-600 font-bold'>GOAL</div>
          </div>
        </div>
      )}

      {/* Hover preview marker */}
      {isHover && mode === "end" && !isStart && (
        <div
          className={`absolute inset-1 border-2 rounded flex items-center justify-center z-10 ${
            hasPreviewPath
              ? "border-blue-500 bg-blue-50 bg-opacity-90"
              : "border-orange-500 bg-orange-50 bg-opacity-90"
          }`}
        >
          <div className='text-center'>
            <div className={hasPreviewPath ? "text-blue-500 text-lg" : "text-orange-500 text-lg"}>
              {hasPreviewPath ? "\u25CE" : "\u2715"}
            </div>
            <div
              className={`text-xs font-bold ${hasPreviewPath ? "text-blue-600" : "text-orange-600"}`}
            >
              {hasPreviewPath ? "GOAL?" : "不可"}
            </div>
          </div>
        </div>
      )}
    </button>
  )
})

interface ToolbarProps {
  gridSize: GridSize
  onResize: (rows: number, cols: number) => void
  onReset: () => void
  status: string
  isCalculating: boolean
  mode: Mode
}

function Toolbar({ gridSize, onResize, onReset, status, isCalculating, mode }: ToolbarProps) {
  return (
    <div className='flex items-center gap-3 p-3 bg-gray-100 border-b border-gray-300 shrink-0 flex-wrap'>
      <span className='text-gray-600 text-sm font-medium'>行:</span>
      <input
        type='number'
        min='2'
        max='15'
        value={gridSize.rows}
        onChange={(e) => onResize(parseInt(e.target.value, 10) || 2, gridSize.cols)}
        className='w-14 bg-white border border-gray-300 rounded px-2 py-1 text-sm'
      />
      <span className='text-gray-600 text-sm font-medium'>列:</span>
      <input
        type='number'
        min='2'
        max='20'
        value={gridSize.cols}
        onChange={(e) => onResize(gridSize.rows, parseInt(e.target.value, 10) || 2)}
        className='w-14 bg-white border border-gray-300 rounded px-2 py-1 text-sm'
      />

      <div className='w-px h-6 bg-gray-300 mx-2' />

      <button
        type='button'
        onClick={onReset}
        className='px-4 py-1.5 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300'
      >
        リセット
      </button>

      <div className='w-px h-6 bg-gray-300 mx-2' />

      <span
        className={`text-sm ${
          status.includes("完了")
            ? "text-green-600 font-medium"
            : status.includes("できません")
              ? "text-red-600 font-medium"
              : "text-gray-600"
        }`}
      >
        {status}
        {isCalculating && <span className='ml-2 text-blue-500'>計算中...</span>}
      </span>

      <div className='ml-auto text-xs text-gray-500'>
        {mode === "end" && "終点候補にホバーするとプレビュー表示"}
      </div>
    </div>
  )
}

interface FooterProps {
  gridSize: GridSize
  pathLength: number
  startPoint: Point | null
  endPoint: Point | null
  hoverPoint: Point | null
  mode: Mode
}

function Footer({ gridSize, pathLength, startPoint, endPoint, hoverPoint, mode }: FooterProps) {
  const parityInfo = useMemo(() => {
    const comparePoint = mode === "end" ? hoverPoint : endPoint
    if (!startPoint || !comparePoint) return null

    const isDifferent = hasDifferentParity(startPoint, comparePoint)
    return {
      isDifferent,
      text: isDifferent ? "異なる(推奨)" : "同じ(解なしの可能性)",
      className: isDifferent ? "text-green-600" : "text-orange-600",
    }
  }, [startPoint, endPoint, hoverPoint, mode])

  return (
    <div className='p-2 bg-gray-100 border-t border-gray-300 text-xs text-gray-500 text-center'>
      グリッド: {gridSize.rows}×{gridSize.cols} = {gridSize.rows * gridSize.cols}
      セル
      {pathLength > 0 && ` | 経路長: ${pathLength}`}
      {parityInfo && (
        <span className={parityInfo.className}>
          {" | "}パリティ: {parityInfo.text}
        </span>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

function createInitialState(gridSize: GridSize): State {
  return {
    grid: createEmptyGrid(gridSize),
    path: [],
    previewPath: [],
    startPoint: null,
    endPoint: null,
    hoverPoint: null,
    mode: "start",
    status: "始点を配置してください",
    isCalculating: false,
  }
}

// Debounce delay for hover calculations (ms)
const HOVER_DEBOUNCE_MS = 50

export default function HamiltonianRoadGenerator() {
  const [gridSize, setGridSize] = useState<GridSize>({ rows: 5, cols: 8 })
  const [state, setState] = useState<State>(() => createInitialState({ rows: 5, cols: 8 }))

  // Cache for computed paths to avoid recalculation
  const pathCacheRef = useRef<Map<string, Point[]>>(new Map())
  // Debounce timer ref
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Pending hover point for debounce
  const pendingHoverRef = useRef<Point | null>(null)

  const { grid, path, previewPath, startPoint, endPoint, hoverPoint, mode, status, isCalculating } =
    state

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleResize = useCallback((rows: number, cols: number) => {
    const r = Math.max(2, Math.min(15, rows))
    const c = Math.max(2, Math.min(20, cols))
    const newSize = { rows: r, cols: c }
    setGridSize(newSize)
    setState(createInitialState(newSize))
    // Clear cache when grid size changes
    pathCacheRef.current.clear()
  }, [])

  const handleReset = useCallback(() => {
    setState(createInitialState(gridSize))
    // Clear cache when resetting
    pathCacheRef.current.clear()
  }, [gridSize])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  const handleCellClick = useCallback(
    async (row: number, col: number) => {
      if (mode === "start") {
        // Clear cache when start point changes
        pathCacheRef.current.clear()
        setState((prev) => ({
          ...prev,
          startPoint: { row, col },
          endPoint: null,
          path: [],
          previewPath: [],
          grid: createEmptyGrid(gridSize),
          mode: "end",
          status: "終点を配置してください（ホバーでプレビュー）",
        }))
      } else if (mode === "end") {
        if (startPoint?.row === row && startPoint?.col === col) {
          setState((prev) => ({
            ...prev,
            status: "終点は始点と異なる位置に配置してください",
          }))
          return
        }

        // Use preview path if available, otherwise calculate
        let resultPath = previewPath
        if (previewPath.length === 0 || hoverPoint?.row !== row || hoverPoint?.col !== col) {
          if (!startPoint) return
          const result = findHamiltonianPath(startPoint, { row, col }, gridSize)
          resultPath = result.found ? result.path : []
        }

        if (resultPath.length > 0) {
          const roadGrid = pathToRoadGrid(resultPath, gridSize)
          setState((prev) => ({
            ...prev,
            path: resultPath,
            previewPath: [],
            grid: roadGrid,
            endPoint: { row, col },
            hoverPoint: null,
            mode: "done",
            status: `経路生成完了: ${resultPath.length}セル`,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            status: "この配置では一本道を生成できません",
          }))
        }
      }
    },
    [mode, startPoint, gridSize, previewPath, hoverPoint],
  )

  const handleCellHover = useCallback(
    (row: number, col: number) => {
      if (mode !== "end" || !startPoint) return
      if (startPoint.row === row && startPoint.col === col) {
        // Cancel any pending calculation
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current)
          hoverTimerRef.current = null
        }
        setState((prev) => ({
          ...prev,
          hoverPoint: null,
          previewPath: [],
          isCalculating: false,
        }))
        return
      }

      // Store pending hover point
      pendingHoverRef.current = { row, col }

      // Update hover point immediately for visual feedback
      setState((prev) => ({
        ...prev,
        hoverPoint: { row, col },
      }))

      // Check cache first
      const cacheKey = `${startPoint.row},${startPoint.col}-${row},${col}`
      const cachedPath = pathCacheRef.current.get(cacheKey)

      if (cachedPath !== undefined) {
        // Use cached result immediately
        setState((prev) => ({
          ...prev,
          previewPath: cachedPath,
          isCalculating: false,
        }))
        return
      }

      // Cancel previous debounce timer
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
      }

      // Show calculating indicator
      setState((prev) => ({
        ...prev,
        isCalculating: true,
      }))

      // Debounce the calculation
      hoverTimerRef.current = setTimeout(() => {
        // Verify we're still hovering the same cell
        const pending = pendingHoverRef.current
        if (!pending || pending.row !== row || pending.col !== col) {
          return
        }

        // Calculate path
        const result = findHamiltonianPath(startPoint, { row, col }, gridSize)
        const resultPath = result.found ? result.path : []

        // Cache the result
        pathCacheRef.current.set(cacheKey, resultPath)

        // Update state if still hovering same cell
        setState((prev) => {
          if (prev.hoverPoint?.row !== row || prev.hoverPoint?.col !== col) {
            return { ...prev, isCalculating: false }
          }
          return {
            ...prev,
            previewPath: resultPath,
            isCalculating: false,
          }
        })
      }, HOVER_DEBOUNCE_MS)
    },
    [mode, startPoint, gridSize],
  )

  const handleCellLeave = useCallback(() => {
    if (mode === "end") {
      // Cancel any pending calculation
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      pendingHoverRef.current = null
      setState((prev) => ({
        ...prev,
        hoverPoint: null,
        previewPath: [],
        isCalculating: false,
      }))
    }
  }, [mode])

  // ============================================================================
  // Computed Values
  // ============================================================================

  const previewGrid = useMemo(() => {
    if (previewPath.length === 0) return null
    return pathToRoadGrid(previewPath, gridSize)
  }, [previewPath, gridSize])

  const displayGrid = mode === "end" && previewGrid ? previewGrid : grid
  const displayPath = mode === "end" && previewPath.length > 0 ? previewPath : path
  const isPreviewMode = mode === "end" && previewPath.length > 0

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className='h-screen w-screen bg-white flex flex-col overflow-hidden'>
      <Toolbar
        gridSize={gridSize}
        onResize={handleResize}
        onReset={handleReset}
        status={status}
        isCalculating={isCalculating}
        mode={mode}
      />

      <div className='flex-1 flex items-center justify-center p-4 overflow-auto bg-gray-50'>
        <div
          className='inline-grid border border-gray-400'
          style={{ gridTemplateColumns: `repeat(${gridSize.cols}, 1fr)` }}
        >
          {Array(gridSize.rows)
            .fill(null)
            .map((_, rowIdx) =>
              Array(gridSize.cols)
                .fill(null)
                .map((_, colIdx) => (
                  <GridCell
                    key={`cell-${rowIdx}-${colIdx}`}
                    row={rowIdx}
                    col={colIdx}
                    cell={displayGrid[rowIdx]?.[colIdx] ?? null}
                    isStart={startPoint?.row === rowIdx && startPoint?.col === colIdx}
                    isEnd={endPoint?.row === rowIdx && endPoint?.col === colIdx}
                    isHover={hoverPoint?.row === rowIdx && hoverPoint?.col === colIdx}
                    isPreviewMode={isPreviewMode}
                    hasPreviewPath={previewPath.length > 0}
                    parity={getCellParity(rowIdx, colIdx)}
                    mode={mode}
                    onClick={() => handleCellClick(rowIdx, colIdx)}
                    onMouseEnter={() => handleCellHover(rowIdx, colIdx)}
                    onMouseLeave={handleCellLeave}
                  />
                )),
            )}
        </div>
      </div>

      <Footer
        gridSize={gridSize}
        pathLength={displayPath.length}
        startPoint={startPoint}
        endPoint={endPoint}
        hoverPoint={hoverPoint}
        mode={mode}
      />
    </div>
  )
}
