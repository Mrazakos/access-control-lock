# Single-Lock Architecture - Quick Start Guide

## Overview

Your access control system is now configured to monitor **one specific lock** identified by the `LOCK_ID` environment variable. Each instance:

1. **Fetches the lock's public key** from the blockchain on startup
2. **Only listens to revocation events** for that specific lock  
3. **Caches revocations locally** using hybrid sync (real-time + batch)
4. **Verifies signatures** using the lock's public key

---

## Configuration

### Required Environment Variables

```bash
# Which lock this instance monitors
LOCK_ID=1

# Network selection
NETWORK=sepolia

# Sepolia Testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_CONTRACT_ADDRESS=0xYourContractAddress
SEPOLIA_START_BLOCK=5000000

# Hybrid Sync Settings
BATCH_SYNC_INTERVAL_MINUTES=15
BATCH_SYNC_SIZE=1000
```

---

## Startup Sequence

When the service starts, it performs these steps:

```
1. Read LOCK_ID from environment
2. Connect to Ethereum RPC (Sepolia or Mainnet)
3. Call contract.getLockInfo(lockId) to fetch:
   - Lock owner address
   - Lock public key (for signature verification)
   - Current revoked count
   - Existence check
4. Start hybrid sync:
   - Initial batch sync from START_BLOCK to current block
   - Start real-time event listening (filtered to this lock)
   - Start 15-minute batch sync interval
```

**Example Startup Logs:**
```
[BlockchainListenerService] Connected to network: sepolia (chainId: 11155111)
[BlockchainListenerService] Fetching lock info for Lock ID: 1...
[BlockchainListenerService] ✅ Lock info loaded:
[BlockchainListenerService]    Owner: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
[BlockchainListenerService]    Public Key: 0x04abcdef123456...
[BlockchainListenerService]    Revoked Count: 42
[BlockchainListenerService] 🔒 Monitoring Lock ID: 1
[BlockchainListenerService] 🚀 Starting hybrid sync for Lock 1 (batch every 15 minutes + real-time events)
[BlockchainListenerService] ✅ Hybrid sync system started successfully
```

---

## How Events Are Filtered

### Real-Time Events
```typescript
// Creates a filter for ONLY this lock's SignatureRevoked events
const filter = contract.filters.SignatureRevoked(
  this.lockId,  // Lock ID from environment
  null,         // Any signatureHash
  null          // Any owner
);

contract.on(filter, async (lockId, signatureHash, owner, event) => {
  // Only events for Lock ID 1 will trigger this handler
});
```

### Batch Sync
```typescript
// Queries historical events ONLY for this lock
const filter = contract.filters.SignatureRevoked(this.lockId, null, null);
const events = await contract.queryFilter(filter, fromBlock, toBlock);
// Returns only SignatureRevoked events where lockId === this.lockId
```

---

## Database Schema (Simplified)

### `revoked_signatures` table
```sql
CREATE TABLE revoked_signatures (
  id TEXT PRIMARY KEY,              -- signatureHash (unique since single lock)
  signatureHash TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,          -- Same as hash
  revokedBy TEXT NOT NULL,          -- Who revoked it
  transactionHash TEXT NOT NULL,    
  blockNumber INTEGER NOT NULL,     
  revokedAt DATETIME NOT NULL,      
  createdAt DATETIME NOT NULL
);
```

**Note:** No `lockId` column needed - this instance only monitors one lock.

### `signature_entries` table
```sql
CREATE TABLE signature_entries (
  id TEXT PRIMARY KEY,              
  signature TEXT NOT NULL,          
  signatureHash TEXT,               -- Added for revocation matching
  publicKey TEXT,                   
  owner TEXT,                       
  message TEXT,                     
  wasRevoked BOOLEAN DEFAULT FALSE, 
  transactionHash TEXT NOT NULL,    
  blockNumber INTEGER NOT NULL,     
  timestamp DATETIME NOT NULL,      
  metadata TEXT,                    
  createdAt DATETIME NOT NULL
);
```

**Note:** No `lockId` column needed - all entries are for the configured lock.

---

## API Usage

### Health Check (Lock-Specific)
```bash
curl http://localhost:3000/api/v1/monitor/health
```

**Response:**
```json
{
  "healthy": true,
  "lockId": "1",
  "lockOwner": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "publicKey": "0x04abcdef123456...",
  "revokedCount": 42,
  "currentBlock": 5234567,
  "lastSyncedBlock": 5234560,
  "blocksBehind": 7,
  "isListening": true,
  "batchSyncActive": true,
  "network": "sepolia",
  "contractAddress": "0x..."
}
```

### Verify a Signature
```bash
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "unlock_request_12345",
    "signature": "0xabc123..."
  }'
```

**Response:**
```json
{
  "verified": true,
  "lockId": "1",
  "publicKey": "0x04abcdef...",
  "checks": [
    { "check": "revocation_status", "status": "success" },
    { "check": "signature_format", "status": "success" },
    { "check": "signature_verification", "status": "success" },
    { "check": "public_key_recovery", "status": "success" }
  ]
}
```

**Key Points:**
- No need to specify lock ID in verification request - uses configured lock
- Public key is automatically used from blockchain
- Revocation status checked against local cache

### Check if Signature is Revoked
```bash
curl http://localhost:3000/api/v1/monitor/signature/0xabc.../revoked
```

**Response:**
```json
{
  "signature": "0xabc...",
  "isRevoked": true,
  "timestamp": "2025-10-19T14:32:30.000Z"
}
```

---

## Multi-Lock Deployment

To monitor **multiple locks**, deploy multiple instances:

### Docker Compose Example
```yaml
version: '3.8'

services:
  lock-1:
    image: access-control-lock:latest
    environment:
      - LOCK_ID=1
      - NETWORK=sepolia
      - SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
      - SEPOLIA_CONTRACT_ADDRESS=0x...
      - PORT=3001
    ports:
      - "3001:3001"
    volumes:
      - ./data/lock1:/app/data

  lock-2:
    image: access-control-lock:latest
    environment:
      - LOCK_ID=2
      - NETWORK=sepolia
      - SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
      - SEPOLIA_CONTRACT_ADDRESS=0x...
      - PORT=3002
    ports:
      - "3002:3002"
    volumes:
      - ./data/lock2:/app/data

  lock-3:
    image: access-control-lock:latest
    environment:
      - LOCK_ID=3
      - NETWORK=sepolia
      - SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
      - SEPOLIA_CONTRACT_ADDRESS=0x...
      - PORT=3003
    ports:
      - "3003:3003"
    volumes:
      - ./data/lock3:/app/data
```

Each instance:
- Monitors its own lock ID
- Has its own SQLite database
- Listens on its own port
- Independent revocation cache

---

## Verification Flow

```
1. Signature arrives (NFC, API, or IoT)
   ↓
2. Check local revocation cache (sub-millisecond)
   - SELECT * FROM revoked_signatures WHERE signatureHash = ?
   ↓
3. If NOT revoked → Verify signature using lock's public key
   - verifySignature(message, signature, lockInfo.publicKey)
   ↓
4. Log entry to signature_entries table
   ↓
5. Return verification result
```

**Fast Path:**
- Revoked signatures: ~0.5ms (indexed DB lookup)
- Valid signatures: ~5-10ms (ECDSA verification + DB write)

---

## Advantages of Single-Lock Architecture

✅ **Simplified Database** - No complex joins or foreign keys  
✅ **Faster Queries** - No filtering by lockId needed  
✅ **Smaller Cache** - Only revocations for one lock  
✅ **Isolated Failures** - One lock's issues don't affect others  
✅ **Horizontal Scaling** - Deploy one instance per lock  
✅ **Clear Ownership** - Each service knows exactly which lock it manages  
✅ **Easier Debugging** - Logs are lock-specific  

---

## Testing Your Configuration

### 1. Verify Lock Info is Fetched
```bash
# Check logs for:
[BlockchainListenerService] ✅ Lock info loaded:
[BlockchainListenerService]    Owner: 0x...
[BlockchainListenerService]    Public Key: 0x04...
```

### 2. Test Revocation Event
```bash
# On blockchain: Revoke a signature for your lock
# In logs, you should see:
[BlockchainListenerService] 🔴 Real-time event: Signature revoked for Lock 1
[EventProcessorService] ✅ Signature revoked [real-time]: Hash: 0xabc123...
```

### 3. Verify Signature
```bash
curl -X POST http://localhost:3000/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "message": "test",
    "signature": "YOUR_SIGNATURE"
  }'

# Should return verification result using lock's public key
```

### 4. Check Health
```bash
curl http://localhost:3000/api/v1/monitor/health

# Should show:
# - lockId: "1" (or your configured ID)
# - publicKey: "0x04..." (fetched from blockchain)
# - healthy: true
```

---

## Troubleshooting

### Error: "Lock ID X does not exist on the blockchain"
**Cause:** The LOCK_ID you configured hasn't been registered on-chain  
**Solution:**  
- Check if lock is registered: `await contract.getLockInfo(lockId)`
- Verify you're on the correct network (Sepolia vs Mainnet)
- Register the lock if needed: `await contract.registerLock(publicKey)`

### Error: "LOCK_ID environment variable is required"
**Cause:** Missing LOCK_ID in .env file  
**Solution:**  
```bash
echo "LOCK_ID=1" >> .env
npm run start:dev
```

### Revocations Not Syncing
**Cause:** Event filter might not be working  
**Solution:**  
- Check logs for "Starting real-time event listening for Lock X"
- Verify RPC URL supports event subscriptions (WebSocket)
- Try force sync: `POST /api/v1/monitor/force-sync`

### Wrong Public Key Being Used
**Cause:** Lock info not loaded or stale  
**Solution:**  
- Restart service to refetch lock info
- Check health endpoint to see current publicKey
- Verify lock hasn't been updated on-chain

---

## Summary

| Before (Multi-Lock) | After (Single-Lock) |
|---------------------|---------------------|
| Store all locks in DB | Fetch lock info on startup |
| Filter by lockId in queries | No filtering needed |
| One instance monitors all locks | One instance per lock |
| Public key passed in API call | Public key from blockchain |
| Complex revocation queries | Simple hash lookup |

**Result:** Simpler, faster, more scalable architecture perfect for edge devices (NFC readers) that only need to manage one physical lock.
