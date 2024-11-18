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
pub struct DeploymentResult {
    pub rollup_address: Address,
    pub inbox_address: Address,
    pub admin_address: Address,
    pub sequencer_inbox_address: Address,
    pub transaction_hash: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RollupConfig {
    pub chain_id: u64,
    pub owner: Address,
    pub validators: Vec<Address>,
    pub batch_posters: Vec<Address>,
    pub native_token: Option<Address>,
    pub data_availability_committee: bool,
    pub is_custom_fee_token: bool,
    pub custom_fee_token: Option<Address>,
    pub setup_token_bridge: bool,
    pub native_token_is_erc20: bool,
}

pub async fn deploy_rollup(config: RollupConfig) -> Result<DeploymentResult> {
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

pub async fn setup_initial_configuration(
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
    let batch_poster_bytes = serde_json::to_vec(&batch_poster_params)?;
    manage_batch_posters(batch_poster_bytes, context.clone())?;

    // Set initial validators
    let validator_params = ValidatorParams {
        rollup_address: deployment.rollup_address,
        validators: config.validators.clone(),
        is_active: true,
    };
    let validator_bytes = serde_json::to_vec(&validator_params)?;
    set_validators(validator_bytes, context.clone())?;

    Ok(())
}
