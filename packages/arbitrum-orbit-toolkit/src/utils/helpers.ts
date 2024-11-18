import { Chain, Address } from 'viem';
import { sanitizePrivateKey as orbitSanitizePrivateKey } from '@arbitrum/orbit-sdk/utils';
import crypto from 'crypto';

/**
 * Gets the block explorer URL for a given chain
 */
export function getBlockExplorerUrl(chain: Chain): string | undefined {
  return chain.blockExplorers?.default.url;
}

/**
 * Calculates time delay from number of blocks for different chains
 */
export function getTimeDelayFromBlocks(chainId: number, blocks: bigint): string {
  const seconds = Number(chainId === 8453 || chainId === 84532 ? blocks * 2n : blocks * 12n);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h${m}m${s}s`;
}

/**
 * Sanitizes a private key or generates a new one if undefined
 */
export function withFallbackPrivateKey(privateKey: string | undefined): `0x${string}` {
  if (typeof privateKey === 'undefined' || privateKey === '') {
    const randomBytes = crypto.randomBytes(32);
    return `0x${randomBytes.toString('hex')}` as `0x${string}`;
  }
  return orbitSanitizePrivateKey(privateKey);
}

/**
 * Validates an array of addresses and removes duplicates
 */
export function sanitizeAddresses(addresses: string[]): Address[] {
  return [...new Set(addresses)].map(addr => addr as Address);
}

/**
 * Validates fee distribution weights add up to 10000 (100%)
 */
export function validateFeeWeights(weights: bigint[]): boolean {
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  return total === 10000n;
}

/**
 * Formats a transaction hash with block explorer link
 */
export function formatTxHash(chain: Chain, hash: string): string {
  const explorer = getBlockExplorerUrl(chain);
  return explorer ? `${explorer}/tx/${hash}` : hash;
}