import StellarSdk from "@stellar/stellar-sdk";
import { SignerPool } from "./signing";

export type HorizonSelectionStrategy = "priority" | "round_robin";

export interface FeePayerAccount {
  publicKey: string;
  keypair: ReturnType<typeof StellarSdk.Keypair.fromSecret>;
  secretSource:
    | { type: "env"; secret: string }
    | { type: "db"; encrypted: true }
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

export interface SupportedAsset {
  code: string;
  issuer?: string;
  minBalance?: string;
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
  alerting: AlertingConfig;
  supportedAssets: SupportedAsset[];
  maxXdrSize: number;
  maxOperations: number;
  horizonSelectionStrategy: HorizonSelectionStrategy;
  horizonUrls: string[];
  stellarRpcUrl?: string;
  vault?: VaultConfig;
}

export interface AlertEmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  to: string[];
}

export interface AlertingConfig {
  lowBalanceThresholdXlm?: number;
  checkIntervalMs: number;
  cooldownMs: number;
  slackWebhookUrl?: string;
  email?: AlertEmailConfig;
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
  maxXdrSize: number;
  maxOperations: number;
  stellarRpcUrl?: string;
  vault?: VaultConfig;
  alerting: AlertingConfig;
}

function parseCommaSeparatedList(value: string | undefined): string[] {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function loadVaultConfig(): VaultConfig | undefined {
  const addr = process.env.VAULT_ADDR?.trim();
  if (!addr) {
    return undefined;
  }

  const roleId = process.env.VAULT_ROLE_ID?.trim();
  const secretId = process.env.VAULT_SECRET_ID?.trim();

  return {
    addr,
    token: process.env.VAULT_TOKEN?.trim() || undefined,
    appRole:
      roleId && secretId
        ? {
            roleId,
            secretId,
          }
        : undefined,
    kvMount: process.env.VAULT_KV_MOUNT?.trim() || "secret",
    kvVersion: process.env.VAULT_KV_VERSION === "1" ? 1 : 2,
    secretField: process.env.VAULT_SECRET_FIELD?.trim() || "secret",
  };
}

function loadAlertEmailConfig(): AlertEmailConfig | undefined {
  const host = process.env.FLUID_ALERT_SMTP_HOST?.trim();
  const from = process.env.FLUID_ALERT_EMAIL_FROM?.trim();
  const to = parseCommaSeparatedList(process.env.FLUID_ALERT_EMAIL_TO);

  if (!host || !from || to.length === 0) {
    return undefined;
  }

  return {
    host,
    port: parsePositiveInt(process.env.FLUID_ALERT_SMTP_PORT, 587),
    secure: process.env.FLUID_ALERT_SMTP_SECURE === "true",
    user: process.env.FLUID_ALERT_SMTP_USER?.trim() || undefined,
    pass: process.env.FLUID_ALERT_SMTP_PASS?.trim() || undefined,
    from,
    to,
  };
}

export function loadConfig(): Config {
  const baseFee = parsePositiveInt(process.env.FLUID_BASE_FEE, 100);
  const feeMultiplier = Number.parseFloat(process.env.FLUID_FEE_MULTIPLIER || "2.0");
  const networkPassphrase =
    process.env.STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
  const configuredHorizonUrls = parseCommaSeparatedList(process.env.STELLAR_HORIZON_URLS);
  const legacyHorizonUrl = process.env.STELLAR_HORIZON_URL?.trim();
  const horizonUrls =
    configuredHorizonUrls.length > 0
      ? configuredHorizonUrls
      : legacyHorizonUrl
        ? [legacyHorizonUrl]
        : [];
  const horizonSelectionStrategy: HorizonSelectionStrategy =
    process.env.FLUID_HORIZON_SELECTION === "round_robin" ? "round_robin" : "priority";
  const rateLimitWindowMs = parsePositiveInt(process.env.FLUID_RATE_LIMIT_WINDOW_MS, 60_000);
  const rateLimitMax = parsePositiveInt(process.env.FLUID_RATE_LIMIT_MAX, 5);
  const allowedOrigins = parseCommaSeparatedList(process.env.FLUID_ALLOWED_ORIGINS);
  const maxXdrSize = parsePositiveInt(process.env.FLUID_MAX_XDR_SIZE, 10_240);
  const maxOperations = parsePositiveInt(process.env.FLUID_MAX_OPERATIONS, 100);
  const vault = loadVaultConfig();
  const lowBalanceThresholdXlm = parseOptionalNumber(process.env.FLUID_LOW_BALANCE_THRESHOLD_XLM);
  const checkIntervalMs = parsePositiveInt(
    process.env.FLUID_LOW_BALANCE_CHECK_INTERVAL_MS,
    60 * 60 * 1000,
  );
  const cooldownMs = parsePositiveInt(
    process.env.FLUID_LOW_BALANCE_ALERT_COOLDOWN_MS,
    6 * 60 * 60 * 1000,
  );
  const slackWebhookUrl = process.env.FLUID_ALERT_SLACK_WEBHOOK_URL?.trim() || undefined;
  const email = loadAlertEmailConfig();

  const supportedAssets = parseSupportedAssets(process.env.FLUID_SUPPORTED_ASSETS);

  
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
    supportedAssets,
  };
  
  const vaultSecretPaths = parseCommaSeparatedList(process.env.FLUID_FEE_PAYER_VAULT_SECRET_PATHS);
  const vaultPublicKeys = parseCommaSeparatedList(process.env.FLUID_FEE_PAYER_PUBLIC_KEYS);

  let feePayerAccounts: FeePayerAccount[];

  if (vault && vaultSecretPaths.length > 0 && vaultPublicKeys.length > 0) {
    if (vaultSecretPaths.length !== vaultPublicKeys.length) {
      throw new Error(
        "Vault mode requires FLUID_FEE_PAYER_VAULT_SECRET_PATHS and FLUID_FEE_PAYER_PUBLIC_KEYS to have the same number of entries",
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
      alerting: loadAlertingConfig(),
    };
  }

    feePayerAccounts = secrets.map((secret) => {
      const keypair = StellarSdk.Keypair.fromSecret(secret);
      return {
        publicKey: keypair.publicKey(),
        keypair,
        secretSource: { type: "env", secret },
      };
    });
  }

  const feePayerAccounts: FeePayerAccount[] = secrets.map((secret) => {
    const keypair = StellarSdk.Keypair.fromSecret(secret);

    return {
      publicKey: keypair.publicKey(),
      keypair,
      secretSource: { type: "env", secret },
    };
  });

  const lowBalanceThresholdXlm = parseOptionalNumber(
    process.env.FLUID_LOW_BALANCE_THRESHOLD_XLM,
  );
  const checkIntervalMs = parsePositiveInt(
    process.env.FLUID_LOW_BALANCE_CHECK_INTERVAL_MS,
    60 * 60 * 1000,
  );
  const cooldownMs = parsePositiveInt(
    process.env.FLUID_LOW_BALANCE_ALERT_COOLDOWN_MS,
    6 * 60 * 60 * 1000,
  );

  return {
      feePayerAccounts,
      signerPool: new SignerPool(
        feePayerAccounts.map((account) => ({
          keypair: account.keypair,
          secret: account.secretSource.type === "env" ? account.secretSource.secret : "",
        }))
      ),
      baseFee,
      feeMultiplier: Number.isFinite(feeMultiplier) ? feeMultiplier : 2,
      networkPassphrase,
      horizonUrl: horizonUrls[0],
      horizonUrls,
      horizonSelectionStrategy,
      rateLimitWindowMs,
      rateLimitMax,
      allowedOrigins,
      maxXdrSize,
      maxOperations,
      stellarRpcUrl: process.env.STELLAR_RPC_URL?.trim() || undefined,
      vault,
      alerting: {
      lowBalanceThresholdXlm,
      checkIntervalMs,
      cooldownMs,
      slackWebhookUrl,
      email,
    },
  };
}

function loadAlertingConfig(): AlertingConfig {
  const lowBalanceThresholdXlm = parseOptionalNumber(
    process.env.FLUID_LOW_BALANCE_THRESHOLD_XLM,
  );
  const checkIntervalMs = parsePositiveInt(
    process.env.FLUID_LOW_BALANCE_CHECK_INTERVAL_MS,
    60 * 60 * 1000,
  );
  const cooldownMs = parsePositiveInt(
    process.env.FLUID_LOW_BALANCE_ALERT_COOLDOWN_MS,
    6 * 60 * 60 * 1000,
  );
  const slackWebhookUrl = process.env.FLUID_ALERT_SLACK_WEBHOOK_URL?.trim();
  const email = loadAlertEmailConfig();

  return {
    lowBalanceThresholdXlm,
    checkIntervalMs,
    cooldownMs,
    slackWebhookUrl: slackWebhookUrl || undefined,
    email,
  };
}

function loadAlertEmailConfig(): AlertEmailConfig | undefined {
  const host = process.env.FLUID_ALERT_SMTP_HOST?.trim();
  const from = process.env.FLUID_ALERT_EMAIL_FROM?.trim();
  const to = process.env.FLUID_ALERT_EMAIL_TO
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
let rrIndex = 0;

export function pickFeePayerAccount(config: Config): FeePayerAccount {
  const activeKeys = config.signerPool
    .getSnapshot()
    .filter((account) => account.active)
    .map((account) => account.publicKey);

  if (activeKeys.length === 0) {
    throw new Error("Failed to select fee payer account from signer pool");
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseCommaSeparatedList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadVaultConfig(): VaultConfig | undefined {
  const addr = process.env.VAULT_ADDR?.trim();
  if (!addr) {
    return undefined;
  }

  const token = process.env.VAULT_TOKEN?.trim();
  const roleId = process.env.VAULT_APPROLE_ROLE_ID?.trim();
  const secretId = process.env.VAULT_APPROLE_SECRET_ID?.trim();
  const kvMount = process.env.FLUID_VAULT_KV_MOUNT?.trim() || "secret";
  const kvVersionRaw = process.env.FLUID_VAULT_KV_VERSION?.trim() || "2";
  const kvVersion = kvVersionRaw === "1" ? 1 : 2;
  const secretField = process.env.FLUID_FEE_PAYER_VAULT_SECRET_FIELD?.trim() || "secret";

  return {
    addr,
    token,
    appRole: token ? undefined : (roleId && secretId ? { roleId, secretId } : undefined),
    kvMount,
    kvVersion,
    secretField,
  };
}

// Round-robin counter (module-level, safe for single-threaded Node.js event loop)
let rrIndex = 0;

export function pickFeePayerAccount (config: Config): FeePayerAccount {
  const snapshot = config.signerPool.getSnapshot();
  const nextPublicKey = snapshot[rrIndex % snapshot.length]?.publicKey;
  rrIndex = (rrIndex + 1) % snapshot.length;
  const account = config.feePayerAccounts.find(
    (candidate) => candidate.publicKey === nextPublicKey
  );

  const account = config.feePayerAccounts.find((candidate) => candidate.publicKey === nextPublicKey);
  if (!account) {
    throw new Error("Failed to select fee payer account from signer pool");
  }

  return account;
}

function parseCommaSeparatedList (value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadVaultConfig (): VaultConfig | undefined {
  const addr = process.env.VAULT_ADDR?.trim();
  const kvMount = process.env.VAULT_KV_MOUNT?.trim() || "secret";
  const kvVersionStr = process.env.VAULT_KV_VERSION?.trim() || "2";

  if (!addr) {
    return undefined;
  }

  return {
    addr,
    kvMount,
    kvVersion: kvVersionStr === "1" ? 1 : 2,
    secretField: process.env.VAULT_SECRET_FIELD?.trim() || "secret",
    token: process.env.VAULT_TOKEN?.trim(),
    appRole: process.env.VAULT_ROLE_ID && process.env.VAULT_SECRET_ID
      ? {
        roleId: process.env.VAULT_ROLE_ID,
        secretId: process.env.VAULT_SECRET_ID,
      }
      : undefined,
  };
}

function parseSupportedAssets (value: string | undefined): SupportedAsset[] {
  if (!value) {
    return [];
  }

  // Expect entry format: CODE:ISSUER:MIN_BALANCE (ISSUER and MIN_BALANCE are optional)
  return parseCommaSeparatedList(value).map((entry) => {
    const parts = entry.split(":").map((p) => p.trim());
    const code = parts[0];
    const issuer = parts[1];
    const minBalance = parts[2];

    return {
      code,
      issuer: issuer || undefined,
      minBalance: minBalance || undefined,
    };
  });
}
