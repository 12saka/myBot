# TradeMind AI (2026 Edition) — Monorepo Ecosystem

TradeMind AI is an enterprise-grade, multi-agent financial intelligence and automated trading ecosystem designed for high performance, real-time market data streaming, and advanced risk limit observation.

## 🚀 Repository Architecture

The codebase is organized as a unified npm workspace monorepo:

```
├── apps/
│   └── web/                # Next.js 16 (App Router, Tailwind CSS v4, Framer Motion)
├── services/
│   ├── api-gateway/        # NestJS API Gateway (REST v2, ioredis, Swagger documentation)
│   └── ai-service/         # FastAPI Python AI Service (FinBERT predictions, Copilot Chat agent)
├── packages/
│   └── db/                 # Shared Prisma Client and Database Schema
├── docker-compose.yml      # Local Postgres 16 & Redis 8 container services
└── package.json            # Monorepo Workspace configuration
```

---

## 🛠️ Prerequisites

Make sure you have the following installed locally:
- [Node.js v20+](https://nodejs.org/)
- [Docker & Docker Compose](https://www.docker.com/)
- [Python 3.11+](https://www.python.org/)

---

## 💻 Setup & Development

### 1. Setup Environments
Create your local environment parameters by copying the example files:
```bash
cp .env.example .env
```
Ensure database connections point to your Docker Postgres parameters.

### 2. Install Workspace Dependencies
From the root of the project, install all frontend, gateway, and packages dependencies simultaneously:
```bash
npm install
```

### 3. Spin up Database Services
Launch Postgres 16 and Redis 8 locally using Docker Compose:
```bash
docker-compose up -d
```

### 4. Apply Database Migrations
Initialize Prisma schema mappings and generate your typings:
```bash
npm run prisma:generate --workspace=@trademind/db
npm run prisma:migrate --workspace=@trademind/db
```

### 5. Launch Services
Run the entire suite of services in concurrent hot-reload development environments:
- **Next.js Web Client** (Port 3000):
  ```bash
  npm run dev --workspace=@trademind/web
  ```
- **NestJS API Gateway** (Port 4000):
  ```bash
  npm run dev --workspace=@trademind/api-gateway
  ```
- **FastAPI AI Service** (Port 8000):
  Make sure you activate your python virtualenv first:
  ```bash
  cd services/ai-service
  python -m venv .venv
  source .venv/bin/activate  # On Windows: .venv\Scripts\activate
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
  ```

---

## 🔐 Authentication & Security Protocols

TradeMind AI enforces the following security workflows:
- **Resend Email API** for email verification delivery.
- **Africa's Talking WhatsApp Business API** for 2FA/SMS mobile passcode delivery.
- **5-Minute OTP Passcodes**: Passcodes are hashed with `bcryptjs` and stored inside Redis under a strict 5-minute TTL.
- **Security Audits**: Upon any password changes, all active user session tokens are immediately purged from Redis to force logout other devices.
