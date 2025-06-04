import { PublicKey } from "@solana/web3.js";

export const validateSolanaAddress = (solanaAddress: string): boolean => {
  try {
    const key = new PublicKey(solanaAddress);
    return PublicKey.isOnCurve(key.toBytes());
  } catch (error) {
    return false;
  }
};
