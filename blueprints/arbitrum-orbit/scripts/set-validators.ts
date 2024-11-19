import { setValidators, SetValidatorsParams } from "arbitrum-orbit-toolkit";
import { Chain, createPublicClient, http, PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

interface ScriptParams extends Omit<SetValidatorsParams, "owner"> {
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
    "upgradeExecutor",
    "rollupAddress",
    "validators",
    "isActive",
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

  const parentChainClient: PublicClient<any, Chain> = createPublicClient({
    transport: http(params.parentChainRpc),
  });

  const account = privateKeyToAccount(params.ownerPrivateKey);

  try {
    const result = await setValidators(
      {
        rollupAddress: params.rollupAddress,
        validators: params.validators,
        isActive: params.isActive,
        upgradeExecutor: process.env.UPGRADE_EXECUTOR_ADDRESS as `0x${string}`,
        owner: account,
      },
      parentChainClient,
    );

    console.log(JSON.stringify({ transactionHash: result }));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
