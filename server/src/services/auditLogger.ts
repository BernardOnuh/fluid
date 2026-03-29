import { Request } from "express";
import prisma from "../utils/db";

export type AuditEventType =
  | "ADMIN_LOGIN"
  | "API_KEY_UPSERT"
  | "API_KEY_REVOKE"
  | "TENANT_TIER_UPDATE"
  | "MANUAL_OVERRIDE"
  | "RATE_LIMIT_OVERRIDE"
  | "CHAIN_CREATED"
  | "CHAIN_UPDATED"
  | "CHAIN_DELETED"
  | "AUDIT_EXPORT"
  | "OFAC_SCREENING_BLOCKED"
  | "OFAC_SCREENING_PASSED";

export function getAuditActor(req: Request): string {
  const adminUser = req.header("x-admin-user");
  if (adminUser) {
    return `admin:${adminUser}`;
  }
  if (req.header("x-admin-token")) {
    return "admin-token";
  }
  return "unknown";
}

export async function logAuditEvent(
  eventType: AuditEventType,
  actor: string,
  payload?: unknown,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType,
        actor,
        payload: payload ?? undefined,
      },
    });
  } catch {
    // Audit logging must not block the request path.
  }
}

const csvHeader = ["event_type", "actor", "payload", "timestamp"];

function escapeCsvValue(value: string): string {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeAuditRecordToCsv(
  record: {
    eventType: string;
    actor: string;
    payload?: unknown;
    timestamp: Date;
  },
): string {
  const payload = record.payload ? JSON.stringify(record.payload) : "";
  return [
    escapeCsvValue(record.eventType),
    escapeCsvValue(record.actor),
    escapeCsvValue(payload),
    escapeCsvValue(record.timestamp.toISOString()),
  ].join(",");
}

export async function exportAuditLogCsv(): Promise<string> {
  const records = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
  });

  const rows = records.map((record: any) => {
    return serializeAuditRecordToCsv({
      eventType: record.eventType,
      actor: record.actor,
      payload: record.payload,
      timestamp: record.timestamp,
    });
  });

  return [csvHeader.join(","), ...rows].join("\n");
}

export async function ensureAuditLogTableIntegrity(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!dbUrl.startsWith("file:")) {
    return;
  }

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS \"AuditLog\" (
      id TEXT PRIMARY KEY NOT NULL,
      eventType TEXT NOT NULL,
      actor TEXT NOT NULL,
      payload TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );

  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER IF NOT EXISTS audit_log_no_update
      BEFORE UPDATE ON \"AuditLog\"
      BEGIN
        SELECT RAISE(ABORT, 'AuditLog updates are prohibited');
      END`,
  );

  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
      BEFORE DELETE ON \"AuditLog\"
      BEGIN
        SELECT RAISE(ABORT, 'AuditLog deletes are prohibited');
      END`,
  );
}
