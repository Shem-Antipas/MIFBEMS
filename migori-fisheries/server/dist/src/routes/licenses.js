import { LicenseStatus, LicenseType } from "@prisma/client";
import { extname } from "node:path";
import multer from "multer";
import { Router } from "express";
import * as XLSX from "xlsx";
import { z } from "zod";
import { asyncHandler, HttpError } from "../lib/http.js";
import { MIGORI_SUBCOUNTIES, isValidWardForSubCounty, toCanonicalWardForSubCounty } from "../lib/locationData.js";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditLog } from "../middleware/auditLog.js";
import { validate } from "../middleware/validate.js";
const router = Router();
const idParamSchema = z.object({ id: z.string().min(5) });
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
const runMulter = (req, res, middleware) => new Promise((resolve, reject) => {
    middleware(req, res, (error) => {
        if (error) {
            reject(error);
            return;
        }
        resolve();
    });
});
const runMulterOrThrow = async (req, res, middleware) => {
    try {
        await runMulter(req, res, middleware);
    }
    catch (error) {
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
const normalizeHeader = (header) => header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeRow = (row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = value;
    }
    return normalized;
};
const isBlankSpreadsheetRow = (row) => Object.values(row).every((value) => {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === "string") {
        return value.replace(/\u00a0/g, " ").trim() === "";
    }
    return false;
});
const pickValue = (row, keys) => {
    for (const key of keys) {
        const value = row[key];
        if (value === null || value === undefined) {
            continue;
        }
        if (typeof value === "string" && value.replace(/\u00a0/g, " ").trim() === "") {
            continue;
        }
        return value;
    }
    return undefined;
};
const parseText = (value) => {
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
    const trimmed = value.replace(/\u00a0/g, " ").trim();
    return trimmed ? trimmed : undefined;
};
const parseNumber = (value) => {
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
const parseDateValue = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        const parsedExcelDate = XLSX.SSF.parse_date_code(value);
        if (parsedExcelDate) {
            return new Date(Date.UTC(parsedExcelDate.y, parsedExcelDate.m - 1, parsedExcelDate.d));
        }
    }
    const text = parseText(value);
    if (!text) {
        return undefined;
    }
    const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (slashMatch) {
        const [, dayPart, monthPart, yearPart] = slashMatch;
        if (!dayPart || !monthPart || !yearPart) {
            return undefined;
        }
        const day = Number(dayPart);
        const month = Number(monthPart);
        const year = Number(yearPart.length === 2 ? `20${yearPart}` : yearPart);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
const toTitleCase = (value) => value
    .trim()
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
const toCanonicalSubCounty = (value) => {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
    const match = MIGORI_SUBCOUNTIES.find((subCounty) => subCounty.toLowerCase() === normalized);
    return match ?? toTitleCase(value);
};
const toCanonicalWard = (subCounty, value) => {
    const canonicalWard = toCanonicalWardForSubCounty(subCounty, value);
    return canonicalWard === value.trim() ? toTitleCase(value) : canonicalWard;
};
const parseLicenseType = (value) => {
    const normalized = parseText(value)?.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!normalized) {
        return undefined;
    }
    const map = {
        fishdepot: LicenseType.FISH_DEPOT,
        fisherman: LicenseType.FISHERMAN,
        fishermanslicense: LicenseType.FISHERMAN,
        fishermenlicense: LicenseType.FISHERMAN,
        fishtrader: LicenseType.FISH_TRADER,
        fishtraderlicense: LicenseType.FISH_TRADER,
        fishtraderslicense: LicenseType.FISH_TRADER,
        boatowner: LicenseType.BOAT_OWNER,
        boatownerlicense: LicenseType.BOAT_OWNER,
        fishmovementpermit: LicenseType.FISH_MOVEMENT_PERMIT,
        boatlicense: LicenseType.BOAT_LICENSE,
        boatlicensing: LicenseType.BOAT_LICENSE,
        newboardregistration: LicenseType.NEW_BOARD_REGISTRATION,
        newboardregistrationlicense: LicenseType.NEW_BOARD_REGISTRATION,
        iceplant: LicenseType.ICE_PLANT,
        iceplantlicense: LicenseType.ICE_PLANT,
        boat: LicenseType.BOAT
    };
    return map[normalized] ?? (Object.values(LicenseType).includes(normalized.toUpperCase()) ? normalized.toUpperCase() : undefined);
};
const parseLicenseStatus = (value, expiryDate) => {
    const normalized = parseText(value)?.toLowerCase().replace(/[^a-z]/g, "");
    const map = {
        pending: LicenseStatus.PENDING,
        valid: LicenseStatus.VALID,
        active: LicenseStatus.VALID,
        expired: LicenseStatus.EXPIRED,
        revoked: LicenseStatus.REVOKED,
        rejected: LicenseStatus.REJECTED
    };
    return normalized ? map[normalized] ?? LicenseStatus.PENDING : expiryDate < new Date() ? LicenseStatus.EXPIRED : LicenseStatus.PENDING;
};
const formatImportError = (rowNumber, message) => `Row ${rowNumber}: ${message}`;
const IMPORT_CREATE_BATCH_SIZE = 100;
const IMPORT_UPDATE_BATCH_SIZE = 25;
const chunkItems = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};
const baseLicenseSchema = z.object({
    licenseNo: z.string().min(4),
    receiptNo: z.string().min(2),
    bmuName: z.string().min(2).optional(),
    holderName: z.string().min(2).optional(),
    holderIdNumber: z.string().min(4).optional(),
    holderPhoneNumber: z.string().min(7).optional(),
    holderEmail: z.string().email().optional(),
    subCounty: z.enum(MIGORI_SUBCOUNTIES).optional(),
    ward: z.string().min(2).optional(),
    beachName: z.string().min(2).optional(),
    market: z.string().min(2).optional(),
    amountLicensed: z.number().min(0).optional(),
    farmerId: z.string().min(5).optional(),
    type: z.enum(LicenseType),
    issuedDate: z.coerce.date(),
    expiryDate: z.coerce.date()
});
const createLicenseSchema = baseLicenseSchema.strict().superRefine((value, ctx) => {
    if (value.expiryDate <= value.issuedDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["expiryDate"],
            message: "Expiry date must be later than issued date"
        });
    }
    if (!value.farmerId) {
        for (const field of ["holderName", "holderIdNumber", "holderPhoneNumber", "subCounty", "ward"]) {
            if (!value[field]) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [field],
                    message: "This field is required when no registry holder is selected"
                });
            }
        }
    }
    if (value.subCounty && value.ward && !isValidWardForSubCounty(value.subCounty, value.ward)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ward"],
            message: "Selected ward does not belong to the selected sub-county"
        });
    }
});
const updateLicenseSchema = baseLicenseSchema
    .partial()
    .extend({
    status: z.enum(LicenseStatus).optional()
})
    .strict();
router.use(authenticate);
router.get("/", authorize(["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER", "ADMIN"]), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    if (req.user.role === "FISHERIES_OFFICER" && !req.user.subCounty) {
        throw new HttpError(403, "Your account is not assigned to a sub-county");
    }
    const where = req.user.role === "FISHERIES_OFFICER"
        ? {
            OR: [
                { subCounty: req.user.subCounty },
                { farmer: { subCounty: req.user.subCounty } }
            ]
        }
        : req.user.role === "FARMER"
            ? { farmerId: req.user.id }
            : {};
    const licenses = await prisma.license.findMany({
        where,
        include: { farmer: true },
        orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ data: licenses });
}));
router.post("/import", authorize(["DIRECTOR", "ADMIN", "FISHERIES_OFFICER"]), auditLog("LICENSE", "BULK_IMPORT"), asyncHandler(async (req, res) => {
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
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    if (rows.length === 0) {
        throw new HttpError(400, "The file is empty. Add license rows then try again.");
    }
    const actor = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true }
    });
    const rowErrors = [];
    const parsedRows = [];
    const seenLicenseNumbers = new Set();
    const seenReceiptNumbers = new Set();
    let processedCount = 0;
    for (const [index, rawRow] of rows.entries()) {
        const rowNumber = index + 2;
        if (isBlankSpreadsheetRow(rawRow)) {
            continue;
        }
        processedCount += 1;
        const row = normalizeRow(rawRow);
        const receiptNo = parseText(pickValue(row, ["receiptno", "receipt", "receiptnumber"]));
        const licenseNo = parseText(pickValue(row, ["uniquenumber", "licenseno", "licensenumber", "uniqueid"])) ??
            (receiptNo ? `LIC-${receiptNo}` : undefined);
        const holderName = parseText(pickValue(row, ["name", "holdername", "licenseename", "applicantname"]));
        const holderIdNumber = parseText(pickValue(row, ["id", "idno", "idnumber", "nationalid"]));
        const holderPhoneNumber = parseText(pickValue(row, ["phone", "phonenumber", "telephone", "contact"]));
        const holderEmail = parseText(pickValue(row, ["email", "emailaddress"]));
        const subCountyRaw = parseText(pickValue(row, ["subcounty", "subcountyname"]));
        const wardRaw = parseText(pickValue(row, ["ward", "wardname"]));
        const beachName = parseText(pickValue(row, ["beachname", "beach", "landingbeach"]));
        const market = parseText(pickValue(row, ["market", "marketname"]));
        const amountLicensed = parseNumber(pickValue(row, ["amountlicensed", "amount", "licenseamount"])) ?? 0;
        const licensedByName = parseText(pickValue(row, ["licensedby", "officer", "licensedbyname"])) ?? actor?.name;
        const type = parseLicenseType(pickValue(row, ["type", "licensetype", "category"]));
        const issuedDate = parseDateValue(pickValue(row, ["issueddate", "dateissued", "issued"]));
        const expiryDate = parseDateValue(pickValue(row, ["expirydate", "expirationdate", "expiry", "expires"]));
        if (!licenseNo || !receiptNo || !holderName || !holderIdNumber || !holderPhoneNumber || !subCountyRaw || !wardRaw || !type || !issuedDate || !expiryDate) {
            rowErrors.push(formatImportError(rowNumber, "required fields missing (Unique Number or Receipt No, Name, ID, Phone, Sub-County, Ward, Type, Issued Date, Expiry Date)."));
            continue;
        }
        if (seenLicenseNumbers.has(licenseNo)) {
            rowErrors.push(formatImportError(rowNumber, `duplicate Unique Number "${licenseNo}" in this upload.`));
            continue;
        }
        if (seenReceiptNumbers.has(receiptNo)) {
            rowErrors.push(formatImportError(rowNumber, `duplicate Receipt No "${receiptNo}" in this upload.`));
            continue;
        }
        if (expiryDate <= issuedDate) {
            rowErrors.push(formatImportError(rowNumber, "Expiry date must be later than issued date."));
            continue;
        }
        const subCounty = toCanonicalSubCounty(subCountyRaw);
        if (!MIGORI_SUBCOUNTIES.includes(subCounty)) {
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
        const status = parseLicenseStatus(pickValue(row, ["status", "licensestatus"]), expiryDate);
        seenLicenseNumbers.add(licenseNo);
        seenReceiptNumbers.add(receiptNo);
        const createData = {
            licenseNo,
            receiptNo,
            holderName,
            holderIdNumber,
            holderPhoneNumber,
            holderEmail,
            subCounty,
            ward,
            beachName,
            market,
            amountLicensed,
            licensedById: req.user.id,
            licensedByName,
            type,
            issuedDate,
            expiryDate,
            status
        };
        parsedRows.push({
            rowNumber,
            licenseNo,
            receiptNo,
            createData,
            updateData: createData
        });
    }
    const licenseNumbers = parsedRows.map((row) => row.licenseNo);
    const receiptNumbers = parsedRows.map((row) => row.receiptNo);
    const existingLicenses = parsedRows.length > 0
        ? await prisma.license.findMany({
            where: {
                OR: [
                    ...(licenseNumbers.length > 0 ? [{ licenseNo: { in: licenseNumbers } }] : []),
                    ...(receiptNumbers.length > 0 ? [{ receiptNo: { in: receiptNumbers } }] : [])
                ]
            },
            select: { id: true, licenseNo: true, receiptNo: true }
        })
        : [];
    const existingByLicenseNo = new Map(existingLicenses.map((license) => [license.licenseNo, license]));
    const existingByReceiptNo = new Map(existingLicenses
        .filter((license) => license.receiptNo)
        .map((license) => [license.receiptNo, license]));
    const createRows = [];
    const updateRows = [];
    for (const row of parsedRows) {
        const existingLicense = existingByLicenseNo.get(row.licenseNo) ?? existingByReceiptNo.get(row.receiptNo);
        if (existingLicense) {
            updateRows.push({ ...row, existingId: existingLicense.id });
        }
        else {
            createRows.push(row);
        }
    }
    let createdCount = 0;
    let updatedCount = 0;
    for (const chunk of chunkItems(createRows, IMPORT_CREATE_BATCH_SIZE)) {
        try {
            const result = await prisma.license.createMany({
                data: chunk.map((row) => row.createData),
                skipDuplicates: true
            });
            createdCount += result.count;
        }
        catch {
            for (const row of chunk) {
                try {
                    await prisma.license.create({ data: row.createData });
                    createdCount += 1;
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to import row";
                    rowErrors.push(formatImportError(row.rowNumber, message));
                }
            }
        }
    }
    for (const chunk of chunkItems(updateRows, IMPORT_UPDATE_BATCH_SIZE)) {
        try {
            await prisma.$transaction(chunk.map((row) => prisma.license.update({
                where: { id: row.existingId },
                data: row.updateData
            })));
            updatedCount += chunk.length;
        }
        catch {
            for (const row of chunk) {
                try {
                    await prisma.license.update({
                        where: { id: row.existingId },
                        data: row.updateData
                    });
                    updatedCount += 1;
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to import row";
                    rowErrors.push(formatImportError(row.rowNumber, message));
                }
            }
        }
    }
    res.status(createdCount + updatedCount > 0 ? 201 : 200).json({
        data: {
            createdCount,
            updatedCount,
            skippedCount: processedCount - createdCount - updatedCount,
            errors: rowErrors
        }
    });
}));
router.post("/", validate({ body: createLicenseSchema }), authorize(["FISHERIES_OFFICER"]), auditLog("LICENSE"), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new HttpError(401, "Unauthorized");
    }
    const payload = req.body;
    const farmer = payload.farmerId
        ? await prisma.farmer.findUnique({ where: { id: payload.farmerId } })
        : null;
    if (payload.farmerId && !farmer) {
        throw new HttpError(404, "Registry holder not found");
    }
    const targetSubCounty = farmer?.subCounty ?? payload.subCounty;
    if (!targetSubCounty) {
        throw new HttpError(400, "Sub-county is required");
    }
    if (req.user.subCounty !== targetSubCounty) {
        throw new HttpError(403, "You can only record licenses in your sub-county");
    }
    const officer = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true }
    });
    const license = await prisma.license.create({
        data: {
            ...payload,
            holderName: payload.holderName ?? farmer?.name,
            holderIdNumber: payload.holderIdNumber ?? farmer?.idNumber,
            holderPhoneNumber: payload.holderPhoneNumber ?? farmer?.phoneNumber,
            holderEmail: payload.holderEmail ?? farmer?.email,
            subCounty: targetSubCounty,
            ward: payload.ward ?? farmer?.ward,
            amountLicensed: payload.amountLicensed ?? 0,
            licensedById: req.user.id,
            licensedByName: officer?.name,
            status: LicenseStatus.PENDING
        }
    });
    res.status(201).json({ data: license });
}));
router.put("/:id", validate({ params: idParamSchema, body: updateLicenseSchema }), authorize(["DIRECTOR", "FISHERIES_OFFICER", "ADMIN"]), auditLog("LICENSE"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const license = await prisma.license.findUnique({
        where: { id },
        include: { farmer: true }
    });
    if (!license) {
        throw new HttpError(404, "License not found");
    }
    const licenseSubCounty = license.subCounty ?? license.farmer?.subCounty;
    if (req.user?.role === "FISHERIES_OFFICER" && licenseSubCounty !== req.user.subCounty) {
        throw new HttpError(403, "You can only update licenses in your sub-county");
    }
    const payload = req.body;
    const isApprovalChange = payload.status !== undefined;
    if (isApprovalChange && req.user?.role !== "DIRECTOR" && req.user?.role !== "ADMIN") {
        throw new HttpError(403, "Only the Director or Admin can approve or reject licenses");
    }
    if (req.user?.role === "FISHERIES_OFFICER" && license.status !== LicenseStatus.PENDING) {
        throw new HttpError(403, "Approved, rejected, expired, or revoked licenses cannot be edited by extension officers");
    }
    if ((payload.issuedDate ?? license.issuedDate) >= (payload.expiryDate ?? license.expiryDate)) {
        throw new HttpError(400, "Expiry date must be later than issued date");
    }
    if (payload.subCounty && payload.ward && !isValidWardForSubCounty(payload.subCounty, payload.ward)) {
        throw new HttpError(400, "Selected ward does not belong to the selected sub-county");
    }
    const updated = await prisma.license.update({
        where: { id },
        data: {
            ...payload,
            approvedById: payload.status === LicenseStatus.VALID || payload.status === LicenseStatus.REJECTED ? req.user?.id : undefined,
            approvedAt: payload.status === LicenseStatus.VALID || payload.status === LicenseStatus.REJECTED ? new Date() : undefined
        }
    });
    res.status(200).json({ data: updated });
}));
router.delete("/:id", validate({ params: idParamSchema }), authorize(["DIRECTOR", "ADMIN"]), auditLog("LICENSE"), asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.license.delete({ where: { id } });
    res.status(204).send();
}));
export default router;
