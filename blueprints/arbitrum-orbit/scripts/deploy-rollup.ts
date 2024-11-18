import { createRollup, CreateRollupParams } from 'arbitrum-orbit-toolkit';
import { createPublicClient, http } from 'viem';

async function main() {
    const config: CreateRollupParams = JSON.parse(process.argv[2]);
    const parentChainClient = createPublicClient({
        transport: http(process.env.PARENT_CHAIN_RPC)
    });
    
    try {
        const result = await createRollup(config, parentChainClient);
        console.log(JSON.stringify({
            rollupAddress: result.rollupAddress,
            inboxAddress: result.inboxAddress,
            adminAddress: result.adminAddress,
            sequencerInboxAddress: result.sequencerInboxAddress,
            transactionHash: result.transactionHash
        }));
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main().catch(console.error);