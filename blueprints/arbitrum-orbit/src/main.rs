use alloy_primitives::Address;
use arbitrum_orbit_blueprint::{jobs::{AddExecutorsEventHandler, ConfigureFastWithdrawalsEventHandler, ConfigureFeeRecipientsEventHandler, ManageBatchPostersEventHandler, SetValidatorsEventHandler}, OrbitRaaSBlueprint};
use color_eyre::Result;
use gadget_sdk::{self as sdk, utils::evm::get_provider_http};
use sdk::runners::tangle::TangleConfig;
use sdk::runners::BlueprintRunner;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[sdk::main(env)]
async fn main() -> Result<()> {
    let service_id = env.service_id().unwrap();
    let provider = get_provider_http(&env.http_rpc_endpoint);
    let blueprint_address = Address::from([0; 20]);
    let contract = OrbitRaaSBlueprint::new(blueprint_address, provider);
    let rollup_config_return = contract.getRollupConfig(service_id).call().await?;
    
    let rollup_config = RollupConfig {
        chain_id: rollup_config_return.chainId,
        owner: rollup_config_return.owner,
        validators: rollup_config_return.validators,
        batch_posters: rollup_config_return.batchPosters,
        native_token: if rollup_config_return.nativeToken == Address::ZERO {
            None
        } else {
            Some(rollup_config_return.nativeToken)
        },
        data_availability_committee: rollup_config_return.dataAvailabilityCommittee,
        is_custom_fee_token: rollup_config_return.isCustomFeeToken,
        custom_fee_token: if rollup_config_return.customFeeToken == Address::ZERO {
            None
        } else {
            Some(rollup_config_return.customFeeToken)
        },
        setup_token_bridge: rollup_config_return.setupTokenBridge,
        native_token_is_erc20: rollup_config_return.nativeTokenIsERC20,
    };

    gadget_sdk::info!("Starting rollup deployment...");

    let deployment_result = deploy_rollup(rollup_config.clone()).await?;
    gadget_sdk::info!("Rollup deployed at: {}", deployment_result.rollup_address);

    let context = ServiceContext {
        config: env.clone(),
    };

    // Setup initial configuration
    setup_initial_configuration(&deployment_result, &rollup_config, &context).await?;
    gadget_sdk::info!("Initial configuration completed");

    // Initialize all jobs
    let set_validators = SetValidatorsEventHandler::new(&env, context).await?;
    let add_executors = AddExecutorsEventHandler::new(&env, context).await?;
    let configure_fast_withdrawals = ConfigureFastWithdrawalsEventHandler::new(&env, context).await?;
    let manage_batch_postesr = ManageBatchPostersEventHandler::new(&env, context).await?;
    let configure_fee_recipients = ConfigureFeeRecipientsEventHandler::new(&env, context).await?;

    // Start the event watcher
    let tangle_config = TangleConfig::default();
    BlueprintRunner::new(tangle_config, env)
        .job(set_validators)
        .job(add_executors)
        .job(configure_fast_withdraw)
        .job(manage_batch_posters)
        .job(configure_fee_recipients)
        .run().await?;

    gadget_sdk::info!("Exiting...");
    Ok(())
}