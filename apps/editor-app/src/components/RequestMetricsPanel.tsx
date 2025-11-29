/**
 * RequestMetricsPanel - Canvas-based minimap visualization for cell states
 * Displays a mini-grid mirroring the main grid with colored circles for each cell status
 */

import type { CellState, CellStatus, QueueMetrics } from "@hamiltonian/lib"
import React, { useCallback, useEffect, useRef } from "react"

interface RequestMetricsPanelProps {
  metrics: QueueMetrics
  cellStates: CellState[][]
  gridSize: { rows: number; cols: number }
}

// Color constants for cell status (circle fill colors)
const STATUS_COLORS: Record<CellStatus, string> = {
  idle: "#E5E7EB", // gray-200
  pending: "#FBBF24", // yellow-400
  processing: "#3B82F6", // blue-500
  found: "#22C55E", // green-500
  not_found: "#F87171", // red-400
  start: "#F472B6", // pink-400
  goal: "#8B5CF6", // violet-500
}

// Darker stroke colors for circles
const STATUS_STROKE_COLORS: Record<CellStatus, string> = {
  idle: "#D1D5DB", // gray-300
  pending: "#F59E0B", // yellow-500
  processing: "#2563EB", // blue-600
  found: "#16A34A", // green-600
  not_found: "#EF4444", // red-500
  start: "#EC4899", // pink-500
  goal: "#7C3AED", // violet-600
}

// Minimap component using Canvas
const CellStateMinimap = React.memo(function CellStateMinimap({
  cellStates,
  gridSize,
}: {
  cellStates: CellState[][]
  gridSize: { rows: number; cols: number }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || gridSize.rows === 0 || gridSize.cols === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Get container dimensions
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Calculate cell size to fit within container while maintaining aspect ratio
    const padding = 8
    const availableWidth = containerWidth - padding * 2
    const availableHeight = containerHeight - padding * 2

    // Calculate cell size based on grid dimensions
    const cellWidth = availableWidth / gridSize.cols
    const cellHeight = availableHeight / gridSize.rows
    const cellSize = Math.min(cellWidth, cellHeight, 20) // Max cell size 20px

    // Calculate actual grid dimensions
    const gridWidth = cellSize * gridSize.cols
    const gridHeight = cellSize * gridSize.rows

    // Center the grid
    const offsetX = (containerWidth - gridWidth) / 2
    const offsetY = (containerHeight - gridHeight) / 2

    // Set canvas size with device pixel ratio for sharpness
    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = "#F9FAFB" // gray-50
    ctx.fillRect(0, 0, containerWidth, containerHeight)

    // Draw grid background
    ctx.fillStyle = "#FFFFFF"
    ctx.strokeStyle = "#E5E7EB"
    ctx.lineWidth = 1
    ctx.fillRect(offsetX, offsetY, gridWidth, gridHeight)
    ctx.strokeRect(offsetX, offsetY, gridWidth, gridHeight)

    // Calculate circle radius (slightly smaller than cell)
    const circleRadius = cellSize * 0.4

    // Draw cells as circles
    for (let row = 0; row < gridSize.rows; row++) {
      const rowStates = cellStates[row]
      if (!rowStates) continue

      for (let col = 0; col < gridSize.cols; col++) {
        const state = rowStates[col]
        if (!state) continue

        const centerX = offsetX + col * cellSize + cellSize / 2
        const centerY = offsetY + row * cellSize + cellSize / 2

        // Draw circle
        ctx.beginPath()
        ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)

        // Fill
        ctx.fillStyle = STATUS_COLORS[state.status]
        ctx.fill()

        // Stroke
        ctx.strokeStyle = STATUS_STROKE_COLORS[state.status]
        ctx.lineWidth = 1
        ctx.stroke()

        // Add pulse effect for processing cells
        if (state.status === "processing") {
          ctx.beginPath()
          ctx.arc(centerX, centerY, circleRadius + 2, 0, Math.PI * 2)
          ctx.strokeStyle = "rgba(59, 130, 246, 0.3)"
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }
  }, [cellStates, gridSize])

  // Redraw on changes
  useEffect(() => {
    draw()
  }, [draw])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      draw()
    })
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [draw])

  // Animation frame for processing pulse
  useEffect(() => {
    const hasProcessing = cellStates.some((row) => row.some((cell) => cell.status === "processing"))
    if (!hasProcessing) return

    let animationId: number
    const animate = () => {
      draw()
      animationId = requestAnimationFrame(animate)
    }
    animationId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationId)
  }, [cellStates, draw])

  return (
    <div ref={containerRef} className='w-full h-full min-h-[120px]'>
      <canvas ref={canvasRef} className='w-full h-full' />
    </div>
  )
})

// Progress bar component
const ProgressBar = React.memo(function ProgressBar({
  current,
  total,
  label,
  color,
}: {
  current: number
  total: number
  label: string
  color: string
}) {
  const percentage = total > 0 ? (current / total) * 100 : 0

  return (
    <div className='space-y-1'>
      <div className='flex justify-between text-xs text-gray-600'>
        <span>{label}</span>
        <span className='font-mono'>
          {current}/{total}
        </span>
      </div>
      <div className='h-1.5 bg-gray-200 rounded-full overflow-hidden'>
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
})

export default function RequestMetricsPanel({
  metrics,
  cellStates,
  gridSize,
}: RequestMetricsPanelProps) {
  const exploredPercentage =
    metrics.totalCells > 0 ? Math.round((metrics.exploredCells / metrics.totalCells) * 100) : 0

  return (
    <div className='h-full flex flex-col bg-gray-50 border-l border-gray-300'>
      {/* Header */}
      <div className='px-3 py-2 border-b border-gray-200 bg-white shrink-0'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>Cell States</span>
          <span className='text-xs font-mono text-gray-500'>
            {metrics.exploredCells}/{metrics.totalCells} ({exploredPercentage}%)
          </span>
        </div>
      </div>

      {/* Minimap - takes available vertical space */}
      <div className='flex-1 p-3 min-h-0'>
        <CellStateMinimap cellStates={cellStates} gridSize={gridSize} />
      </div>

      {/* Legend */}
      <div className='px-3 py-2 border-t border-gray-200 bg-white shrink-0'>
        <div className='flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-600'>
          <div className='flex items-center gap-1'>
            <div
              className='w-2.5 h-2.5 rounded-full'
              style={{ backgroundColor: STATUS_COLORS.start }}
            />
            <span>Start</span>
          </div>
          <div className='flex items-center gap-1'>
            <div
              className='w-2.5 h-2.5 rounded-full'
              style={{ backgroundColor: STATUS_COLORS.goal }}
            />
            <span>Goal</span>
          </div>
          <div className='flex items-center gap-1'>
            <div
              className='w-2.5 h-2.5 rounded-full'
              style={{ backgroundColor: STATUS_COLORS.idle }}
            />
            <span>Idle</span>
          </div>
          <div className='flex items-center gap-1'>
            <div
              className='w-2.5 h-2.5 rounded-full'
              style={{ backgroundColor: STATUS_COLORS.pending }}
            />
            <span>Pending</span>
          </div>
          <div className='flex items-center gap-1'>
            <div
              className='w-2.5 h-2.5 rounded-full'
              style={{ backgroundColor: STATUS_COLORS.processing }}
            />
            <span>Processing</span>
          </div>
          <div className='flex items-center gap-1'>
            <div
              className='w-2.5 h-2.5 rounded-full'
              style={{ backgroundColor: STATUS_COLORS.found }}
            />
            <span>Found</span>
          </div>
          <div className='flex items-center gap-1'>
            <div
              className='w-2.5 h-2.5 rounded-full'
              style={{ backgroundColor: STATUS_COLORS.not_found }}
            />
            <span>Not Found</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className='px-3 py-3 border-t border-gray-200 bg-white shrink-0 space-y-3'>
        {/* Exploration progress */}
        <ProgressBar
          current={metrics.exploredCells}
          total={metrics.totalCells}
          label='Explored Cells'
          color='bg-blue-500'
        />

        {/* Cell breakdown */}
        <div className='grid grid-cols-2 gap-x-4 gap-y-1 text-xs'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1.5'>
              <div
                className='w-2 h-2 rounded-full'
                style={{ backgroundColor: STATUS_COLORS.found }}
              />
              <span className='text-gray-600'>Found</span>
            </div>
            <span className='font-mono font-medium text-green-600'>{metrics.foundCells}</span>
          </div>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-1.5'>
              <div
                className='w-2 h-2 rounded-full'
                style={{ backgroundColor: STATUS_COLORS.not_found }}
              />
              <span className='text-gray-600'>Not Found</span>
            </div>
            <span className='font-mono font-medium text-red-500'>{metrics.notFoundCells}</span>
          </div>
        </div>

        {/* Request stats */}
        <div className='pt-2 border-t border-gray-100 space-y-1'>
          <div className='flex justify-between text-xs'>
            <span className='text-gray-500'>Total Requests</span>
            <span className='font-mono'>{metrics.totalRequests}</span>
          </div>
          <div className='flex justify-between text-xs'>
            <span className='text-gray-500'>Cache Hits</span>
            <span className='font-mono text-purple-600'>{metrics.cacheHits}</span>
          </div>
          <div className='flex justify-between text-xs'>
            <span className='text-gray-500'>Avg Time</span>
            <span className='font-mono'>
              {metrics.averageProcessingTime > 0
                ? `${Math.round(metrics.averageProcessingTime)}ms`
                : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
