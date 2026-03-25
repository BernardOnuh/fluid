import { SignerPool } from "./signing";
import StellarSdk from "@stellar/stellar-sdk";

export type HorizonSelectionStrategy = "priority" | "round_robin";

export interface FeePayerAccount {
  publicKey: string;
  keypair: ReturnType<typeof StellarSdk.Keypair.fromSecret>;
  secretSource:
  | { type: "env"; secret: string }
  | { type: "vault"; secretPath: string };
}

export interface VaultConfig {
  addr: string;
  token?: string;
  appRole?: {
    roleId: string;
    secretId: string;
  };
  kvMount: string;
  kvVersion: 1 | 2;
  secretField: string;
}

export interface Config {
  feePayerAccounts: FeePayerAccount[];
  signerPool: SignerPool;
  baseFee: number;
  feeMultiplier: number;
  networkPassphrase: string;
  horizonUrl?: string;
  horizonUrls: string[];
  horizonSelectionStrategy: HorizonSelectionStrategy;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  allowedOrigins: string[];
  stellarRpcUrl?: string;
  maxXdrSize: number;
  maxOperations: number;
  vault?: VaultConfig;
}

function parseCommaSeparatedList (value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function loadVaultConfig (): VaultConfig | undefined {
  const vaultAddr = process.env.VAULT_ADDR;
  const vaultToken = process.env.VAULT_TOKEN;
  const vaultAppRoleRoleId = process.env.VAULT_APPROLE_ROLE_ID;
  const vaultAppRoleSecretId = process.env.VAULT_APPROLE_SECRET_ID;

  if (
    !vaultAddr ||
    (!vaultToken && (!vaultAppRoleRoleId || !vaultAppRoleSecretId))
  ) {
    return undefined;
  }

  return {
    addr: vaultAddr,
    token: vaultToken,
    appRole: vaultToken
      ? undefined
      : {
        roleId: vaultAppRoleRoleId!,
        secretId: vaultAppRoleSecretId!,
      },
    kvMount: process.env.FLUID_VAULT_KV_MOUNT || "secret",
    kvVersion: (process.env.FLUID_VAULT_KV_VERSION === "1" ? 1 : 2) as 1 | 2,
    secretField: process.env.FLUID_FEE_PAYER_VAULT_SECRET_FIELD || "secret",
  };
}

export function loadConfig (): Config {
  const baseFee = parseInt(process.env.FLUID_BASE_FEE || "100", 10);
  const feeMultiplier = parseFloat(process.env.FLUID_FEE_MULTIPLIER || "2.0");
  const networkPassphrase =
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    "Test SDF Network ; September 2015";
  const configuredHorizonUrls = parseCommaSeparatedList(
    process.env.STELLAR_HORIZON_URLS
  );
  const legacyHorizonUrl = process.env.STELLAR_HORIZON_URL?.trim();
  const horizonUrls =
    configuredHorizonUrls.length > 0
      ? configuredHorizonUrls
      : legacyHorizonUrl
        ? [legacyHorizonUrl]
        : [];
  const horizonSelectionStrategy: HorizonSelectionStrategy =
    process.env.FLUID_HORIZON_SELECTION === "round_robin"
      ? "round_robin"
      : "priority";
  const rateLimitWindowMs = parseInt(
    process.env.FLUID_RATE_LIMIT_WINDOW_MS || "60000",
    10
  );
  const rateLimitMax = parseInt(process.env.FLUID_RATE_LIMIT_MAX || "5", 10);
  const allowedOrigins = parseCommaSeparatedList(process.env.FLUID_ALLOWED_ORIGINS);
  const maxXdrSize = parseInt(process.env.FLUID_MAX_XDR_SIZE || "10240", 10);
  const maxOperations = parseInt(process.env.FLUID_MAX_OPERATIONS || "100", 10);
  const vault = loadVaultConfig();

  const sharedConfig = {
    allowedOrigins,
    baseFee,
    feeMultiplier,
    horizonSelectionStrategy,
    horizonUrl: horizonUrls[0],
    horizonUrls,
    maxOperations,
    maxXdrSize,
    networkPassphrase,
    rateLimitMax,
    rateLimitWindowMs,
    stellarRpcUrl: process.env.STELLAR_RPC_URL,
    vault,
  };

  const vaultSecretPaths = parseCommaSeparatedList(
    process.env.FLUID_FEE_PAYER_VAULT_SECRET_PATHS
  );
  const vaultPublicKeys = parseCommaSeparatedList(
    process.env.FLUID_FEE_PAYER_PUBLIC_KEYS
  );

  if (vault && vaultSecretPaths.length > 0 && vaultPublicKeys.length > 0) {
    if (vaultSecretPaths.length !== vaultPublicKeys.length) {
      throw new Error(
        "Vault mode requires FLUID_FEE_PAYER_VAULT_SECRET_PATHS and FLUID_FEE_PAYER_PUBLIC_KEYS to have the same number of entries"
      );
    }

    const feePayerAccounts: FeePayerAccount[] = vaultPublicKeys.map(
      (publicKey, index) => ({
        publicKey,
        keypair: StellarSdk.Keypair.fromPublicKey(publicKey),
        secretSource: {
          type: "vault",
          secretPath: vaultSecretPaths[index],
        },
      })
    );

    const signerPool = new SignerPool(
      feePayerAccounts.map((account) => ({
        keypair: account.keypair,
        secret:
          account.secretSource.type === "vault"
            ? `vault:${account.secretSource.secretPath}`
            : account.secretSource.secret,
      }))
    );

    return {
      ...sharedConfig,
      feePayerAccounts,
      signerPool,
    };
  }

  const secrets = parseCommaSeparatedList(process.env.FLUID_FEE_PAYER_SECRET);
  if (secrets.length === 0) {
    throw new Error(
      "No fee payer secrets configured. Provide either Vault settings (VAULT_ADDR + token/approle + FLUID_FEE_PAYER_VAULT_SECRET_PATHS + FLUID_FEE_PAYER_PUBLIC_KEYS) or set FLUID_FEE_PAYER_SECRET for env-based development."
    );
  }

  const feePayerAccounts: FeePayerAccount[] = secrets.map((secret) => {
    const keypair = StellarSdk.Keypair.fromSecret(secret);

    return {
      publicKey: keypair.publicKey(),
      keypair,
      secretSource: { type: "env", secret },
    };
  });

  const signerPool = new SignerPool(
    feePayerAccounts.map((account) => ({
      keypair: account.keypair,
      secret:
        account.secretSource.type === "env"
          ? account.secretSource.secret
          : `vault:${account.secretSource.secretPath}`,
    }))
  );

  return {
    ...sharedConfig,
    feePayerAccounts,
    signerPool,
  };
}

let rrIndex = 0;

export function pickFeePayerAccount (config: Config): FeePayerAccount {
  const snapshot = config.signerPool.getSnapshot();
  const nextPublicKey = snapshot[rrIndex % snapshot.length]?.publicKey;
  rrIndex = (rrIndex + 1) % snapshot.length;
  const account = config.feePayerAccounts.find(
    (candidate) => candidate.publicKey === nextPublicKey
  );

  if (!account) {
    throw new Error("Failed to select fee payer account from signer pool");
  }

  return account;
}