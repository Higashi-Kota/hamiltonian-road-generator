//! Hamiltonian Path Finder - Rust WASM Implementation
//!
//! This module provides a high-performance implementation of the Hamiltonian path
//! finding algorithm optimized for WebAssembly deployment.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// パニック時のスタックトレースをより分かりやすくする
fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ============================================================================
// Type Definitions
// ============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Point {
    pub row: i32,
    pub col: i32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GridSize {
    pub rows: i32,
    pub cols: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathResult {
    pub found: bool,
    pub path: Vec<Point>,
    pub iterations: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellData {
    pub connections: Vec<String>,
    pub path_index: usize,
}

// ============================================================================
// Constants
// ============================================================================

const DIRECTIONS: [(i32, i32, &str); 4] = [
    (-1, 0, "up"),
    (1, 0, "down"),
    (0, -1, "left"),
    (0, 1, "right"),
];

// ============================================================================
// Core Algorithm Implementation
// ============================================================================

/// Check if position is within grid bounds
#[inline]
fn is_in_bounds(row: i32, col: i32, grid_size: &GridSize) -> bool {
    row >= 0 && row < grid_size.rows && col >= 0 && col < grid_size.cols
}

/// Get cell parity (checkerboard pattern)
#[inline]
fn get_cell_parity(row: i32, col: i32) -> i32 {
    (row + col) % 2
}

/// Get unvisited neighboring cells
fn get_unvisited_neighbors(
    row: i32,
    col: i32,
    grid_size: &GridSize,
    visited: &[Vec<bool>],
) -> Vec<(i32, i32, &'static str)> {
    let mut neighbors = Vec::with_capacity(4);

    for &(dr, dc, dir) in &DIRECTIONS {
        let nr = row + dr;
        let nc = col + dc;

        if is_in_bounds(nr, nc, grid_size) && !visited[nr as usize][nc as usize] {
            neighbors.push((nr, nc, dir));
        }
    }

    neighbors
}

/// Count unvisited neighbors (optimized - no allocation)
#[inline]
fn count_unvisited_neighbors(row: i32, col: i32, grid_size: &GridSize, visited: &[Vec<bool>]) -> u8 {
    let mut count = 0u8;
    for &(dr, dc, _) in &DIRECTIONS {
        let nr = row + dr;
        let nc = col + dc;
        if is_in_bounds(nr, nc, grid_size) && !visited[nr as usize][nc as usize] {
            count += 1;
        }
    }
    count
}

/// Sort neighbors using Warnsdorff's heuristic (optimized with cached counts)
fn sort_by_warnsdorff(
    neighbors: &mut Vec<(i32, i32, &'static str)>,
    target: &Point,
    grid_size: &GridSize,
    visited: &[Vec<bool>],
) {
    // Cache neighbor counts before sorting to avoid repeated calculations
    let mut neighbors_with_counts: Vec<((i32, i32, &'static str), u8)> = neighbors
        .iter()
        .map(|&n| {
            let is_target = n.0 == target.row && n.1 == target.col;
            let count = if is_target {
                u8::MAX // Target always sorted last
            } else {
                count_unvisited_neighbors(n.0, n.1, grid_size, visited)
            };
            (n, count)
        })
        .collect();

    // Sort by cached count (fewer neighbors first, target last)
    neighbors_with_counts.sort_by_key(|(_, count)| *count);

    // Update original vector
    for (i, (neighbor, _)) in neighbors_with_counts.into_iter().enumerate() {
        neighbors[i] = neighbor;
    }
}

/// Check if remaining unvisited cells are connected (optimized version)
/// Uses a more efficient approach: instead of collecting all unvisited cells first,
/// we do a single BFS/DFS and count reachable cells.
fn is_remaining_connected(
    grid_size: &GridSize,
    visited: &[Vec<bool>],
    unvisited_count: usize,
) -> bool {
    if unvisited_count <= 1 {
        return true;
    }

    // Find first unvisited cell
    let mut start: Option<(i32, i32)> = None;
    'outer: for r in 0..grid_size.rows {
        for c in 0..grid_size.cols {
            if !visited[r as usize][c as usize] {
                start = Some((r, c));
                break 'outer;
            }
        }
    }

    let start = match start {
        Some(s) => s,
        None => return true,
    };

    // DFS using stack (faster than BFS for connectivity check)
    // Use a flat visited array for BFS to avoid HashSet overhead
    let rows = grid_size.rows as usize;
    let cols = grid_size.cols as usize;
    let mut bfs_visited = vec![false; rows * cols];
    let mut stack = Vec::with_capacity(unvisited_count);
    let mut reachable_count = 0usize;

    stack.push(start);
    bfs_visited[start.0 as usize * cols + start.1 as usize] = true;

    while let Some((r, c)) = stack.pop() {
        reachable_count += 1;

        // Early exit: if we've found enough cells, we're connected
        if reachable_count == unvisited_count {
            return true;
        }

        for &(dr, dc, _) in &DIRECTIONS {
            let nr = r + dr;
            let nc = c + dc;

            if is_in_bounds(nr, nc, grid_size) {
                let idx = nr as usize * cols + nc as usize;
                if !visited[nr as usize][nc as usize] && !bfs_visited[idx] {
                    bfs_visited[idx] = true;
                    stack.push((nr, nc));
                }
            }
        }
    }

    reachable_count == unvisited_count
}

/// Check if a cell is an articulation point (removing it disconnects the graph)
/// This is a lighter-weight check that can be used before the full connectivity check
#[inline]
fn is_likely_articulation_point(
    row: i32,
    col: i32,
    grid_size: &GridSize,
    visited: &[Vec<bool>],
) -> bool {
    // Count unvisited neighbors
    let neighbor_count = count_unvisited_neighbors(row, col, grid_size, visited);

    // If cell has 0 or 1 unvisited neighbor, it's not an articulation point
    // (it's either isolated or a leaf)
    if neighbor_count <= 1 {
        return false;
    }

    // Quick heuristic: corner and edge cells with 2+ unvisited neighbors
    // are less likely to be articulation points
    let is_corner = (row == 0 || row == grid_size.rows - 1)
        && (col == 0 || col == grid_size.cols - 1);
    if is_corner && neighbor_count == 2 {
        return false;
    }

    // For cells with 3+ neighbors in the interior, they might be articulation points
    // This is a heuristic - we'll do the full check for these
    neighbor_count >= 2
}

/// Main Hamiltonian path finding algorithm
fn find_hamiltonian_path_internal(
    start: Point,
    end: Point,
    grid_size: GridSize,
    max_iterations: u32,
) -> PathResult {
    // Validation: same start and end
    if start == end {
        return PathResult {
            found: false,
            path: vec![],
            iterations: 0,
        };
    }

    let total_cells = (grid_size.rows * grid_size.cols) as usize;

    // Early exit: parity check for even-sized grids
    // In a checkerboard pattern, a Hamiltonian path alternates between black and white cells.
    // For even-sized grids, start and end must have different parities.
    // For odd-sized grids, start and end must have the same parity.
    let start_parity = get_cell_parity(start.row, start.col);
    let end_parity = get_cell_parity(end.row, end.col);
    let is_even_grid = total_cells % 2 == 0;

    if is_even_grid && start_parity == end_parity {
        // Even grid with same parity endpoints: impossible
        return PathResult {
            found: false,
            path: vec![],
            iterations: 0,
        };
    }

    if !is_even_grid && start_parity != end_parity {
        // Odd grid with different parity endpoints: impossible
        return PathResult {
            found: false,
            path: vec![],
            iterations: 0,
        };
    }
    let mut visited = vec![vec![false; grid_size.cols as usize]; grid_size.rows as usize];
    let mut result_path: Vec<Point> = Vec::new();
    let mut found = false;
    let mut iterations: u32 = 0;

    // Recursive backtracking with unvisited count tracking
    fn backtrack(
        path: &mut Vec<Point>,
        end: &Point,
        grid_size: &GridSize,
        visited: &mut [Vec<bool>],
        unvisited_count: usize,
        max_iterations: u32,
        iterations: &mut u32,
        found: &mut bool,
        result_path: &mut Vec<Point>,
    ) {
        if *found || *iterations > max_iterations {
            return;
        }
        *iterations += 1;

        let current = *path.last().unwrap();

        // Success: visited all cells and reached endpoint
        if unvisited_count == 0 {
            if current == *end {
                *found = true;
                *result_path = path.clone();
            }
            return;
        }

        // Pruning: reached endpoint too early
        if current == *end {
            return;
        }

        // Get and sort neighbors
        let mut neighbors = get_unvisited_neighbors(current.row, current.col, grid_size, visited);
        sort_by_warnsdorff(&mut neighbors, end, grid_size, visited);

        for (nr, nc, _) in neighbors {
            let is_endpoint = nr == end.row && nc == end.col;

            visited[nr as usize][nc as usize] = true;
            let new_unvisited = unvisited_count - 1;

            // Pruning: check connectivity only when necessary
            // Skip check if moving to endpoint (it doesn't need further connections)
            // Also skip if only 1-2 cells remain (always connected or trivially checkable)
            let should_check_connectivity = !is_endpoint
                && new_unvisited > 2
                && is_likely_articulation_point(nr, nc, grid_size, visited);

            if should_check_connectivity && !is_remaining_connected(grid_size, visited, new_unvisited)
            {
                visited[nr as usize][nc as usize] = false;
                continue;
            }

            path.push(Point { row: nr, col: nc });

            backtrack(
                path,
                end,
                grid_size,
                visited,
                new_unvisited,
                max_iterations,
                iterations,
                found,
                result_path,
            );

            if *found {
                return;
            }

            path.pop();
            visited[nr as usize][nc as usize] = false;
        }
    }

    // Start backtracking
    visited[start.row as usize][start.col as usize] = true;
    let mut path = vec![start];
    let initial_unvisited = total_cells - 1; // We've visited the start cell

    backtrack(
        &mut path,
        &end,
        &grid_size,
        &mut visited,
        initial_unvisited,
        max_iterations,
        &mut iterations,
        &mut found,
        &mut result_path,
    );

    PathResult {
        found,
        path: result_path,
        iterations,
    }
}

/// Convert path to road grid with connection data
fn path_to_road_grid_internal(path: &[Point], grid_size: &GridSize) -> Vec<Vec<Option<CellData>>> {
    let mut grid: Vec<Vec<Option<CellData>>> =
        vec![vec![None; grid_size.cols as usize]; grid_size.rows as usize];

    if path.is_empty() {
        return grid;
    }

    for (i, current) in path.iter().enumerate() {
        let mut connections = Vec::new();

        // Connection to previous cell
        if i > 0 {
            let prev = &path[i - 1];
            if prev.row < current.row {
                connections.push("up".to_string());
            } else if prev.row > current.row {
                connections.push("down".to_string());
            } else if prev.col < current.col {
                connections.push("left".to_string());
            } else if prev.col > current.col {
                connections.push("right".to_string());
            }
        }

        // Connection to next cell
        if i < path.len() - 1 {
            let next = &path[i + 1];
            if next.row < current.row {
                connections.push("up".to_string());
            } else if next.row > current.row {
                connections.push("down".to_string());
            } else if next.col < current.col {
                connections.push("left".to_string());
            } else if next.col > current.col {
                connections.push("right".to_string());
            }
        }

        grid[current.row as usize][current.col as usize] = Some(CellData {
            connections,
            path_index: i,
        });
    }

    grid
}

// ============================================================================
// WASM Exports
// ============================================================================

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    set_panic_hook();
}

/// Find Hamiltonian path - WASM entry point
#[wasm_bindgen]
pub fn find_hamiltonian_path(
    start_row: i32,
    start_col: i32,
    end_row: i32,
    end_col: i32,
    grid_rows: i32,
    grid_cols: i32,
    max_iterations: u32,
) -> JsValue {
    let start = Point {
        row: start_row,
        col: start_col,
    };
    let end = Point {
        row: end_row,
        col: end_col,
    };
    let grid_size = GridSize {
        rows: grid_rows,
        cols: grid_cols,
    };

    let result = find_hamiltonian_path_internal(start, end, grid_size, max_iterations);

    serde_wasm_bindgen::to_value(&result).unwrap()
}

/// Convert path to road grid - WASM entry point
#[wasm_bindgen]
pub fn path_to_road_grid(path_js: JsValue, grid_rows: i32, grid_cols: i32) -> JsValue {
    let path: Vec<Point> = serde_wasm_bindgen::from_value(path_js).unwrap_or_default();
    let grid_size = GridSize {
        rows: grid_rows,
        cols: grid_cols,
    };

    let grid = path_to_road_grid_internal(&path, &grid_size);

    serde_wasm_bindgen::to_value(&grid).unwrap()
}

/// Get cell parity - WASM entry point
#[wasm_bindgen]
pub fn cell_parity(row: i32, col: i32) -> i32 {
    get_cell_parity(row, col)
}

/// Check if two points have different parity - WASM entry point
#[wasm_bindgen]
pub fn has_different_parity(r1: i32, c1: i32, r2: i32, c2: i32) -> bool {
    get_cell_parity(r1, c1) != get_cell_parity(r2, c2)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_2x2_grid() {
        // (0,0) -> (0,1) : different parity (0 vs 1)
        let result = find_hamiltonian_path_internal(
            Point { row: 0, col: 0 },
            Point { row: 0, col: 1 },
            GridSize { rows: 2, cols: 2 },
            100000,
        );
        assert!(result.found);
        assert_eq!(result.path.len(), 4);
    }

    #[test]
    fn test_3x3_grid() {
        // 3x3 grid (odd cells) allows same parity endpoints
        let result = find_hamiltonian_path_internal(
            Point { row: 0, col: 0 },
            Point { row: 2, col: 2 },
            GridSize { rows: 3, cols: 3 },
            100000,
        );
        assert!(result.found);
        assert_eq!(result.path.len(), 9);
    }

    #[test]
    fn test_same_parity_even_grid_fails() {
        let result = find_hamiltonian_path_internal(
            Point { row: 0, col: 0 },
            Point { row: 0, col: 2 },
            GridSize { rows: 2, cols: 4 },
            100000,
        );
        assert!(!result.found);
    }

    #[test]
    fn test_parity() {
        assert_eq!(get_cell_parity(0, 0), 0);
        assert_eq!(get_cell_parity(0, 1), 1);
        assert_eq!(get_cell_parity(1, 0), 1);
        assert_eq!(get_cell_parity(1, 1), 0);
    }
}
