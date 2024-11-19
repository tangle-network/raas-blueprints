import { createRollup } from "arbitrum-orbit-toolkit";
import { CreateRollupParams } from "arbitrum-orbit-toolkit/src/rollup/create";
import { Chain, createPublicClient, http, PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

interface ScriptParams extends Omit<CreateRollupParams, "owner"> {
  ownerPrivateKey: `0x${string}`;
}

function validateParams(params: unknown): asserts params is ScriptParams {
  if (!params || typeof params !== "object") {
    throw new Error("Invalid params: must be an object");
  }

  const requiredFields = [
    "ownerPrivateKey",
    "chainId",
    "validators",
    "batchPosters",
    "nativeToken",
    "dataAvailabilityCommittee",
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
    transport: http(process.env.PARENT_CHAIN_RPC),
  });

  const account = privateKeyToAccount(params.ownerPrivateKey);

  // Prepare complete rollup parameters
  const rollupParams: CreateRollupParams = {
    chainId: params.chainId,
    owner: account,
    validators: params.validators,
    batchPosters: params.batchPosters,
    nativeToken: params.nativeToken,
    dataAvailabilityCommittee: params.dataAvailabilityCommittee,
  };

  try {
    const result = await createRollup(rollupParams, parentChainClient);
    console.log(
      JSON.stringify({
        rollupAddress: result.rollupAddress,
        inboxAddress: result.inboxAddress,
        adminAddress: result.adminAddress,
        sequencerInboxAddress: result.sequencerInboxAddress,
        transactionHash: result.transactionHash,
      }),
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
