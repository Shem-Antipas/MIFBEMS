import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { Request, Response } from "express";
import multer from "multer";
import { ProjectCategory, ProjectStatus } from "@prisma/client";
import { Router } from "express";
import * as XLSX from "xlsx";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import {
  MIGORI_SUBCOUNTIES,
  isValidWardForSubCounty,
} from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const idParamSchema = z.object({ id: z.string().min(5) });
const COUNTY_WIDE = "County Wide";
const ALL_WARDS = "All wards";
const PROJECT_IMAGES_BUCKET = "project-images";
const MAX_PROJECT_IMAGES = 8;

type PrimitiveCell = string | number | boolean | Date | null;
type SpreadsheetRow = Record<string, PrimitiveCell>;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: MAX_PROJECT_IMAGES
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }
    callback(new HttpError(400, "Only image files are allowed for project attachments"));
  }
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    const validExtensions = new Set([".csv", ".xlsx", ".xls"]);

    if (validExtensions.has(extension)) {
      callback(null, true);
      return;
    }

    callback(new HttpError(400, "Upload a CSV or Excel file (.csv, .xlsx, .xls)"));
  }
});

const runMulter = (
  req: Request,
  res: Response,
  middleware: (req: Request, res: Response, callback: (error?: unknown) => void) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    middleware(req, res, (error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const runMulterOrThrow = async (
  req: Request,
  res: Response,
  middleware: (req: Request, res: Response, callback: (error?: unknown) => void) => void
): Promise<void> => {
  try {
    await runMulter(req, res, middleware);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        throw new HttpError(400, "Uploaded file is too large");
      }
      throw new HttpError(400, error.message);
    }

    throw new HttpError(400, "Invalid file upload request");
  }
};

const toTitleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");

const toCanonicalSubCounty = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (normalized === "county wide" || normalized === "countywide") {
    return COUNTY_WIDE;
  }

  const match = MIGORI_SUBCOUNTIES.find((subCounty) => subCounty.toLowerCase() === normalized);
  if (match) {
    return match;
  }

  return toTitleCase(trimmed);
};

const isProjectSubCounty = (value: string): boolean =>
  value === COUNTY_WIDE || MIGORI_SUBCOUNTIES.includes(value as (typeof MIGORI_SUBCOUNTIES)[number]);

const normalizeWard = (subCounty: string, ward?: string): string => {
  if (subCounty === COUNTY_WIDE) {
    return ALL_WARDS;
  }

  return ward?.trim() || "Unspecified";
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(/,/g, "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) {
    return undefined;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseGps = (value: unknown): { latitude?: number; longitude?: number } => {
  if (typeof value !== "string") {
    return {};
  }

  const parts = value
    .split(/[;,\s]+/)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));

  if (parts.length < 2) {
    return {};
  }

  return {
    latitude: parts[0],
    longitude: parts[1]
  };
};

const parseDateValue = (value: unknown): Date | undefined => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1900 && value <= 2200) {
      return new Date(Date.UTC(value, 0, 1));
    }

    const parsedExcelDate = XLSX.SSF.parse_date_code(value);
    if (parsedExcelDate) {
      return new Date(
        Date.UTC(
          parsedExcelDate.y,
          parsedExcelDate.m - 1,
          parsedExcelDate.d,
          parsedExcelDate.H,
          parsedExcelDate.M,
          Math.floor(parsedExcelDate.S)
        )
      );
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (/^\d{4}$/.test(trimmed)) {
      return new Date(Date.UTC(Number(trimmed), 0, 1));
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
};

const normalizeHeader = (header: string): string => header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeRow = (row: SpreadsheetRow): Record<string, PrimitiveCell> => {
  const normalized: Record<string, PrimitiveCell> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[normalizeHeader(key)] = value;
  }
  return normalized;
};

const pickValue = (row: Record<string, PrimitiveCell>, keys: string[]): PrimitiveCell | undefined => {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" && value.trim() === "") {
      continue;
    }

    return value;
  }

  return undefined;
};

const parseStatus = (value: unknown): ProjectStatus | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, ProjectStatus> = {
    pending: "PENDING",
    in_progress: "IN_PROGRESS",
    inprogress: "IN_PROGRESS",
    stalled: "STALLED",
    planned: "PLANNED",
    ongoing: "ONGOING",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    canceled: "CANCELLED"
  };

  return map[normalized];
};

const projectPayloadSchema = z.object({
  budgetLine: z.string().trim().min(2).optional(),
  category: z.enum(ProjectCategory).optional(),
  name: z.string().min(3),
  description: z.string().min(3).optional(),
  subCounty: z.string().trim().min(2),
  ward: z.string().trim().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  budget: z.number().min(0),
  completionPercent: z.number().min(0).max(100).optional(),
  funder: z.string().min(2),
  status: z.enum(ProjectStatus).optional(),
  photos: z.array(z.string().url()).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional()
});

const createProjectSchema = projectPayloadSchema.strict().superRefine((value, ctx) => {
  if (!isProjectSubCounty(value.subCounty)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subCounty"],
      message: "Selected sub-county is invalid"
    });
    return;
  }

  const ward = normalizeWard(value.subCounty, value.ward);
  if (
    value.subCounty !== COUNTY_WIDE &&
    ward !== "Unspecified" &&
    ward !== ALL_WARDS &&
    !isValidWardForSubCounty(value.subCounty, ward)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }
});

const updateProjectSchema = projectPayloadSchema.partial().strict();

router.use(authenticate);

router.get(
  "/",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
    }

    const where = req.user.role === "FISHERIES_OFFICER" ? { subCounty: req.user.subCounty } : {};

    const projects = await prisma.blueEconomyProject.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ data: projects });
  })
);

router.post(
  "/upload-images",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
  auditLog("PROJECT_MEDIA", "UPLOAD"),
  asyncHandler(async (req, res) => {
    await runMulterOrThrow(req, res, imageUpload.array("images", MAX_PROJECT_IMAGES));

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      throw new HttpError(400, "Please attach at least one image");
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      throw new HttpError(500, "Supabase is not configured for image uploads");
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const extension = extname(file.originalname).toLowerCase() || ".jpg";
      const objectPath = `projects/${new Date().getUTCFullYear()}/${randomUUID()}${extension}`;

      const { error } = await supabase.storage
        .from(PROJECT_IMAGES_BUCKET)
        .upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: false });

      if (error) {
        throw new HttpError(500, `Failed to upload image: ${error.message}`);
      }

      const { data } = supabase.storage.from(PROJECT_IMAGES_BUCKET).getPublicUrl(objectPath);
      uploadedUrls.push(data.publicUrl);
    }

    res.status(201).json({ data: { photos: uploadedUrls } });
  })
);

router.post(
  "/import",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
  auditLog("PROJECT", "BULK_IMPORT"),
  asyncHandler(async (req, res) => {
    await runMulterOrThrow(req, res, importUpload.single("file"));

    if (!req.file) {
      throw new HttpError(400, "Please attach a CSV/Excel file for import");
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new HttpError(400, "The spreadsheet has no worksheet");
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new HttpError(400, "The spreadsheet worksheet could not be read");
    }

    const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, { defval: "" });

    if (rows.length === 0) {
      throw new HttpError(400, "The file is empty. Add project rows then try again.");
    }

    const officerName = req.user
      ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } })
      : null;

    const payloads: Array<z.infer<typeof createProjectSchema>> = [];
    const rowErrors: string[] = [];

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);

      const nameRaw = pickValue(row, ["projectnametitle", "projectname", "name", "title"]);
      const subCountyRaw = pickValue(row, ["subcounty", "subcountyname", "subcounties"]);
      const wardRaw = pickValue(row, ["ward", "wardname"]);
      const budgetRaw = pickValue(row, ["approvedprojectcost", "projectcost", "budget", "amount"]);
      const startDateRaw = pickValue(row, ["projectstartdate", "startdate", "startyear", "year"]);
      const statusRaw = pickValue(row, ["projectstatus", "status"]);
      const completionRaw = pickValue(row, ["completion", "completionpercent", "percentcompletion"]);
      const budgetLineRaw = pickValue(row, ["projectcodebudgetline", "projectcode", "budgetline", "code"]);
      const gpsRaw = pickValue(row, ["gps", "coordinates", "latlng"]);
      const latitudeRaw = pickValue(row, ["latitude", "lat"]);
      const longitudeRaw = pickValue(row, ["longitude", "lng", "lon"]);
      const funderRaw = pickValue(row, ["funder", "sourceoffunds", "donor"]);
      const descriptionRaw = pickValue(row, ["description", "projectdescription", "remarks"]);

      const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
      const canonicalSubCounty = toCanonicalSubCounty(typeof subCountyRaw === "string" ? subCountyRaw : "");
      const budget = parseNumber(budgetRaw);
      const startDate = parseDateValue(startDateRaw);

      if (!name || !canonicalSubCounty || budget === undefined || !startDate) {
        rowErrors.push(
          `Row ${rowNumber}: required fields missing (Project Name/Title, Sub-County, Approved Project Cost, Project Start Date).`
        );
        return;
      }

      if (!isProjectSubCounty(canonicalSubCounty)) {
        rowErrors.push(`Row ${rowNumber}: invalid sub-county \"${canonicalSubCounty}\".`);
        return;
      }

      if (req.user?.role === "FISHERIES_OFFICER" && canonicalSubCounty !== req.user.subCounty) {
        rowErrors.push(`Row ${rowNumber}: Fisheries Officer imports are restricted to ${req.user.subCounty}.`);
        return;
      }

      const ward = normalizeWard(canonicalSubCounty, typeof wardRaw === "string" ? wardRaw : undefined);
      if (
        canonicalSubCounty !== COUNTY_WIDE &&
        ward !== "Unspecified" &&
        ward !== ALL_WARDS &&
        !isValidWardForSubCounty(canonicalSubCounty, ward)
      ) {
        rowErrors.push(`Row ${rowNumber}: ward \"${ward}\" does not belong to ${canonicalSubCounty}.`);
        return;
      }

      const gpsCoordinates = parseGps(gpsRaw);
      const latitude = parseNumber(latitudeRaw) ?? gpsCoordinates.latitude;
      const longitude = parseNumber(longitudeRaw) ?? gpsCoordinates.longitude;

      const parsedStatus = parseStatus(statusRaw) ?? "COMPLETED";
      const completionPercent = parseNumber(completionRaw) ?? (parsedStatus === "COMPLETED" ? 100 : 0);

      const candidate = {
        budgetLine: typeof budgetLineRaw === "string" && budgetLineRaw.trim() ? budgetLineRaw.trim() : undefined,
        category: "BLUE_ECONOMY" as const,
        name,
        description: typeof descriptionRaw === "string" && descriptionRaw.trim() ? descriptionRaw.trim() : name,
        subCounty: canonicalSubCounty,
        ward,
        latitude,
        longitude,
        budget,
        completionPercent,
        funder: typeof funderRaw === "string" && funderRaw.trim() ? funderRaw.trim() : "County Government of Migori",
        status: parsedStatus,
        photos: [] as string[],
        startDate,
        endDate: undefined
      };

      const parsed = createProjectSchema.safeParse(candidate);
      if (!parsed.success) {
        rowErrors.push(`Row ${rowNumber}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
        return;
      }

      payloads.push(parsed.data);
    });

    if (payloads.length === 0) {
      throw new HttpError(400, rowErrors[0] ?? "No valid rows were found in the import file.");
    }

    const result = await prisma.blueEconomyProject.createMany({
      data: payloads.map((item) => ({
        ...item,
        responsibleOfficerId: req.user?.id,
        responsibleOfficerName: officerName?.name
      }))
    });

    res.status(201).json({
      data: {
        createdCount: result.count,
        skippedCount: rows.length - result.count,
        errors: rowErrors
      }
    });
  })
);

router.post(
  "/",
  validate({ body: createProjectSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof createProjectSchema>).subCounty
  }),
  auditLog("PROJECT"),
  asyncHandler(async (req, res) => {
    const payload = req.body as z.infer<typeof createProjectSchema>;
    const ward = normalizeWard(payload.subCounty, payload.ward);

    if (payload.endDate && payload.endDate < payload.startDate) {
      throw new HttpError(400, "endDate cannot be before startDate");
    }

    const officer = req.user
      ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } })
      : null;

    const project = await prisma.blueEconomyProject.create({
      data: {
        ...payload,
        ward,
        responsibleOfficerId: req.user?.id,
        responsibleOfficerName: officer?.name
      }
    });
    res.status(201).json({ data: project });
  })
);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateProjectSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof updateProjectSchema>).subCounty
  }),
  auditLog("PROJECT"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const current = await prisma.blueEconomyProject.findUnique({ where: { id } });

    if (!current) {
      throw new HttpError(404, "Project not found");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && current.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only update projects in your sub-county");
    }

    const payload = req.body as z.infer<typeof updateProjectSchema>;

    if (payload.subCounty && !isProjectSubCounty(payload.subCounty)) {
      throw new HttpError(400, "Selected sub-county is invalid");
    }

    const targetSubCounty = payload.subCounty ?? current.subCounty;
    const targetWard = normalizeWard(targetSubCounty, payload.ward ?? current.ward);

    if (
      targetSubCounty !== COUNTY_WIDE &&
      targetWard !== "Unspecified" &&
      targetWard !== ALL_WARDS &&
      !isValidWardForSubCounty(targetSubCounty, targetWard)
    ) {
      throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }

    const project = await prisma.blueEconomyProject.update({
      where: { id },
      data: {
        ...payload,
        ward: targetWard
      }
    });

    res.status(200).json({ data: project });
  })
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "ADMIN"]),
  auditLog("PROJECT"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    await prisma.blueEconomyProject.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
