import { Address, Chain, PrivateKeyAccount, PublicClient } from 'viem';
import { prepareChainConfig } from '@arbitrum/orbit-sdk';
import {
  createRollupPrepareDeploymentParamsConfig,
  createRollupEnoughCustomFeeTokenAllowance,
  createRollupPrepareCustomFeeTokenApprovalTransactionRequest,
  createRollupPrepareTransactionRequest,
  createRollupPrepareTransactionReceipt,
} from '@arbitrum/orbit-sdk';

export interface CreateRollupParams {
  chainId: number | bigint;
  owner: {
    address: Address;
    account: PrivateKeyAccount;
  };
  validators: Address[];
  batchPosters: Address[];
  nativeToken?: Address;
  dataAvailabilityCommittee?: boolean;
}

export interface CreateRollupResult {
  transactionHash: string;
  rollupAddress: Address;
  inboxAddress: Address;
  adminAddress: Address;
  sequencerInboxAddress: Address;
}

/**
 * Creates a new rollup with either ETH or custom token as fee
 */
export async function createRollup(
  params: CreateRollupParams,
  parentChainClient: PublicClient<any, Chain>
): Promise<CreateRollupResult> {
  // Create chain config
  const chainConfig = prepareChainConfig({
    chainId: Number(params.chainId),
    arbitrum: {
      InitialChainOwner: params.owner.address,
      DataAvailabilityCommittee: params.dataAvailabilityCommittee ?? true,
    },
  });

  // Prepare deployment params
  const config = createRollupPrepareDeploymentParamsConfig(parentChainClient, {
    chainId: BigInt(params.chainId),
    owner: params.owner.address,
    chainConfig,
  });

  // Handle custom fee token if specified
  if (params.nativeToken) {
    const allowanceParams = {
      nativeToken: params.nativeToken,
      account: params.owner.address,
      publicClient: parentChainClient,
    };

    // Check and approve token allowance if needed
    if (!(await createRollupEnoughCustomFeeTokenAllowance(allowanceParams))) {
      const approvalRequest = await createRollupPrepareCustomFeeTokenApprovalTransactionRequest(
        allowanceParams
      );

      const signedApprovalTx = await params.owner.account.signTransaction({
        to: approvalRequest.to,
        data: approvalRequest.data,
        chainId: await parentChainClient.getChainId(),
        maxFeePerGas: approvalRequest.maxFeePerGas,
        maxPriorityFeePerGas: approvalRequest.maxPriorityFeePerGas,
        gas: approvalRequest.gas,
        nonce: approvalRequest.nonce,
        type: 'eip1559' as const,
      });

      const approvalTxHash = await parentChainClient.sendRawTransaction({
        serializedTransaction: signedApprovalTx,
      });

      await parentChainClient.waitForTransactionReceipt({ hash: approvalTxHash });
    }
  }

  // Prepare and send rollup creation transaction
  const txRequest = await createRollupPrepareTransactionRequest({
    params: {
      config,
      batchPosters: params.batchPosters,
      validators: params.validators,
      nativeToken: params.nativeToken,
    },
    account: params.owner.address,
    publicClient: parentChainClient,
  });

  const signedTx = await params.owner.account.signTransaction({
    to: txRequest.to,
    data: txRequest.data,
    chainId: await parentChainClient.getChainId(),
    maxFeePerGas: txRequest.maxFeePerGas,
    maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas,
    gas: txRequest.gas,
    nonce: txRequest.nonce,
    type: 'eip1559' as const,
  });

  const txHash = await parentChainClient.sendRawTransaction({
    serializedTransaction: signedTx,
  });

  const receipt = createRollupPrepareTransactionReceipt(
    await parentChainClient.waitForTransactionReceipt({ hash: txHash })
  );

  const contracts = receipt.getCoreContracts();

  return {
    transactionHash: receipt.transactionHash,
    rollupAddress: contracts.rollup,
    inboxAddress: contracts.inbox,
    adminAddress: contracts.adminProxy,
    sequencerInboxAddress: contracts.sequencerInbox,
  };
}
