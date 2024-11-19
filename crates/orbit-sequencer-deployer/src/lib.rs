use gadget_sdk::{
    docker::bollard::{
        self,
        container::{
            Config, CreateContainerOptions, LogsOptions, RemoveContainerOptions,
            StopContainerOptions,
        },
        models::{HostConfig, PortBinding},
        network::CreateNetworkOptions,
        secret::{ContainerStateStatusEnum, HealthStatusEnum},
        Docker,
    },
    info, tokio,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    hash::Hash,
    path::PathBuf,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio_stream::{Stream, StreamExt};

// Image constants
const NITRO_NODE_IMAGE: &str = "offchainlabs/nitro-node:v3.2.1-d81324d";
const POSTGRES_IMAGE: &str = "postgres:14";
const REDIS_IMAGE: &str = "redis:alpine";
const NGINX_IMAGE: &str = "nginx";
const BLOCKSCOUT_IMAGE: &str = "blockscout/blockscout";
const FRONTEND_IMAGE: &str = "ghcr.io/blockscout/frontend";
const STATS_IMAGE: &str = "ghcr.io/blockscout/stats";
const VISUALIZER_IMAGE: &str = "ghcr.io/blockscout/visualizer";
const SIG_PROVIDER_IMAGE: &str = "ghcr.io/blockscout/sig-provider";
const SMART_CONTRACT_VERIFIER_IMAGE: &str = "ghcr.io/blockscout/smart-contract-verifier";

#[derive(Debug, Serialize, Deserialize)]
pub struct OrbitStackConfig {
    pub parent_chain_rpc: String,
    pub chain_id: u64,
    pub chain_name: String,
    pub chain_info_json: String,
    pub data_dir: PathBuf,
    pub is_sequencer: bool,
    pub enable_das: bool,
    pub docker_tags: DockerTags,
    pub env_files: EnvFiles,
    pub sequencer_endpoint: Option<String>,
    pub das_endpoints: Option<Vec<String>>,
    pub das_online_url_list: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerTags {
    pub blockscout: String,
    pub frontend: String,
    pub stats: String,
    pub visualizer: String,
    pub sig_provider: String,
    pub smart_contract_verifier: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvFiles {
    pub blockscout: PathBuf,
    pub frontend: PathBuf,
    pub visualizer: PathBuf,
    pub stats: PathBuf,
    pub smart_contract_verifier: PathBuf,
}

pub struct OrbitStack {
    config: OrbitStackConfig,
    docker: Arc<Docker>,
    containers: HashMap<String, String>, // service_name -> container_id
}

// Helper function to parse env file
fn parse_env_file(path: &PathBuf) -> Result<Vec<String>, std::io::Error> {
    Ok(std::fs::read_to_string(path)?
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.trim().starts_with('#'))
        .map(|line| line.to_string())
        .collect())
}

impl OrbitStack {
    pub fn new(config: OrbitStackConfig, docker: Arc<Docker>) -> Self {
        Self {
            config,
            docker,
            containers: HashMap::new(),
        }
    }

    async fn create_and_start_container<T>(
        &mut self,
        name: &str,
        config: Config<T>,
    ) -> Result<(), bollard::errors::Error>
    where
        T: Into<String> + Eq + Hash + Serialize,
    {
        let container = self
            .docker
            .create_container(
                Some(CreateContainerOptions {
                    name,
                    platform: Some("linux/amd64"),
                }),
                config,
            )
            .await?;

        self.docker
            .start_container::<String>(&container.id, None)
            .await?;
        self.containers.insert(name.to_string(), container.id);
        Ok(())
    }

    async fn start_nitro_node(&mut self) -> Result<(), bollard::errors::Error> {
        let mut cmd_args = vec![
            format!(
                "--parent-chain.connection.url={}",
                self.config.parent_chain_rpc
            ),
            format!("--chain.id={}", self.config.chain_id),
            format!("--chain.name={}", self.config.chain_name),
            format!("--chain.info-json={}", self.config.chain_info_json),
            "--http.api=net,web3,eth".to_string(),
            "--http.corsdomain=*".to_string(),
            "--http.addr=0.0.0.0".to_string(),
            "--http.vhosts=*".to_string(),
            "--ws.port=8548".to_string(),
            "--ws.addr=0.0.0.0".to_string(),
            "--ws.origins=*".to_string(),
        ];

        // Add sequencer-specific configuration
        if !self.config.is_sequencer {
            if let Some(endpoint) = &self.config.sequencer_endpoint {
                cmd_args.push(format!("--execution.forwarding-target={}", endpoint));
            }
        } else {
            cmd_args.extend_from_slice(&[
                "--node.feed.output.enable=true".to_string(),
                "--node.feed.output.addr=0.0.0.0".to_string(),
                "--node.feed.output.port=9642".to_string(),
            ]);
        }

        // Add DAS configuration if enabled
        if self.config.enable_das {
            cmd_args.push("--node.data-availability.enable".to_string());
            if let Some(endpoints) = &self.config.das_endpoints {
                cmd_args.push(format!(
                    "--node.data-availability.rest-aggregator.urls={}",
                    endpoints.join(",")
                ));
            }
            if let Some(url) = &self.config.das_online_url_list {
                cmd_args.push(format!(
                    "--node.data-availability.rest-aggregator.online-url-list={}",
                    url
                ));
            }
        }

        let config = Config {
            image: Some(NITRO_NODE_IMAGE),
            exposed_ports: Some({
                let mut ports = HashMap::new();
                ports.insert("8547/tcp", HashMap::new());
                ports.insert("8548/tcp", HashMap::new());
                ports.insert("9642/tcp", HashMap::new());
                ports
            }),
            host_config: Some(HostConfig {
                port_bindings: Some({
                    let mut bindings = HashMap::new();
                    for (container_port, host_port) in [
                        ("8547/tcp", "8547"),
                        ("8548/tcp", "8548"),
                        ("9642/tcp", "9642"),
                    ] {
                        bindings.insert(
                            container_port.to_string(),
                            Some(vec![PortBinding {
                                host_ip: Some("0.0.0.0".to_string()),
                                host_port: Some(host_port.to_string()),
                            }]),
                        );
                    }
                    bindings
                }),
                ..Default::default()
            }),
            cmd: Some(cmd_args.iter().map(|s| s.as_str()).collect()),
            ..Default::default()
        };

        self.create_and_start_container("nitro-node", config).await
    }
    async fn start_das_server(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(NITRO_NODE_IMAGE.to_string()),
            entrypoint: Some(vec!["/bin/bash".to_string(), "/das-server.sh".to_string()]),
            volumes: Some({
                let mut volumes = HashMap::new();
                volumes.insert(
                    format!(
                        "{}/das-server.sh:/das-server.sh",
                        self.config.data_dir.display()
                    ),
                    HashMap::new(),
                );
                volumes.insert(
                    format!(
                        "{}/das-data:/home/user/das-data",
                        self.config.data_dir.display()
                    ),
                    HashMap::new(),
                );
                volumes
            }),
            exposed_ports: Some({
                let mut ports = HashMap::new();
                for port in ["9876", "9877"] {
                    ports.insert(format!("{}/tcp", port), HashMap::new());
                }
                ports
            }),
            ..Default::default()
        };

        self.create_and_start_container("das-server", config).await
    }

    // Implementation of individual service starts
    async fn start_redis(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(REDIS_IMAGE.to_string()),
            cmd: Some(vec!["redis-server".to_string()]),
            host_config: Some(HostConfig {
                binds: Some(vec![format!(
                    "{}/redis-data:/data",
                    self.config.data_dir.display()
                )]),
                ..Default::default()
            }),
            ..Default::default()
        };

        self.create_and_start_container("redis_db", config).await
    }

    async fn start_db_init(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(POSTGRES_IMAGE.to_string()),
            entrypoint: Some(vec![
                "sh".to_string(),
                "-c".to_string(),
                "chown -R 2000:2000 /var/lib/postgresql/data".to_string(),
            ]),
            host_config: Some(HostConfig {
                binds: Some(vec![format!(
                    "{}/blockscout-db-data:/var/lib/postgresql/data",
                    self.config.data_dir.display()
                )]),
                ..Default::default()
            }),
            ..Default::default()
        };

        self.create_and_start_container("db-init", config).await
    }

    async fn start_db(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(POSTGRES_IMAGE.to_string()),
            cmd: Some(vec![
                "postgres".to_string(),
                "-c".to_string(),
                "max_connections=200".to_string(),
                "-c".to_string(),
                "client_connection_check_interval=60000".to_string(),
            ]),
            env: Some(vec![
                "POSTGRES_DB=blockscout".to_string(),
                "POSTGRES_USER=blockscout".to_string(),
                "POSTGRES_PASSWORD=ceWb1MeLBEeOIfk65gU8EjF8".to_string(),
            ]),
            host_config: Some(HostConfig {
                binds: Some(vec![format!(
                    "{}/blockscout-db-data:/var/lib/postgresql/data",
                    self.config.data_dir.display()
                )]),
                port_bindings: Some({
                    let mut bindings = HashMap::new();
                    bindings.insert(
                        "5432/tcp".to_string(),
                        Some(vec![PortBinding {
                            host_ip: Some("0.0.0.0".to_string()),
                            host_port: Some("7432".to_string()),
                        }]),
                    );
                    bindings
                }),
                ..Default::default()
            }),
            user: Some("2000:2000".to_string()),
            healthcheck: Some(bollard::models::HealthConfig {
                test: Some(vec![
                    "CMD-SHELL".to_string(),
                    "pg_isready -U blockscout -d blockscout".to_string(),
                ]),
                interval: Some(10000000000), // 10s in nanoseconds
                timeout: Some(5000000000),   // 5s in nanoseconds
                retries: Some(5),
                start_period: Some(10000000000),
                ..Default::default()
            }),
            ..Default::default()
        };

        self.create_and_start_container("db", config).await
    }

    async fn start_stats_db_init(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(POSTGRES_IMAGE.to_string()),
            entrypoint: Some(vec![
                "sh".to_string(),
                "-c".to_string(),
                "chown -R 2000:2000 /var/lib/postgresql/data".to_string(),
            ]),
            host_config: Some(HostConfig {
                binds: Some(vec![format!(
                    "{}/stats-db-data:/var/lib/postgresql/data",
                    self.config.data_dir.display()
                )]),
                ..Default::default()
            }),
            ..Default::default()
        };

        self.create_and_start_container("stats-db-init", config)
            .await
    }

    async fn start_stats_db(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(POSTGRES_IMAGE.to_string()),
            cmd: Some(vec![
                "postgres".to_string(),
                "-c".to_string(),
                "max_connections=200".to_string(),
            ]),
            env: Some(vec![
                "POSTGRES_DB=stats".to_string(),
                "POSTGRES_USER=stats".to_string(),
                "POSTGRES_PASSWORD=n0uejXPl61ci6ldCuE2gQU5Y".to_string(),
            ]),
            host_config: Some(HostConfig {
                binds: Some(vec![format!(
                    "{}/stats-db-data:/var/lib/postgresql/data",
                    self.config.data_dir.display()
                )]),
                port_bindings: Some({
                    let mut bindings = HashMap::new();
                    bindings.insert(
                        "5432/tcp".to_string(),
                        Some(vec![PortBinding {
                            host_ip: Some("0.0.0.0".to_string()),
                            host_port: Some("7433".to_string()),
                        }]),
                    );
                    bindings
                }),
                ..Default::default()
            }),
            user: Some("2000:2000".to_string()),
            healthcheck: Some(bollard::models::HealthConfig {
                test: Some(vec![
                    "CMD-SHELL".to_string(),
                    "pg_isready -U stats -d stats".to_string(),
                ]),
                interval: Some(10000000000),
                timeout: Some(5000000000),
                retries: Some(5),
                start_period: Some(10000000000),
                ..Default::default()
            }),
            ..Default::default()
        };

        self.create_and_start_container("stats-db", config).await
    }

    async fn start_backend(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(format!("{}:{}", BLOCKSCOUT_IMAGE, self.config.docker_tags.blockscout)),
            cmd: Some(vec![
                "sh".to_string(),
                "-c".to_string(),
                "bin/blockscout eval \"Elixir.Explorer.ReleaseTasks.create_and_migrate()\" && bin/blockscout start".to_string(),
            ]),
            env: Some(parse_env_file(&self.config.env_files.blockscout)?),
            host_config: Some(HostConfig {
                extra_hosts: Some(vec!["host.docker.internal:host-gateway".to_string()]),
                binds: Some(vec![format!(
                    "{}/logs:/app/logs",
                    self.config.data_dir.display()
                )]),
                ..Default::default()
            }),
            ..Default::default()
        };

        self.create_and_start_container("backend", config).await
    }

    async fn start_frontend(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(format!(
                "{}:{}",
                FRONTEND_IMAGE, self.config.docker_tags.frontend
            )),
            env: Some(parse_env_file(&self.config.env_files.frontend)?),
            ..Default::default()
        };

        self.create_and_start_container("frontend", config).await
    }

    async fn start_stats(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(format!("{}:{}", STATS_IMAGE, self.config.docker_tags.stats)),
            env: Some(
                std::fs::read_to_string(&self.config.env_files.stats)?
                    .lines()
                    .filter(|line| !line.trim().is_empty() && !line.trim().starts_with('#'))
                    .map(|line| line.to_string())
                    .collect::<Vec<String>>(),
            ),
            host_config: Some(HostConfig {
                extra_hosts: Some(vec!["host.docker.internal:host-gateway".to_string()]),
                ..Default::default()
            }),
            ..Default::default()
        };

        self.create_and_start_container("stats", config).await
    }

    async fn start_visualizer(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(format!(
                "{}:{}",
                VISUALIZER_IMAGE, self.config.docker_tags.visualizer
            )),
            env: Some(parse_env_file(&self.config.env_files.visualizer)?),
            ..Default::default()
        };

        self.create_and_start_container("visualizer", config).await
    }

    async fn start_sig_provider(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(format!(
                "{}:{}",
                SIG_PROVIDER_IMAGE, self.config.docker_tags.sig_provider
            )),
            ..Default::default()
        };

        self.create_and_start_container("sig-provider", config)
            .await
    }

    async fn start_smart_contract_verifier(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(format!(
                "{}:{}",
                SMART_CONTRACT_VERIFIER_IMAGE, self.config.docker_tags.smart_contract_verifier
            )),
            env: Some(parse_env_file(
                &self.config.env_files.smart_contract_verifier,
            )?),
            ..Default::default()
        };

        self.create_and_start_container("smart-contract-verifier", config)
            .await
    }

    async fn start_proxy(&mut self) -> Result<(), bollard::errors::Error> {
        let config = Config {
            image: Some(NGINX_IMAGE.to_string()),
            host_config: Some(HostConfig {
                extra_hosts: Some(vec!["host.docker.internal:host-gateway".to_string()]),
                binds: Some(vec![format!(
                    "{}/proxy:/etc/nginx/templates",
                    self.config.data_dir.display()
                )]),
                port_bindings: Some({
                    let mut bindings = HashMap::new();
                    for (container_port, host_port) in
                        [("80/tcp", "80"), ("8080/tcp", "8080"), ("8081/tcp", "8081")]
                    {
                        bindings.insert(
                            container_port.to_string(),
                            Some(vec![PortBinding {
                                host_ip: Some("0.0.0.0".to_string()),
                                host_port: Some(host_port.to_string()),
                            }]),
                        );
                    }
                    bindings
                }),
                ..Default::default()
            }),
            env: Some(vec![
                "BACK_PROXY_PASS=http://backend:4000".to_string(),
                "FRONT_PROXY_PASS=http://frontend:3000".to_string(),
            ]),
            ..Default::default()
        };

        self.create_and_start_container("proxy", config).await
    }

    pub async fn stop_all(&mut self) -> Result<(), bollard::errors::Error> {
        for (service, container_id) in &self.containers {
            info!("Stopping container for service: {}", service);
            self.docker
                .stop_container(container_id, Some(StopContainerOptions { t: 300 }))
                .await?;
        }
        Ok(())
    }

    pub async fn restart_all(&mut self) -> Result<(), bollard::errors::Error> {
        for (service, container_id) in &self.containers {
            info!("Restarting container for service: {}", service);
            self.docker.restart_container(container_id, None).await?;
        }
        Ok(())
    }

    pub async fn get_logs(
        &self,
        service: &str,
    ) -> Option<impl Stream<Item = Result<String, bollard::errors::Error>>> {
        self.containers.get(service).map(|container_id| {
            let options = LogsOptions::<String> {
                stdout: true,
                stderr: true,
                follow: true,
                timestamps: true,
                tail: "100".to_string(),
                ..Default::default()
            };

            Box::pin(
                self.docker
                    .logs(container_id, Some(options))
                    .map(|result| result.map(|log| log.to_string())),
            )
        })
    }

    pub async fn is_healthy(&self, service: &str) -> Result<bool, bollard::errors::Error> {
        if let Some(container_id) = self.containers.get(service) {
            let inspect = self.docker.inspect_container(container_id, None).await?;
            if let Some(state) = inspect.state {
                return Ok(state.health.map_or(state.running.unwrap_or(false), |h| {
                    h.status.map_or(false, |s| s == HealthStatusEnum::HEALTHY)
                }));
            }
        }
        Ok(false)
    }

    pub async fn wait_for_healthy(
        &self,
        service: &str,
        timeout: Duration,
    ) -> Result<(), bollard::errors::Error> {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if self.is_healthy(service).await? {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        Err(bollard::errors::Error::IOError {
            err: std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                format!(
                    "Service {} did not become healthy within {:?}",
                    service, timeout
                ),
            ),
        })
    }

    pub async fn remove_container(&mut self, service: &str) -> Result<(), bollard::errors::Error> {
        if let Some(container_id) = self.containers.remove(service) {
            self.docker
                .remove_container(
                    &container_id,
                    Some(RemoveContainerOptions {
                        force: true,
                        ..Default::default()
                    }),
                )
                .await?;
        }
        Ok(())
    }

    pub async fn cleanup(&mut self) -> Result<(), bollard::errors::Error> {
        self.stop_all().await?;
        for service in self.containers.keys().cloned().collect::<Vec<_>>() {
            self.remove_container(&service).await?;
        }
        Ok(())
    }

    pub async fn get_container_status(
        &self,
        service: &str,
    ) -> Result<Option<ContainerStateStatusEnum>, bollard::errors::Error> {
        if let Some(container_id) = self.containers.get(service) {
            let inspect = self.docker.inspect_container(container_id, None).await?;
            if let Some(state) = inspect.state {
                return Ok(state.status);
            }
        }
        Ok(None)
    }

    async fn ensure_network(&self) -> Result<(), bollard::errors::Error> {
        let networks = self.docker.list_networks::<String>(None).await?;
        let network_name = "orbit_network";

        if !networks
            .iter()
            .any(|n| n.name.as_deref() == Some(network_name))
        {
            self.docker
                .create_network(CreateNetworkOptions {
                    name: network_name.to_string(),
                    driver: "bridge".to_string(),
                    ..Default::default()
                })
                .await?;
        }
        Ok(())
    }

    pub async fn start_with_dependencies(&mut self) -> Result<(), bollard::errors::Error> {
        self.ensure_network().await?;

        // Start databases first
        self.start_db_init().await?;
        self.start_db().await?;
        self.wait_for_healthy("db", Duration::from_secs(60)).await?;

        self.start_stats_db_init().await?;
        self.start_stats_db().await?;
        self.wait_for_healthy("stats-db", Duration::from_secs(60))
            .await?;

        // Start Redis
        self.start_redis().await?;

        // Start nitro node and DAS server if enabled
        self.start_nitro_node().await?;
        if self.config.enable_das {
            self.start_das_server().await?;
        }

        // Start main services
        self.start_backend().await?;
        self.start_frontend().await?;
        self.start_stats().await?;
        self.start_visualizer().await?;
        self.start_sig_provider().await?;
        self.start_smart_contract_verifier().await?;

        // Start proxy last
        self.start_proxy().await?;

        Ok(())
    }
}
