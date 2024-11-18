import { createTokenBridge } from 'arbitrum-orbit-toolkit';
import { createPublicClient, http } from 'viem';

async function main() {
    const params = JSON.parse(process.argv[2]);
    const parentChainClient = createPublicClient({
        transport: http(process.env.PARENT_CHAIN_RPC)
    });
    
    try {
        const result = await createTokenBridge({
            rollupAddress: params.rollup_address,
            nativeToken: params.native_token,
            owner: params.owner,
            upgradeExecutor: process.env.UPGRADE_EXECUTOR_ADDRESS
        }, parentChainClient);
        
        console.log(JSON.stringify({ transactionHash: result }));
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main().catch(console.error);