"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const arbitrum_orbit_toolkit_1 = require("arbitrum-orbit-toolkit");
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
function validateParams(params) {
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
    const params = JSON.parse(process.argv[2]);
    validateParams(params);
    const parentChainClient = (0, viem_1.createPublicClient)({
        transport: (0, viem_1.http)(process.env.PARENT_CHAIN_RPC),
    });
    const account = (0, accounts_1.privateKeyToAccount)(params.ownerPrivateKey);
    // Prepare complete rollup parameters
    const rollupParams = {
        chainId: params.chainId,
        owner: account,
        validators: params.validators,
        batchPosters: params.batchPosters,
        nativeToken: params.nativeToken,
        dataAvailabilityCommittee: params.dataAvailabilityCommittee,
    };
    try {
        const result = await (0, arbitrum_orbit_toolkit_1.createRollup)(rollupParams, parentChainClient);
        console.log(JSON.stringify({
            rollupAddress: result.rollupAddress,
            inboxAddress: result.inboxAddress,
            adminAddress: result.adminAddress,
            sequencerInboxAddress: result.sequencerInboxAddress,
            transactionHash: result.transactionHash,
        }));
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
}
main().catch(console.error);
