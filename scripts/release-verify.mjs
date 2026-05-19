import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const smokeSpecs = [
  "e2e/admin-ops-smoke-stage3.spec.ts",
  "e2e/customizer-designs-api.spec.ts"
];
const securitySpecs = ["e2e/security-regression.spec.ts"];
const buildEnvOverrides = {
  APP_URL: "https://rsh.example",
  COOKIE_DOMAIN: "rsh.example",
  STRIPE_SECRET_KEY: "sk_live_ci_placeholder_key",
  UPLOADTHING_TOKEN: "ci-uploadthing-token",
  UPLOADTHING_APP_ID: "ci-uploadthing-app-id"
};

const runCommand = (command, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, {
      stdio: "inherit",
      shell: true,
      ...options
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

const runCommandWithRetry = async (command, retries, retryDelayMs, options = {}) => {
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await runCommand(command, options);
      return;
    } catch (error) {
      lastError = error;
      if (attempt > retries) {
        break;
      }

      console.warn(
        `[release:verify] command failed (attempt ${attempt}/${retries + 1}), retrying in ${retryDelayMs}ms`
      );
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError;
};

const isPortAvailable = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });

const findAvailablePort = async (startPort) => {
  for (let port = startPort; port < startPort + 40; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  throw new Error(`No available port found in range ${startPort}-${startPort + 39}`);
};

const waitForUrl = async (url, timeoutMs) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET"
      });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // wait and retry
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const runReleaseVerify = async () => {
  console.log("\n[release:verify] 1/6 typecheck");
  await runCommand("npm run typecheck");

  console.log("\n[release:verify] 2/6 lint");
  await runCommand("npm run lint");

  console.log("\n[release:verify] 3/6 unit tests");
  await runCommand("npm run test");
  await runCommandWithRetry("npm run prisma:deploy", 2, 2000);
  await runCommandWithRetry("npm run db:preflight", 2, 2000);
  await runCommandWithRetry("npx prisma generate", 4, 2500);

  const preferredPort = Number(process.env.RELEASE_E2E_PORT ?? "0");
  const randomBasePort = 3100 + Math.floor(Math.random() * 200);
  const basePort =
    Number.isFinite(preferredPort) && preferredPort > 0
      ? preferredPort
      : randomBasePort;
  const port = await findAvailablePort(basePort);
  const baseUrl = `http://localhost:${port}`;
  const nextBin = path.resolve("node_modules", "next", "dist", "bin", "next");

  console.log(`\n[release:verify] 4/6 e2e security gate on ${baseUrl}`);

  const devServer = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      PLAYWRIGHT_TEST: "1"
    }
  });

  try {
    await waitForUrl(baseUrl, 120_000);

    await runCommand(`npx playwright test ${securitySpecs.join(" ")}`, {
      env: {
        ...process.env,
        E2E_BASE_URL: baseUrl
      }
    });

    console.log(`\n[release:verify] 5/6 e2e smoke on ${baseUrl}`);
    await runCommand(`npx playwright test ${smokeSpecs.join(" ")}`, {
      env: {
        ...process.env,
        E2E_BASE_URL: baseUrl
      }
    });
  } finally {
    devServer.kill("SIGTERM");
  }

  console.log("\n[release:verify] 6/6 production build");
  await runCommandWithRetry("npx next build", 2, 2500, {
    env: {
      ...process.env,
      ...buildEnvOverrides
    }
  });

  console.log("\n[release:verify] completed successfully");
};

runReleaseVerify().catch((error) => {
  console.error(`\n[release:verify] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
