import { Address, PublicClient, PrivateKeyAccount } from 'viem';
import {
  createTokenBridgeEnoughCustomFeeTokenAllowance,
  createTokenBridgePrepareCustomFeeTokenApprovalTransactionRequest,
  createTokenBridgePrepareTransactionRequest,
  createTokenBridgePrepareTransactionReceipt,
  createTokenBridgePrepareSetWethGatewayTransactionRequest,
  createTokenBridgePrepareSetWethGatewayTransactionReceipt,
} from '@arbitrum/orbit-sdk';
import type { TokenBridgeContracts } from '../core/types';

export interface CreateTokenBridgeParams {
  rollupAddress: Address;
  owner: {
    address: Address;
    account: PrivateKeyAccount;
  };
  nativeToken?: Address;
  retryableGasOverrides?: {
    gasLimit?: {
      percentIncrease: bigint;
    };
  };
}

export interface CreateTokenBridgeResult {
  transactionHash: string;
  contracts: TokenBridgeContracts;
  retryableHashes: string[];
}

/**
 * Creates a token bridge with either ETH or custom token as fee
 */
export async function createTokenBridge(
  params: CreateTokenBridgeParams,
  parentChainClient: PublicClient,
  orbitChainClient: PublicClient
): Promise<CreateTokenBridgeResult> {
  // Handle custom fee token if specified
  if (params.nativeToken) {
    const allowanceParams = {
      nativeToken: params.nativeToken,
      owner: params.owner.address,
      publicClient: parentChainClient,
    };

    if (!(await createTokenBridgeEnoughCustomFeeTokenAllowance(allowanceParams))) {
      const approvalRequest = await createTokenBridgePrepareCustomFeeTokenApprovalTransactionRequest(
        allowanceParams
      );

      const approvalSerialized = await params.owner.account.signTransaction(approvalRequest);
      const approvalTxHash = await parentChainClient.sendRawTransaction({
        serializedTransaction: approvalSerialized,
      });

      await parentChainClient.waitForTransactionReceipt({ hash: approvalTxHash });
    }
  }

  // Deploy token bridge
  const txRequest = await createTokenBridgePrepareTransactionRequest({
    params: {
      rollup: params.rollupAddress,
      rollupOwner: params.owner.address,
    },
    parentChainPublicClient: parentChainClient,
    orbitChainPublicClient: orbitChainClient,
    account: params.owner.address,
  });

  const txSerialized = await params.owner.account.signTransaction(txRequest);
  const txHash = await parentChainClient.sendRawTransaction({
    serializedTransaction: txSerialized,
  });

  const receipt = createTokenBridgePrepareTransactionReceipt(
    await parentChainClient.waitForTransactionReceipt({ hash: txHash })
  );

  // Wait for retryables to execute
  const retryableReceipts = await receipt.waitForRetryables({
    orbitPublicClient: orbitChainClient,
  });

  // Set WETH gateway if using ETH as fee token
  if (!params.nativeToken) {
    const wethRequest = await createTokenBridgePrepareSetWethGatewayTransactionRequest({
      rollup: params.rollupAddress,
      parentChainPublicClient: parentChainClient,
      orbitChainPublicClient: orbitChainClient,
      account: params.owner.address,
      retryableGasOverrides: params.retryableGasOverrides,
    });

    const wethSerialized = await params.owner.account.signTransaction(wethRequest);
    const wethTxHash = await parentChainClient.sendRawTransaction({
      serializedTransaction: wethSerialized,
    });

    const wethReceipt = createTokenBridgePrepareSetWethGatewayTransactionReceipt(
      await parentChainClient.waitForTransactionReceipt({ hash: wethTxHash })
    );

    const wethRetryableReceipts = await wethReceipt.waitForRetryables({
      orbitPublicClient: orbitChainClient,
    });

    retryableReceipts.push(...wethRetryableReceipts);
  }

  const contracts = await receipt.getTokenBridgeContracts({
    parentChainPublicClient: parentChainClient,
  });

  return {
    transactionHash: receipt.transactionHash,
    contracts,
    retryableHashes: retryableReceipts.map(r => r.transactionHash),
  };
}