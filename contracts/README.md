# Orbit RaaS Blueprint

The Orbit RaaS (Rollup-as-a-Service) Blueprint is a smart contract that manages the configuration and deployment of Arbitrum Orbit chains.

## Overview

The `OrbitRaaSBlueprint` contract extends `BlueprintServiceManagerBase` and provides functionality to:

- Register operators who can manage Orbit chains
- Store and manage rollup configurations for each service ID
- Handle service requests to create new Orbit chains

## Key Features

### Rollup Configuration
Each Orbit chain can be configured with:
- Chain ID
- Owner address
- Validator set
- Batch poster addresses  
- Native token settings
- Data availability committee settings
- Custom fee token options
- Token bridge setup preferences

### Operator Management
- Operators must register before managing chains
- Operator addresses are derived from their public keys
- Only registered operators can create and manage chains

### Service Management 
- Each service has a unique ID
- Service requests create new Orbit chains with specified configurations
- Configurations are stored and retrievable by service ID
