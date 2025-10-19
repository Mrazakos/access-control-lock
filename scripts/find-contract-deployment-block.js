/**
 * Script to find the deployment block of a contract
 * Usage: node scripts/find-contract-deployment-block.js
 */

const { ethers } = require('ethers');
require('dotenv').config();

async function findDeploymentBlock() {
  const network = process.env.NETWORK || 'sepolia';
  const rpcUrl = network === 'mainnet' ? process.env.MAINNET_RPC_URL : process.env.SEPOLIA_RPC_URL;

  const contractAddress =
    network === 'mainnet'
      ? process.env.MAINNET_CONTRACT_ADDRESS
      : process.env.SEPOLIA_CONTRACT_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    console.error('❌ RPC URL or Contract Address not configured');
    process.exit(1);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 FINDING CONTRACT DEPLOYMENT BLOCK`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Network:  ${network}`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`RPC:      ${rpcUrl.substring(0, 50)}...`);
  console.log(`${'='.repeat(80)}\n`);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`📍 Current block: ${currentBlock}\n`);

    // Method 1: Binary search for first transaction
    console.log(`🔎 Method 1: Binary search for contract creation...\n`);

    let left = 0;
    let right = currentBlock;
    let deploymentBlock = null;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      process.stdout.write(`   Checking block ${mid}...`);

      const code = await provider.getCode(contractAddress, mid);
      const hasCode = code !== '0x';

      if (hasCode) {
        deploymentBlock = mid;
        right = mid - 1;
        console.log(` ✅ Contract exists`);
      } else {
        left = mid + 1;
        console.log(` ⚪ No contract`);
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (deploymentBlock) {
      console.log(`\n✅ Found deployment block: ${deploymentBlock}`);

      // Get block timestamp
      const block = await provider.getBlock(deploymentBlock);
      const date = new Date(block.timestamp * 1000);

      console.log(`📅 Deployment date: ${date.toISOString()}`);
      console.log(`⏰ Timestamp: ${block.timestamp}`);

      // Try to find the exact transaction
      console.log(`\n🔍 Searching for deployment transaction in block ${deploymentBlock}...`);
      const txs = block.transactions;

      for (const txHash of txs) {
        const tx = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);

        if (
          receipt &&
          receipt.contractAddress &&
          receipt.contractAddress.toLowerCase() === contractAddress.toLowerCase()
        ) {
          console.log(`\n✨ DEPLOYMENT TRANSACTION FOUND!`);
          console.log(`   Transaction Hash: ${txHash}`);
          console.log(`   From: ${tx.from}`);
          console.log(`   Block: ${receipt.blockNumber}`);
          console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

          // Etherscan link
          const explorerUrl =
            network === 'mainnet'
              ? `https://etherscan.io/tx/${txHash}`
              : `https://sepolia.etherscan.io/tx/${txHash}`;
          console.log(`   Etherscan: ${explorerUrl}`);
          break;
        }
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📝 RECOMMENDED .env CONFIGURATION:`);
      console.log(`${'='.repeat(80)}`);
      if (network === 'sepolia') {
        console.log(`SEPOLIA_START_BLOCK=${deploymentBlock}`);
      } else {
        console.log(`MAINNET_START_BLOCK=${deploymentBlock}`);
      }
      console.log(`${'='.repeat(80)}\n`);

      console.log(`💡 Update your .env file with the START_BLOCK above to avoid`);
      console.log(`   scanning unnecessary blocks before contract deployment.\n`);
    } else {
      console.log(`\n❌ Could not find deployment block. Contract might not be deployed.`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      console.log(`\n💡 Tip: Rate limited by RPC provider. Try again in a few seconds.`);
    }
    process.exit(1);
  }
}

// Alternative Method 2: Use Etherscan API (if you have API key)
async function findDeploymentViaEtherscan() {
  const network = process.env.NETWORK || 'sepolia';
  const contractAddress =
    network === 'mainnet'
      ? process.env.MAINNET_CONTRACT_ADDRESS
      : process.env.SEPOLIA_CONTRACT_ADDRESS;

  const etherscanApiKey = process.env.ETHERSCAN_API_KEY;

  if (!etherscanApiKey) {
    console.log(`\n⚠️  Method 2 (Etherscan API): Skipped (no ETHERSCAN_API_KEY set)`);
    return;
  }

  console.log(`\n🔎 Method 2: Querying Etherscan API...\n`);

  const baseUrl =
    network === 'mainnet' ? 'https://api.etherscan.io/api' : 'https://api-sepolia.etherscan.io/api';

  const url = `${baseUrl}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${etherscanApiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && data.result && data.result.length > 0) {
      const result = data.result[0];
      console.log(`✅ Contract deployment found via Etherscan:`);
      console.log(`   Transaction Hash: ${result.txHash}`);
      console.log(`   Creator Address: ${result.contractCreator}`);

      // Get transaction details
      const provider = new ethers.providers.JsonRpcProvider(
        network === 'mainnet' ? process.env.MAINNET_RPC_URL : process.env.SEPOLIA_RPC_URL,
      );
      const receipt = await provider.getTransactionReceipt(result.txHash);
      console.log(`   Block Number: ${receipt.blockNumber}`);

      const explorerUrl =
        network === 'mainnet'
          ? `https://etherscan.io/tx/${result.txHash}`
          : `https://sepolia.etherscan.io/tx/${result.txHash}`;
      console.log(`   Etherscan: ${explorerUrl}`);
    } else {
      console.log(`⚠️  No deployment info found via Etherscan API`);
    }
  } catch (error) {
    console.log(`⚠️  Etherscan API query failed: ${error.message}`);
  }
}

// Run
(async () => {
  try {
    await findDeploymentBlock();
    // Optionally try Etherscan API as well
    // await findDeploymentViaEtherscan();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
