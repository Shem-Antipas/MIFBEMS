import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config();

const describeUrl = (name: "DATABASE_URL" | "DIRECT_URL") => {
  const raw = process.env[name];

  if (!raw) {
    return { name, present: false };
  }

  try {
    const url = new URL(raw);
    return {
      name,
      present: true,
      host: url.hostname,
      port: url.port || "(default)",
      username: url.username,
      database: url.pathname.replace(/^\//, ""),
      sslmode: url.searchParams.get("sslmode") ?? "(not set)"
    };
  } catch {
    return { name, present: true, invalid: true };
  }
};

const diagnose = (message: string): string => {
  if (message.includes("Can't reach database server")) {
    return "Prisma cannot reach the Supabase pooler. Check that the URL includes ?sslmode=require, that the pooler host exactly matches Supabase Connect, and that your network allows outbound PostgreSQL traffic on ports 5432/6543.";
  }

  if (message.includes("tenant/user") && message.includes("not found")) {
    return "Supabase rejected the pooler tenant/user. The pooler host/region or project ref does not match this project.";
  }

  if (message.includes("Authentication failed")) {
    return "Supabase rejected the database password. Copy the full connection string from Supabase, or reset the database password and use the new URL-encoded password.";
  }

  return message;
};

const checkUrl = async (name: "DATABASE_URL" | "DIRECT_URL") => {
  const url = process.env[name];

  if (!url) {
    console.error(`${name} is missing.`);
    return false;
  }

  const parsed = new URL(url);
  if (parsed.hostname.includes("pooler.supabase.com") && parsed.searchParams.get("sslmode") !== "require") {
    console.error(`${name} is missing ?sslmode=require.`);
    return false;
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    const userCount = await prisma.user.count();
    console.log(`${name} connection ok. Found ${userCount} users.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${name} connection failed.`);
    console.error(diagnose(message));
    return false;
  } finally {
    await prisma.$disconnect();
  }
};

try {
  console.log("Database target:");
  console.log(JSON.stringify([describeUrl("DATABASE_URL"), describeUrl("DIRECT_URL")], null, 2));

  const [databaseOk, directOk] = await Promise.all([checkUrl("DATABASE_URL"), checkUrl("DIRECT_URL")]);

  if (!databaseOk || !directOk) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Database connection failed.");
  console.error(diagnose(message));
  process.exitCode = 1;
}
