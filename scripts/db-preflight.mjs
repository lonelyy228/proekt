import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const runCommand = (command) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, {
      stdio: "inherit",
      shell: true
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} (exit ${code ?? "unknown"})`));
    });
  });

const ensureMigrationsPresent = () => {
  const migrationsDir = path.resolve("prisma", "migrations");

  if (!existsSync(migrationsDir)) {
    throw new Error("Missing prisma/migrations directory");
  }

  const migrationFolders = readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  if (migrationFolders.length === 0) {
    throw new Error("No Prisma migration folders found in prisma/migrations");
  }
};

const assertProductionDbUrls = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";

  const unsafeTargets = ["localhost", "127.0.0.1"];
  if (unsafeTargets.some((token) => databaseUrl.includes(token) || directUrl.includes(token))) {
    throw new Error("Production preflight failed: DATABASE_URL/DIRECT_URL must not target localhost");
  }
};

const runPreflight = async () => {
  console.log("[db:preflight] 1/3 checking migrations directory");
  ensureMigrationsPresent();

  console.log("[db:preflight] 2/3 validating production DB target policy");
  assertProductionDbUrls();

  console.log("[db:preflight] 3/3 prisma validate + migrate status");
  await runCommand("npx prisma validate");
  await runCommand("npx prisma migrate status");

  console.log("[db:preflight] completed successfully");
};

runPreflight().catch((error) => {
  console.error(`[db:preflight] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
