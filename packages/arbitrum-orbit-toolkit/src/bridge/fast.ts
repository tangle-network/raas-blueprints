import {
  Address,
  PublicClient,
  Hash,
  TransactionRequest,
  PrivateKeyAccount,
} from "viem";
import {
  createRollupPrepareTransactionReceipt,
  setAnyTrustFastConfirmerPrepareTransactionRequest,
  rollupAdminLogicPublicActions,
} from "@arbitrum/orbit-sdk";
import { getTimeDelayFromBlocks } from "../utils/helpers";

export interface FastWithdrawalConfig {
  rollupAddress: Address;
  owner: PrivateKeyAccount;
  upgradeExecutor: Address;
  minimumAssertionPeriod: bigint;
  fastConfirmer: Address;
}

export interface FastWithdrawalSetupResult {
  transactionHash: Hash;
  minimumAssertionPeriod: bigint;
  batchPosterConfig: {
    maxDelay: string;
  };
  validatorConfig: {
    enableFastConfirmation: boolean;
    makeAssertionInterval: string;
  };
}

/**
 * Sets up fast withdrawal for an AnyTrust chain
 */
export async function setupFastWithdrawal(
  config: FastWithdrawalConfig,
  parentChainClient: PublicClient,
): Promise<FastWithdrawalSetupResult> {
  const client = parentChainClient.extend(
    rollupAdminLogicPublicActions({
      rollup: config.rollupAddress,
    }),
  );

  // Get current minimum assertion period
  const currentMinimumAssertionPeriod =
    (await client.rollupAdminLogicReadContract({
      functionName: "minimumAssertionPeriod",
    })) as bigint;

  // Set minimum assertion period if needed
  if (currentMinimumAssertionPeriod !== config.minimumAssertionPeriod) {
    const setMinimumPeriodRequest =
      (await client.rollupAdminLogicPrepareTransactionRequest({
        functionName: "setMinimumAssertionPeriod",
        args: [config.minimumAssertionPeriod],
        upgradeExecutor: config.upgradeExecutor,
        account: config.owner.address,
      })) as TransactionRequest;

    const txHash = await parentChainClient.sendRawTransaction({
      serializedTransaction: setMinimumPeriodRequest as `0x${string}`,
    });
    await parentChainClient.waitForTransactionReceipt({ hash: txHash });
  }

  // Set fast confirmer configuration
  const fastConfirmerRequest =
    (await setAnyTrustFastConfirmerPrepareTransactionRequest({
      publicClient: parentChainClient,
      rollup: config.rollupAddress,
      fastConfirmer: config.fastConfirmer,
      account: config.owner,
      upgradeExecutor: config.upgradeExecutor,
    })) as TransactionRequest;

  const fastConfirmerTxHash = await parentChainClient.sendRawTransaction({
    serializedTransaction: fastConfirmerRequest as `0x${string}`,
  });

  const receipt = createRollupPrepareTransactionReceipt(
    await parentChainClient.waitForTransactionReceipt({
      hash: fastConfirmerTxHash,
    }),
  );

  if (!parentChainClient.chain) {
    throw new Error("Parent chain client must have a chain configured");
  }

  // Calculate time delay for node configurations
  const timeDelay = getTimeDelayFromBlocks(
    parentChainClient.chain.id,
    config.minimumAssertionPeriod,
  );

  return {
    transactionHash: receipt.transactionHash,
    minimumAssertionPeriod: config.minimumAssertionPeriod,
    batchPosterConfig: {
      maxDelay: timeDelay,
    },
    validatorConfig: {
      enableFastConfirmation: true,
      makeAssertionInterval: timeDelay,
    },
  };
}

export async function isFastConfirmer(
  rollupAddress: Address,
  confirmerAddress: Address,
  parentChainClient: PublicClient,
): Promise<boolean> {
  const client = parentChainClient.extend(
    rollupAdminLogicPublicActions({
      rollup: rollupAddress,
    }),
  );

  const result = (await client.rollupAdminLogicReadContract({
    functionName: "isFastConfirmer",
    args: [confirmerAddress],
  })) as boolean;

  return result;
}
