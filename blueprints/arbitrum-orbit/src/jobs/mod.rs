use alloy_primitives::Address;
use api::services::events::JobCalled;
use gadget_sdk as sdk;
use sdk::event_listener::tangle::{jobs::services_pre_processor, TangleEventListener};
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

// Parameters for fee recipient configuration
#[derive(Serialize, Deserialize)]
pub struct FeeRecipientParams {
    pub rollup_address: Address,
    pub recipients: Vec<Address>,
    pub weights: Vec<u64>,
}

macro_rules! create_job {
    ($id:expr, $name:ident, $params_type:ty) => {
        #[sdk::job(
                            id = $id,
                            params(params_bytes),
                            event_listener(
                                listener = TangleEventListener::<ServiceContext, JobCalled>,
                                pre_processor = services_pre_processor,
                            ),
                        )]
        pub fn $name(params_bytes: Vec<u8>, context: ServiceContext) -> Result<String, Infallible> {
            let params: $params_type = serde_json::from_slice(&params_bytes).expect(&format!(
                "Failed to deserialize {} params",
                stringify!($name)
            ));

            let output = Command::new("node")
                .arg(format!(
                    "scripts/{}.ts",
                    stringify!($name).replace("_", "-")
                ))
                .arg(serde_json::to_string(&params).unwrap())
                .output()
                .expect("Failed to execute script");

            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
    };
}

// Job to set validators
create_job!(1, set_validators, ValidatorParams);

// Job to add privileged executors
create_job!(2, add_executors, ExecutorParams);

// Job to configure fast withdrawals
create_job!(3, configure_fast_withdrawals, FastWithdrawalParams);

// Job to configure fee recipients
create_job!(4, configure_fee_recipients, FeeRecipientParams);
