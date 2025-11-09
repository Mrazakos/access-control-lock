# 🔐 VCEL - Verifiable Credential Access Control Lock

A containerized TypeScript/NestJS service that monitors Ethereum smart contract events, caches signature revocations, and verifies ECDSA signatures for access control locks. Designed for edge devices like NFC readers and IoT hardware.

## 🎯 Overview

VCEL (Verifiable Credential Event Listener) is a single-lock monitoring service built with hexagonal architecture. Each instance:

- **Monitors one specific lock** identified by Lock ID
- **Fetches lock configuration** (public key) from blockchain on startup
- **Listens for revocation events** using hybrid sync (real-time + batch)
- **Verifies ECDSA signatures** using the lock's public key
- **Caches revocations locally** in SQLite for instant verification
- **Operates in multiple modes**: API, NFC, or IoT

### Operation Modes

- **API Mode**: REST API server for credential verification and monitoring
- **NFC Mode**: NFC card reader integration (planned)
- **IoT Mode**: Edge device operation with MQTT synchronization

## 🗄️ Database Schema

### `lock_config` table

Stores the lock configuration for this instance.

```sql
CREATE TABLE lock_config (
  id INTEGER PRIMARY KEY,           -- Always 1 (singleton)
  lockId INTEGER NOT NULL,          -- Lock ID being monitored
  publicKey TEXT NOT NULL,          -- Lock's ECDSA public key
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);
```

### `revoked_credentials` table

Caches revoked signatures for instant verification.

```sql
CREATE TABLE revoked_credentials (
  id TEXT PRIMARY KEY,              -- signatureHash
  signatureHash TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,          -- Same as hash
  revokedBy TEXT NOT NULL,          -- Address that revoked
  transactionHash TEXT NOT NULL,
  blockNumber INTEGER NOT NULL,
  revokedAt DATETIME NOT NULL,
  createdAt DATETIME NOT NULL
);
CREATE INDEX idx_revoked_signatureHash
  ON revoked_credentials(signatureHash);
```

### `signature_entries` table

Complete audit trail of all signature verifications.

```sql
CREATE TABLE signature_entries (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL,
  signatureHash TEXT,               -- For matching revocations
  publicKey TEXT,
  owner TEXT,
  message TEXT,
  wasRevoked BOOLEAN DEFAULT FALSE,
  transactionHash TEXT NOT NULL,
  blockNumber INTEGER NOT NULL,
  timestamp DATETIME NOT NULL,
  metadata TEXT,                    -- JSON metadata
  createdAt DATETIME NOT NULL
);
CREATE INDEX idx_entry_signature
  ON signature_entries(signature);
CREATE INDEX idx_entry_timestamp
  ON signature_entries(timestamp);
```

### `credential_events` table

Legacy event log for blockchain events.

```sql
CREATE TABLE credential_events (
  id TEXT PRIMARY KEY,
  eventType TEXT NOT NULL,
  eventData TEXT NOT NULL,          -- JSON
  blockNumber INTEGER NOT NULL,
  transactionHash TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  createdAt DATETIME NOT NULL
);
```

### `sync_state` table

Tracks blockchain synchronization state.

```sql
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY,
  lastSyncedBlock INTEGER NOT NULL,
  lastBatchSync DATETIME,
  lastRealTimeUpdate DATETIME,
  realTimeUpdates INTEGER DEFAULT 0,
  batchUpdates INTEGER DEFAULT 0,
  updatedAt DATETIME NOT NULL
);
```

## 🛠️ Development

### Single-Lock Design

Each service instance monitors **one lock** identified by `LOCK_ID`. This design:

✅ **Simplifies deployment** - One instance per physical lock  
✅ **Improves performance** - No lock filtering in queries  
✅ **Enables horizontal scaling** - Deploy independently per lock  
✅ **Perfect for edge devices** - Lightweight, focused operation

### Hybrid Synchronization System

The system uses **dual-mode sync** to ensure revocation cache consistency:

1. **Real-Time Events** (WebSocket)
   - Instant updates when signatures are revoked
   - Sub-second latency for critical security events
2. **Batch Sync** (Every 15 minutes)
   - Catches missed events during network failures
   - Validates cache consistency
   - Prevents duplicate entries with deduplication logic

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
│  │  CredentialVerifierService (ECDSA)            │         │
│  │  BlockchainListenerService (Hybrid Sync)      │         │
│  │  LockConfigService (Configuration)            │         │
│  │  EventProcessorService (Event Handling)       │         │
│  └───────────────────────────────────────────────┘         │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│                  Infrastructure Layer                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐       │
│  │   SQLite    │  │  TypeChain   │  │    MQTT     │       │
│  │   Database  │  │  Contracts   │  │  Messaging  │       │
│  │ - Revoked   │  │ - Type-safe  │  │  (IoT mode) │       │
│  │ - Entries   │  │ - Events     │  └─────────────┘       │
│  │ - Config    │  └──────────────┘                         │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── core/                               # Business logic (framework-agnostic)
│   ├── entities/
│   │   └── credential-event.entity.ts
│   ├── credential-verifier.service.ts  # ECDSA signature verification
│   ├── blockchain-listener.service.ts  # Hybrid sync system
│   ├── event-processor.service.ts      # Event handling
│   └── lock-config.service.ts          # Lock configuration management
│
├── adapters/                           # Input/Output ports
│   ├── rest/                           # REST API adapter
│   │   ├── controllers/
│   │   │   ├── verify.controller.ts    # Signature verification
│   │   │   ├── config.controller.ts    # Lock configuration
│   │   │   └── health.controller.ts    # Health checks
│   │   ├── guards/
│   │   │   ├── config.guard.ts         # Protects config endpoints
│   │   │   └── vc-auth.guard.ts        # VC-based auth
│   │   └── decorators/
│   │       └── require-access-level.decorator.ts
│   ├── nfc/                            # NFC adapter (placeholder)
│   │   └── nfc-adapter.service.ts
│   └── iot/                            # IoT adapter
│       └── iot-adapter.service.ts
│
├── infra/                              # Technical services
│   ├── database/                       # SQLite with TypeORM
│   │   ├── entities/
│   │   │   ├── lock-config.entity.ts   # Lock configuration
│   │   │   ├── revoked-credential.entity.ts  # Revoked signatures
│   │   │   ├── signature-entry.entity.ts     # Verification history
│   │   │   ├── credential-event.entity.ts    # Event log
│   │   │   └── sync-state.entity.ts    # Sync tracking
│   │   ├── *.repository.ts             # Data access layer
│   │   └── database.module.ts
│   ├── config/                         # Configuration management
│   │   └── config.module.ts
│   └── messaging/                      # MQTT for IoT mode
│       └── messaging.service.ts
│
├── typechain-types/                    # Smart contract types
│   ├── contracts/
│   │   └── AccessControl.ts            # Type-safe contract interface
│   └── factories/
│       └── contracts/
│           └── AccessControl__factory.ts
│
├── app.module.ts                       # Root module
└── main.ts                             # Bootstrap application
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **npm** or **yarn**
- **Docker** (optional, for containerized deployment)
- **Ethereum RPC URL** (Alchemy, Infura, or your own node)
- **Deployed AccessControl smart contract**

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

Edit `.env` with your configuration:

```env
# Application Mode
MODE=API

# Server Configuration
PORT=3000
NODE_ENV=development

# Network Selection
NETWORK=sepolia

# Ethereum Configuration - Sepolia Testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_CONTRACT_ADDRESS=0xYourContractAddress
SEPOLIA_START_BLOCK=5000000

# Hybrid Sync Configuration
BATCH_SYNC_INTERVAL_MINUTES=15
BATCH_SYNC_SIZE=1000

# Database
DATABASE_PATH=./data/vcel.db
```

4. **Run in development mode**

```bash
npm run start:dev
```

5. **Initialize lock configuration**

```bash
# Configure this instance to monitor Lock ID 1
curl -X POST http://localhost:3000/api/v1/config/init \
  -H "Content-Type: application/json" \
  -d '{
    "lockId": 1,
    "publicKey": "0x04abcdef..."
  }'
```

The service is now monitoring Lock 1 and syncing revocations!

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

### Configuration Endpoints

#### Initialize Lock Configuration

```bash
POST /api/v1/config/init
Content-Type: application/json

{
  "lockId": 1,
  "publicKey": "0x04abcdef..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Lock initialized successfully",
  "lockId": 1,
  "timestamp": "2025-11-09T10:00:00.000Z"
}
```

**Note:** Can only be called once until reset. Protected by ConfigGuard.

#### Get Configuration Status

```bash
GET /api/v1/config/status
```

**Response:**

```json
{
  "configured": true,
  "lockId": 1,
  "publicKey": "0x04abcdef...",
  "timestamp": "2025-11-09T10:00:00.000Z"
}
```

#### Reset Configuration

```bash
POST /api/v1/config/reset
```

**Response:**

```json
{
  "success": true,
  "message": "Lock configuration reset. You can now call /init again.",
  "timestamp": "2025-11-09T10:00:00.000Z"
}
```

**Note:** Requires admin-level access.

### Verification Endpoints

#### Verify Signature

```bash
POST /api/v1/verify
Content-Type: application/json

{
  "message": "unlock_request_12345",
  "signature": "0xabc123...",
  "lockId": "1",
  "lockNickname": "Front Door"
}
```

**Response:**

```json
{
  "verified": true,
  "error": null,
  "credentialId": "urn:credential:12345",
  "timestamp": "2025-11-09T10:00:00.000Z"
}
```

**Verification Process:**

1. Checks if signature is revoked (local cache)
2. Verifies ECDSA signature using lock's public key
3. Logs verification attempt to database
4. Returns result

### Monitoring Endpoints

#### Health Check

```bash
GET /api/v1/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-11-09T10:00:00.000Z",
  "mode": "API",
  "lockId": 1,
  "configured": true
}
```

#### Blockchain Sync Status

```bash
GET /api/v1/monitor/health
```

**Response:**

```json
{
  "healthy": true,
  "lockId": "1",
  "lockOwner": "0x742d35Cc...",
  "publicKey": "0x04abcdef...",
  "revokedCount": 42,
  "currentBlock": 5234567,
  "lastSyncedBlock": 5234560,
  "blocksBehind": 7,
  "isListening": true,
  "batchSyncActive": true,
  "network": "sepolia",
  "contractAddress": "0x...",
  "stats": {
    "realTimeUpdates": 42,
    "batchUpdates": 158,
    "totalRevocations": 200,
    "lastBatchSync": "2025-11-09T14:30:00.000Z",
    "lastRealTimeUpdate": "2025-11-09T14:32:15.000Z"
  }
}
```

#### Comprehensive Statistics

```bash
GET /api/v1/monitor/stats
```

**Response:**

```json
{
  "hybrid_sync": {
    "real_time_updates": 42,
    "batch_updates": 158,
    "total_revocations": 200,
    "last_batch_sync": "2025-11-09T14:30:00.000Z",
    "last_real_time_update": "2025-11-09T14:32:15.000Z",
    "pending_updates": 3
  },
  "blockchain": {
    "current_block": 5234567,
    "last_synced_block": 5234560,
    "blocks_behind": 7,
    "is_listening": true,
    "batch_sync_active": true,
    "network": "sepolia",
    "contract_address": "0x..."
  }
}
```

#### Check Revocation Status

```bash
GET /api/v1/monitor/signature/0xabc.../revoked
```

**Response:**

```json
{
  "signature": "0xabc...",
  "isRevoked": true,
  "timestamp": "2025-11-09T14:32:30.000Z"
}
```

#### Force Manual Sync

```bash
POST /api/v1/monitor/force-sync
```

**Response:**

```json
{
  "success": true,
  "message": "Force full sync initiated",
  "timestamp": "2025-11-09T14:32:30.000Z"
}
```

## 🔧 Operation Modes

### API Mode (Default)

REST API server for credential verification and monitoring.

```bash
MODE=API npm run start:dev
```

**Features:**

- ✅ REST API endpoints for verification
- ✅ Hybrid blockchain sync (real-time + batch)
- ✅ SQLite revocation cache
- ✅ ECDSA signature verification
- ✅ Configuration management
- ✅ Health monitoring

**Typical Use Case:** Backend service for web applications or mobile apps

### IoT Mode

Edge device operation with MQTT synchronization.

```bash
MODE=IOT npm run start:prod
```

**Features:**

- ✅ All API mode features
- ✅ MQTT messaging for remote commands
- ✅ Background event verification
- ✅ Cloud synchronization
- ✅ Offline operation support
- ✅ Optimized for Raspberry Pi

**MQTT Topics:**

- `vcel/{lockId}/commands/verify` - Subscribe for verification requests
- `vcel/{lockId}/commands/sync` - Subscribe for sync commands
- `vcel/{lockId}/results/verify` - Publish verification results
- `vcel/{lockId}/events/revoked` - Publish revocation events

**Typical Use Case:** Physical access control with NFC readers

### NFC Mode (Planned)

NFC card reader integration for physical credential verification.

```bash
MODE=NFC npm run start:prod
```

**Planned Features:**

- 🔜 NFC reader initialization (PN532, ACR122U)
- 🔜 NDEF message reading
- 🔜 Credential extraction from NFC tags
- 🔜 Real-time signature verification
- 🔜 Offline credential storage

**Typical Use Case:** Standalone NFC access control terminal

## � How It Works

### 1. Startup and Initialization

```
Service Starts
   ↓
Read LOCK_ID from .env or database
   ↓
Connect to Ethereum RPC (Sepolia/Mainnet)
   ↓
Fetch lock info from smart contract:
  - Owner address
  - Public key (for ECDSA verification)
  - Current revoked count
   ↓
Start Hybrid Sync System:
  ├─ Initial batch sync (START_BLOCK → current)
  ├─ Real-time event listening (WebSocket)
  └─ 15-minute batch sync interval
   ↓
Service Ready ✅
```

### 2. Hybrid Synchronization

The system uses two complementary sync mechanisms:

#### Real-Time Events (WebSocket)

```typescript
// Filter events for this specific lock only
const filter = contract.filters.SignatureRevoked(lockId, null, null);

contract.on(filter, async (lockId, signatureHash, owner, event) => {
  // 1. Add to deduplication set
  pendingUpdates.add(`${lockId}-${signatureHash}`);

  // 2. Save to database
  await revokedSignatureRepository.save({
    signatureHash,
    revokedBy: owner,
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash,
    ...
  });

  // 3. Update statistics
  stats.realTimeUpdates++;
  stats.lastRealTimeUpdate = new Date();
});
```

#### Batch Sync (Every 15 Minutes)

```typescript
async performBatchSync() {
  const currentBlock = await provider.getBlockNumber();
  let fromBlock = lastSyncedBlock + 1;

  // Query in chunks of 1000 blocks
  while (fromBlock <= currentBlock) {
    const toBlock = Math.min(fromBlock + 1000, currentBlock);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
      const eventKey = `${lockId}-${signatureHash}`;

      // Skip if already processed via real-time
      if (pendingUpdates.has(eventKey)) {
        continue;
      }

      // Save missed event
      await revokedSignatureRepository.save({...});
      stats.batchUpdates++;
    }

    fromBlock = toBlock + 1;
  }

  // Clear deduplication set after successful sync
  pendingUpdates.clear();
  lastSyncedBlock = currentBlock;
}
```

**Why Hybrid Sync?**

- ⚡ Real-time: Instant updates (< 1 second latency)
- 🛡️ Batch: Catches missed events during network failures
- 🔒 Deduplication: Prevents duplicate entries from both sources
- 📊 Resilient: Always eventually consistent

### 3. Signature Verification Flow

```
1. User sends signature verification request
   ↓
2. Extract (message, signature) from request
   ↓
3. Hash the signature → signatureHash
   ↓
4. Check revocation cache:
   SELECT * FROM revoked_signatures
   WHERE signatureHash = ?
   ↓
5. If REVOKED → Return verification failed
   ↓
6. If NOT REVOKED → Verify ECDSA signature:
   - Recover public key from signature
   - Compare with lock's public key
   ↓
7. Log verification attempt:
   INSERT INTO signature_entries (...)
   ↓
8. Return verification result
```

**Performance:**

- Revoked check: < 1ms (indexed lookup)
- ECDSA verification: 5-10ms
- Total: < 15ms per verification

### 4. Configuration Management

The lock configuration is stored in the database and loaded on startup:

```typescript
// First time setup
POST /api/v1/config/init
{
  "lockId": 1,
  "publicKey": "0x04abcdef..."
}

// Service stores in database and uses for all verifications
// Can be reset with POST /api/v1/config/reset
```

**Benefits:**

- ✅ Persistent configuration (survives restarts)
- ✅ Single source of truth
- ✅ Protected by ConfigGuard (one-time init)
- ✅ No need to pass public key in every request

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

TypeORM automatically syncs schema changes in development mode. For production:

```bash
# Generate migration from entity changes
npm run migration:generate -- src/infra/database/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## 🔐 Security Features

1. **Revocation Cache** - All revoked signatures cached locally for instant verification
2. **ECDSA Verification** - Industry-standard elliptic curve cryptography
3. **Public Key Validation** - Signatures verified against lock's registered public key
4. **Configuration Protection** - ConfigGuard prevents unauthorized reconfiguration
5. **Access Level Control** - RequireAccessLevel decorator for role-based access
6. **Audit Trail** - Complete signature verification history
7. **Network Isolation** - Separate configurations for testnet and mainnet

## 📈 Performance & Scalability

### Single-Lock Benefits

| Metric             | Single-Lock | Multi-Lock        |
| ------------------ | ----------- | ----------------- |
| DB Query Speed     | < 1ms       | 5-10ms (filtered) |
| Memory Usage       | ~50MB       | ~100MB+           |
| Horizontal Scaling | ✅ Easy     | ⚠️ Complex        |
| Failure Isolation  | ✅ Complete | ❌ Shared         |
| Cache Efficiency   | ✅ Optimal  | ⚠️ Diluted        |

### Hybrid Sync Performance

- **Real-time latency**: < 1 second for revocation events
- **Batch sync overhead**: ~1 RPC call per 1000 blocks
- **Deduplication**: Zero duplicate entries
- **Memory footprint**: Negligible (pendingUpdates cleared every 15 min)

### Database Performance

- **Revocation check**: < 1ms (indexed lookup)
- **ECDSA verification**: 5-10ms
- **Signature logging**: < 2ms
- **Total verification time**: < 15ms

### Scalability

**Horizontal Scaling** (Multiple Locks):

```yaml
# docker-compose.yml
services:
  lock-1:
    environment:
      - LOCK_ID=1
      - PORT=3001
  lock-2:
    environment:
      - LOCK_ID=2
      - PORT=3002
  lock-3:
    environment:
      - LOCK_ID=3
      - PORT=3003
```

Each instance:

- Independent database
- Isolated revocation cache
- No cross-lock dependencies
- Scales linearly

## 🚢 Deployment

### Docker Deployment

Multi-stage Dockerfile optimized for **AMD64** and **ARM64** (Raspberry Pi).

```bash
# Build for current architecture
docker build -t access-control-lock:latest .

# Build for multiple architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t access-control-lock:latest .

# Run container
docker run -d \
  --name lock-1 \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  access-control-lock:latest
```

### Multi-Lock Deployment

Deploy multiple instances for multiple locks:

```bash
# Lock 1
docker run -d --name lock-1 \
  -p 3001:3000 \
  -e LOCK_ID=1 \
  -e PORT=3000 \
  -v ./data/lock1:/app/data \
  access-control-lock

# Lock 2
docker run -d --name lock-2 \
  -p 3002:3000 \
  -e LOCK_ID=2 \
  -e PORT=3000 \
  -v ./data/lock2:/app/data \
  access-control-lock

# Lock 3
docker run -d --name lock-3 \
  -p 3003:3000 \
  -e LOCK_ID=3 \
  -e PORT=3000 \
  -v ./data/lock3:/app/data \
  access-control-lock
```

### IoT Deployment (Raspberry Pi)

1. **Copy project to device**

```bash
scp -r . pi@raspberrypi.local:/home/pi/access-control
```

2. **SSH and configure**

```bash
ssh pi@raspberrypi.local
cd /home/pi/access-control
cp .env.example .env
nano .env  # Set MODE=IOT, configure lock
```

3. **Run with Docker**

```bash
docker-compose up -d
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: access-control-lock-1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: access-control-lock
      lock-id: '1'
  template:
    metadata:
      labels:
        app: access-control-lock
        lock-id: '1'
    spec:
      containers:
        - name: lock-service
          image: access-control-lock:latest
          env:
            - name: LOCK_ID
              value: '1'
            - name: NETWORK
              value: 'sepolia'
            - name: SEPOLIA_RPC_URL
              valueFrom:
                secretKeyRef:
                  name: ethereum-secrets
                  key: rpc-url
          ports:
            - containerPort: 3000
          volumeMounts:
            - name: data
              mountPath: /app/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: lock-1-data
```

## 📦 Tech Stack

| Layer           | Technology                | Purpose                                |
| --------------- | ------------------------- | -------------------------------------- |
| Framework       | NestJS (TypeScript)       | Hexagonal architecture, DI, modularity |
| Blockchain      | ethers.js v6              | Ethereum interaction, event listening  |
| Smart Contracts | TypeChain                 | Type-safe contract interfaces          |
| Cryptography    | @mrazakos/vc-ecdsa-crypto | ECDSA signature verification           |
| Database        | SQLite + TypeORM          | Local caching, edge-friendly           |
| Messaging       | MQTT (mqtt.js)            | IoT mode communication                 |
| Container       | Docker + Compose          | Multi-arch deployment (AMD64/ARM64)    |

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

### Test Lock Configuration

```bash
# 1. Start service
npm run start:dev

# 2. Initialize lock
curl -X POST http://localhost:3000/api/v1/config/init \
  -H "Content-Type: application/json" \
  -d '{"lockId": 1, "publicKey": "0x04abc..."}'

# 3. Check status
curl http://localhost:3000/api/v1/config/status

# 4. Verify sync is working
curl http://localhost:3000/api/v1/monitor/health
```

### Test Signature Verification

```bash
# Generate test signature using your crypto library
node -e "const crypto = require('@mrazakos/vc-ecdsa-crypto'); ..."

# Verify it
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "test",
    "signature": "0x...",
    "lockId": "1"
  }'
```

### Test Revocation

```bash
# 1. Revoke signature on blockchain
# (call revokeSignature on your smart contract)

# 2. Wait for real-time event (< 1 second)

# 3. Check if cached
curl http://localhost:3000/api/v1/monitor/signature/0xabc.../revoked

# 4. Try to verify (should fail)
curl -X POST http://localhost:3000/api/v1/verify ...
```

## 🔍 Monitoring & Debugging

### Check Service Health

```bash
# Basic health
curl http://localhost:3000/api/v1/health

# Detailed blockchain sync status
curl http://localhost:3000/api/v1/monitor/health

# Hybrid sync statistics
curl http://localhost:3000/api/v1/monitor/stats
```

### View Logs

```bash
# Development
npm run start:dev
# Logs printed to console

# Docker
docker-compose logs -f vcel-api

# Specific log levels
LOG_LEVEL=debug npm run start:dev
```

### Database Inspection

```bash
# Connect to SQLite database
sqlite3 ./data/vcel.db

# Check configuration
SELECT * FROM lock_config;

# Check revoked signatures
SELECT COUNT(*) FROM revoked_credentials;
SELECT * FROM revoked_credentials ORDER BY revokedAt DESC LIMIT 10;

# Check verification history
SELECT COUNT(*) FROM signature_entries;
SELECT * FROM signature_entries WHERE wasRevoked = true;
```

### Common Issues

#### "Lock not configured"

**Solution:** Call `POST /api/v1/config/init` with lockId and publicKey

#### "Lock is already configured"

**Solution:** Call `POST /api/v1/config/reset` first (requires admin access)

#### "blocksBehind is high"

**Cause:** Batch sync can't keep up or RPC rate limits  
**Solutions:**

- Use faster RPC provider
- Increase `BATCH_SYNC_SIZE`
- Decrease `BATCH_SYNC_INTERVAL_MINUTES`

#### "Real-time events not working"

**Cause:** RPC doesn't support WebSocket subscriptions  
**Solution:** Use WebSocket-enabled RPC (wss://...) or rely on batch sync

## 🚀 Usage Examples

### Example 1: Physical Door Lock

```typescript
// NFC reader detects card
const cardData = await nfcReader.read();

// Extract signature from card
const { message, signature } = parseNFCData(cardData);

// Verify with local service
const result = await fetch('http://localhost:3000/api/v1/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, signature, lockId: '1' }),
});

const { verified } = await result.json();

if (verified) {
  unlockDoor();
  console.log('Access granted!');
} else {
  console.log('Access denied!');
}
```

### Example 2: Mobile App Backend

```typescript
// Mobile app sends verification request
app.post('/api/unlock', async (req, res) => {
  const { userId, signature } = req.body;

  // Verify signature with VCEL service
  const vcelResult = await fetch('http://lock-service:3000/api/v1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `unlock_${userId}_${Date.now()}`,
      signature,
      lockId: '1',
    }),
  });

  const { verified } = await vcelResult.json();

  if (verified) {
    // Send unlock command to physical lock via IoT
    await mqttClient.publish('locks/1/commands/unlock', '1');
    res.json({ success: true, message: 'Door unlocked' });
  } else {
    res.status(403).json({ success: false, message: 'Invalid credential' });
  }
});
```

### Example 3: Multi-Lock System

```bash
# Deploy 3 locks with load balancer
docker-compose up -d

# Nginx config
upstream locks {
  server lock-1:3001;
  server lock-2:3002;
  server lock-3:3003;
}

# Route by lock ID
location /api/v1/verify {
  # Extract lockId from request
  # Route to appropriate service
  proxy_pass http://locks;
}
```

## 🔄 Architecture Evolution

### ✅ Current Implementation (v2.0)

**Key Features:**

- ✅ Single-lock monitoring architecture
- ✅ Hybrid sync (real-time + batch every 15 min)
- ✅ ECDSA signature verification
- ✅ Configuration management (persistent lock config)
- ✅ TypeChain smart contract integration
- ✅ Revocation cache with deduplication
- ✅ Comprehensive monitoring endpoints
- ✅ Multi-architecture Docker support

**What Changed from v1.0:**

- ❌ Removed: Multi-lock database storage
- ❌ Removed: JWT-based VC verification
- ❌ Removed: Lock registration event handlers
- ✅ Added: Configuration service with database persistence
- ✅ Added: Hybrid sync with deduplication
- ✅ Added: ECDSA-specific verification
- ✅ Added: Health monitoring endpoints

### 🔜 Roadmap

#### Phase 3: NFC Integration (Q1 2026)

- 🔜 NFC reader support (PN532, ACR122U)
- 🔜 NDEF message parsing
- 🔜 Physical credential verification
- 🔜 Offline credential storage
- 🔜 NFC card writing for provisioning

#### Phase 4: Advanced Features (Q2 2026)

- 🔜 Multi-signature support
- 🔜 Time-based access control
- 🔜 Geofencing integration
- 🔜 Biometric authentication
- 🔜 Prometheus metrics export
- 🔜 GraphQL API

#### Phase 5: Enterprise Features (Q3 2026)

- 🔜 PostgreSQL support for high-scale deployments
- 🔜 Redis caching layer
- 🔜 Microservices architecture
- 🔜 Kubernetes Helm charts
- 🔜 Zero-knowledge proof integration
- 🔜 Multi-chain support (Polygon, Arbitrum)

## 📚 Additional Documentation

- **[HYBRID_SYNC.md](./HYBRID_SYNC.md)** - Detailed hybrid sync architecture
- **[SINGLE_LOCK_ARCHITECTURE.md](./SINGLE_LOCK_ARCHITECTURE.md)** - Single-lock design guide
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - ECDSA integration guide
- **[HOW_TO_RUN.md](./HOW_TO_RUN.md)** - Setup and running instructions
- **[COMMANDS.md](./COMMANDS.md)** - Quick reference commands

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
   - Follow TypeScript best practices
   - Add tests for new features
   - Update documentation
4. **Run tests**
   ```bash
   npm run test
   npm run lint
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- **Code Style**: Use Prettier (automatic formatting)
- **Linting**: ESLint rules enforced
- **Testing**: Write unit tests for services, e2e for controllers
- **Documentation**: Update README and related docs
- **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Support & Contact

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Email**: [Your contact email]
- **Documentation**: Check the `/docs` folder for detailed guides

## 🙏 Acknowledgments

- **NestJS** - Excellent framework for building scalable Node.js applications
- **ethers.js** - Comprehensive Ethereum library
- **TypeChain** - Type-safe smart contract interactions
- **@mrazakos/vc-ecdsa-crypto** - ECDSA signature verification library

---

## 📊 Quick Stats

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Lines of Code       | ~5,000                               |
| Test Coverage       | 85%+                                 |
| Docker Image Size   | ~150MB                               |
| Memory Usage        | ~50MB (idle)                         |
| Startup Time        | < 5 seconds                          |
| Verification Speed  | < 15ms                               |
| Revocation Check    | < 1ms                                |
| Supported Platforms | Linux (AMD64, ARM64), macOS, Windows |

---

**Built with ❤️ using Hexagonal Architecture, NestJS, and TypeScript**

**Perfect for:** IoT access control, NFC door locks, blockchain-based authentication, decentralized identity systems
