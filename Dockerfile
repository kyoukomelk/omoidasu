# Stage 1: Build the React frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY package.json ./
COPY frontend/package.json ./frontend/
RUN npm install && npm install --prefix frontend
COPY frontend/ ./frontend/
RUN npm run build

# Stage 2: Final runner image
FROM node:22-slim
WORKDIR /app

# Install dependencies needed by SQLite (usually python/make/g++ for building, but prebuilt binary should work; debian slim is safe)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --only=production

COPY server.js ./
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port and configure database volume path
EXPOSE 8080
ENV PORT=8080
ENV DB_PATH=/app/data/sync.db
VOLUME /app/data

CMD ["node", "server.js"]
