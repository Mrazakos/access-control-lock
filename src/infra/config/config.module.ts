import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

/**
 * Configuration interface matching .env structure
 */
export interface AppConfig {
  // Application
  MODE: 'API' | 'NFC' | 'IOT';
  PORT: number;
  NODE_ENV: string;

  // Lock Configuration
  LOCK_ID: number;

  // Network Selection
  NETWORK: 'sepolia' | 'mainnet';

  // Sepolia Configuration
  SEPOLIA_RPC_URL?: string;
  SEPOLIA_CONTRACT_ADDRESS?: string;
  SEPOLIA_START_BLOCK?: number;

  // Mainnet Configuration
  MAINNET_RPC_URL?: string;
  MAINNET_CONTRACT_ADDRESS?: string;
  MAINNET_START_BLOCK?: number;

  // Blockchain Settings
  POLL_INTERVAL: number;
  CONFIRMATIONS: number;

  // Hybrid Sync
  BATCH_SYNC_INTERVAL_MINUTES: number;
  BATCH_SYNC_SIZE: number;

  // Database
  DATABASE_PATH: string;

  // MQTT (Optional)
  MQTT_BROKER_URL?: string;
  MQTT_CLIENT_ID?: string;
  MQTT_USERNAME?: string;
  MQTT_PASSWORD?: string;

  // DID
  DID_RESOLVER_REGISTRY_URL?: string;

  // Logging
  LOG_LEVEL: string;

  // NFC
  NFC_READER_PORT?: string;
  NFC_POLLING_INTERVAL?: number;

  // Cache
  CACHE_TTL?: number;
  CACHE_MAX_ITEMS?: number;

  // Computed properties (network-specific)
  ETHEREUM_RPC_URL: string;
  CONTRACT_ADDRESS: string;
  START_BLOCK: number;
}

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
  ],
})
export class ConfigModule {
  static validate(): AppConfig {
    const errors: string[] = [];
    const network = (process.env.NETWORK || 'sepolia').toLowerCase();

    // Basic validation
    const MODE = (process.env.MODE || 'API') as 'API' | 'NFC' | 'IOT';
    const PORT = parseInt(process.env.PORT || '3000', 10);
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const LOCK_ID = parseInt(process.env.LOCK_ID || '1', 10);
    const NETWORK = network as 'sepolia' | 'mainnet';

    // Validate LOCK_ID
    if (isNaN(LOCK_ID) || LOCK_ID < 0) {
      errors.push('LOCK_ID must be a valid positive number');
    }

    // Validate network
    if (!['sepolia', 'mainnet'].includes(network)) {
      errors.push('NETWORK must be either "sepolia" or "mainnet"');
    }

    // Network-specific RPC URL and Contract Address
    let ETHEREUM_RPC_URL: string;
    let CONTRACT_ADDRESS: string;
    let START_BLOCK: number;

    if (network === 'sepolia') {
      ETHEREUM_RPC_URL = process.env.SEPOLIA_RPC_URL || '';
      CONTRACT_ADDRESS = process.env.SEPOLIA_CONTRACT_ADDRESS || '';
      START_BLOCK = parseInt(process.env.SEPOLIA_START_BLOCK || '0', 10);

      if (!ETHEREUM_RPC_URL) {
        errors.push('SEPOLIA_RPC_URL is required when NETWORK=sepolia');
      }
      if (!CONTRACT_ADDRESS) {
        errors.push('SEPOLIA_CONTRACT_ADDRESS is required when NETWORK=sepolia');
      }
    } else {
      // mainnet
      ETHEREUM_RPC_URL = process.env.MAINNET_RPC_URL || '';
      CONTRACT_ADDRESS = process.env.MAINNET_CONTRACT_ADDRESS || '';
      START_BLOCK = parseInt(process.env.MAINNET_START_BLOCK || '0', 10);

      if (!ETHEREUM_RPC_URL) {
        errors.push('MAINNET_RPC_URL is required when NETWORK=mainnet');
      }
      if (!CONTRACT_ADDRESS) {
        errors.push('MAINNET_CONTRACT_ADDRESS is required when NETWORK=mainnet');
      }
    }

    // Validate contract address format
    if (CONTRACT_ADDRESS && !CONTRACT_ADDRESS.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push(`Invalid contract address format: ${CONTRACT_ADDRESS}`);
    }

    // Blockchain settings
    const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '12000', 10);
    const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || '3', 10);

    // Hybrid sync settings
    const BATCH_SYNC_INTERVAL_MINUTES = parseInt(
      process.env.BATCH_SYNC_INTERVAL_MINUTES || '15',
      10,
    );
    const BATCH_SYNC_SIZE = parseInt(process.env.BATCH_SYNC_SIZE || '1000', 10);

    if (BATCH_SYNC_INTERVAL_MINUTES < 1) {
      errors.push('BATCH_SYNC_INTERVAL_MINUTES must be at least 1');
    }

    if (BATCH_SYNC_SIZE < 1 || BATCH_SYNC_SIZE > 10000) {
      errors.push('BATCH_SYNC_SIZE must be between 1 and 10000');
    }

    // Database
    const DATABASE_PATH = process.env.DATABASE_PATH || './data/vcel.db';

    // Logging
    const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

    // Optional MQTT settings
    const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;
    const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID;
    const MQTT_USERNAME = process.env.MQTT_USERNAME;
    const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

    // Optional DID settings
    const DID_RESOLVER_REGISTRY_URL = process.env.DID_RESOLVER_REGISTRY_URL;

    // Optional NFC settings
    const NFC_READER_PORT = process.env.NFC_READER_PORT;
    const NFC_POLLING_INTERVAL = process.env.NFC_POLLING_INTERVAL
      ? parseInt(process.env.NFC_POLLING_INTERVAL, 10)
      : undefined;

    // Optional cache settings
    const CACHE_TTL = process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL, 10) : undefined;
    const CACHE_MAX_ITEMS = process.env.CACHE_MAX_ITEMS
      ? parseInt(process.env.CACHE_MAX_ITEMS, 10)
      : undefined;

    // Throw errors if validation failed
    if (errors.length > 0) {
      throw new Error(
        `❌ Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
      );
    }

    // Return validated config
    return {
      MODE,
      PORT,
      NODE_ENV,
      LOCK_ID,
      NETWORK,
      SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL,
      SEPOLIA_CONTRACT_ADDRESS: process.env.SEPOLIA_CONTRACT_ADDRESS,
      SEPOLIA_START_BLOCK: process.env.SEPOLIA_START_BLOCK
        ? parseInt(process.env.SEPOLIA_START_BLOCK, 10)
        : undefined,
      MAINNET_RPC_URL: process.env.MAINNET_RPC_URL,
      MAINNET_CONTRACT_ADDRESS: process.env.MAINNET_CONTRACT_ADDRESS,
      MAINNET_START_BLOCK: process.env.MAINNET_START_BLOCK
        ? parseInt(process.env.MAINNET_START_BLOCK, 10)
        : undefined,
      POLL_INTERVAL,
      CONFIRMATIONS,
      BATCH_SYNC_INTERVAL_MINUTES,
      BATCH_SYNC_SIZE,
      DATABASE_PATH,
      MQTT_BROKER_URL,
      MQTT_CLIENT_ID,
      MQTT_USERNAME,
      MQTT_PASSWORD,
      DID_RESOLVER_REGISTRY_URL,
      LOG_LEVEL,
      NFC_READER_PORT,
      NFC_POLLING_INTERVAL,
      CACHE_TTL,
      CACHE_MAX_ITEMS,
      // Computed properties based on selected network
      ETHEREUM_RPC_URL,
      CONTRACT_ADDRESS,
      START_BLOCK,
    };
  }
}
