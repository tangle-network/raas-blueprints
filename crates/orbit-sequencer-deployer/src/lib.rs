use gadget_sdk::docker::{bollard::{self, container::LogsOptions, models::ContainerConfig, Docker}, Container};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf, sync::Arc};
use tokio_stream::{Stream, StreamExt};

const NITRO_NODE_IMAGE: &str = "offchainlabs/nitro-node:v3.2.1-d81324d";

#[derive(Debug, Serialize, Deserialize)]
pub struct OrbitNodeConfig {
    pub parent_chain_rpc: String,
    pub chain_id: u64,
    pub chain_name: String,
    pub chain_info_json: String,
    pub sequencer_endpoint: Option<String>,
    pub data_dir: PathBuf,
    pub is_sequencer: bool,
    pub enable_das: bool,
    pub das_endpoints: Option<Vec<String>>,
    pub das_online_url_list: Option<String>,
}

pub struct OrbitNode {
    config: OrbitNodeConfig,
    docker: Arc<Docker>,
    container_id: Option<String>,
}

impl OrbitNode {
    pub fn new(config: OrbitNodeConfig, docker: Arc<Docker>) -> Self {
        Self {
            config,
            docker,
            container_id: None,
        }
    }

    pub async fn start(&mut self) -> Result<(), bollard::errors::Error> {
        let mut container_config = ContainerConfig {
            image: Some(NITRO_NODE_IMAGE.to_string()),
            exposed_ports: Some({
                let mut ports = HashMap::new();
                ports.insert("8547/tcp".to_string(), HashMap::new());
                ports.insert("8548/tcp".to_string(), HashMap::new());
                ports.insert("9642/tcp".to_string(), HashMap::new());
                ports
            }),
            ..Default::default()
        };

        // Build command arguments
        let mut args = vec![
            format!("--parent-chain.connection.url={}", self.config.parent_chain_rpc),
            format!("--chain.id={}", self.config.chain_id),
            format!("--chain.name={}", self.config.chain_name),
            format!("--chain.info-json={}", self.config.chain_info_json),
            "--http.api=net,web3,eth".into(),
            "--http.corsdomain=*".into(),
            "--http.addr=0.0.0.0".into(),
            "--http.vhosts=*".into(),
            "--ws.port=8548".into(),
            "--ws.addr=0.0.0.0".into(),
            "--ws.origins=*".into(),
        ];

        // Add sequencer-specific configuration
        if !self.config.is_sequencer {
            if let Some(endpoint) = &self.config.sequencer_endpoint {
                args.push(format!("--execution.forwarding-target={}", endpoint));
            }
        } else {
            args.push("--node.feed.output.enable=true".into());
            args.push("--node.feed.output.addr=0.0.0.0".into());
            args.push("--node.feed.output.port=9642".into());
        }

        // Add DAS configuration if enabled
        if self.config.enable_das {
            args.push("--node.data-availability.enable".into());
            if let Some(endpoints) = &self.config.das_endpoints {
                args.push(format!(
                    "--node.data-availability.rest-aggregator.urls={}",
                    endpoints.join(",")
                ));
            }
            if let Some(url) = &self.config.das_online_url_list {
                args.push(format!(
                    "--node.data-availability.rest-aggregator.online-url-list={}",
                    url
                ));
            }
        }

        container_config.cmd = Some(args);

        // Create and start container
        let container = Container::new(&self.docker, NITRO_NODE_IMAGE);
        self.container_id = container.id().map(|id| id.to_string());
        
        if let Some(id) = &self.container_id {
            self.docker.start_container::<String>(id, None).await?;
        }

        Ok(())
    }

    pub async fn stop(&self) -> Result<(), bollard::errors::Error> {
        if let Some(id) = &self.container_id {
            self.docker.stop_container(id, None).await?;
        }
        Ok(())
    }

    pub async fn restart(&self) -> Result<(), bollard::errors::Error> {
        if let Some(id) = &self.container_id {
            self.docker.restart_container(id, None).await?;
        }
        Ok(())
    }

    pub async fn logs(&self) -> Option<impl Stream<Item = Result<String, bollard::errors::Error>>> {
        if let Some(id) = &self.container_id {
            let logs = self.docker.logs(
                id,
                Some(LogsOptions::<String> {
                    stdout: true,
                    stderr: true,
                    follow: true,
                    ..Default::default()
                }),
            );

            Some(Box::pin(logs.map(|result| {
                result
                    .map(|log_output| log_output.to_string())
                    .map_err(Into::into)
            })))
        } else {
            None
        }
    }
}
