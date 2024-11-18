use std::process::Command;

use alloy_primitives::Address;
use alloy_sol_types::sol;
use color_eyre::eyre::Result;
use gadget_sdk::load_abi;
use jobs::{
    manage_batch_posters, set_validators, BatchPosterParams, ServiceContext, TokenBridgeParams,
    ValidatorParams,
};
use serde::{Deserialize, Serialize};

pub mod jobs;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    #[derive(Debug, Serialize, Deserialize)]
    OrbitRaaSBlueprint,
    "../../contracts/out/OrbitRaaSBlueprint.sol/OrbitRaaSBlueprint.json"
);

load_abi!(
    ORBIT_RAAS_BLUEPRINT_ABI,
    "../../contracts/out/OrbitRaaSBlueprint.sol/OrbitRaaSBlueprint.json"
);

#[derive(Serialize, Deserialize)]
struct DeploymentResult {
    rollup_address: Address,
    inbox_address: Address,
    admin_address: Address,
    sequencer_inbox_address: Address,
    transaction_hash: String,
}

#[derive(Serialize)]
struct RollupConfig {
    chain_id: u64,
    owner: Address,
    validators: Vec<Address>,
    batch_posters: Vec<Address>,
    native_token: Option<Address>,
    data_availability_committee: bool,
    is_custom_fee_token: bool,
    custom_fee_token: Option<Address>,
    setup_token_bridge: bool,
    native_token_is_erc20: bool,
}

async fn deploy_rollup(config: RollupConfig) -> Result<DeploymentResult> {
    let config_json = serde_json::to_string(&config)?;
    let output = Command::new("node")
        .arg("scripts/deploy-rollup.ts")
        .arg(config_json)
        .output()?;

    if !output.status.success() {
        return Err(color_eyre::eyre::eyre!(
            "Deployment failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let result: DeploymentResult = serde_json::from_str(&String::from_utf8(output.stdout)?)?;
    Ok(result)
}

async fn setup_initial_configuration(
    deployment: &DeploymentResult,
    config: &RollupConfig,
    context: &ServiceContext,
) -> Result<()> {
    // Configure token bridge if requested (one-time setup)
    if config.setup_token_bridge {
        let output = Command::new("node")
            .arg("scripts/configure-token-bridge.ts")
            .arg(
                serde_json::to_string(&TokenBridgeParams {
                    rollup_address: deployment.rollup_address,
                    native_token: config.native_token.unwrap_or(Address::ZERO),
                    owner: config.owner,
                })
                .unwrap(),
            )
            .output()?;

        if !output.status.success() {
            return Err(color_eyre::eyre::eyre!(
                "Token bridge setup failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    }

    // Set initial batch posters
    let batch_poster_params = BatchPosterParams {
        rollup_address: deployment.rollup_address,
        batch_posters: config.batch_posters.clone(),
        is_active: true,
    };
    manage_batch_posters(batch_poster_params, context.clone())?;

    // Set initial validators
    let validator_params = ValidatorParams {
        rollup_address: deployment.rollup_address,
        validators: config.validators.clone(),
        is_active: true,
    };
    set_validators(validator_params, context.clone())?;

    Ok(())
}
