# The website image: Next.js "standalone" output, a small Node server with only the files it needs.

# --- 1. Install packages -------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- 2. Build -------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# These are fixed into the build:
#   API_URL: where the Next.js server finds the API inside Docker's network
#   NEXT_PUBLIC_REALTIME_WEBSOCKET=1: Caddy forwards WebSockets, so browsers can use them
ARG API_URL=http://api:4000
ARG NEXT_PUBLIC_REALTIME_WEBSOCKET=1
ARG MAX_UPLOAD_MB=100
ENV API_URL=$API_URL \
    MAX_UPLOAD_MB=$MAX_UPLOAD_MB \
    NEXT_PUBLIC_REALTIME_WEBSOCKET=$NEXT_PUBLIC_REALTIME_WEBSOCKET \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- 3. Run ---------------------------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
