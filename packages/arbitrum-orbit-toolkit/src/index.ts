import { Chain, Address } from 'viem';
import { RollupConfig, ChainConfig } from './core/types';

// Export all types
export * from './core/types';
export * from './core/constants';

// Export core functionality
export { createParentChainClient, createOrbitChainClient, createChainClients } from './core/clients';

// Export rollup management
export { createRollup } from './rollup/create';
export { setValidators, getValidatorStatus, isValidator } from './rollup/validators';

// Export bridge functionality
export { createTokenBridge } from './bridge/token';
export { setupFastWithdrawal, isFastConfirmer } from './bridge/fast';

// Export configuration utilities
export { prepareNodeConfiguration } from './config/node';
export { addPrivilegedExecutors } from './config/executor';

// Export helper functions
export {
  getBlockExplorerUrl,
  getTimeDelayFromBlocks,
  withFallbackPrivateKey,
  sanitizeAddresses,
  validateFeeWeights,
  formatTxHash,
} from './utils/helpers';

// Export environment utilities
export {
  validateEnv,
  validateRequiredEnvVars,
  validateOptionalEnvVars,
  validateRollupAddress,
} from './utils/env';

export const createDefaultConfig = (
  chainId: number | string,
  deployer: { address: Address },
  chainConfig: Partial<ChainConfig> = {}
): RollupConfig => ({
  chainId: BigInt(chainId),
  owner: deployer.address,
  chainConfig: {
    chainId: Number(chainId),
    arbitrum: {
      InitialChainOwner: deployer.address,
      DataAvailabilityCommittee: true,
      ...chainConfig.arbitrum,
    },
  },
});

// Re-export commonly used types from viem
export type { Chain, Address };