import { Address, Chain } from "viem";

export interface CoreContracts {
  rollup: Address;
  inbox: Address;
  outbox: Address;
  adminProxy: Address;
  sequencerInbox: Address;
  bridge: Address;
  utils: Address;
  validatorUtils: Address;
  validatorWalletCreator: Address;
  deployedAt: number;
  upgradeExecutor: Address;
}

export interface TokenBridgeContracts {
  parentChainContracts: {
    router: Address;
    standardGateway: Address;
    customGateway: Address;
    wethGateway: Address;
    weth: Address;
  };
  orbitChainContracts: {
    router: Address;
    standardGateway: Address;
    customGateway: Address;
    wethGateway: Address;
    weth: Address;
    upgradeExecutor: Address;
  };
}

export interface RollupConfig {
  chainId: bigint;
  owner: Address;
  chainConfig: ChainConfig;
}

export interface ChainConfig {
  chainId: number;
  arbitrum: {
    InitialChainOwner: Address;
    DataAvailabilityCommittee: boolean;
  };
}

export interface ValidatorConfig {
  address: Address;
  isActive: boolean;
}

export interface FeeRecipient {
  account: Address;
  weight: bigint;
}

export interface ClientConfig {
  parentChain: Chain;
  parentChainRpc?: string;
  orbitChainId: number;
  orbitChainRpc: string;
  orbitChainName: string;
  orbitChainNetworkName: string;
  orbitChainNativeCurrency: { name: string; symbol: string; decimals: number };
}
