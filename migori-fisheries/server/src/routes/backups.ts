import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { Router } from "express";
import { asyncHandler, HttpError } from "../lib/http.js";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";

const router = Router();

const backupDirectory = process.env.VERCEL ? "/tmp/mifbems-backups" : path.join(process.cwd(), "backups");
const backupFilePrefix = "mifbems-backup-";
const backupFileExtension = ".json.enc";

type BackupMetadata = {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
};

const getEncryptionKey = (): Buffer =>
  createHash("sha256")
    .update(`${env.JWT_ACCESS_SECRET}:${env.JWT_REFRESH_SECRET}`)
    .digest();

const createEncryptedArchive = (payload: unknown): Buffer => {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const compressedPayload = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const encrypted = Buffer.concat([cipher.update(compressedPayload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.from(
    JSON.stringify(
      {
        algorithm: "aes-256-gcm",
        compression: "gzip",
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        payload: encrypted.toString("base64")
      },
      null,
      2
    ),
    "utf8"
  );
};

const ensureBackupDirectory = async (): Promise<void> => {
  if (!existsSync(backupDirectory)) {
    await mkdir(backupDirectory, { recursive: true });
  }
};

const readBackupMetadata = async (fileName: string): Promise<BackupMetadata | null> => {
  if (!fileName.startsWith(backupFilePrefix) || !fileName.endsWith(backupFileExtension)) {
    return null;
  }

  const filePath = path.join(backupDirectory, fileName);
  const fileStats = await stat(filePath);

  return {
    fileName,
    sizeBytes: fileStats.size,
    createdAt: fileStats.mtime.toISOString()
  };
};

const getLatestBackup = async (): Promise<(BackupMetadata & { filePath: string }) | null> => {
  await ensureBackupDirectory();
  const fileNames = await readdir(backupDirectory);
  const metadata = await Promise.all(fileNames.map((fileName) => readBackupMetadata(fileName)));
  const backups = metadata
    .filter((entry): entry is BackupMetadata => entry !== null)
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

  const latest = backups[0];
  if (!latest) {
    return null;
  }

  return {
    ...latest,
    filePath: path.join(backupDirectory, latest.fileName)
  };
};

const buildBackupPayload = async (requestedById: string) => {
  const [
    users,
    farmers,
    licenses,
    productionRecords,
    captureFisheriesRecords,
    inspections,
    blueEconomyProjects,
    advisories,
    queries,
    auditLogs
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.farmer.findMany(),
    prisma.license.findMany(),
    prisma.productionRecord.findMany(),
    prisma.captureFisheriesRecord.findMany(),
    prisma.inspection.findMany(),
    prisma.blueEconomyProject.findMany(),
    prisma.advisory.findMany(),
    prisma.query.findMany(),
    prisma.auditLog.findMany()
  ]);

  return {
    app: "MiFBeDAS",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    requestedById,
    tables: {
      users,
      farmers,
      licenses,
      productionRecords,
      captureFisheriesRecords,
      inspections,
      blueEconomyProjects,
      advisories,
      queries,
      auditLogs
    }
  };
};

router.use(authenticate);

router.get(
  "/",
  authorize(["ADMIN", "DIRECTOR"]),
  asyncHandler(async (_req, res) => {
    const latest = await getLatestBackup();
    res.status(200).json({ data: { latest } });
  })
);

router.post(
  "/",
  authorize(["ADMIN", "DIRECTOR"]),
  auditLog("BACKUP", "CREATE"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    await ensureBackupDirectory();

    const exportedAt = new Date();
    const fileName = `${backupFilePrefix}${exportedAt.toISOString().replace(/[:.]/g, "-")}${backupFileExtension}`;
    const filePath = path.join(backupDirectory, fileName);
    const payload = await buildBackupPayload(req.user.id);
    const archive = createEncryptedArchive(payload);

    await writeFile(filePath, archive);

    const fileStats = await stat(filePath);

    res.status(201).json({
      data: {
        fileName,
        sizeBytes: fileStats.size,
        createdAt: fileStats.mtime.toISOString()
      }
    });
  })
);

router.get(
  "/latest/download",
  authorize(["ADMIN", "DIRECTOR"]),
  asyncHandler(async (_req, res) => {
    const latest = await getLatestBackup();

    if (!latest) {
      throw new HttpError(404, "No backup archive is available yet. Run a backup first.");
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${latest.fileName}"`);
    res.sendFile(latest.filePath);
  })
);

export default router;
