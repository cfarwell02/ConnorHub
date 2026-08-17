import "server-only";
import { getTailscaleDevices, TailscaleDevice } from "./tailscale";

export type ConnorHubDevice = {
  id: string;
  name: string;
  type: "server" | "desktop" | "laptop" | "phone";

  status: "online" | "offline";

  agentStatus?: "online" | "offline";
};

type AgentDeviceConfig = {
  id: string;
  name: string;
  type: ConnorHubDevice["type"];
  url: string | undefined;
};

const agentDevices: AgentDeviceConfig[] = [
  {
    id: "raspberry-pi",
    name: "Raspberry Pi",
    type: "server",
    url: process.env.CONNORHUB_PI_AGENT_URL,
  },
  {
    id: "mac-mini",
    name: "Mac mini",
    type: "desktop",
    url: process.env.CONNORHUB_MAC_AGENT_URL,
  },
  {
    id: "thinkpad",
    name: "ThinkPad",
    type: "laptop",
    url: process.env.CONNORHUB_THINKPAD_AGENT_URL,
  },
];

export async function getConnorHubDevices(): Promise<ConnorHubDevice[]> {
  const [agentStatuses, tailscaleDevices] = await Promise.all([
    Promise.all(
      agentDevices.map(async (device) => ({
        id: device.id,
        status: await checkAgentHealth(device.url),
      })),
    ),
    getTailscaleDevices().catch(() => []),
  ]);

  const agentStatusById = new Map(
    agentStatuses.map((device) => [device.id, device.status]),
  );

  const iphone = tailscaleDevices.find(
    (device) => device.name === "iphone-14.tail23d007.ts.net",
  );

  return [
    {
      id: "raspberry-pi",
      name: "Raspberry Pi",
      type: "server",
      status: getTailscaleStatus(
        tailscaleDevices,
        "raspberrypi.tail23d007.ts.net",
      ),
      agentStatus: agentStatusById.get("raspberry-pi") ?? "offline",
    },

    {
      id: "mac-mini",
      name: "Mac mini",
      type: "desktop",
      status: getTailscaleStatus(
        tailscaleDevices,
        "connors-mac-mini.tail23d007.ts.net",
      ),
      agentStatus: agentStatusById.get("mac-mini") ?? "offline",
    },

    {
      id: "thinkpad",
      name: "ThinkPad",
      type: "laptop",
      status: getTailscaleStatus(
        tailscaleDevices,
        "connorslaptop.tail23d007.ts.net",
      ),
      agentStatus: agentStatusById.get("thinkpad") ?? "offline",
    },

    {
      id: "iphone",
      name: "iPhone 14",
      type: "phone",
      status: iphone?.connectedToControl ? "online" : "offline",
    },
  ];
}

async function checkAgentHealth(
  agentUrl: string | undefined,
): Promise<"online" | "offline"> {
  if (!agentUrl) {
    return "offline";
  }

  try {
    const response = await fetch(`${agentUrl}/api/v1/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });

    return response.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}

function getTailscaleStatus(
  devices: TailscaleDevice[],
  name: string,
): "online" | "offline" {
  const device = devices.find((candidate) => candidate.name === name);

  return device?.connectedToControl ? "online" : "offline";
}
