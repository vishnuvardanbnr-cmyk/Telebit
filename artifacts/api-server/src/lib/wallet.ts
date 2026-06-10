import { ethers } from "ethers";
import { encrypt, decrypt } from "./crypto";
import { logger } from "./logger";

// BSC USDT BEP-20 contract address
export const USDT_CONTRACT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

// ERC-20 ABI (minimal for balanceOf and transfer)
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

export function generateWallet(): { address: string; privateKeyEncrypted: string } {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKeyEncrypted: encrypt(wallet.privateKey),
  };
}

export function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function getProvider(rpcUrl: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl);
}

export async function getUsdtBalance(
  address: string,
  provider: ethers.JsonRpcProvider
): Promise<bigint> {
  const contract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
  return await contract.balanceOf(address);
}

export async function sweepUsdt(
  fromPrivateKeyEncrypted: string,
  toAddress: string,
  amount: bigint,
  provider: ethers.JsonRpcProvider
): Promise<string> {
  const privateKey = decrypt(fromPrivateKeyEncrypted);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, wallet);
  const tx = await contract.transfer(toAddress, amount);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Transaction receipt is null");
  return receipt.hash;
}

export async function sendBnbGas(
  toAddress: string,
  amount: bigint,
  gasWalletPrivateKey: string,
  provider: ethers.JsonRpcProvider
): Promise<string> {
  const wallet = new ethers.Wallet(gasWalletPrivateKey, provider);
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: amount,
  });
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Transaction receipt is null");
  return receipt.hash;
}

export async function getBnbBalance(
  address: string,
  provider: ethers.JsonRpcProvider
): Promise<bigint> {
  return await provider.getBalance(address);
}

export function formatUsdt(amount: bigint, decimals = 18): string {
  return ethers.formatUnits(amount, decimals);
}

export function parseUsdt(amount: string, decimals = 18): bigint {
  return ethers.parseUnits(amount, decimals);
}
