# Base build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy root workspace and package files
COPY package*.json ./
COPY packages/db/package*.json ./packages/db/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/configs/package*.json ./packages/configs/
COPY apps/web/package*.json ./apps/web/
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/auth-service/package*.json ./services/auth-service/
COPY services/wallet-service/package*.json ./services/wallet-service/

# Install all dependencies (hoisted to root node_modules automatically)
RUN npm ci

# Copy packages and service source
COPY packages/db ./packages/db
COPY services/api-gateway ./services/api-gateway

# Generate Prisma Client (builds to root node_modules/.prisma/client)
RUN npm run db:generate --workspace=packages/db

# Build the NestJS API Gateway
RUN npm run build --workspace=@trademind/api-gateway

# Production runner stage
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package config for workspace mapping
COPY package*.json ./

# Copy compiled files, node_modules (including Prisma client), and package definitions
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/db ./packages/db
COPY --from=builder /usr/src/app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /usr/src/app/services/api-gateway/package.json ./services/api-gateway/package.json

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

# Run migrations and start API Gateway
CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && npm run start --workspace=@trademind/api-gateway"]
