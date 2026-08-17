import "server-only";

type TailscaleAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export async function getTailscaleAccessToken(): Promise<string> {
  const clientId = process.env.TAILSCALE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.TAILSCALE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Tailscale OAuth credentials are not configured.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch("https://api.tailscale.com/api/v2/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to authenticate with Tailscale.");
  }

  const data = (await response.json()) as TailscaleAccessTokenResponse;

  return data.access_token;
}

export type TailscaleDevice = {
  id: string;
  name: string;
  hostname: string;
  lastSeen?: string;
  connectedToControl?: boolean;
};

export async function getTailscaleDevices(): Promise<TailscaleDevice[]> {
  const accessToken = await getTailscaleAccessToken();

  const response = await fetch(
    "https://api.tailscale.com/api/v2/tailnet/-/devices",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load Tailscale devices.");
  }

  const data = (await response.json()) as {
    devices: TailscaleDevice[];
  };

  return data.devices;
}
