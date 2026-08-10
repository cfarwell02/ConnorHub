"use client";

import { Activity, Loader2, Network, PlugZap } from "lucide-react";
import { useState } from "react";

type NetworkCheckResult = {
  host: string;
  ping: {
    reachable: boolean;
    latencyMs: number | null;
  };
  port: {
    port: number;
    open: boolean;
  } | null;
};

type NetworkCheckResponse = NetworkCheckResult & {
  error?: string;
};

export default function NetworkCheckTool() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [result, setResult] = useState<NetworkCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheck() {
    const trimmedHost = host.trim();

    if (!trimmedHost || isChecking) {
      return;
    }

    setIsChecking(true);
    setResult(null);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        host: trimmedHost,
      });

      if (port.trim()) {
        params.set("port", port.trim());
      }

      const response = await fetch(
        `/api/tools/network-check?${params.toString()}`,
      );

      const data = (await response.json()) as NetworkCheckResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Network check failed.");
      }

      setResult({
        host: data.host,
        ping: data.ping,
        port: data.port,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The network check could not be completed.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="text-sm font-medium text-zinc-400">Network Check</h2>

        <p className="mt-1 text-xs text-zinc-600">
          Ping a host and optionally test whether a TCP port is open.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
          <div>
            <label
              htmlFor="network-host"
              className="mb-1.5 block text-xs font-medium text-zinc-500"
            >
              Host
            </label>

            <input
              id="network-host"
              type="text"
              value={host}
              onChange={(event) => setHost(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCheck();
                }
              }}
              placeholder="8.8.8.8 or example.com"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
            />
          </div>

          <div>
            <label
              htmlFor="network-port"
              className="mb-1.5 block text-xs font-medium text-zinc-500"
            >
              Port
            </label>

            <input
              id="network-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(event) => setPort(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCheck();
                }
              }}
              placeholder="443"
              className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void handleCheck();
              }}
              disabled={!host.trim() || isChecking}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isChecking ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Checking
                </>
              ) : (
                <>
                  <Activity size={15} />
                  Check
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-4 text-sm text-red-300">{errorMessage}</p>
        )}

        {result && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ResultCard
              icon={<Network size={17} />}
              label="Ping"
              value={
                result.ping.reachable
                  ? result.ping.latencyMs !== null
                    ? `${result.ping.latencyMs} ms`
                    : "Reachable"
                  : "Unreachable"
              }
            />

            <ResultCard
              icon={<PlugZap size={17} />}
              label={result.port ? `Port ${result.port.port}` : "Port"}
              value={
                result.port
                  ? result.port.open
                    ? "Open"
                    : "Closed"
                  : "Not checked"
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ResultCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center gap-2 text-zinc-600">
        {icon}

        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
