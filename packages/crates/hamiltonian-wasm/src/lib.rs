//! Hamiltonian Path Finder - Rust WASM Implementation
//!
//! This module provides a high-performance implementation of the Hamiltonian path
//! finding algorithm optimized for WebAssembly deployment.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
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

/// Sort neighbors using Warnsdorff's heuristic
fn sort_by_warnsdorff(
    neighbors: &mut Vec<(i32, i32, &'static str)>,
    target: &Point,
    grid_size: &GridSize,
    visited: &[Vec<bool>],
) {
    neighbors.sort_by(|a, b| {
        let a_is_target = a.0 == target.row && a.1 == target.col;
        let b_is_target = b.0 == target.row && b.1 == target.col;

        // Keep target for last
        match (a_is_target, b_is_target) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => {
                // Sort by number of unvisited neighbors (fewer first)
                let a_count = get_unvisited_neighbors(a.0, a.1, grid_size, visited).len();
                let b_count = get_unvisited_neighbors(b.0, b.1, grid_size, visited).len();
                a_count.cmp(&b_count)
            }
        }
    });
}

/// Check if remaining unvisited cells are connected
fn is_remaining_connected(grid_size: &GridSize, visited: &[Vec<bool>]) -> bool {
    // Collect unvisited cells
    let mut unvisited: Vec<Point> = Vec::new();
    for r in 0..grid_size.rows {
        for c in 0..grid_size.cols {
            if !visited[r as usize][c as usize] {
                unvisited.push(Point { row: r, col: c });
            }
        }
    }

    if unvisited.len() <= 1 {
        return true;
    }

    // BFS from first unvisited cell
    let mut reachable: HashSet<(i32, i32)> = HashSet::new();
    let mut queue: Vec<Point> = vec![unvisited[0]];
    reachable.insert((unvisited[0].row, unvisited[0].col));

    while let Some(current) = queue.pop() {
        for &(dr, dc, _) in &DIRECTIONS {
            let nr = current.row + dr;
            let nc = current.col + dc;

            if is_in_bounds(nr, nc, grid_size)
                && !visited[nr as usize][nc as usize]
                && !reachable.contains(&(nr, nc))
            {
                reachable.insert((nr, nc));
                queue.push(Point { row: nr, col: nc });
            }
        }
    }

    reachable.len() == unvisited.len()
}

/// Main Hamiltonian path finding algorithm
fn find_hamiltonian_path_internal(
    start: Point,
    end: Point,
    grid_size: GridSize,
    max_iterations: u32,
) -> PathResult {
    // Validation
    if start == end {
        return PathResult {
            found: false,
            path: vec![],
            iterations: 0,
        };
    }

    let total_cells = (grid_size.rows * grid_size.cols) as usize;
    let mut visited = vec![vec![false; grid_size.cols as usize]; grid_size.rows as usize];
    let mut result_path: Vec<Point> = Vec::new();
    let mut found = false;
    let mut iterations: u32 = 0;

    // Recursive backtracking
    fn backtrack(
        path: &mut Vec<Point>,
        end: &Point,
        grid_size: &GridSize,
        visited: &mut [Vec<bool>],
        total_cells: usize,
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
        if path.len() == total_cells {
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

            // Pruning: check connectivity
            if !is_endpoint && !is_remaining_connected(grid_size, visited) {
                visited[nr as usize][nc as usize] = false;
                continue;
            }

            path.push(Point { row: nr, col: nc });

            backtrack(
                path,
                end,
                grid_size,
                visited,
                total_cells,
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

    backtrack(
        &mut path,
        &end,
        &grid_size,
        &mut visited,
        total_cells,
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
