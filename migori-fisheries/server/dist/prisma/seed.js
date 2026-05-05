import bcrypt from "bcryptjs";
import { AdvisoryType, FarmType, FarmerStatus, InspectionResult, LicenseStatus, LicenseType, PrismaClient, ProjectStatus, Role } from "@prisma/client";
const prisma = new PrismaClient();
const PASSWORD = "Password123!";
const subCounties = ["Nyatike", "Suna East", "Suna West", "Uriri", "Kuria East", "Kuria West"];
const makeDate = (isoDate) => new Date(isoDate);
async function main() {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await prisma.auditLog.deleteMany();
    await prisma.license.deleteMany();
    await prisma.productionRecord.deleteMany();
    await prisma.captureFisheriesRecord.deleteMany();
    await prisma.inspection.deleteMany();
    await prisma.query.deleteMany();
    await prisma.advisory.deleteMany();
    await prisma.blueEconomyProject.deleteMany();
    await prisma.farmer.deleteMany();
    await prisma.user.deleteMany();
    const director = await prisma.user.create({
        data: {
            name: "Dr. James Ochieng",
            email: "director@mifbems.go.ke",
            passwordHash,
            role: Role.DIRECTOR,
            subCounty: null
        }
    });
    const officer = await prisma.user.create({
        data: {
            name: "Agnes Adhiambo",
            email: "officer@mifbems.go.ke",
            passwordHash,
            role: Role.FISHERIES_OFFICER,
            subCounty: "Suna East"
        }
    });
    const analyst = await prisma.user.create({
        data: {
            name: "Kevin Otieno",
            email: "analyst@mifbems.go.ke",
            passwordHash,
            role: Role.DATA_ANALYST,
            subCounty: null
        }
    });
    const farmerUser = await prisma.user.create({
        data: {
            name: "Peter Achieng",
            email: "farmer@mifbems.go.ke",
            passwordHash,
            role: Role.FARMER,
            subCounty: "Nyatike"
        }
    });
    await prisma.user.create({
        data: {
            name: "Mary Wanjiku",
            email: "admin@mifbems.go.ke",
            passwordHash,
            role: Role.ADMIN,
            subCounty: null
        }
    });
    const farmers = await Promise.all([
        prisma.farmer.create({
            data: {
                id: farmerUser.id,
                name: "Peter Achieng Farm",
                subCounty: subCounties[0],
                ward: "Kachieng",
                farmType: FarmType.POND,
                species: ["Tilapia", "Catfish"],
                status: FarmerStatus.ACTIVE,
                productionKg: 1200,
                numberOfPonds: 6,
                activePonds: 5,
                inactivePonds: 1,
                latitude: -1.5504,
                longitude: 34.2167,
                registeredById: officer.id
            }
        }),
        prisma.farmer.create({
            data: {
                name: "Suna Aqua Holdings",
                subCounty: subCounties[1],
                ward: "God Jope",
                farmType: FarmType.CAGE,
                species: ["Tilapia"],
                status: FarmerStatus.ACTIVE,
                productionKg: 2400,
                numberOfPonds: 0,
                activePonds: 0,
                inactivePonds: 0,
                latitude: -1.071,
                longitude: 34.474,
                registeredById: officer.id
            }
        }),
        prisma.farmer.create({
            data: {
                name: "West Lake Fisheries",
                subCounty: subCounties[2],
                ward: "Wiga",
                farmType: FarmType.TANK,
                species: ["Catfish"],
                status: FarmerStatus.ACTIVE,
                productionKg: 1600,
                numberOfPonds: 0,
                activePonds: 0,
                inactivePonds: 0,
                latitude: -1.169,
                longitude: 34.311,
                registeredById: director.id
            }
        }),
        prisma.farmer.create({
            data: {
                name: "Uriri Blue Waters",
                subCounty: subCounties[3],
                ward: "West Kanyamkago",
                farmType: FarmType.DAM,
                species: ["Tilapia", "Nile Perch"],
                status: FarmerStatus.SUSPENDED,
                productionKg: 800,
                numberOfPonds: 0,
                activePonds: 0,
                inactivePonds: 0,
                latitude: -0.784,
                longitude: 34.482,
                registeredById: director.id
            }
        }),
        prisma.farmer.create({
            data: {
                name: "Kuria East Fish Collective",
                subCounty: subCounties[4],
                ward: "Gokeharaka/Getambwega",
                farmType: FarmType.POND,
                species: ["Tilapia"],
                status: FarmerStatus.ACTIVE,
                productionKg: 980,
                numberOfPonds: 5,
                activePonds: 3,
                inactivePonds: 2,
                latitude: -1.041,
                longitude: 34.644,
                registeredById: director.id
            }
        }),
        prisma.farmer.create({
            data: {
                name: "Kuria West Aquahub",
                subCounty: subCounties[5],
                ward: "Bukira East",
                farmType: FarmType.CAGE,
                species: ["Catfish", "Tilapia"],
                status: FarmerStatus.INACTIVE,
                productionKg: 430,
                numberOfPonds: 0,
                activePonds: 0,
                inactivePonds: 0,
                latitude: -1.127,
                longitude: 34.515,
                registeredById: director.id
            }
        })
    ]);
    await Promise.all([
        prisma.productionRecord.createMany({
            data: [
                { farmerId: farmers[0].id, species: "Tilapia", volumeKg: 600, season: "Long Rains", year: 2025, month: 4 },
                { farmerId: farmers[1].id, species: "Tilapia", volumeKg: 1200, season: "Short Rains", year: 2025, month: 11 },
                { farmerId: farmers[2].id, species: "Catfish", volumeKg: 900, season: "Dry", year: 2025, month: 7 }
            ]
        }),
        prisma.blueEconomyProject.createMany({
            data: [
                {
                    name: "Procurement of fingerlings",
                    budgetLine: "3111302",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 1_200_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2022-01-01")
                },
                {
                    name: "Purchase of wooden boats",
                    budgetLine: "3110702",
                    subCounty: "Nyatike",
                    ward: "Unspecified",
                    budget: 3_200_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2022-01-01")
                },
                {
                    name: "Raised Ponds",
                    budgetLine: "2211007",
                    subCounty: "Kuria West",
                    ward: "Unspecified",
                    budget: 480_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Pond construction and renovation",
                    budgetLine: "3110504",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 3_200_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Boat, Engine and Trolley",
                    budgetLine: "3111103",
                    subCounty: "Nyatike",
                    ward: "Unspecified",
                    budget: 2_500_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Harvesting Nets",
                    budgetLine: "2211007",
                    subCounty: "Nyatike",
                    ward: "Unspecified",
                    budget: 880_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Pond Liners",
                    budgetLine: "2211007",
                    subCounty: "Uriri",
                    ward: "Unspecified",
                    budget: 1_200_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Predator Nets",
                    budgetLine: "2211007",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 800_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Beach Seine",
                    budgetLine: "2211007",
                    subCounty: "Nyatike",
                    ward: "Unspecified",
                    budget: 250_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Monosex Tilapia Fingerlings",
                    budgetLine: "3111302",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 3_000_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Mixed Sex Tilapia Fingerlings",
                    budgetLine: "3111302",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 1_200_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Catfish Fingerlings",
                    budgetLine: "3111302",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 400_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Fish Feeds (Grower Mash)",
                    budgetLine: "2211007",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 1_700_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Fish Feeds (Starter Mash)",
                    budgetLine: "2211007",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 1_800_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Cold Storage for Fish Market",
                    budgetLine: "3111103",
                    subCounty: "County Wide",
                    ward: "All wards",
                    budget: 10_000_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Omena Drying Sheds",
                    budgetLine: "3111504",
                    subCounty: "Nyatike",
                    ward: "Unspecified",
                    budget: 2_000_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Fencing of aquatic recreation park",
                    budgetLine: "3111504",
                    subCounty: "Nyatike",
                    ward: "Got Kachola",
                    budget: 890_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Acquisition of land for aquatic recreation park",
                    budgetLine: "3130101",
                    subCounty: "Nyatike",
                    ward: "Got Kachola",
                    budget: 2_000_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Purchase of cages",
                    budgetLine: "2211007",
                    subCounty: "Nyatike",
                    ward: "Unspecified",
                    budget: 4_000_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Fish Banda Renovation",
                    budgetLine: "2220205",
                    subCounty: "Nyatike",
                    ward: "Kachieng",
                    budget: 3_600_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                },
                {
                    name: "Purchase of life jackets",
                    budgetLine: "2211007",
                    subCounty: "Nyatike",
                    ward: "All wards",
                    budget: 1_000_000,
                    completionPercent: 100,
                    funder: "County Government of Migori",
                    status: ProjectStatus.COMPLETED,
                    startDate: makeDate("2023-01-01")
                }
            ]
        }),
        prisma.inspection.createMany({
            data: [
                {
                    farmName: "Suna Aqua Holdings",
                    subCounty: "Suna East",
                    officerId: officer.id,
                    date: makeDate("2026-01-20"),
                    result: InspectionResult.PASS,
                    notes: "Good stocking and feed management."
                },
                {
                    farmName: "Peter Achieng Farm",
                    subCounty: "Nyatike",
                    officerId: officer.id,
                    date: makeDate("2026-02-08"),
                    result: InspectionResult.PENDING,
                    notes: "Water quality sample sent to lab."
                },
                {
                    farmName: "Uriri Blue Waters",
                    subCounty: "Uriri",
                    officerId: director.id,
                    date: makeDate("2026-03-04"),
                    result: InspectionResult.FAIL,
                    notes: "Biosecurity measures not compliant."
                }
            ]
        }),
        prisma.advisory.createMany({
            data: [
                {
                    title: "Rain Season Pond Management",
                    message: "Increase pond embankment checks to prevent overflow losses.",
                    type: AdvisoryType.INFO,
                    fromName: "Agnes Adhiambo",
                    subCounty: "Suna East"
                },
                {
                    title: "Fingerling Disease Alert",
                    message: "Avoid sourcing fingerlings from unverified hatcheries this month.",
                    type: AdvisoryType.WARNING,
                    fromName: "Dr. James Ochieng",
                    subCounty: null
                },
                {
                    title: "License Renewal Window",
                    message: "Submit renewal applications before month end to avoid penalties.",
                    type: AdvisoryType.ACTION,
                    fromName: "Fisheries Department",
                    subCounty: null
                }
            ]
        }),
        prisma.query.createMany({
            data: [
                {
                    userId: farmerUser.id,
                    subject: "Feed subsidy availability",
                    message: "Is the county feed subsidy open for April?",
                    status: "PENDING"
                }
            ]
        })
    ]);
    await prisma.license.createMany({
        data: [
            {
                licenseNo: "MIG-LIC-0001",
                receiptNo: "RCT-0001",
                bmuName: "Muhuru Bay BMU",
                farmerId: farmers[0].id,
                type: LicenseType.FISHERMAN,
                issuedDate: makeDate("2025-01-01"),
                expiryDate: makeDate("2026-01-01"),
                status: LicenseStatus.EXPIRED
            },
            {
                licenseNo: "MIG-LIC-0002",
                receiptNo: "RCT-0002",
                bmuName: "Suna East BMU",
                farmerId: farmers[1].id,
                type: LicenseType.BOAT,
                issuedDate: makeDate("2026-01-15"),
                expiryDate: makeDate("2027-01-15"),
                status: LicenseStatus.VALID
            },
            {
                licenseNo: "MIG-LIC-0003",
                receiptNo: "RCT-0003",
                bmuName: "Suna West BMU",
                farmerId: farmers[2].id,
                type: LicenseType.FISH_TRADER,
                issuedDate: makeDate("2025-05-03"),
                expiryDate: makeDate("2026-05-03"),
                status: LicenseStatus.VALID
            },
            {
                licenseNo: "MIG-LIC-0004",
                receiptNo: "RCT-0004",
                bmuName: "Uriri BMU",
                farmerId: farmers[3].id,
                type: LicenseType.FISHERMAN,
                issuedDate: makeDate("2024-06-10"),
                expiryDate: makeDate("2025-06-10"),
                status: LicenseStatus.EXPIRED
            },
            {
                licenseNo: "MIG-LIC-0005",
                receiptNo: "RCT-0005",
                bmuName: "Kuria East BMU",
                farmerId: farmers[4].id,
                type: LicenseType.BOAT,
                issuedDate: makeDate("2026-02-01"),
                expiryDate: makeDate("2027-02-01"),
                status: LicenseStatus.VALID
            },
            {
                licenseNo: "MIG-LIC-0006",
                receiptNo: "RCT-0006",
                bmuName: "Kuria West BMU",
                farmerId: farmers[5].id,
                type: LicenseType.FISH_TRADER,
                issuedDate: makeDate("2025-09-10"),
                expiryDate: makeDate("2026-09-10"),
                status: LicenseStatus.VALID
            }
        ]
    });
    await prisma.captureFisheriesRecord.createMany({
        data: [
            {
                fisherName: "Peter Achieng",
                bmuName: "Muhuru Bay BMU",
                landingSite: "Muhuru Bay",
                species: "Tilapia",
                catchKg: 128,
                effortHours: 7,
                fishingDate: makeDate("2026-04-05"),
                recordedById: officer.id
            },
            {
                fisherName: "Omondi Were",
                bmuName: "Sori BMU",
                landingSite: "Sori",
                species: "Nile Perch",
                catchKg: 86,
                effortHours: 6,
                fishingDate: makeDate("2026-04-08"),
                recordedById: officer.id
            }
        ]
    });
    console.log("Seed complete: users, farmers, licenses, capture fisheries, projects, inspections, advisories, and queries created.");
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
