FROM node:22-alpine AS builder

# Install OpenSSL for Prisma engine compatibility
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

# Copy root workspace and package files for Layer Caching
COPY package*.json ./
COPY packages/db/package*.json ./packages/db/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/configs/package*.json ./packages/configs/
COPY apps/web/package*.json ./apps/web/
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY services/auth-service/package*.json ./services/auth-service/
COPY services/wallet-service/package*.json ./services/wallet-service/

# Install dependencies fast using npm ci
RUN npm ci --prefer-offline --no-audit

# Copy packages and service source
COPY packages/db ./packages/db
COPY services/api-gateway ./services/api-gateway

# Generate Prisma Client
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build NestJS API Gateway
RUN npm run build --workspace=@trademind/api-gateway

# Production runner stage
FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package*.json ./

# Copy compiled files, node_modules, and package definitions
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/db ./packages/db
COPY --from=builder /usr/src/app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /usr/src/app/services/api-gateway/package.json ./services/api-gateway/package.json

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

# Run migrations gracefully and start API Gateway
CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma || true && npm run start --workspace=@trademind/api-gateway"]
