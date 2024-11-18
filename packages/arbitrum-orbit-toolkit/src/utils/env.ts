import { Address } from 'viem';

export interface RequiredEnvVars {
  DEPLOYER_PRIVATE_KEY: string;
  PARENT_CHAIN_RPC: string;
  BATCH_POSTER_PRIVATE_KEY: string;
  VALIDATOR_PRIVATE_KEY: string;
}

export interface OptionalEnvVars {
  ROLLUP_ADDRESS?: string;
  ETHEREUM_BEACON_RPC_URL?: string;
  ORBIT_CHAIN_RPC?: string;
}

export type EnvVars = RequiredEnvVars & OptionalEnvVars;

/**
 * Validates required environment variables
 */
export function validateRequiredEnvVars(envVars: NodeJS.ProcessEnv): RequiredEnvVars {
  const required: (keyof RequiredEnvVars)[] = [
    'DEPLOYER_PRIVATE_KEY',
    'PARENT_CHAIN_RPC',
    'BATCH_POSTER_PRIVATE_KEY',
    'VALIDATOR_PRIVATE_KEY',
  ];

  const missing = required.filter(key => !envVars[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return {
    DEPLOYER_PRIVATE_KEY: envVars.DEPLOYER_PRIVATE_KEY!,
    PARENT_CHAIN_RPC: envVars.PARENT_CHAIN_RPC!,
    BATCH_POSTER_PRIVATE_KEY: envVars.BATCH_POSTER_PRIVATE_KEY!,
    VALIDATOR_PRIVATE_KEY: envVars.VALIDATOR_PRIVATE_KEY!,
  };
}

/**
 * Validates optional environment variables
 */
export function validateOptionalEnvVars(envVars: NodeJS.ProcessEnv): OptionalEnvVars {
  return {
    ROLLUP_ADDRESS: envVars.ROLLUP_ADDRESS,
    ETHEREUM_BEACON_RPC_URL: envVars.ETHEREUM_BEACON_RPC_URL,
    ORBIT_CHAIN_RPC: envVars.ORBIT_CHAIN_RPC,
  };
}

/**
 * Validates rollup address if provided
 */
export function validateRollupAddress(address?: string): Address | undefined {
  if (!address) return undefined;
  
  if (!address.startsWith('0x') || address.length !== 42) {
    throw new Error('Invalid rollup address format');
  }

  return address as Address;
}

/**
 * Validates all environment variables
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvVars {
  return {
    ...validateRequiredEnvVars(env),
    ...validateOptionalEnvVars(env),
  };
}