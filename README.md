# 🔐 VCEL - Verifiable Credential Event Listener

A containerized TypeScript/NestJS service that listens to Ethereum blockchain events, verifies Verifiable Credentials (VCs), caches results in SQLite, and can run on NFC-enabled IoT hardware.

## 🎯 Overview

VCEL (Verifiable Credential Event Listener) is a hexagonal architecture-based application designed for flexibility and portability. It can operate in three distinct modes:

- **API Mode**: REST API server for credential verification and event querying
- **NFC Mode**: NFC card reader integration (future implementation)
- **IoT Mode**: Edge device operation with MQTT synchronization

## 🏗️ Architecture

### Hexagonal (Ports & Adapters) Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                         Adapters Layer                       │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │   REST   │      │   NFC    │      │   IoT    │          │
│  │   API    │      │  Reader  │      │   Edge   │          │
│  └────┬─────┘      └────┬─────┘      └────┬─────┘          │
└───────┼─────────────────┼─────────────────┼────────────────┘
        │                 │                 │
┌───────┼─────────────────┼─────────────────┼────────────────┐
│       │           Core Domain Layer       │                │
│  ┌────▼────────────────────────────────────▼─────┐         │
│  │  CredentialVerifierService                    │         │
│  │  BlockchainListenerService                    │         │
│  │  Domain Entities (CredentialEvent, VC)        │         │
│  └───────────────────────────────────────────────┘         │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│                  Infrastructure Layer                       │
│  ┌─────────┐  ┌──────────┐  ┌─────────────┐               │
│  │ SQLite  │  │  Config  │  │   MQTT      │               │
│  │Database │  │ Module   │  │ Messaging   │               │
│  └─────────┘  └──────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── core/                       # Business logic (framework-agnostic)
│   ├── entities/
│   │   ├── credential-event.entity.ts
│   │   └── verifiable-credential.entity.ts
│   ├── credential-verifier.service.ts
│   └── blockchain-listener.service.ts
│
├── adapters/                   # Input/Output ports
│   ├── rest/                   # REST API adapter
│   │   ├── controllers/
│   │   │   ├── verify.controller.ts
│   │   │   ├── events.controller.ts
│   │   │   └── health.controller.ts
│   │   └── dto/
│   ├── nfc/                    # NFC adapter (placeholder)
│   │   └── nfc-adapter.service.ts
│   └── iot/                    # IoT adapter
│       └── iot-adapter.service.ts
│
├── infra/                      # Technical services
│   ├── database/               # SQLite with TypeORM
│   │   ├── entities/
│   │   ├── credential-event.repository.ts
│   │   └── database.module.ts
│   ├── config/                 # Configuration management
│   │   └── config.module.ts
│   └── messaging/              # MQTT for IoT mode
│       └── messaging.service.ts
│
├── app.module.ts               # Root module
└── main.ts                     # Bootstrap application
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **npm** or **yarn**
- **Docker** (optional, for containerized deployment)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd access-control-lock
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
MODE=API
PORT=3000
NODE_ENV=development

# Ethereum Configuration
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
START_BLOCK=0

# Database
DATABASE_PATH=./data/vcel.db
```

4. **Run in development mode**

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1`

### Using Docker

1. **Build and run with Docker Compose**

```bash
docker-compose up -d
```

2. **View logs**

```bash
docker-compose logs -f vcel-api
```

## 📡 API Endpoints

### Health Check

```bash
GET /api/v1/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-10-19T10:00:00.000Z",
  "mode": "API"
}
```

### Verify Credential

```bash
POST /api/v1/verify
Content-Type: application/json

{
  "credential": "<JWT or JSON-LD credential>",
  "storeResult": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "verified": true,
    "results": [
      {
        "check": "format",
        "status": "success",
        "message": "Valid credential format"
      },
      {
        "check": "cryptographic_verification",
        "status": "success",
        "message": "Signature verified"
      }
    ],
    "verifiedAt": "2024-10-19T10:00:00.000Z"
  }
}
```

### Query Events

```bash
GET /api/v1/events?limit=10&offset=0
GET /api/v1/events?credentialId=<id>
GET /api/v1/events?holder=<address>
```

### Get Listener Status

```bash
GET /api/v1/events/status
```

### Get Unverified Events

```bash
GET /api/v1/events/unverified?limit=100
```

## 🔧 Operation Modes

### API Mode (Default)

REST API server for credential verification.

```bash
MODE=API npm run start:dev
```

**Features:**
- ✅ REST API endpoints
- ✅ Ethereum event listening
- ✅ SQLite caching
- ✅ Credential verification

### IoT Mode

Edge device operation with MQTT synchronization.

```bash
MODE=IOT npm run start:prod
```

**Features:**
- ✅ All API mode features
- ✅ MQTT messaging
- ✅ Background event verification
- ✅ Cloud synchronization
- ✅ Offline operation support

**MQTT Topics:**
- `vcel/events/issued` - Published when credentials are issued
- `vcel/events/revoked` - Published when credentials are revoked
- `vcel/commands/verify` - Subscribe for verification requests
- `vcel/commands/sync` - Subscribe for sync commands
- `vcel/results/verify` - Publish verification results

### NFC Mode (Planned)

NFC card reader integration for physical credential verification.

```bash
MODE=NFC npm run start:prod
```

**Planned Features:**
- 🔜 NFC reader initialization
- 🔜 NDEF message reading
- 🔜 Credential extraction from NFC tags
- 🔜 Real-time verification

## 🛠️ Development

### Project Scripts

```bash
# Development
npm run start:dev          # Start with watch mode
npm run start:debug        # Start with debug mode

# Production
npm run build              # Build the project
npm run start:prod         # Run production build

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run tests with coverage

# Code Quality
npm run lint               # Lint code
npm run format             # Format code with Prettier
```

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- src/infra/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 🔐 Security Considerations

1. **DID Resolution**: Uses `did-resolver` with `ethr-did-resolver` for Ethereum-based DIDs
2. **Signature Verification**: Cryptographic proof verification using `did-jwt-vc`
3. **Expiration Checks**: Validates credential expiration dates
4. **Issuer Verification**: Resolves and validates issuer DID documents

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS (TypeScript) |
| Blockchain | ethers.js v6 |
| Database | SQLite + TypeORM |
| VC Verification | did-jwt-vc, @digitalbazaar/vc |
| DID Resolution | did-resolver, ethr-did-resolver |
| Messaging | MQTT (for IoT mode) |
| Container | Docker + Docker Compose |

## 🚢 Deployment

### Docker Deployment

The project includes multi-stage Dockerfile optimized for both **AMD64** and **ARM64** architectures (Raspberry Pi compatible).

```bash
# Build for current architecture
docker build -t vcel:latest .

# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t vcel:latest .

# Run container
docker run -d \
  --name vcel \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  vcel:latest
```

### IoT Deployment (Raspberry Pi)

1. **Copy project to device**

```bash
scp -r . pi@raspberrypi.local:/home/pi/vcel
```

2. **SSH and configure**

```bash
ssh pi@raspberrypi.local
cd /home/pi/vcel
cp .env.example .env
nano .env  # Configure for IoT mode
```

3. **Run with Docker**

```bash
docker-compose up -d
```

## 🔄 Evolution Roadmap

### ✅ Phase 1: MVP (Current)
- REST API
- Ethereum event listener
- SQLite caching
- Credential verification

### 🔜 Phase 2: NFC Integration
- NFC reader support (PN532, ACR122U)
- NDEF message parsing
- Physical credential verification
- Offline credential storage

### 🔜 Phase 3: IoT Edge
- Complete MQTT integration
- Edge runtime optimization
- Offline synchronization
- Multi-device mesh networking

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Contact

For questions and support, please open an issue in the GitHub repository.

---

**Built with ❤️ using Hexagonal Architecture and NestJS**
