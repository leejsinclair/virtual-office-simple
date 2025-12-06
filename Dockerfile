# Multi-stage build for Virtual Office

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY virtual-office-frontend/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY virtual-office-frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:20-alpine AS backend-deps

WORKDIR /app/backend

# Copy backend package files
COPY package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Stage 3: Production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies for backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules

# Copy backend source
COPY index.js ./
COPY package*.json ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/.next ./virtual-office-frontend/.next
COPY --from=frontend-builder /app/frontend/public ./virtual-office-frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./virtual-office-frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./virtual-office-frontend/node_modules
COPY --from=frontend-builder /app/frontend/next.config.* ./virtual-office-frontend/

# Expose ports
EXPOSE 3000 4000

# Start both services
CMD ["sh", "-c", "node index.js & cd virtual-office-frontend && npm start"]

