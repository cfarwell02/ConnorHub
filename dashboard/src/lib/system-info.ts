import "server-only";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CONNORHUB_ROOT } from "@/lib/server-data";

const execFileAsync = promisify(execFile);

export type SystemInfo = {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  totalMemoryBytes: number;
  usedMemoryBytes: number;
  cpuModel: string;
  cpuCount: number;
};

export type DiskInfo = {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
};

export type NetworkInfo = {
  hostname: string;
  localIpv4: string | null;
  tailscaleIpv4: string | null;
  tailscaleConnected: boolean;
};

export function getSystemInfo(): SystemInfo {
  const totalMemoryBytes = os.totalmem();
  const freeMemoryBytes = os.freemem();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    uptimeSeconds: os.uptime(),
    totalMemoryBytes,
    usedMemoryBytes: totalMemoryBytes - freeMemoryBytes,
    cpuModel: os.cpus()[0]?.model ?? "Unknown",
    cpuCount: os.cpus().length,
  };
}

export async function getDiskInfo(): Promise<DiskInfo> {
  const { stdout } = await execFileAsync("df", ["-k", CONNORHUB_ROOT]);

  const lines = stdout.trim().split("\n");

  const dataLine = lines.at(-1);

  if (!dataLine) {
    throw new Error("Disk information could not be read.");
  }

  const parts = dataLine.trim().split(/\s+/);

  const totalKilobytes = Number(parts[1]);
  const usedKilobytes = Number(parts[2]);
  const availableKilobytes = Number(parts[3]);
  const usedPercent = Number(parts[4]?.replace("%", ""));

  if (
    !Number.isFinite(totalKilobytes) ||
    !Number.isFinite(usedKilobytes) ||
    !Number.isFinite(availableKilobytes) ||
    !Number.isFinite(usedPercent)
  ) {
    throw new Error("Disk information was returned in an unexpected format.");
  }

  return {
    totalBytes: totalKilobytes * 1024,
    usedBytes: usedKilobytes * 1024,
    availableBytes: availableKilobytes * 1024,
    usedPercent,
  };
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const networkInterfaces = os.networkInterfaces();

  let localIpv4: string | null = null;

  for (const addresses of Object.values(networkInterfaces)) {
    if (!addresses) {
      continue;
    }

    for (const address of addresses) {
      if (
        address.family === "IPv4" &&
        !address.internal &&
        !address.address.startsWith("100.")
      ) {
        localIpv4 = address.address;
        break;
      }
    }

    if (localIpv4) {
      break;
    }
  }

  let tailscaleIpv4: string | null = null;

  try {
    const { stdout } = await execFileAsync("tailscale", ["ip", "-4"]);

    const value = stdout.trim();

    if (value) {
      tailscaleIpv4 = value;
    }
  } catch {
    tailscaleIpv4 = null;
  }

  return {
    hostname: os.hostname(),
    localIpv4,
    tailscaleIpv4,
    tailscaleConnected: tailscaleIpv4 !== null,
  };
}
