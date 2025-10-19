# VCEL Setup Script for Windows PowerShell

Write-Host "🔐 VCEL - Verifiable Credential Event Listener Setup" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 20+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✓ npm $npmVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ npm not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Create .env file if it doesn't exist
if (-Not (Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Please edit .env file and configure:" -ForegroundColor Yellow
    Write-Host "   - SEPOLIA_RPC_URL (Get from https://alchemy.com or https://infura.io)" -ForegroundColor Yellow
    Write-Host "   - SEPOLIA_CONTRACT_ADDRESS (Your deployed contract address)" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Create data directory
if (-Not (Test-Path "data")) {
    Write-Host "Creating data directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "✓ Data directory created" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your configuration" -ForegroundColor White
Write-Host "2. Run: npm run start:dev" -ForegroundColor White
Write-Host "3. Visit: http://localhost:3000/api/v1/health" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see:" -ForegroundColor Cyan
Write-Host "- README.md - Project documentation" -ForegroundColor White
Write-Host "- MIGRATION_GUIDE.md - Integration details" -ForegroundColor White
Write-Host ""
