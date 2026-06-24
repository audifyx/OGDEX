import {
  Connection, PublicKey, Transaction, SystemProgram,
  LAMPORTS_PER_SOL, VersionedTransaction, Keypair,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress, createTransferInstruction,
  createAssociatedTokenAccountInstruction, getAccount,
} from "@solana/spl-token";

/** Public Solana RPC for client-side blockhash + balance reads. */
export const RPC_URL = "https://api.mainnet-beta.solana.com";
export const connection = new Connection(RPC_URL, "confirmed");

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signAndSendTransaction(tx: Transaction | VersionedTransaction): Promise<{ signature: string }>;
}

export function getProvider(): PhantomProvider | null {
  const w = window as any;
  if (w?.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w?.solana?.isPhantom) return w.solana;
  return null;
}

export async function connectWallet(): Promise<string> {
  const p = getProvider();
  if (!p) throw new Error("Phantom wallet not found. Install it from phantom.app");
  const res = await p.connect();
  return res.publicKey.toString();
}

const TOKEN_DECIMALS = 6; // USDC + USDT

/**
 * Send the launch fee to PAY_WALLET in SOL or a stablecoin and return the
 * confirmed transaction signature.
 */
export async function payFee(opts: {
  payWallet: string;
  currency: "sol" | "usdc" | "usdt";
  /** SOL amount when currency === "sol" */
  amountSol?: number;
  /** USD amount when currency is a stablecoin */
  amountUsd?: number;
  /** stablecoin mint, required for usdc/usdt */
  tokenMint?: string;
}): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("Phantom wallet not found");
  const ownerStr = provider.publicKey?.toString();
  if (!ownerStr) throw new Error("Wallet not connected");

  const owner = new PublicKey(ownerStr);
  const dest = new PublicKey(opts.payWallet);
  const tx = new Transaction();

  if (opts.currency === "sol") {
    const lamports = Math.round((opts.amountSol || 0) * LAMPORTS_PER_SOL);
    if (lamports <= 0) throw new Error("Invalid SOL amount");
    tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: dest, lamports }));
  } else {
    if (!opts.tokenMint) throw new Error("Missing stablecoin mint");
    const mint = new PublicKey(opts.tokenMint);
    const fromAta = await getAssociatedTokenAddress(mint, owner);
    const toAta = await getAssociatedTokenAddress(mint, dest);
    // Create the recipient ATA if it does not exist yet.
    try {
      await getAccount(connection, toAta);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(owner, toAta, dest, mint));
    }
    const amount = BigInt(Math.round((opts.amountUsd || 0) * 10 ** TOKEN_DECIMALS));
    if (amount <= 0n) throw new Error("Invalid token amount");
    tx.add(createTransferInstruction(fromAta, toAta, owner, amount));
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  const { signature } = await provider.signAndSendTransaction(tx);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/**
 * Sign a PumpPortal create transaction (base64 VersionedTransaction) with the
 * new mint keypair, then hand it to Phantom to add the fee-payer signature and
 * broadcast. Returns the create signature.
 */
export async function signAndSendCreate(txBase64: string, mintKeypair: Keypair): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("Phantom wallet not found");
  const bytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(bytes);
  tx.sign([mintKeypair]);
  const { signature } = await provider.signAndSendTransaction(tx);
  return signature;
}

export function newMintKeypair(): Keypair {
  return Keypair.generate();
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
