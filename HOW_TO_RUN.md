# 🚀 How to Run the Access Control Lock Service

## Important Note: This is NOT Next.js!

**This is a NestJS application**, not Next.js. They are completely different frameworks:

- **NestJS** = Backend framework (like Express/Fastify) for building server-side APIs
- **Next.js** = Frontend framework for React applications

Your application is a **backend service** built with NestJS that:

- Listens to blockchain events
- Verifies credentials using ECDSA
- Stores data in SQLite
- Exposes REST APIs

---

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** (comes with Node.js)
3. **Ethereum RPC endpoint** (Alchemy, Infura, or local node)
4. **Contract address** of your deployed AccessControl smart contract

---

## 🛠️ Step 1: Install Dependencies

```powershell
npm install
```

This installs all packages from `package.json`:

- NestJS framework
- ethers.js (blockchain interaction)
- TypeORM + SQLite (database)
- Your custom crypto library (@mrazakos/vc-ecdsa-crypto)
- And more...

---

## ⚙️ Step 2: Configure Environment

Create a `.env` file by copying the example:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` with your settings:

```bash
# Application Mode
MODE=API
# Your lock's ID on the blockchain
LOCK_ID=1

# Server Configuration
PORT=3000
NODE_ENV=development

# Network (use sepolia for testing)
NETWORK=sepolia

# Ethereum RPC - GET FREE KEY FROM https://www.alchemy.com/
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
SEPOLIA_CONTRACT_ADDRESS=0xYourContractAddress
SEPOLIA_START_BLOCK=0

# Database (SQLite - no setup needed!)
DATABASE_PATH=./data/vcel.db

# Hybrid Sync (real-time + batch every 15 minutes)
BATCH_SYNC_INTERVAL_MINUTES=15
BATCH_SYNC_SIZE=1000
```

---

## 🏃 Step 3: Run the Application

### Development Mode (with hot reload):

```powershell
npm run start:dev
```

### Production Mode:

```powershell
# First build
npm run build

# Then run
npm run start:prod
```

---

## 🎯 What Happens When You Run It?

### Phase 1: Application Bootstrap (main.ts)

```
1. Configuration Validation
   ↓
2. Create NestJS Application
   ↓
3. Enable CORS & Global Validation
   ↓
4. Set API prefix (/api/v1)
   ↓
5. Start HTTP Server on port 3000
```

**Console Output:**

```
[Nest] 12345  - 10/19/2025, 10:00:00 AM     LOG [Bootstrap] Starting VCEL in API mode...
[Nest] 12345  - 10/19/2025, 10:00:01 AM     LOG [Bootstrap] 🚀 Server running on http://localhost:3000/api/v1
[Nest] 12345  - 10/19/2025, 10:00:01 AM     LOG [Bootstrap] 📊 Health check: http://localhost:3000/api/v1/health
[Nest] 12345  - 10/19/2025, 10:00:01 AM     LOG [Bootstrap] Mode: API
[Nest] 12345  - 10/19/2025, 10:00:01 AM     LOG [Bootstrap] Database: ./data/vcel.db
```

---

### Phase 2: Module Initialization (app.module.ts)

```
AppModule loads:
1. ConfigModule           → Validates environment variables
2. EventEmitterModule     → Internal event bus
3. DatabaseModule         → SQLite initialization
4. MessagingModule        → MQTT (optional)
5. RestModule             → HTTP controllers (verify, health)
6. Core Services:
   - CredentialVerifierService
   - BlockchainListenerService  ← THIS IS THE KEY!
   - EventProcessorService
```

---

### Phase 3: Blockchain Listener Initialization

**This is where the magic happens!**

```typescript
// blockchain-listener.service.ts - onModuleInit()

1. Connect to Ethereum RPC
   ├─ Creates ethers.js provider
   ├─ Connects to Sepolia/Mainnet
   └─ Creates AccessControl contract instance

2. Fetch Lock Information from Blockchain
   ├─ Calls: contract.getLockInfo(LOCK_ID)
   ├─ Retrieves:
   │  - Lock owner address
   │  - Lock's public key (for ECDSA verification!)
   │  - Number of revoked signatures
   │  - Lock exists flag
   └─ Emits: 'lock.info.loaded' event

3. Initialize Hybrid Sync System
   ├─ Batch Sync (every 15 minutes):
   │  └─ Queries historical events from blockchain
   │     └─ Filters: SignatureRevoked(lockId=YOUR_LOCK_ID, *, *)
   │
   └─ Real-time Listener:
      └─ WebSocket connection to RPC
         └─ Listens for new SignatureRevoked events
            └─ Only for YOUR lock ID
```

**Console Output:**

```
[Nest] 12345  - LOG [BlockchainListenerService] Initializing blockchain listener...
[Nest] 12345  - LOG [BlockchainListenerService] Network: sepolia
[Nest] 12345  - LOG [BlockchainListenerService] Contract: 0xAbc123...
[Nest] 12345  - LOG [BlockchainListenerService] Monitoring Lock ID: 1
[Nest] 12345  - LOG [BlockchainListenerService] ✅ Lock info loaded:
[Nest] 12345  - LOG [BlockchainListenerService]    Owner: 0xDef456...
[Nest] 12345  - LOG [BlockchainListenerService]    Public Key: 0x04abc...
[Nest] 12345  - LOG [BlockchainListenerService]    Revoked Count: 42
[Nest] 12345  - LOG [BlockchainListenerService] 🔄 Starting hybrid sync...
[Nest] 12345  - LOG [BlockchainListenerService] 📡 Real-time listener active
[Nest] 12345  - LOG [BlockchainListenerService] ⏱️ Batch sync scheduled every 15 minutes
```

---

### Phase 4: Database Initialization (SQLite)

**SQLite is embedded - no separate server needed!**

```
TypeORM initializes SQLite:

1. Check if database file exists
   ├─ Path: ./data/vcel.db
   └─ Creates directory if missing

2. Create tables (if first run):
   ├─ revoked_signatures
   │  ├─ id (PRIMARY KEY)
   │  ├─ signatureHash (INDEXED)
   │  ├─ blockNumber
   │  ├─ revokedAt
   │  └─ createdAt
   │
   └─ signature_entries
      ├─ id (PRIMARY KEY)
      ├─ signatureHash (INDEXED)
      ├─ publicKey
      ├─ timestamp (INDEXED)
      └─ createdAt

3. Ready for queries!
```

**Console Output:**

```
[Nest] 12345  - LOG [TypeOrmModule] Database initialized: ./data/vcel.db
[Nest] 12345  - LOG [TypeOrmModule] Tables synchronized
```

**File Structure:**

```
access-control-lock/
├─ data/
│  └─ vcel.db          ← SQLite database file (created automatically)
│                         This file contains all your data!
```

---

### Phase 5: Initial Batch Sync

```
BlockchainListenerService performs first sync:

1. Get current blockchain block: 5,234,567

2. Query historical events:
   ├─ From block: SEPOLIA_START_BLOCK (or 0)
   ├─ To block: 5,234,567
   ├─ Filter: SignatureRevoked(lockId=1, *, *)
   └─ Batch size: 1000 events at a time

3. Process each event:
   ├─ Extract: signatureHash, revokedBy, blockNumber
   ├─ Check: Not already in database
   ├─ Save to: revoked_signatures table
   └─ Emit: 'signature.revoked' event

4. Update sync status:
   └─ lastSyncedBlock = 5,234,567
```

**Console Output:**

```
[Nest] 12345  - LOG [BlockchainListenerService] 🔍 Batch sync started...
[Nest] 12345  - LOG [BlockchainListenerService] 📦 Querying blocks 0 to 5234567
[Nest] 12345  - LOG [BlockchainListenerService] ✅ Found 42 revocation events
[Nest] 12345  - LOG [BlockchainListenerService] 💾 Saved 42 new revocations to database
[Nest] 12345  - LOG [BlockchainListenerService] ⏰ Next batch sync in 15 minutes
```

---

## 🌐 How SQLite Works in This App

### What is SQLite?

**SQLite is a file-based database** - no separate server needed!

```
Traditional databases:          SQLite:
┌──────────────┐               ┌──────────────┐
│ Your App     │               │ Your App     │
└──────┬───────┘               └──────┬───────┘
       │ TCP/IP                       │ (embedded)
┌──────▼───────┐               ┌──────▼───────┐
│ PostgreSQL   │               │ SQLite lib   │
│ Server       │               │ (in-process) │
│ (separate    │               └──────┬───────┘
│  process)    │                      │
└──────┬───────┘               ┌──────▼───────┐
       │                       │ vcel.db file │
┌──────▼───────┐               │ (on disk)    │
│ Data files   │               └──────────────┘
└──────────────┘
```

### SQLite Operations in Your App:

**1. When you start the app:**

```typescript
// TypeORM connects to SQLite file
const connection = await createConnection({
  type: 'sqlite',
  database: './data/vcel.db', // Just a file path!
  entities: [RevokedSignatureEntity, SignatureEntryEntity],
  synchronize: true, // Auto-creates tables
});
```

**2. When saving a revoked signature:**

```typescript
// EventProcessorService receives event
async handleSignatureRevoked(data: RevocationEventData) {
  // INSERT INTO revoked_signatures VALUES (...)
  await this.revokedSignatureRepo.save({
    signatureHash: data.signatureHash,
    blockNumber: data.blockNumber,
    revokedAt: data.timestamp,
  });
}
```

**SQLite executes:**

```sql
INSERT INTO revoked_signatures
  (signatureHash, blockNumber, revokedAt, createdAt)
VALUES
  ('0xabc123...', 5234567, '2025-10-19T10:00:00Z', '2025-10-19T10:00:00Z');
```

**3. When verifying a credential:**

```typescript
// VerifyController checks revocation
const isRevoked = await this.revokedSignatureRepo.isSignatureHashRevoked(credential.signature);
```

**SQLite executes:**

```sql
SELECT COUNT(*) FROM revoked_signatures
WHERE signatureHash = '0xabc123...';
```

---

## 🔄 Real-Time Event Flow

### When someone revokes a signature on the blockchain:

```
1. Smart Contract emits event:
   SignatureRevoked(lockId=1, signatureHash=0xabc..., revokedBy=0xdef...)
   ↓
2. Ethereum node propagates event
   ↓
3. Your RPC WebSocket receives it
   ↓
4. BlockchainListenerService detects it:
   - Checks filter: Is lockId === this.lockId? ✅
   - Adds to pendingUpdates Set (avoid batch duplicate)
   ↓
5. Emits internal event: 'signature.revoked'
   ↓
6. EventProcessorService handles it:
   - Saves to revoked_signatures table
   - Updates statistics
   ↓
7. Next verification request will see it as revoked!
```

**Console Output:**

```
[Nest] 12345  - LOG [BlockchainListenerService] 🔔 Real-time event detected!
[Nest] 12345  - LOG [BlockchainListenerService]    Lock ID: 1
[Nest] 12345  - LOG [BlockchainListenerService]    Signature Hash: 0xabc123...
[Nest] 12345  - LOG [BlockchainListenerService]    Block: 5234568
[Nest] 12345  - LOG [EventProcessorService] 💾 Saved revocation to database
```

---

## 🔍 Testing Your Running Application

### 1. Check Health Endpoint

```powershell
# Using curl
curl http://localhost:3000/api/v1/health

# Using Invoke-WebRequest (PowerShell)
Invoke-WebRequest -Uri http://localhost:3000/api/v1/health | Select-Object -Expand Content
```

**Expected Response:**

```json
{
  "status": "healthy",
  "lock": {
    "lockId": "1",
    "owner": "0xYourAddress...",
    "publicKey": "0x04abc123...",
    "revokedCount": 42,
    "exists": true
  },
  "blockchain": {
    "network": "sepolia",
    "currentBlock": 5234567,
    "lastSyncedBlock": 5234567,
    "blocksBehind": 0,
    "isListening": true,
    "batchSyncActive": true
  },
  "sync": {
    "realTimeUpdates": 5,
    "batchUpdates": 42,
    "totalRevocations": 47,
    "lastBatchSync": "2025-10-19T10:15:00Z",
    "lastRealTimeUpdate": "2025-10-19T10:20:00Z"
  }
}
```

### 2. Verify a Credential

```powershell
# Create test credential JSON
$credential = @{
  signedMessageHash = "0xabc123..."
  lockId = 1
  lockNickname = "Main Door"
  signature = "0xdef456..."
  userDataHash = "0x789abc..."
  expirationDate = "2025-12-31T23:59:59Z"
  issuanceDate = "2025-10-19T10:00:00Z"
  id = "vc-test-123"
} | ConvertTo-Json

# POST to verify endpoint
Invoke-WebRequest -Uri http://localhost:3000/api/v1/verify `
  -Method POST `
  -ContentType "application/json" `
  -Body $credential
```

**Expected Response:**

```json
{
  "verified": true,
  "credentialId": "vc-test-123",
  "lockId": "1",
  "isRevoked": false,
  "checks": [
    {
      "check": "format",
      "status": "success",
      "message": "Valid credential format"
    },
    {
      "check": "revocation_status",
      "status": "success",
      "message": "Signature is not revoked"
    },
    {
      "check": "ecdsa_verification",
      "status": "success",
      "message": "ECDSA signature verified"
    },
    {
      "check": "expiration",
      "status": "success",
      "message": "Valid until 2025-12-31T23:59:59Z"
    },
    {
      "check": "lock_id",
      "status": "success",
      "message": "Lock ID: 1 (Main Door)"
    }
  ],
  "verifiedAt": "2025-10-19T10:30:00Z",
  "timestamp": "2025-10-19T10:30:00Z"
}
```

---

## 📊 How Data Flows Through the System

```
┌─────────────────────────────────────────────────────────────┐
│                    ETHEREUM BLOCKCHAIN                       │
│  Lock ID 1 → Public Key: 0x04abc...                         │
│  SignatureRevoked events emitted by smart contract           │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
      ┌──────▼────────┐          ┌────────▼─────────┐
      │ Real-time     │          │ Batch Sync       │
      │ WebSocket     │          │ (every 15 min)   │
      └──────┬────────┘          └────────┬─────────┘
             │                            │
             └────────────┬───────────────┘
                          │
                ┌─────────▼──────────┐
                │ BlockchainListener │
                │ Service            │
                └─────────┬──────────┘
                          │
                   Emits Event
                          │
                ┌─────────▼──────────┐
                │ EventProcessor     │
                │ Service            │
                └─────────┬──────────┘
                          │
                    Saves to DB
                          │
              ┌───────────▼────────────┐
              │ SQLite (vcel.db)       │
              │  - revoked_signatures  │
              │  - signature_entries   │
              └───────────┬────────────┘
                          │
                   Read on verify
                          │
         ┌────────────────▼────────────────────┐
         │  HTTP Request: POST /api/v1/verify  │
         │  ┌──────────────────────────────┐   │
         │  │ VerifyController             │   │
         │  │  1. Get lock's public key    │   │
         │  │  2. Check if revoked (DB)    │   │
         │  │  3. Verify ECDSA signature   │   │
         │  │  4. Check expiration         │   │
         │  │  5. Return result            │   │
         │  └──────────────────────────────┘   │
         └─────────────────────────────────────┘
```

---

## 🗂️ SQLite Database Structure

After running, you'll have `./data/vcel.db` with these tables:

### Table: `revoked_signatures`

```sql
CREATE TABLE revoked_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signatureHash TEXT NOT NULL UNIQUE,
  blockNumber INTEGER NOT NULL,
  revokedAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signature_hash ON revoked_signatures(signatureHash);
```

**Example data:**
| id | signatureHash | blockNumber | revokedAt | createdAt |
|----|---------------|-------------|-----------|-----------|
| 1 | 0xabc123... | 5234567 | 2025-10-19 10:00:00 | 2025-10-19 10:15:23 |
| 2 | 0xdef456... | 5234580 | 2025-10-19 10:30:00 | 2025-10-19 10:30:12 |

### Table: `signature_entries`

```sql
CREATE TABLE signature_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signatureHash TEXT NOT NULL,
  publicKey TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sig_hash ON signature_entries(signatureHash);
CREATE INDEX idx_timestamp ON signature_entries(timestamp);
```

**Example data:**
| id | signatureHash | publicKey | timestamp | createdAt |
|----|---------------|-----------|-----------|-----------|
| 1 | 0xabc123... | 0x04abc... | 2025-10-19 09:00:00 | 2025-10-19 09:00:15 |
| 2 | 0xdef456... | 0x04abc... | 2025-10-19 10:00:00 | 2025-10-19 10:00:22 |

---

## 🔧 Troubleshooting

### Problem: "Cannot connect to RPC"

**Solution:** Check your Alchemy/Infura API key in `.env`

### Problem: "Lock not found"

**Solution:** Verify `LOCK_ID` matches an existing lock on the blockchain

### Problem: "Database locked"

**Solution:** SQLite file is in use by another process. Stop all instances.

### Problem: "No events found"

**Solution:**

- Check `SEPOLIA_START_BLOCK` - might be too high
- Verify contract address is correct
- Ensure lock has revocation events

---

## 📈 Production Deployment

```powershell
# Build optimized code
npm run build

# Set production environment
$env:NODE_ENV = "production"

# Run production server
npm run start:prod
```

**Production Checklist:**

- ✅ Set `NODE_ENV=production`
- ✅ Use real Ethereum mainnet RPC
- ✅ Set appropriate `START_BLOCK` (don't sync from genesis!)
- ✅ Backup `./data/vcel.db` regularly
- ✅ Monitor logs for errors
- ✅ Set up process manager (PM2, systemd)

---

## 🎓 Key Takeaways

1. **This is NestJS (backend), not Next.js (frontend)**
2. **SQLite is embedded** - no separate database server needed
3. **Hybrid sync** - real-time + batch ensures no missed events
4. **Single-lock focus** - each instance monitors ONE lock
5. **Public key from blockchain** - fetched automatically on startup
6. **Local cache** - SQLite stores revocations for fast lookup

---

## 🆘 Need Help?

Check the logs - they tell you exactly what's happening:

```powershell
# See all logs in real-time
npm run start:dev

# Filter for errors only
npm run start:dev 2>&1 | Select-String "ERROR"
```

Good luck! 🚀
