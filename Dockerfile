# Multi-stage build for Hamiltonian Road Generator
# Stage 1: Rust WASM Builder
FROM rust:1.86-slim AS rust-builder

# Install system dependencies for Rust/WASM build
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

WORKDIR /app

# Copy Rust toolchain configuration
COPY rust-toolchain.toml ./

# Add WASM target
RUN rustup target add wasm32-unknown-unknown

# Copy WASM crate files
COPY packages/crates/hamiltonian-wasm/Cargo.toml packages/crates/hamiltonian-wasm/Cargo.lock ./packages/crates/hamiltonian-wasm/
COPY packages/crates/hamiltonian-wasm/src/ ./packages/crates/hamiltonian-wasm/src/

# Build WASM package
RUN wasm-pack build packages/crates/hamiltonian-wasm \
    --target web \
    --release \
    --out-dir pkg

# Stage 2: Node.js Builder
FROM node:22-slim AS node-builder

# Install pnpm
RUN npm install -g pnpm@10

WORKDIR /app

# Copy package configuration files first (for better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/editor-app/package.json ./apps/editor-app/
COPY packages/lib/package.json ./packages/lib/
COPY packages/shared-config/package.json ./packages/shared-config/
COPY packages/crates/hamiltonian-wasm/package.json ./packages/crates/hamiltonian-wasm/

# Copy shared configuration
COPY packages/shared-config/ ./packages/shared-config/
COPY tsconfig.json biome.json ./

# Copy WASM package from rust-builder stage
COPY --from=rust-builder /app/packages/crates/hamiltonian-wasm/pkg/ ./packages/crates/hamiltonian-wasm/pkg/

# Install dependencies
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Copy source code
COPY packages/lib/ ./packages/lib/
COPY apps/editor-app/ ./apps/editor-app/

# Build packages
RUN pnpm --filter @hamiltonian/lib build && \
    pnpm --filter @hamiltonian/editor-app build

# Stage 3: Production Runtime (minimal static file server)
FROM node:22-alpine AS runtime

# Install serve only (no extra packages needed for static file serving)
RUN npm install -g serve@14 && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs appuser

WORKDIR /app

# Copy built static files only
COPY --from=node-builder --chown=appuser:nodejs /app/apps/editor-app/dist/ ./dist/

USER appuser

EXPOSE 3000

# Simple health check using Node.js (no curl/wget needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["serve", "-s", "dist", "-l", "3000"]
