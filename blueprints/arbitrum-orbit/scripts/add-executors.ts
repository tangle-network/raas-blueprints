import {
  ExecutorConfig,
  addPrivilegedExecutors,
  createOrbitChainClient,
} from "arbitrum-orbit-toolkit";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

interface ScriptParams extends Omit<ExecutorConfig, "owner"> {
  parentChainRpc: string;
  orbitChainRpc: string;
  chainId: number;
  chainName: string;
  chainNetworkName: string;
  currencyName: string;
  currencySymbol: string;
  currencyDecimals: number;
  ownerPrivateKey: `0x${string}`;
}

function validateParams(params: unknown): asserts params is ScriptParams {
  if (!params || typeof params !== "object") {
    throw new Error("Invalid params: must be an object");
  }

  const requiredFields = [
    "parentChainRpc",
    "orbitChainRpc",
    "chainId",
    "chainName",
    "chainNetworkName",
    "nativeCurrency",
    "ownerPrivateKey",
    "rollupAddress",
    "upgradeExecutor",
    "newExecutors",
  ];

  for (const field of requiredFields) {
    if (!(field in params)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

async function main() {
  const params: ScriptParams = JSON.parse(process.argv[2]);
  validateParams(params);

  const parentChainClient = createPublicClient({
    transport: http(params.parentChainRpc),
  });

  const orbitChainClient = createOrbitChainClient(
    params.chainId,
    params.chainName,
    params.chainNetworkName,
    {
      name: params.currencyName,
      symbol: params.currencySymbol,
      decimals: params.currencyDecimals,
    },
    params.orbitChainRpc,
    params.rollupAddress,
  );

  let account = privateKeyToAccount(params.ownerPrivateKey);

  try {
    const result = await addPrivilegedExecutors(
      {
        rollupAddress: params.rollupAddress,
        newExecutors: params.newExecutors,
        upgradeExecutor: params.upgradeExecutor,
        owner: account,
      },
      parentChainClient,
      orbitChainClient,
    );

    console.log(JSON.stringify({ transactionHash: result }));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
