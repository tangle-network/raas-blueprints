import { createPublicClient, http, Chain, PublicClient } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { 
  arbOwnerPublicActions, 
  arbGasInfoPublicActions,
  rollupAdminLogicPublicActions 
} from '@arbitrum/orbit-sdk';
import type { ClientConfig } from './types';

/**
 * Creates a public client for the parent chain with optional RPC URL
 */
export function createParentChainClient(
  chain: Chain = arbitrumSepolia,
  rpcUrl?: string
): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Creates a public client for the orbit chain with required extensions
 */
export function createOrbitChainClient(
  chainId: number,
  rpcUrl: string,
  rollupAddress?: `0x${string}`
): PublicClient {
  const client = createPublicClient({
    chain: {
      id: chainId,
      name: 'Orbit Chain',
      network: 'orbit',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [rpcUrl] },
        public: { http: [rpcUrl] },
      },
    },
    transport: http(),
  }).extend(arbOwnerPublicActions)
    .extend(arbGasInfoPublicActions);

  // Add rollup admin actions if rollup address is provided
  if (rollupAddress) {
    return client.extend(
      rollupAdminLogicPublicActions({
        rollup: rollupAddress,
      })
    );
  }

  return client;
}

/**
 * Creates both parent and orbit chain clients from a single config
 */
export function createChainClients(config: ClientConfig) {
  const parentClient = createParentChainClient(
    config.parentChain,
    config.parentChainRpc
  );

  const orbitClient = config.orbitChainId && config.orbitChainRpc
    ? createOrbitChainClient(config.orbitChainId, config.orbitChainRpc)
    : undefined;

  return {
    parentChainClient: parentClient,
    orbitChainClient: orbitClient,
  };
}