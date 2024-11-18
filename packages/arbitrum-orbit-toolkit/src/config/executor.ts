import { Address, PrivateKeyAccount, PublicClient } from 'viem';
import {
  upgradeExecutorFetchPrivilegedAccounts,
  upgradeExecutorPrepareAddExecutorTransactionRequest,
  createTokenBridgeFetchTokenBridgeContracts,
} from '@arbitrum/orbit-sdk';
import { sanitizeAddresses } from '../utils/helpers';

export interface ExecutorConfig {
  rollupAddress: Address;
  owner: {
    address: Address;
    account: PrivateKeyAccount;
  };
  upgradeExecutor: Address;
  newExecutors: Address[];
}

export interface ExecutorSetupResult {
  parentChainTxHashes: string[];
  orbitChainTxHashes: string[];
  privilegedAccounts: Address[];
}

export async function addPrivilegedExecutors(
  config: ExecutorConfig,
  parentChainClient: PublicClient,
  orbitChainClient: PublicClient
): Promise<ExecutorSetupResult> {
  // Get token bridge contracts to access upgrade executors
  const tokenBridgeContracts = await createTokenBridgeFetchTokenBridgeContracts({
    inbox: config.rollupAddress,
    parentChainPublicClient: parentChainClient,
  });

  // Store transaction hashes
  const parentChainTxHashes: string[] = [];
  const orbitChainTxHashes: string[] = [];

  // Process each new executor
  for (const newExecutor of sanitizeAddresses(config.newExecutors)) {
    // Add executor on parent chain
    const parentChainRequest = await upgradeExecutorPrepareAddExecutorTransactionRequest({
      account: newExecutor,
      upgradeExecutorAddress: config.upgradeExecutor,
      executorAccountAddress: config.owner.address,
      publicClient: parentChainClient,
    });

    const parentChainSerialized = await config.owner.account.signTransaction(parentChainRequest);
    const parentChainTxHash = await parentChainClient.sendRawTransaction({
      serializedTransaction: parentChainSerialized,
    });
    await parentChainClient.waitForTransactionReceipt({ hash: parentChainTxHash });
    parentChainTxHashes.push(parentChainTxHash);

    // Add executor on orbit chain
    const orbitChainRequest = await upgradeExecutorPrepareAddExecutorTransactionRequest({
      account: newExecutor,
      upgradeExecutorAddress: tokenBridgeContracts.orbitChainContracts.upgradeExecutor,
      executorAccountAddress: config.owner.address,
      publicClient: orbitChainClient,
    });

    const orbitChainSerialized = await config.owner.account.signTransaction(orbitChainRequest);
    const orbitChainTxHash = await orbitChainClient.sendRawTransaction({
      serializedTransaction: orbitChainSerialized,
    });
    await orbitChainClient.waitForTransactionReceipt({ hash: orbitChainTxHash });
    orbitChainTxHashes.push(orbitChainTxHash);
  }

  // Verify executors were added
  const privilegedAccounts = await upgradeExecutorFetchPrivilegedAccounts({
    upgradeExecutorAddress: config.upgradeExecutor,
    publicClient: parentChainClient,
  });

  return {
    parentChainTxHashes,
    orbitChainTxHashes,
    privilegedAccounts: Object.keys(privilegedAccounts) as Address[],
  };
}