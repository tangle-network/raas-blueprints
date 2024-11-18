import { Address, PrivateKeyAccount, PublicClient, Chain } from 'viem';
import {
  rollupAdminLogicPublicActions,
  getValidators,
} from '@arbitrum/orbit-sdk';
import type { ValidatorConfig } from '../core/types';
import { sanitizeAddresses } from '../utils/helpers';

export interface SetValidatorsParams {
  rollupAddress: Address;
  validators: Address[];
  isActive: boolean;
  owner: {
    address: Address;
    account: PrivateKeyAccount;
  };
  upgradeExecutor: Address;
}

export interface ValidatorStatus {
  address: Address;
  isActive: boolean;
}

export async function getValidatorStatus(
  rollupAddress: Address,
  parentChainClient: PublicClient<any, Chain>
): Promise<ValidatorConfig[]> {
  const validators = await getValidators(parentChainClient, {
    rollup: rollupAddress,
  });

  return validators.validators.map(addr => ({
    address: addr,
    isActive: validators.validators.includes(addr)
  }));
}

export async function setValidators(
  params: SetValidatorsParams,
  parentChainClient: PublicClient<any, Chain>
): Promise<string> {
  const client = parentChainClient.extend(
    rollupAdminLogicPublicActions({
      rollup: params.rollupAddress,
    })
  );

  // Sanitize and deduplicate validator addresses
  const validatorAddresses = sanitizeAddresses(params.validators);
  const validatorStatuses = validatorAddresses.map(() => params.isActive);

  // Prepare transaction request
  const txRequest = await client.rollupAdminLogicPrepareTransactionRequest({
    functionName: 'setValidator',
    args: [validatorAddresses, validatorStatuses],
    upgradeExecutor: params.upgradeExecutor,
    account: params.owner.address,
  });

  // Sign and send transaction
  const signedTx = await params.owner.account.signTransaction({
    to: txRequest.to,
    data: txRequest.data,
    chainId: await client.getChainId(),
    maxFeePerGas: txRequest.maxFeePerGas,
    maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas,
    gas: txRequest.gas,
    nonce: txRequest.nonce,
    type: 'eip1559' as const,
  });

  const txHash = await client.sendRawTransaction({
    serializedTransaction: signedTx,
  });

  // Wait for receipt
  await client.waitForTransactionReceipt({ hash: txHash });

  return txHash;
}

export async function isValidator(
  address: Address,
  rollupAddress: Address,
  parentChainClient: PublicClient<any, Chain>
): Promise<boolean> {
  const validators = await getValidators(parentChainClient, {
    rollup: rollupAddress,
  });
  return validators.validators.includes(address);
}