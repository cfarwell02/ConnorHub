import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

const PROJECT_ROOT = process.cwd();

const ENV_FILE = path.join(PROJECT_ROOT, ".env.local");

const CONFIG_DIRECTORY = path.join(os.homedir(), ".connorhub");

const CONFIG_FILE = path.join(CONFIG_DIRECTORY, "config.json");

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  console.log();
  console.log("ConnorHub Environment Setup");
  console.log("===========================");
  console.log();

  const existingEnv = await readEnvFile();
  const config = await readConfig();

  const currentTailscaleIp = detectTailscaleIp();

  if (currentTailscaleIp) {
    console.log(`Detected Tailscale IP: ${currentTailscaleIp}`);
  } else {
    console.log("Tailscale IP could not be detected.");
  }

  const currentDevice = config.currentDevice ?? (await askCurrentDevice());

  const devices = {
    ...config.devices,
  };

  if (currentTailscaleIp) {
    devices[currentDevice] = {
      ...devices[currentDevice],
      tailscaleIp: currentTailscaleIp,
    };
  }

  const agentToken =
    existingEnv.CONNORHUB_AGENT_TOKEN ??
    config.agentToken ??
    (await findAgentToken()) ??
    (await askOptional("ConnorHub Agent token"));

  const piIp = await resolveDeviceIp({
    name: "Raspberry Pi",
    id: "raspberry-pi",
    existing: existingEnv.CONNORHUB_PI_AGENT_URL,
    devices,
  });

  const macIp = await resolveDeviceIp({
    name: "Mac mini",
    id: "mac-mini",
    existing: existingEnv.CONNORHUB_MAC_AGENT_URL,
    devices,
  });

  const thinkpadIp = await resolveDeviceIp({
    name: "ThinkPad",
    id: "thinkpad",
    existing: existingEnv.CONNORHUB_THINKPAD_AGENT_URL,
    devices,
  });

  await writeEnvironmentFile({
    agentToken,
    piIp,
    macIp,
    thinkpadIp,
  });

  await saveConfig({
    currentDevice,
    agentToken,
    devices,
  });

  console.log();
  console.log("Environment configured.");
  console.log(`Written: ${ENV_FILE}`);
  console.log(`Saved config: ${CONFIG_FILE}`);
  console.log();

  terminal.close();
}

async function resolveDeviceIp({ name, id, existing, devices }) {
  const existingIp = extractIpFromAgentUrl(existing);

  const savedIp = devices[id]?.tailscaleIp;

  const value =
    existingIp ?? savedIp ?? (await askOptional(`${name} Tailscale IP`));

  if (value) {
    devices[id] = {
      ...devices[id],
      tailscaleIp: value,
    };
  }

  return value;
}

async function askCurrentDevice() {
  console.log();
  console.log("Which device is this?");
  console.log("1. Raspberry Pi");
  console.log("2. Mac mini");
  console.log("3. ThinkPad");

  while (true) {
    const answer = (await terminal.question("> ")).trim();

    if (answer === "1") {
      return "raspberry-pi";
    }

    if (answer === "2") {
      return "mac-mini";
    }

    if (answer === "3") {
      return "thinkpad";
    }

    console.log("Enter 1, 2, or 3.");
  }
}

async function askOptional(label) {
  const answer = (await terminal.question(`${label} (Enter to skip): `)).trim();

  return answer || undefined;
}

function detectTailscaleIp() {
  try {
    return execFileSync("tailscale", ["ip", "-4"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

async function findAgentToken() {
  const candidates = [
    path.resolve(PROJECT_ROOT, "../../ConnorHub-Agent/.env"),

    path.resolve(PROJECT_ROOT, "../ConnorHub-Agent/.env"),
  ];

  for (const candidate of candidates) {
    const env = await readEnv(candidate);

    if (env.CONNORHUB_AGENT_TOKEN) {
      console.log("Found Agent token from ConnorHub-Agent.");

      return env.CONNORHUB_AGENT_TOKEN;
    }
  }

  return undefined;
}

async function readEnvFile() {
  return readEnv(ENV_FILE);
}

async function readEnv(filePath) {
  try {
    const contents = await readFile(filePath, "utf8");

    return Object.fromEntries(
      contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");

          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch {
    return {};
  }
}

async function readConfig() {
  try {
    const contents = await readFile(CONFIG_FILE, "utf8");

    return JSON.parse(contents);
  } catch {
    return {
      currentDevice: undefined,
      agentToken: undefined,
      devices: {},
    };
  }
}

async function saveConfig(config) {
  await mkdir(CONFIG_DIRECTORY, {
    recursive: true,
  });

  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

async function writeEnvironmentFile({ agentToken, piIp, macIp, thinkpadIp }) {
  const lines = [];

  const connorHubRoot =
    process.platform === "linux"
      ? "/srv/connorhub"
      : path.resolve(PROJECT_ROOT, "../dev-storage");

  lines.push(`CONNORHUB_ROOT=${connorHubRoot}`);

  await mkdir(connorHubRoot, {
    recursive: true,
  });

  if (agentToken) {
    lines.push(`CONNORHUB_AGENT_TOKEN=${agentToken}`);
  }

  if (piIp) {
    lines.push(`CONNORHUB_PI_AGENT_URL=http://${piIp}:4242`);
  }

  if (macIp) {
    lines.push(`CONNORHUB_MAC_AGENT_URL=http://${macIp}:4242`);
  }

  if (thinkpadIp) {
    lines.push(`CONNORHUB_THINKPAD_AGENT_URL=http://${thinkpadIp}:4242`);
  }

  await writeFile(ENV_FILE, `${lines.join("\n")}\n`, "utf8");
}

function extractIpFromAgentUrl(value) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

await main();
