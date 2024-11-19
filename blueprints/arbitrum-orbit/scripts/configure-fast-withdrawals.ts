import {
  FastWithdrawalConfig,
  setupFastWithdrawal,
} from "arbitrum-orbit-toolkit";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

interface ScriptParams extends Omit<FastWithdrawalConfig, "owner"> {
  parentChainRpc: string;
  ownerPrivateKey: `0x${string}`;
}

function validateParams(params: unknown): asserts params is ScriptParams {
  if (!params || typeof params !== "object") {
    throw new Error("Invalid params: must be an object");
  }

  const requiredFields = [
    "parentChainRpc",
    "ownerPrivateKey",
    "ownerAddress",
    "rollupAddress",
    "upgradeExecutor",
    "minimumAssertionPeriod",
    "fastConfirmer",
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

  const account = privateKeyToAccount(params.ownerPrivateKey);

  try {
    const result = await setupFastWithdrawal(
      {
        rollupAddress: params.rollupAddress,
        owner: account,
        upgradeExecutor: params.upgradeExecutor,
        minimumAssertionPeriod: params.minimumAssertionPeriod,
        fastConfirmer: params.fastConfirmer,
      },
      parentChainClient,
    );

    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
