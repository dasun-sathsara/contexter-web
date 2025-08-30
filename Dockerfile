# Stage 1: Build the WebAssembly module
FROM rust:1-slim as wasm-builder

# Install curl and wasm-pack (Rust-generated WebAssembly tool)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sSfL https://rustwasm.github.io/wasm-pack/installer/init.sh | sh -s -- -f

# Ensure Cargo bin is on PATH for subsequent steps
ENV PATH="/root/.cargo/bin:/usr/local/cargo/bin:${PATH}"

WORKDIR /app

# Copy only the wasm source and build it. 
COPY ./wasm ./wasm
RUN wasm-pack build ./wasm --target web --out-dir pkg


# Stage 2: Build the Next.js application
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Copy the compiled WASM package from the first stage
COPY --from=wasm-builder /app/wasm/pkg ./wasm/pkg

# Set a build-time argument for the Next.js public host
ARG NEXT_PUBLIC_HOST

# Build the Next.js application. The `copy-wasm` script is run automatically by the build command.
RUN npm run build


# Stage 3: Production Image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output from the builder stage.
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./

# Copy the public and static assets
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Set the host and port for the server
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["node", "server.js"]
