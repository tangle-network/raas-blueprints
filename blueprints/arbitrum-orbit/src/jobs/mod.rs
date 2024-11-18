use alloy_primitives::Address;
use api::services::events::JobCalled;
use gadget_sdk as sdk;
use sdk::event_listener::tangle::{
    jobs::{services_post_processor, services_pre_processor},
    TangleEventListener,
};
use sdk::tangle_subxt::tangle_testnet_runtime::api;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::process::Command;

#[derive(Clone)]
pub struct ServiceContext {
    pub config: sdk::config::StdGadgetConfiguration,
}

// Parameters for validator management
#[derive(Serialize, Deserialize)]
pub struct ValidatorParams {
    pub rollup_address: Address,
    pub validators: Vec<Address>,
    pub is_active: bool,
}

// Parameters for privileged executor management
#[derive(Serialize, Deserialize)]
pub struct ExecutorParams {
    pub rollup_address: Address,
    pub new_executors: Vec<Address>,
}

// Parameters for token bridge configuration
#[derive(Serialize, Deserialize)]
pub struct TokenBridgeParams {
    pub rollup_address: Address,
    pub native_token: Address,
    pub owner: Address,
}

// Parameters for fast withdrawal configuration
#[derive(Serialize, Deserialize)]
pub struct FastWithdrawalParams {
    pub rollup_address: Address,
    pub confirmers: Vec<Address>,
    pub is_active: bool,
}

// Parameters for batch poster management
#[derive(Serialize, Deserialize)]
pub struct BatchPosterParams {
    pub rollup_address: Address,
    pub batch_posters: Vec<Address>,
    pub is_active: bool,
}

// Parameters for fee recipient configuration
#[derive(Serialize, Deserialize)]
pub struct FeeRecipientParams {
    pub rollup_address: Address,
    pub recipients: Vec<Address>,
    pub weights: Vec<u64>,
}

// Macro to reduce code duplication in job implementations
macro_rules! impl_node_script_job {
    ($job_name:ident, $params_type:ty, $id:expr) => {
        #[sdk::job(
            id = $id,
            params(params),
            event_listener(
                listener = TangleEventListener::<ServiceContext, JobCalled>,
                pre_processor = services_pre_processor,
            ),
        )]
        pub fn $job_name(
            params: $params_type,
            _context: ServiceContext,
        ) -> Result<String, std::io::Error> {
            let output = Command::new("node")
                .arg(concat!("scripts/", stringify!($job_name).replace("_", "-"), ".ts"))
                .arg(serde_json::to_string(&params).unwrap())
                .output()?;

            if !output.status.success() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    String::from_utf8_lossy(&output.stderr).to_string()
                ));
            }

            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
    };
}

// Job to set validators
impl_node_script_job!(set_validators, ValidatorParams, 1);

// Job to add privileged executors  
impl_node_script_job!(add_executors, ExecutorParams, 2);

// Job to configure fast withdrawals
impl_node_script_job!(configure_fast_withdrawals, FastWithdrawalParams, 3);

// Job to manage batch posters
impl_node_script_job!(manage_batch_posters, BatchPosterParams, 4);

// Job to configure fee recipients
impl_node_script_job!(configure_fee_recipients, FeeRecipientParams, 5);