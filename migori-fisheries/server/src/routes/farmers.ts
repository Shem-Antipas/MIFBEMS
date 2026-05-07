import { AgeBracket, FarmType, FarmerStatus, Gender, LicenseStatus, LicenseType, Prisma } from "@prisma/client";
import { extname } from "node:path";
import type { Request, Response } from "express";
import multer from "multer";
import { Router } from "express";
import * as XLSX from "xlsx";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY, isValidWardForSubCounty } from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
import { listFarmersByActor } from "../services/farmerService.js";

const router = Router();

type PrimitiveCell = string | number | boolean | Date | null;
type SpreadsheetRow = Record<string, PrimitiveCell>;

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

const parseText = (value: unknown): string | undefined => {
  if (value instanceof Date) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value).trim();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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

const parseInteger = (value: unknown): number | undefined => {
  const parsed = parseNumber(value);
  if (parsed === undefined) {
    return undefined;
  }

  return Math.max(0, Math.trunc(parsed));
};

const parseDateValue = (value: unknown): Date | undefined => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
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

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
};

const toTitleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");

const toCanonicalSubCounty = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const match = MIGORI_SUBCOUNTIES.find((subCounty) => subCounty.toLowerCase() === normalized);
  return match ?? toTitleCase(value);
};

const toCanonicalWard = (subCounty: string, value: string): string => {
  const normalized = value.trim().toLowerCase();
  const wards = WARDS_BY_SUBCOUNTY[subCounty as keyof typeof WARDS_BY_SUBCOUNTY] ?? [];
  return wards.find((ward) => ward.toLowerCase() === normalized) ?? toTitleCase(value);
};

const parseFarmType = (value: unknown): FarmType | undefined => {
  const text = parseText(value)?.toLowerCase().replace(/[^a-z]/g, "");
  if (!text) {
    return undefined;
  }

  const map: Record<string, FarmType> = {
    cage: "CAGE",
    cages: "CAGE",
    dam: "DAM",
    dams: "DAM",
    pond: "POND",
    ponds: "POND",
    fishpond: "POND",
    fishponds: "POND",
    tank: "TANK",
    tanks: "TANK"
  };

  return map[text] ?? (Object.values(FarmType).includes(text.toUpperCase() as FarmType) ? (text.toUpperCase() as FarmType) : undefined);
};

const parseFarmerStatus = (value: unknown): FarmerStatus => {
  const text = parseText(value)?.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, FarmerStatus> = {
    active: "ACTIVE",
    inactive: "INACTIVE",
    partiallyactive: "PARTIALLY_ACTIVE",
    partialactive: "PARTIALLY_ACTIVE",
    suspended: "SUSPENDED"
  };

  return text ? map[text] ?? "ACTIVE" : "ACTIVE";
};

const parseGender = (value: unknown): Gender | undefined => {
  const text = parseText(value)?.toLowerCase().replace(/[^a-z]/g, "");
  if (!text) {
    return undefined;
  }

  const map: Record<string, Gender> = {
    male: "MALE",
    m: "MALE",
    female: "FEMALE",
    f: "FEMALE"
  };

  return map[text];
};

const parseAgeBracket = (value: unknown): AgeBracket | undefined => {
  const text = parseText(value)?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!text) {
    return undefined;
  }

  const map: Record<string, AgeBracket> = {
    youth: "YOUTH",
    below35: "YOUTH",
    under35: "YOUTH",
    adult: "ADULT",
    above35: "ADULT",
    over35: "ADULT"
  };

  return map[text];
};

const parseSpecies = (value: unknown): string[] => {
  const text = parseText(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[,;/|]+/)
    .map((species) => species.trim())
    .filter((species) => species.length >= 2);
};

const formatImportError = (rowNumber: number, message: string): string => `Row ${rowNumber}: ${message}`;

const createFarmerSchema = z.object({
  name: z.string().min(2),
  idNumber: z.string().min(4).optional(),
  phoneNumber: z.string().min(7).optional(),
  email: z.string().email().optional(),
  gender: z.enum(Gender).optional(),
  ageBracket: z.enum(AgeBracket).optional(),
  subCounty: z.enum(MIGORI_SUBCOUNTIES),
  ward: z.string().min(2),
  farmType: z.enum(FarmType),
  species: z.array(z.string().min(2)).min(1),
  licenseNo: z.string().optional(),
  status: z.enum(FarmerStatus).optional(),
  productionKg: z.number().min(0).optional(),
  numberOfPonds: z.number().int().min(0).optional(),
  activePonds: z.number().int().min(0).optional(),
  inactivePonds: z.number().int().min(0).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  initialLicense: z
    .object({
      licenseNo: z.string().min(4),
      receiptNo: z.string().min(2),
      bmuName: z.string().min(2).optional(),
      type: z.enum(LicenseType),
      issuedDate: z.coerce.date(),
      expiryDate: z.coerce.date()
    })
    .optional()
}).strict().superRefine((value, ctx) => {
  if (!isValidWardForSubCounty(value.subCounty, value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }

  if (value.initialLicense && value.initialLicense.expiryDate <= value.initialLicense.issuedDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["initialLicense", "expiryDate"],
      message: "Expiry date must be later than issued date"
    });
  }

  const numberOfPonds = value.numberOfPonds ?? 0;
  const activePonds = value.activePonds ?? 0;
  const inactivePonds = value.inactivePonds ?? 0;

  if (activePonds + inactivePonds > numberOfPonds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["numberOfPonds"],
      message: "Active and inactive ponds cannot exceed total ponds"
    });
  }
});

const updateFarmerSchema = z
  .object({
    name: z.string().min(2).optional(),
    idNumber: z.string().min(4).nullable().optional(),
    phoneNumber: z.string().min(7).nullable().optional(),
    email: z.string().email().nullable().optional(),
    gender: z.enum(Gender).nullable().optional(),
    ageBracket: z.enum(AgeBracket).nullable().optional(),
    subCounty: z.enum(MIGORI_SUBCOUNTIES).optional(),
    ward: z.string().min(2).optional(),
    farmType: z.enum(FarmType).optional(),
    species: z.array(z.string().min(2)).min(1).optional(),
    licenseNo: z.string().optional(),
    status: z.enum(FarmerStatus).optional(),
    productionKg: z.number().min(0).optional(),
    numberOfPonds: z.number().int().min(0).optional(),
    activePonds: z.number().int().min(0).optional(),
    inactivePonds: z.number().int().min(0).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional()
  })
  .strict();

const idParamSchema = z.object({ id: z.string().min(5) });

router.use(authenticate);

router.get(
  "/",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
    }

    const farmers = await listFarmersByActor(req.user);
    res.status(200).json({ data: farmers });
  })
);

router.post(
  "/import",
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]),
  auditLog("FARMER", "BULK_IMPORT"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    await runMulterOrThrow(req, res, importUpload.single("file"));

    if (!req.file) {
      throw new HttpError(400, "Please attach a CSV/Excel file for import");
    }

    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
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
      throw new HttpError(400, "The file is empty. Add farmer rows then try again.");
    }

    const rowErrors: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);

      const farmerCode = parseText(pickValue(row, ["farmerid", "farmerno", "farmernumber", "farmercode"]));
      const name = parseText(pickValue(row, ["name", "farmername"]));
      const idNumber = parseText(pickValue(row, ["idno", "idnumber", "nationalid", "id"]));
      const phoneNumber = parseText(pickValue(row, ["phonenumber", "phone", "farmerphone", "farmernumber"]));
      const email = parseText(pickValue(row, ["email", "emailaddress"]));
      const gender = parseGender(pickValue(row, ["gender", "sex"]));
      const ageBracket = parseAgeBracket(pickValue(row, ["agebracket", "agegroup", "agecategory"]));
      const subCountyRaw = parseText(pickValue(row, ["subcounty", "subcountyname", "subcounties"]));
      const wardRaw = parseText(pickValue(row, ["ward", "wardname"]));
      const farmType = parseFarmType(pickValue(row, ["productionunit", "farmtype", "unittype"]));
      const species = parseSpecies(pickValue(row, ["species", "fishspecies"]));
      const productionKg = parseNumber(pickValue(row, ["productionkg", "productionkgs", "production"])) ?? 0;
      const numberOfPonds = parseInteger(
        pickValue(row, ["numberofproductionunits", "productionunits", "numberofponds", "numberofunits", "units"])
      ) ?? 0;
      const activePonds = parseInteger(pickValue(row, ["numberactive", "active", "activeponds", "activeunits"])) ?? 0;
      const inactivePonds =
        parseInteger(pickValue(row, ["numberinactive", "inactive", "inactiveponds", "inactiveunits"])) ?? 0;
      const status = parseFarmerStatus(pickValue(row, ["status", "farmerstatus"]));
      const latitude = parseNumber(pickValue(row, ["latitude", "lat"]));
      const longitude = parseNumber(pickValue(row, ["longitude", "lng", "lon"]));
      const createdAt = parseDateValue(pickValue(row, ["createdat", "createddate", "datecreated"]));

      if (!name || !subCountyRaw || !wardRaw || !farmType || species.length === 0) {
        rowErrors.push(
          formatImportError(
            rowNumber,
            "required fields missing (Name, Sub-County, Ward, Production Unit, Species)."
          )
        );
        continue;
      }

      const subCounty = toCanonicalSubCounty(subCountyRaw);
      if (!MIGORI_SUBCOUNTIES.includes(subCounty as (typeof MIGORI_SUBCOUNTIES)[number])) {
        rowErrors.push(formatImportError(rowNumber, `invalid sub-county "${subCounty}".`));
        continue;
      }

      if (req.user.role === "FISHERIES_OFFICER" && subCounty !== req.user.subCounty) {
        rowErrors.push(formatImportError(rowNumber, `Fisheries Officer imports are restricted to ${req.user.subCounty}.`));
        continue;
      }

      const ward = toCanonicalWard(subCounty, wardRaw);
      if (!isValidWardForSubCounty(subCounty, ward)) {
        rowErrors.push(formatImportError(rowNumber, `ward "${ward}" does not belong to ${subCounty}.`));
        continue;
      }

      if (activePonds + inactivePonds > numberOfPonds) {
        rowErrors.push(formatImportError(rowNumber, "Number Active and Number Inactive cannot exceed total Production Units."));
        continue;
      }

      if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
        rowErrors.push(formatImportError(rowNumber, "Latitude must be between -90 and 90."));
        continue;
      }

      if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
        rowErrors.push(formatImportError(rowNumber, "Longitude must be between -180 and 180."));
        continue;
      }

      const duplicateChecks: Prisma.FarmerWhereInput[] = [];
      if (farmerCode) duplicateChecks.push({ farmerCode });
      if (idNumber) duplicateChecks.push({ idNumber });
      if (phoneNumber) duplicateChecks.push({ phoneNumber });
      if (email) duplicateChecks.push({ email });

      try {
        const existingFarmer =
          duplicateChecks.length > 0
            ? await prisma.farmer.findFirst({
                where: { OR: duplicateChecks }
              })
            : null;

        if (existingFarmer) {
          await prisma.farmer.update({
            where: { id: existingFarmer.id },
            data: {
              name,
              idNumber,
              phoneNumber,
              email,
              gender,
              ageBracket,
              subCounty,
              ward,
              farmType,
              species,
              status,
              productionKg,
              numberOfPonds,
              activePonds,
              inactivePonds,
              latitude,
              longitude
            }
          });
          updatedCount += 1;
          continue;
        }

        await prisma.farmer.create({
          data: {
            ...(farmerCode ? { farmerCode } : {}),
            name,
            idNumber,
            phoneNumber,
            email,
            gender,
            ageBracket,
            subCounty,
            ward,
            farmType,
            species,
            status,
            productionKg,
            numberOfPonds,
            activePonds,
            inactivePonds,
            latitude,
            longitude,
            ...(createdAt ? { createdAt } : {}),
            registeredById: req.user.id
          }
        });
        createdCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to import row";
        rowErrors.push(formatImportError(rowNumber, message));
      }
    }

    if (createdCount + updatedCount === 0) {
      throw new HttpError(400, rowErrors[0] ?? "No valid rows were found in the import file.");
    }

    res.status(201).json({
      data: {
        createdCount,
        updatedCount,
        skippedCount: rows.length - createdCount - updatedCount,
        errors: rowErrors
      }
    });
  })
);

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;

    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: { licenses: true, productionRecords: true }
    });

    if (!farmer) {
      throw new HttpError(404, "Farmer not found");
    }

    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (req.user.role === "FISHERIES_OFFICER" && farmer.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only access farmers in your sub-county");
    }

    if (req.user.role === "FARMER" && farmer.id !== req.user.id) {
      throw new HttpError(403, "You can only access your own farmer record");
    }

    res.status(200).json({ data: farmer });
  })
);

router.post(
  "/",
  validate({ body: createFarmerSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof createFarmerSchema>).subCounty
  }),
  auditLog("FARMER"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new HttpError(401, "Unauthorized");
    }

    const payload = req.body as z.infer<typeof createFarmerSchema>;

    if (req.user.role === "FISHERIES_OFFICER") {
      if (!req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
      }

      if (payload.subCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only create farmers in your assigned sub-county");
      }
    }

    const { initialLicense, ...farmerPayload } = payload;

    const farmer = await prisma.$transaction(async (tx) => {
      const created = await tx.farmer.create({
        data: {
          ...farmerPayload,
          licenseNo: initialLicense?.licenseNo ?? farmerPayload.licenseNo,
          registeredById: req.user.id,
          productionKg: farmerPayload.productionKg ?? 0,
          numberOfPonds: farmerPayload.numberOfPonds ?? 0,
          activePonds: farmerPayload.activePonds ?? 0,
          inactivePonds: farmerPayload.inactivePonds ?? 0
        }
      });

      if (initialLicense) {
        if (req.user.role !== "FISHERIES_OFFICER") {
          throw new HttpError(403, "Only extension officers can record license and receipt information");
        }

        await tx.license.create({
          data: {
            ...initialLicense,
            status: LicenseStatus.PENDING,
            farmerId: created.id,
            holderName: created.name,
            holderIdNumber: created.idNumber,
            holderPhoneNumber: created.phoneNumber,
            holderEmail: created.email,
            subCounty: created.subCounty,
            ward: created.ward,
            licensedById: req.user.id
          }
        });
      }

      return tx.farmer.findUnique({
        where: { id: created.id },
        include: { licenses: true }
      });
    });

    if (!farmer) {
      throw new HttpError(500, "Failed to create farmer");
    }

    res.status(201).json({ data: farmer });
  })
);

router.put(
  "/:id",
  validate({ params: idParamSchema, body: updateFarmerSchema }),
  authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"], {
    resolveSubCounty: (req) => (req.body as z.infer<typeof updateFarmerSchema>).subCounty
  }),
  auditLog("FARMER"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;
    const existingFarmer = await prisma.farmer.findUnique({ where: { id } });

    if (!existingFarmer) {
      throw new HttpError(404, "Farmer not found");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && existingFarmer.subCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only update farmers in your sub-county");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
      throw new HttpError(403, "Your account is not assigned to a sub-county");
    }

    const payload = req.body as z.infer<typeof updateFarmerSchema>;
    const targetSubCounty = payload.subCounty ?? existingFarmer.subCounty;
    const targetWard = payload.ward ?? existingFarmer.ward;
    const targetNumberOfPonds = payload.numberOfPonds ?? existingFarmer.numberOfPonds;
    const targetActivePonds = payload.activePonds ?? existingFarmer.activePonds;
    const targetInactivePonds = payload.inactivePonds ?? existingFarmer.inactivePonds;

    if (!isValidWardForSubCounty(targetSubCounty, targetWard)) {
      throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }

    if (req.user?.role === "FISHERIES_OFFICER" && targetSubCounty !== req.user.subCounty) {
      throw new HttpError(403, "You can only update farmers in your assigned sub-county");
    }

    if (targetActivePonds + targetInactivePonds > targetNumberOfPonds) {
      throw new HttpError(400, "Active and inactive ponds cannot exceed total ponds");
    }

    const farmer = await prisma.farmer.update({
      where: { id },
      data: payload
    });

    res.status(200).json({ data: farmer });
  })
);

router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  authorize(["DIRECTOR", "ADMIN"]),
  auditLog("FARMER"),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof idParamSchema>;

    await prisma.farmer.delete({ where: { id } });
    res.status(204).send();
  })
);

export default router;
