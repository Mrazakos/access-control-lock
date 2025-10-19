# WebSocket Connection Fix

## Problem

When trying to use WebSocket URL (`wss://...`), the service failed with:

```
ERROR [BlockchainListenerService] ❌ Failed to initialize blockchain listener:
could not detect network (event="noNetwork", code=NETWORK_ERROR, version=providers/5.8.0)
```

## Root Cause

The code was using `JsonRpcProvider` for all connections, but this provider type doesn't support WebSocket URLs. WebSocket URLs require `WebSocketProvider`.

## Solution

### Changed Provider Type Declaration

```typescript
// Before
private provider: ethers.providers.JsonRpcProvider;

// After
private provider: ethers.providers.JsonRpcProvider | ethers.providers.WebSocketProvider;
```

### Added Smart Provider Selection

The service now automatically detects the URL scheme and uses the correct provider:

```typescript
// Initialize provider based on URL scheme (wss:// = WebSocket, https:// = HTTP)
if (
  this.networkConfig.rpcUrl.startsWith('wss://') ||
  this.networkConfig.rpcUrl.startsWith('ws://')
) {
  this.logger.log('📡 Initializing WebSocket provider for real-time events...');
  this.provider = new ethers.providers.WebSocketProvider(this.networkConfig.rpcUrl);
} else {
  this.logger.log('📡 Initializing JSON-RPC provider (HTTP polling)...');
  this.provider = new ethers.providers.JsonRpcProvider(this.networkConfig.rpcUrl);
}
```

### Added Proper WebSocket Cleanup

```typescript
// Close WebSocket connection if using WebSocketProvider
if ('destroy' in this.provider && typeof this.provider.destroy === 'function') {
  await this.provider.destroy();
  this.logger.log('📡 WebSocket connection closed');
}
```

## What You'll See Now

When starting the service with a WebSocket URL:

```
📡 Initializing WebSocket provider for real-time events...
Connected to network: sepolia (chainId: 11155111)
🎧 Starting real-time event listening for Lock 19...
✅ Real-time event listening active
📡 Connection mode: WebSocket
✅ Hybrid sync system started successfully
```

When starting with an HTTP URL:

```
📡 Initializing JSON-RPC provider (HTTP polling)...
Connected to network: sepolia (chainId: 11155111)
🎧 Starting real-time event listening for Lock 19...
✅ Real-time event listening active
📡 Connection mode: HTTP polling
⚠️  Using HTTP polling - real-time events may be delayed. Consider using WebSocket URL (wss://...)
```

## Configuration

Your `.env` is now correctly set up:

```bash
SEPOLIA_RPC_URL=wss://eth-sepolia.g.alchemy.com/v2/OTazlXjnOhgAqyGTNdkM0DMVhmK0PE4B
```

## All Fixes Combined

1. ✅ Fixed TypeChain event callback signature
2. ✅ Changed RPC URL from `https://` to `wss://`
3. ✅ Auto-detect URL scheme and use correct provider type
4. ✅ Proper WebSocket connection cleanup
5. ✅ Removed noisy block logging

## Test Real-Time Events

1. Start the service: `npm run start:dev`
2. Look for: `📡 Initializing WebSocket provider for real-time events...`
3. Revoke a signature from your smart contract for Lock ID 19
4. You should immediately see:
   ```
   🔴 Real-time event detected: SignatureRevoked
      Signature: 0xabcd123456...
      Block: 9445432
   ✅ Real-time revocation processed: 0xabcd123456...
   ```

Real-time events should now work with **<1 second delay** from blockchain to database! 🚀
