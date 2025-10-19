# 🔄 Migration to ECDSA Crypto & TypeChain Integration

This document outlines the changes made to integrate `@mrazakos/vc-ecdsa-crypto` and use TypeChain-generated types for your AccessControl smart contract.

## 📋 What Changed

### 1. **Removed JWT-based VC Libraries**
Removed the following dependencies:
- `did-jwt-vc`
- `did-resolver`
- `ethr-did-resolver`
- `@digitalbazaar/vc`
- `@digitalbazaar/ed25519-signature-2020`
- `@digitalbazaar/did-method-key`

### 2. **Added ECDSA Crypto Library**
Added your custom ECDSA signature verification package:
```json
"@mrazakos/vc-ecdsa-crypto": "^1.0.0"
```

### 3. **Updated Ethers.js Version**
Changed from `ethers ^6.9.2` to `ethers ^5.7.2` for TypeChain compatibility.

### 4. **Database Schema Updates**

#### New Entities:
1. **`LockEntity`** - Stores registered locks from the contract
   - `lockId`: Unique lock identifier
   - `owner`: Lock owner address
   - `publicKey`: ECDSA public key
   - `revokedSignatureCount`: Count of revoked signatures

2. **`RevokedSignatureEntity`** - Caches all revoked signatures
   - `lockId`: Lock identifier
   - `signatureHash`: Keccak256 hash of signature (bytes32)
   - `signature`: Original signature string
   - `revokedBy`: Address that revoked it
   - Indexed for fast lookup

3. **`SignatureEntryEntity`** - Tracks when signatures were used/verified
   - `lockId`: Lock identifier
   - `signature`: The signature that was used
   - `timestamp`: When it was used
   - `wasRevoked`: Whether it was later revoked
   - Tracks the history of signature usage

### 5. **Updated Credential Verifier**

The `CredentialVerifierService` now:
- Uses `verifySignature()` from `@mrazakos/vc-ecdsa-crypto`
- Uses `recoverPublicKey()` to extract signer information
- Checks revocation status before verification
- Supports direct ECDSA signature verification

**New Methods:**
```typescript
// Verify a signature with a public key
verifySignatureWithPublicKey(
  message: string,
  signature: string,
  publicKey: string,
  isRevoked: boolean
): Promise<VerificationResult>

// Verify a Verifiable Credential with embedded proof
verifyCredential(
  credential: VerifiableCredential,
  publicKey: string,
  isRevoked: boolean
): Promise<VerificationResult>

// Recover signer address from signature
recoverSignerAddress(
  message: string,
  signature: string
): string | null
```

### 6. **Updated Blockchain Listener**

The `BlockchainListenerService` now:
- Uses TypeChain-generated `AccessControl` contract types
- Listens to your contract's actual events:
  - `LockRegistered` - When a new lock is registered
  - `SignatureRevoked` - When a signature is revoked
  - `LockOwnershipTransferred` - When lock ownership changes

**New Methods:**
```typescript
// Query past lock registrations
queryPastLockRegistrations(fromBlock, toBlock): Promise<Lock[]>

// Query past signature revocations
queryPastRevocations(fromBlock, toBlock): Promise<Revocation[]>

// Check revocation on-chain
isSignatureRevokedOnChain(lockId, signature): Promise<boolean>

// Get lock information from contract
getLockInfo(lockId): Promise<LockInfo>
```

### 7. **Network Configuration**

Added support for Sepolia testnet and Ethereum mainnet:

**Environment Variables:**
```env
# Network Selection
NETWORK=sepolia  # or "mainnet"

# Sepolia Testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_CONTRACT_ADDRESS=0x...
SEPOLIA_START_BLOCK=0

# Ethereum Mainnet
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
MAINNET_CONTRACT_ADDRESS=0x...
MAINNET_START_BLOCK=0

# Settings
POLL_INTERVAL=12000
CONFIRMATIONS=3
```

The system automatically selects the correct network configuration based on the `NETWORK` environment variable.

### 8. **Event Flow Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│              Ethereum Smart Contract                         │
│         (AccessControl with TypeChain types)                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Events: LockRegistered, SignatureRevoked
                   ▼
┌─────────────────────────────────────────────────────────────┐
│           BlockchainListenerService                          │
│  - Listens to contract events                                │
│  - Emits internal application events                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Internal Events
                   ▼
┌─────────────────────────────────────────────────────────────┐
│          Event Handlers (IoT/API Adapters)                   │
│  - Process lock registrations                                │
│  - Cache revoked signatures                                  │
│  - Track signature entries                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│               SQLite Database                                │
│  - locks                                                     │
│  - revoked_signatures (fast revocation lookup)              │
│  - signature_entries (usage history)                         │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Installation & Setup

### Step 1: Install Dependencies

```powershell
npm install
```

This will install:
- `@mrazakos/vc-ecdsa-crypto` for ECDSA signature verification
- `ethers@5.7.2` for blockchain interaction
- All other NestJS and infrastructure dependencies

### Step 2: Configure Environment

Copy and configure the environment file:

```powershell
cp .env.example .env
```

Edit `.env`:

```env
# Set mode
MODE=API

# Choose network
NETWORK=sepolia

# Configure Sepolia testnet
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
SEPOLIA_CONTRACT_ADDRESS=0xYourContractAddressHere
SEPOLIA_START_BLOCK=0

# Database
DATABASE_PATH=./data/vcel.db
```

### Step 3: Run Development Server

```powershell
npm run start:dev
```

The server will start on `http://localhost:3000/api/v1`

### Step 4: Verify Setup

Check health endpoint:
```powershell
curl http://localhost:3000/api/v1/health
```

Check blockchain listener status:
```powershell
curl http://localhost:3000/api/v1/events/status
```

## 📊 Database Structure

### Tables Created:

1. **`locks`**
   ```sql
   - id (PK)
   - lockId (indexed, unique)
   - owner (indexed)
   - publicKey
   - transactionHash
   - blockNumber
   - registeredAt
   - revokedSignatureCount
   - createdAt, updatedAt
   ```

2. **`revoked_signatures`**
   ```sql
   - id (PK)
   - lockId (indexed)
   - signatureHash (indexed)
   - signature (indexed)
   - revokedBy
   - transactionHash
   - blockNumber
   - revokedAt
   - createdAt
   - UNIQUE INDEX on (lockId, signatureHash)
   ```

3. **`signature_entries`**
   ```sql
   - id (PK)
   - lockId (indexed)
   - signature (indexed)
   - publicKey
   - owner
   - message
   - wasRevoked
   - transactionHash
   - blockNumber
   - timestamp (indexed)
   - metadata (JSON)
   - createdAt
   ```

4. **`credential_events`** (legacy, can be removed if not needed)
   ```sql
   - id (PK)
   - blockNumber
   - transactionHash
   - eventName
   - credentialId
   - holder
   - issuer
   - timestamp
   - rawData (JSON)
   - verified
   - verificationResult (JSON)
   - createdAt, updatedAt
   ```

## 🔍 API Endpoints

### Verification

**POST `/api/v1/verify`**
```json
{
  "message": "Hello World",
  "signature": "0x...",
  "publicKey": "0x...",
  "lockId": 1
}
```

Response:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "verified": true,
    "results": [
      {
        "check": "revocation_status",
        "status": "success",
        "message": "Signature is not revoked"
      },
      {
        "check": "ecdsa_verification",
        "status": "success",
        "message": "ECDSA signature verified"
      }
    ],
    "verifiedAt": "2024-10-19T10:00:00.000Z"
  }
}
```

### Query Events

**GET `/api/v1/events`** - All events
**GET `/api/v1/events?lockId=1`** - Events for specific lock
**GET `/api/v1/events/status`** - Blockchain listener status
**GET `/api/v1/events/unverified`** - Unverified events

### Revocations

**GET `/api/v1/revocations?lockId=1`** - Get revoked signatures for a lock
**GET `/api/v1/revocations/check?lockId=1&signature=0x...`** - Check if signature is revoked

### Locks

**GET `/api/v1/locks`** - All registered locks
**GET `/api/v1/locks/:lockId`** - Get specific lock info

## 🧪 Testing Signature Verification

```javascript
// Example: Test signature verification
const response = await fetch('http://localhost:3000/api/v1/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Access granted',
    signature: '0x1234...', // Your ECDSA signature
    publicKey: '0xabcd...', // Lock's public key
    lockId: 1
  })
});

const result = await response.json();
console.log(result);
```

## 🐛 TypeScript Errors

The TypeScript errors you see are expected during development and will resolve once:
1. Dependencies are installed (`npm install`)
2. Type definitions are generated
3. The project is built (`npm run build`)

Common errors that will auto-resolve:
- `Cannot find module '@mrazakos/vc-ecdsa-crypto'` → Resolves after `npm install`
- `Cannot find module '@nestjs/...'` → Resolves after `npm install`
- `Cannot find module 'typeorm'` → Resolves after `npm install`
- `Cannot find name 'process'` → Add `@types/node` (already in package.json)

## 📝 Next Steps

1. **Install packages**: `npm install`
2. **Configure `.env`**: Add your RPC URL and contract address
3. **Run migrations** (if needed): `npm run migration:run`
4. **Start server**: `npm run start:dev`
5. **Test integration**: Use the API endpoints to verify signatures
6. **Deploy**: Use Docker for production deployment

## 🔐 Security Notes

1. **Revocation Cache**: The system caches all revoked signatures locally for fast lookup
2. **On-chain Verification**: Can also check revocation status directly from contract
3. **Signature History**: All signature usage is logged with timestamps
4. **Public Key Verification**: Signatures are verified against lock's registered public key

## 📚 Additional Resources

- [Your ECDSA Crypto Package](https://www.npmjs.com/package/@mrazakos/vc-ecdsa-crypto)
- [TypeChain Documentation](https://github.com/dethcrypto/TypeChain)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Ethers.js v5 Documentation](https://docs.ethers.io/v5/)
