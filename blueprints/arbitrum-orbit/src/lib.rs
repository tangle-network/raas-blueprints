use std::process::Command;

use alloy_primitives::Address;
use alloy_sol_types::sol;
use color_eyre::eyre::Result;
use gadget_sdk::load_abi;
use jobs::{set_validators, ServiceContext, TokenBridgeParams, ValidatorParams};
use serde::{Deserialize, Serialize};
use serde_json::json;

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
pub struct OrbitDeploymentResult {
    pub rollup_address: Address,
    pub inbox_address: Address,
    pub admin_address: Address,
    pub sequencer_inbox_address: Address,
    pub transaction_hash: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OrbitRollupConfig {
    pub parent_chain_id: u64,
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

pub async fn deploy_rollup(config: OrbitRollupConfig) -> Result<OrbitDeploymentResult> {
    let params = json!({
        "chainId": config.chain_id,
        "owner": {
            "address": config.owner,
            "account": std::env::var("OWNER_PRIVATE_KEY")?
        },
        "validators": config.validators,
        "batchPosters": config.batch_posters,
        "nativeToken": config.native_token,
        "dataAvailabilityCommittee": config.data_availability_committee,
        "isCustomFeeToken": config.is_custom_fee_token,
        "customFeeToken": config.custom_fee_token,
        "nativeTokenIsERC20": config.native_token_is_erc20
    });

    let output = Command::new("node")
        .arg("scripts/deploy-rollup.ts")
        .arg(params.to_string())
        .output()?;

    if !output.status.success() {
        return Err(color_eyre::eyre::eyre!(
            "Deployment failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let result: OrbitDeploymentResult = serde_json::from_str(&String::from_utf8(output.stdout)?)?;
    Ok(result)
}

pub async fn setup_initial_configuration(
    deployment: &OrbitDeploymentResult,
    config: &OrbitRollupConfig,
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
