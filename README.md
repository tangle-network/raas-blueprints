# <h1 align="center"> Rollup-as-a-Service Tangle Blueprints 🌐 </h1>

# Tangle Network Blueprints 🌐

A collection of official blueprints for the Tangle Network, providing ready-to-use service implementations for various blockchain infrastructure needs.

## Available Blueprints

### Arbitrum Orbit RaaS (Rollup-as-a-Service)

Deploy and manage Arbitrum Orbit chains through a standardized service interface. This blueprint provides comprehensive management of Orbit chain deployments with the following features:

#### Initial Deployment
- Automated Orbit chain deployment with customizable configurations
- Support for both ETH and ERC20 native tokens
- Configurable token bridge setup
- Custom fee token configuration
- Data availability committee settings

#### Chain Management Features
The blueprint provides several management jobs that can be triggered through the Tangle Network:

1. **Validator Management**
   - Add/remove chain validators
   - Enable/disable validator sets

2. **Executor Management**
   - Configure privileged executors
   - Manage executor permissions

3. **Batch Poster Configuration**
   - Set batch poster addresses
   - Enable/disable batch posters

4. **Fee Management**
   - Configure fee recipients
   - Set fee distribution weights

5. **Fast Withdrawals**
   - Configure withdrawal confirmers
   - Enable/disable fast withdrawal functionality

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) (v16 or later)
- [Foundry](https://getfoundry.sh)
- [Tangle CLI](https://github.com/tangle-network/tangle)

## Environment Setup

Required environment variables:
```bash
PARENT_CHAIN_RPC=           # Parent chain RPC endpoint

UPGRADE_EXECUTOR_ADDRESS=   # Address of the upgrade executor
OWNER_ADDRESS=             # Owner address for management operations
OWNER_PRIVATE_KEY=         # Private key for signing transactions
```

## Development

### Build
**Build smart contracts**
```bash
forge build
```
**Build service implementation**
```bash
cargo build --release
```
**Deploy blueprint to Tangle Network**
```bash
cargo tangle blueprint deploy
```

## Architecture

### Smart Contracts
The blueprint includes smart contracts for:
- Service registration and management
- Configuration storage and validation
- Access control and permissions

### Service Implementation
Built with Rust and the Tangle Network SDK, featuring:
- TypeScript scripts for chain interaction
- Job handlers for management operations
- Secure configuration management
- Event-driven architecture

## Security Considerations

- One-time initialization for critical components
- Role-based access control for management operations
- Protected configuration updates
- Secure key management requirements

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

Licensed under:
- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))