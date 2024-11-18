import { setFeeRecipients } from 'arbitrum-orbit-toolkit';
import { createPublicClient, http } from 'viem';

async function main() {
    const params = JSON.parse(process.argv[2]);
    const parentChainClient = createPublicClient({
        transport: http(process.env.PARENT_CHAIN_RPC)
    });
    
    try {
        const result = await setFeeRecipients({
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
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main().catch(console.error);