import bcrypt from "bcryptjs";
import {
  AdvisoryType,
  FarmType,
  FarmerStatus,
  InspectionResult,
  LicenseStatus,
  LicenseType,
  PrismaClient,
  ProjectStatus,
  Role
} from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

const subCounties = ["Nyatike", "Suna East", "Suna West", "Uriri", "Kuria East", "Kuria West"] as const;

const makeDate = (isoDate: string): Date => new Date(isoDate);

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.auditLog.deleteMany();
  await prisma.license.deleteMany();
  await prisma.productionRecord.deleteMany();
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
        farmType: FarmType.POND,
        species: ["Tilapia", "Catfish"],
        status: FarmerStatus.ACTIVE,
        productionKg: 1200,
        latitude: -1.5504,
        longitude: 34.2167,
        registeredById: officer.id
      }
    }),
    prisma.farmer.create({
      data: {
        name: "Suna Aqua Holdings",
        subCounty: subCounties[1],
        farmType: FarmType.CAGE,
        species: ["Tilapia"],
        status: FarmerStatus.ACTIVE,
        productionKg: 2400,
        latitude: -1.071,
        longitude: 34.474,
        registeredById: officer.id
      }
    }),
    prisma.farmer.create({
      data: {
        name: "West Lake Fisheries",
        subCounty: subCounties[2],
        farmType: FarmType.TANK,
        species: ["Catfish"],
        status: FarmerStatus.ACTIVE,
        productionKg: 1600,
        latitude: -1.169,
        longitude: 34.311,
        registeredById: director.id
      }
    }),
    prisma.farmer.create({
      data: {
        name: "Uriri Blue Waters",
        subCounty: subCounties[3],
        farmType: FarmType.DAM,
        species: ["Tilapia", "Nile Perch"],
        status: FarmerStatus.SUSPENDED,
        productionKg: 800,
        latitude: -0.784,
        longitude: 34.482,
        registeredById: director.id
      }
    }),
    prisma.farmer.create({
      data: {
        name: "Kuria East Fish Collective",
        subCounty: subCounties[4],
        farmType: FarmType.POND,
        species: ["Tilapia"],
        status: FarmerStatus.ACTIVE,
        productionKg: 980,
        latitude: -1.041,
        longitude: 34.644,
        registeredById: director.id
      }
    }),
    prisma.farmer.create({
      data: {
        name: "Kuria West Aquahub",
        subCounty: subCounties[5],
        farmType: FarmType.CAGE,
        species: ["Catfish", "Tilapia"],
        status: FarmerStatus.INACTIVE,
        productionKg: 430,
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
          name: "Lake Victoria Cage Expansion",
          subCounty: "Suna East",
          budget: 4_500_000,
          funder: "County Government",
          status: ProjectStatus.ONGOING,
          startDate: makeDate("2025-02-01")
        },
        {
          name: "Nyatike Hatchery Upgrade",
          subCounty: "Nyatike",
          budget: 2_200_000,
          funder: "World Bank",
          status: ProjectStatus.PLANNED,
          startDate: makeDate("2026-06-15")
        },
        {
          name: "Kuria Cold Chain Facilities",
          subCounty: "Kuria West",
          budget: 3_100_000,
          funder: "IFAD",
          status: ProjectStatus.COMPLETED,
          startDate: makeDate("2024-01-10"),
          endDate: makeDate("2025-12-10")
        },
        {
          name: "Uriri Beach Landing Site",
          subCounty: "Uriri",
          budget: 1_500_000,
          funder: "Blue Economy Fund",
          status: ProjectStatus.CANCELLED,
          startDate: makeDate("2024-05-05"),
          endDate: makeDate("2024-11-30")
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
        farmerId: farmers[0].id,
        type: LicenseType.AQUACULTURE,
        issuedDate: makeDate("2025-01-01"),
        expiryDate: makeDate("2026-01-01"),
        status: LicenseStatus.EXPIRED
      },
      {
        licenseNo: "MIG-LIC-0002",
        farmerId: farmers[1].id,
        type: LicenseType.AQUACULTURE,
        issuedDate: makeDate("2026-01-15"),
        expiryDate: makeDate("2027-01-15"),
        status: LicenseStatus.VALID
      },
      {
        licenseNo: "MIG-LIC-0003",
        farmerId: farmers[2].id,
        type: LicenseType.COMMERCIAL_FISHING,
        issuedDate: makeDate("2025-05-03"),
        expiryDate: makeDate("2026-05-03"),
        status: LicenseStatus.VALID
      },
      {
        licenseNo: "MIG-LIC-0004",
        farmerId: farmers[3].id,
        type: LicenseType.ARTISANAL_FISHING,
        issuedDate: makeDate("2024-06-10"),
        expiryDate: makeDate("2025-06-10"),
        status: LicenseStatus.EXPIRED
      },
      {
        licenseNo: "MIG-LIC-0005",
        farmerId: farmers[4].id,
        type: LicenseType.AQUACULTURE,
        issuedDate: makeDate("2026-02-01"),
        expiryDate: makeDate("2027-02-01"),
        status: LicenseStatus.VALID
      },
      {
        licenseNo: "MIG-LIC-0006",
        farmerId: farmers[5].id,
        type: LicenseType.COMMERCIAL_FISHING,
        issuedDate: makeDate("2025-09-10"),
        expiryDate: makeDate("2026-09-10"),
        status: LicenseStatus.VALID
      }
    ]
  });

  console.log("Seed complete: users, farmers, licenses, projects, inspections, advisories, and queries created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
