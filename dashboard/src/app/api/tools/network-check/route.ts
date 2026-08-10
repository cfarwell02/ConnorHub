import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get("host")?.trim() ?? "";
  const portValue = request.nextUrl.searchParams.get("port")?.trim() ?? "";

  if (!host) {
    return NextResponse.json({ error: "A host is required." }, { status: 400 });
  }

  const port = portValue ? Number(portValue) : null;

  if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    return NextResponse.json(
      { error: "Port must be between 1 and 65535." },
      { status: 400 },
    );
  }

  try {
    const [ping, portResult] = await Promise.all([
      getPing(host),
      port ? checkPort(host, port) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      host,
      ping,
      port: portResult,
    });
  } catch (error) {
    console.error("Network check failed:", error);

    return NextResponse.json(
      {
        error: "The network check could not be completed.",
      },
      {
        status: 500,
      },
    );
  }
}

async function getPing(host: string): Promise<{
  reachable: boolean;
  latencyMs: number | null;
}> {
  try {
    const { stdout } = await execFileAsync("ping", [
      "-c",
      "1",
      "-W",
      "1000",
      host,
    ]);

    const match = stdout.match(/time[=<]([\d.]+)\s*ms/i);

    return {
      reachable: true,
      latencyMs: match ? Number(match[1]) : null,
    };
  } catch {
    return {
      reachable: false,
      latencyMs: null,
    };
  }
}

function checkPort(
  host: string,
  port: number,
): Promise<{
  port: number;
  open: boolean;
}> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finish = (open: boolean) => {
      socket.destroy();

      resolve({
        port,
        open,
      });
    };

    socket.setTimeout(1500);

    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));

    socket.connect(port, host);
  });
}
