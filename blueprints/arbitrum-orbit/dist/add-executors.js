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
    const params = JSON.parse(process.argv[2]);
    validateParams(params);
    const parentChainClient = (0, viem_1.createPublicClient)({
        transport: (0, viem_1.http)(params.parentChainRpc),
    });
    const orbitChainClient = (0, arbitrum_orbit_toolkit_1.createOrbitChainClient)(params.chainId, params.chainName, params.chainNetworkName, {
        name: params.currencyName,
        symbol: params.currencySymbol,
        decimals: params.currencyDecimals,
    }, params.orbitChainRpc, params.rollupAddress);
    let account = (0, accounts_1.privateKeyToAccount)(params.ownerPrivateKey);
    try {
        const result = await (0, arbitrum_orbit_toolkit_1.addPrivilegedExecutors)({
            rollupAddress: params.rollupAddress,
            newExecutors: params.newExecutors,
            upgradeExecutor: params.upgradeExecutor,
            owner: account,
        }, parentChainClient, orbitChainClient);
        console.log(JSON.stringify({ transactionHash: result }));
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
}
main().catch(console.error);
