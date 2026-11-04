import { randomBytes } from "node:crypto";
import { signDiscordBotRequest } from "../../src/lib/discord-bot-security";

type JsonRecord = Record<string, unknown>;

export class RPManagerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export type BotCommandRequest = {
  interactionId: string;
  guildId: string;
  discordId: string;
  roleIds: string[];
  action: string;
  input?: JsonRecord;
};

export type OutboxEvent = {
  id: string;
  channelId: string;
  content: string;
  leaseToken: string;
};

export class RPManagerApi {
  private readonly baseUrl: URL;
  private readonly secret: string;

  constructor(baseUrl: string, secret: string) {
    if (secret.length < 32) {
      throw new Error("DISCORD_BOT_SERVICE_SECRET must be at least 32 characters");
    }
    this.baseUrl = new URL(baseUrl);
    if (
      this.baseUrl.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(this.baseUrl.hostname)
    ) {
      throw new Error("RP_MANAGER_API_URL must use HTTPS outside localhost");
    }
    this.secret = secret;
  }

  async command<T>(payload: BotCommandRequest) {
    return this.request<{ data: T }>(
      "POST",
      "/api/bot/v1",
      JSON.stringify(payload)
    );
  }

  async heartbeat(guildId: string) {
    return this.request<{ ok: boolean; seenAt: string }>(
      "POST",
      "/api/bot/heartbeat",
      JSON.stringify({ guildId })
    );
  }

  async getOutbox(guildId: string) {
    return this.request<{ events: OutboxEvent[] }>(
      "GET",
      `/api/bot/outbox?guildId=${encodeURIComponent(guildId)}`,
      ""
    );
  }

  async acknowledgeOutbox(
    guildId: string,
    event: OutboxEvent,
    action: "ack" | "nack"
  ) {
    return this.request<{ ok: boolean }>(
      "POST",
      "/api/bot/outbox",
      JSON.stringify({
        action,
        guildId,
        eventId: event.id,
        leaseToken: event.leaseToken,
      })
    );
  }

  private async request<T>(method: "GET" | "POST", path: string, body: string) {
    const url = new URL(path, this.baseUrl);
    const bodyBytes = new TextEncoder().encode(body);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timestamp = Date.now().toString();
      const nonce = randomBytes(16).toString("hex");
      const signature = signDiscordBotRequest(
        this.secret,
        method,
        `${url.pathname}${url.search}`,
        timestamp,
        nonce,
        bodyBytes
      );
      try {
        response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-rpmanager-timestamp": timestamp,
            "x-rpmanager-nonce": nonce,
            "x-rpmanager-signature": signature,
          },
          ...(method === "POST" ? { body } : {}),
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
      } catch {
        if (attempt === 1) {
          throw new RPManagerApiError("RPManager service could not be reached", 503);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      if (response.status < 500 || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!response) {
      throw new RPManagerApiError("RPManager service could not be reached", 503);
    }
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new RPManagerApiError("RPManager returned an invalid response", 502);
    }
    if (!response.ok) {
      const message =
        result &&
        typeof result === "object" &&
        "error" in result &&
        typeof result.error === "string"
          ? result.error
          : "RPManager could not complete the request";
      throw new RPManagerApiError(message, response.status);
    }
    if (!result || typeof result !== "object") {
      throw new RPManagerApiError("RPManager returned an invalid response", 502);
    }
    return result as T;
  }
}
