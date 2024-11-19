"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const arbitrum_orbit_toolkit_1 = require("arbitrum-orbit-toolkit");
const viem_1 = require("viem");
async function main() {
    const params = JSON.parse(process.argv[2]);
    const parentChainClient = (0, viem_1.createPublicClient)({
        transport: (0, viem_1.http)(process.env.PARENT_CHAIN_RPC)
    });
    try {
        const result = await (0, arbitrum_orbit_toolkit_1.setFeeRecipients)({
            rollupAddress: params.rollup_address,
            recipients: params.recipients,
            weights: params.weights,
            upgradeExecutor: process.env.UPGRADE_EXECUTOR_ADDRESS,
            owner: {
                address: process.env.OWNER_ADDRESS,
                account: process.env.OWNER_PRIVATE_KEY
            }
        }, parentChainClient);
        console.log(JSON.stringify({ transactionHash: result }));
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
}
main().catch(console.error);
