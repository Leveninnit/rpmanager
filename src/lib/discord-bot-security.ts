import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const DISCORD_BOT_SIGNATURE_WINDOW_MS = 60_000;

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function signDiscordBotRequest(
  secret: string,
  method: string,
  pathAndQuery: string,
  timestamp: string,
  nonce: string,
  body: Uint8Array
) {
  const bodyHash = sha256(body);
  return createHmac("sha256", secret)
    .update(`${method.toUpperCase()}\n${pathAndQuery}\n${timestamp}\n${nonce}\n${bodyHash}`)
    .digest("hex");
}

export function verifyDiscordBotSignature({
  secret,
  method,
  pathAndQuery,
  timestamp,
  nonce,
  signature,
  body,
  now = Date.now(),
}: {
  secret: string;
  method: string;
  pathAndQuery: string;
  timestamp: string;
  nonce: string;
  signature: string;
  body: Uint8Array;
  now?: number;
}) {
  if (!secret || !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{32}$/i.test(nonce)) {
    return false;
  }
  const timestampMs = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now - timestampMs) > DISCORD_BOT_SIGNATURE_WINDOW_MS ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expected = signDiscordBotRequest(
    secret,
    method,
    pathAndQuery,
    timestamp,
    nonce,
    body
  );
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(signature, "hex");
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export function isDiscordSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

export function parseConfiguredRoleIds(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((roleId) => isDiscordSnowflake(roleId))
    ) {
      return [];
    }
    return parsed as string[];
  } catch {
    return [];
  }
}

export function hasConfiguredSupervisorRole(
  callerRoleIds: string[],
  configuredRoleIds: string[]
) {
  const configured = new Set(configuredRoleIds);
  return callerRoleIds.some((roleId) => configured.has(roleId));
}
