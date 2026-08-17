import { spawn } from "node:child_process";

const next = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
});

async function waitForServer() {
  while (true) {
    try {
      const response = await fetch("http://localhost:3000");

      if (response.ok) {
        break;
      }
    } catch {
      // Server is not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  spawn("cmd", ["/c", "start", "", "chrome", "http://localhost:3000"], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

void waitForServer();

next.on("exit", (code) => {
  process.exit(code ?? 0);
});
