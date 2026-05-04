import { FarmType, FarmerStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rollbackMarker = "ROLLBACK_FARMER_CREATE_CHECK";

const main = async (): Promise<void> => {
  const user = await prisma.user.findFirst({
    where: { role: "DIRECTOR", isActive: true },
    select: { id: true, email: true }
  });

  if (!user) {
    throw new Error("No active director user found for farmer create check.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const farmer = await tx.farmer.create({
        data: {
          name: "Rollback Farmer Save Check",
          subCounty: "Suna East",
          ward: "God Jope",
          farmType: FarmType.POND,
          species: ["Tilapia"],
          status: FarmerStatus.ACTIVE,
          productionKg: 10,
          latitude: -1.0634,
          longitude: 34.4742,
          registeredById: user.id
        }
      });

      console.log(`Farmer create reached database successfully: ${farmer.id}`);
      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (error instanceof Error && error.message === rollbackMarker) {
      console.log(`Rollback completed; no test farmer persisted. Checked with ${user.email}.`);
      return;
    }

    throw error;
  }
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
