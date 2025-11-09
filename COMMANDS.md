# Quick Reference: Common Commands

## Development
```powershell
# Install dependencies
npm install

# Start development server (with hot-reload)
npm run start:dev

# Start in debug mode
npm run start:debug

# Build for production
npm run build

# Start production server
npm run start:prod
```

## Code Quality
```powershell
# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm run test

# Run tests with coverage
npm run test:cov
```

## Docker
```powershell
# Build Docker image
docker build -t vcel:latest .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f vcel-api

# Stop services
docker-compose down
```

## Environment Modes
```powershell
# API Mode (REST API server)
$env:MODE="API"; npm run start:dev

# IoT Mode (Edge device with MQTT)
$env:MODE="IOT"; npm run start:dev

# NFC Mode (NFC reader integration - future)
$env:MODE="NFC"; npm run start:dev
```

## Network Selection
```powershell
# Use Sepolia testnet (default)
$env:NETWORK="sepolia"; npm run start:dev

# Use Ethereum mainnet
$env:NETWORK="mainnet"; npm run start:dev
```

## API Testing
```powershell
# Health check
curl http://localhost:3000/api/v1/health

# Get blockchain status
curl http://localhost:3000/api/v1/events/status

# Get all locks
curl http://localhost:3000/api/v1/locks

# Get revoked signatures for lock ID 1
curl "http://localhost:3000/api/v1/revocations?lockId=1"

# Verify a signature (POST request)
curl -X POST http://localhost:3000/api/v1/verify `
  -H "Content-Type: application/json" `
  -d '{\"message\":\"test\",\"signature\":\"0x...\",\"publicKey\":\"0x...\",\"lockId\":1}'
```

## Database
```powershell
# View SQLite database
sqlite3 ./data/vcel.db

# List tables
sqlite3 ./data/vcel.db ".tables"

# Query locks
sqlite3 ./data/vcel.db "SELECT * FROM locks;"

# Query revoked signatures
sqlite3 ./data/vcel.db "SELECT * FROM revoked_signatures;"

# Query signature entries
sqlite3 ./data/vcel.db "SELECT * FROM signature_entries ORDER BY timestamp DESC LIMIT 10;"
```

## Troubleshooting
```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install

# Clear database (WARNING: Deletes all data)
Remove-Item ./data/vcel.db

# Check TypeScript errors
npm run build

# View detailed logs
$env:LOG_LEVEL="debug"; npm run start:dev
```

## Git Commands
```powershell
# Check status
git status

# Add all changes
git add .

# Commit changes
git commit -m "Your message here"

# Push to remote
git push origin main

# Create new branch
git checkout -b feature/your-feature-name
```

## Useful Links
- Health Check: http://localhost:3000/api/v1/health
- Events Status: http://localhost:3000/api/v1/events/status
- GitHub Repo: https://github.com/Mrazakos/access-control-lock
- Your ECDSA Package: https://www.npmjs.com/package/@mrazakos/vc-ecdsa-crypto
