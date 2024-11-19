import { Address, Hash, PublicClient } from "viem";
import { writeFile } from "fs/promises";
import {
  ChainConfig,
  PrepareNodeConfigParams,
  createRollupPrepareTransaction,
  createRollupPrepareTransactionReceipt,
  prepareNodeConfig,
} from "@arbitrum/orbit-sdk";
import { getParentChainLayer } from "@arbitrum/orbit-sdk/utils";
import { ParentChainId } from "@arbitrum/orbit-sdk";
import { validateParentChain } from "@arbitrum/orbit-sdk/dist/types/ParentChain";

export interface NodeConfigParams {
  chainName: string;
  deploymentTxHash: string;
  batchPosterPrivateKey: `0x${string}`;
  validatorPrivateKey: `0x${string}`;
  parentChainId: number;
  parentChainRpcUrl: string;
  parentChainBeaconRpcUrl?: string;
  outputPath?: string;
}

export interface NodeConfigResult {
  chainConfig: ChainConfig;
  coreContracts: {
    rollup: Address;
    inbox: Address;
    outbox: Address;
    adminProxy: Address;
    sequencerInbox: Address;
    bridge: Address;
    utils: Address;
    validatorUtils: Address;
    validatorWalletCreator: Address;
    deployedAt: number;
  };
  configPath: string;
}

/**
 * Prepares node configuration for validators and batch posters
 */
export async function prepareNodeConfiguration(
  params: NodeConfigParams,
  parentChainClient: PublicClient,
): Promise<NodeConfigResult> {
  // Get deployment transaction
  const tx = await createRollupPrepareTransaction(
    await parentChainClient.getTransaction({
      hash: params.deploymentTxHash as Hash,
    }),
  );

  // Get transaction receipt
  const txReceipt = createRollupPrepareTransactionReceipt(
    await parentChainClient.waitForTransactionReceipt({
      hash: params.deploymentTxHash as Hash,
    }),
  );

  // Get chain config from transaction inputs
  const chainConfig: ChainConfig = JSON.parse(
    tx.getInputs()[0].config.chainConfig,
  );

  const coreContracts = {
    ...txReceipt.getCoreContracts(),
    utils: "0x0" as Address,
    deployedAt: Math.floor(Date.now() / 1000),
  };

  // Prepare node config parameters
  let parentChainId = validateParentChain(params.parentChainId)
    .chainId as ParentChainId;
  const nodeConfigParameters: PrepareNodeConfigParams = {
    chainName: params.chainName,
    chainConfig,
    coreContracts,
    batchPosterPrivateKey: params.batchPosterPrivateKey,
    validatorPrivateKey: params.validatorPrivateKey,
    parentChainId: parentChainId,
    parentChainRpcUrl: params.parentChainRpcUrl,
  };

  // Add beacon RPC URL for L2 Orbit chains settling to Ethereum
  if (getParentChainLayer(parentChainId) === 1) {
    if (!params.parentChainBeaconRpcUrl) {
      throw new Error(
        "Parent chain beacon RPC URL required for L2 Orbit chains",
      );
    }
    nodeConfigParameters.parentChainBeaconRpcUrl =
      params.parentChainBeaconRpcUrl;
  }

  // Generate node config
  const nodeConfig = prepareNodeConfig(nodeConfigParameters);

  // Write config to file
  const outputPath = params.outputPath || "node-config.json";
  await writeFile(outputPath, JSON.stringify(nodeConfig, null, 2));

  return {
    chainConfig,
    coreContracts,
    configPath: outputPath,
  };
}
