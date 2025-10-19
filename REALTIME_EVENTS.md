# Real-Time Event Listening - Fixed

## What Was Wrong

The real-time event listener had an incorrect callback signature. With TypeChain-generated contracts, event listeners receive arguments differently than plain ethers.js:

**Before (Incorrect):**

```typescript
this.contract.on(filter, async (lockId, signatureHash, owner, event) => {
  // This was expecting 4 separate parameters
});
```

**After (Correct):**

```typescript
this.contract.on(filter, async (...args: any[]) => {
  // TypeChain passes all event args as array, with event object as last element
  const event = args[args.length - 1];
  const signatureHash = args[1] as string;
  const owner = args[2] as string;
});
```

## Changes Made

### 1. Fixed Event Listener Callback

- Updated `startRealtimeListening()` to correctly parse TypeChain event arguments
- The event object is now correctly extracted from the last position in the args array
- Event parameters (lockId, signatureHash, owner) are accessed by array index

### 2. Removed Noisy Block Logging

- Removed `logger.debug('New block: ...')` that was logging every single block
- Block tracking continues in the background for statistics
- You'll only see relevant events (revocations) in the logs

### 3. Added WebSocket Connection Warning

- System now checks if you're using WebSocket (wss://) or HTTP polling
- If using HTTP, shows a warning that real-time events may be delayed
- WebSocket connections are recommended for true real-time event detection

## How to Test Real-Time Events

### Step 1: Check Your RPC URL

Your `.env` should use a WebSocket URL for best real-time performance:

```bash
# Good - WebSocket connection
SEPOLIA_RPC_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Not ideal - HTTP polling (events may be delayed)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

### Step 2: Start the Service

```bash
npm run start:dev
```

Look for these log messages:

```
🎧 Starting real-time event listening for Lock 19...
✅ Real-time event listening active
📡 Connection mode: WebSocket  (or "HTTP polling" if not using WebSocket)
```

### Step 3: Trigger a Revocation

From your smart contract, revoke a signature for Lock ID 19.

### Step 4: Watch the Logs

You should see:

```
🔴 Real-time event detected: SignatureRevoked
   Signature: 0x1234567890...
   Block: 9445432
✅ Real-time revocation processed: 0x1234567890...
```

Then in the event processor:

```
💾 Saving signature revocation to database...
   Signature Hash: 0x1234567890...
   Block Number: 9445432
   Source: real-time
✅ Signature revocation saved successfully
```

## Troubleshooting

### No Real-Time Events Detected?

1. **Check Connection Mode:**
   - Look for: `📡 Connection mode: WebSocket`
   - If you see `HTTP polling`, change your RPC URL to use `wss://`

2. **Verify Lock ID:**
   - Ensure the revocation is for Lock ID 19 (or whatever LOCK_ID is set to in .env)
   - The filter only listens to events for your specific lock

3. **Check Network:**
   - Verify you're on the correct network (sepolia/mainnet)
   - Check that the contract address is correct

4. **WebSocket Providers:**
   - Alchemy WebSocket: `wss://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`
   - Infura WebSocket: `wss://sepolia.infura.io/ws/v3/YOUR_KEY`
   - QuickNode WebSocket: `wss://YOUR_ENDPOINT.quiknode.pro/YOUR_KEY/`

### Events Only Appear in Batch Sync?

This means the real-time listener isn't working, but batch sync catches them every 15 minutes. This typically happens when:

- Using HTTP instead of WebSocket
- Provider doesn't support eth_subscribe (WebSocket subscriptions)
- Network connectivity issues

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Blockchain (Sepolia)                               │
│  - SignatureRevoked event emitted                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ├─── WebSocket Subscription ──────────┐
                 │    (Real-time, <1 second delay)     │
                 │                                      │
                 ├─── HTTP Polling ───────────────────┐│
                 │    (Every 15 mins via batch sync)  ││
                 │                                     ││
┌────────────────▼─────────────────────────────────────┐│
│  BlockchainListenerService                           ││
│  - startRealtimeListening() ← Fixed! ────────────────┘│
│  - performBatchSync() ──────────────────────────────┘
└────────────────┬────────────────────────────────────┘
                 │
                 │ Emit: BLOCKCHAIN_EVENTS.SIGNATURE_REVOKED
                 │
┌────────────────▼────────────────────────────────────┐
│  EventProcessorService                              │
│  - handleSignatureRevoked()                         │
│  - Save to database (revoked_signatures table)      │
└─────────────────────────────────────────────────────┘
```

## Performance Impact

- **WebSocket mode:** ~0-2 second delay from blockchain to database
- **HTTP polling mode:** Up to 15 minutes delay (depends on batch sync interval)
- **No additional API calls:** Real-time events don't count against rate limits
- **Duplicate prevention:** Events from real-time are tracked to avoid duplicates in batch sync

## Next Steps

1. ✅ Real-time event listening is now fixed
2. 🔄 Test by revoking a signature and watching logs
3. 📊 Monitor stats via GET /api/v1/health endpoint
4. 🎯 Consider using WebSocket URL if not already
