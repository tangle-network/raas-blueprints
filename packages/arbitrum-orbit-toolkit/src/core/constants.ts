import { Chain } from 'viem';
import { arbitrumSepolia, arbitrum as arbitrumOne, arbitrumNova } from 'viem/chains';

export const CHAIN_IDS = {
  ARBITRUM_ONE: arbitrumOne.id,
  ARBITRUM_NOVA: arbitrumNova.id,
  ARBITRUM_SEPOLIA: arbitrumSepolia.id,
} as const;

export const DEFAULT_CHAINS: Record<number, Chain> = {
  [CHAIN_IDS.ARBITRUM_ONE]: arbitrumOne,
  [CHAIN_IDS.ARBITRUM_NOVA]: arbitrumNova,
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: arbitrumSepolia,
} as const;

export const CHAIN_BLOCK_TIMES = {
  ETHEREUM: 12n, // ~12 seconds
  OPTIMISM: 2n,  // ~2 seconds
  ARBITRUM: 12n, // Uses L1 block time
} as const;

export const FEE_DISTRIBUTION = {
  TOTAL_BASIS_POINTS: 10000n,
  DEFAULT_WEIGHT: 5000n, // 50%
} as const;

export const VALIDATION = {
  MIN_VALIDATORS: 1,
  MAX_VALIDATORS: 100,
  MIN_BATCH_POSTERS: 1,
  MAX_BATCH_POSTERS: 50,
  MIN_CONFIRMATIONS: 1,
  MAX_CONFIRMATIONS: 10,
} as const;

export const DEFAULT_CONFIG = {
  DATA_AVAILABILITY_COMMITTEE: true,
  MINIMUM_ASSERTION_PERIOD: 100n,
  CHALLENGE_PERIOD_BLOCKS: 20n,
} as const;

export const ERROR_MESSAGES = {
  INVALID_CHAIN_ID: 'Invalid chain ID provided',
  INVALID_ADDRESS: 'Invalid address format',
  INVALID_PRIVATE_KEY: 'Invalid private key format',
  INVALID_FEE_WEIGHTS: 'Fee weights must sum to 10000 basis points',
  INVALID_VALIDATOR_COUNT: 'Invalid number of validators',
  INVALID_BATCH_POSTER_COUNT: 'Invalid number of batch posters',
  INVALID_CONFIRMATION_COUNT: 'Invalid number of confirmations',
} as const;