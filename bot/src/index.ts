import dotenv from "dotenv";

import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import { RPManagerApi, type OutboxEvent, RPManagerApiError } from "./api";
import { executeSlashCommand } from "./commands";

dotenv.config({ path: process.env.BOT_ENV_FILE ?? "bot/.env" });

function requiredSetting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is missing or blank. Check bot/.env and make sure a blank shell environment variable is not overriding it.`
    );
  }
  return value;
}

const token = requiredSetting("DISCORD_BOT_TOKEN");
const applicationId = requiredSetting("DISCORD_APPLICATION_ID");
const serviceSecret = requiredSetting("DISCORD_BOT_SERVICE_SECRET");
const apiUrl = requiredSetting("RP_MANAGER_API_URL");

if (
  serviceSecret.length < 32 ||
  serviceSecret.toLowerCase().includes("generate-a-random-secret")
) {
  throw new Error(
    "DISCORD_BOT_SERVICE_SECRET must be a private random secret of at least 32 characters, not the example placeholder."
  );
}

const api = new RPManagerApi(apiUrl, serviceSecret);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const cooldowns = new Map<string, number>();
const activeOutboxPolls = new Set<string>();
const failureLogTimes = new Map<string, number>();

function logServiceFailure(action: string, guildId: string, error: unknown) {
  const key = `${guildId}:${action}`;
  const now = Date.now();
  if (now - (failureLogTimes.get(key) ?? 0) < 60_000) return;
  failureLogTimes.set(key, now);
  console.warn("RPManager Discord service operation failed", {
    action,
    guildId,
    status: error instanceof RPManagerApiError ? error.status : undefined,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

async function beat(guildId: string) {
  try {
    await api.heartbeat(guildId);
  } catch (error) {
    logServiceFailure("heartbeat", guildId, error);
  }
}

async function pollOutbox(guildId: string) {
  if (activeOutboxPolls.has(guildId)) return;
  activeOutboxPolls.add(guildId);
  try {
    const { events } = await api.getOutbox(guildId);
    for (const event of events) {
      await deliverOutboxEvent(guildId, event);
    }
  } catch (error) {
    logServiceFailure("notification poll", guildId, error);
  } finally {
    activeOutboxPolls.delete(guildId);
  }
}

async function deliverOutboxEvent(guildId: string, event: OutboxEvent) {
  try {
    const channel = await client.channels.fetch(event.channelId);
    if (
      !channel ||
      !channel.isTextBased() ||
      !("send" in channel) ||
      typeof channel.send !== "function"
    ) {
      throw new Error("Notification channel is unavailable");
    }
    await channel.send({
      content: event.content,
      allowedMentions: { parse: [] },
    });
    await api.acknowledgeOutbox(guildId, event, "ack");
  } catch (error) {
    logServiceFailure("notification delivery", guildId, error);
    try {
      await api.acknowledgeOutbox(guildId, event, "nack");
    } catch (ackError) {
      logServiceFailure("notification retry", guildId, ackError);
    }
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.info("RPManager Discord bot is ready.", {
    guildCount: readyClient.guilds.cache.size,
  });
  for (const guild of readyClient.guilds.cache.values()) {
    void beat(guild.id);
    void pollOutbox(guild.id);
  }
  setInterval(() => {
    for (const guild of readyClient.guilds.cache.values()) void beat(guild.id);
  }, 60_000);
  setInterval(() => {
    for (const guild of readyClient.guilds.cache.values()) void pollOutbox(guild.id);
  }, 15_000);
});

client.on(Events.GuildCreate, (guild) => {
  void beat(guild.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const now = Date.now();
  const cooldownKey = `${interaction.user.id}:${interaction.commandName}`;
  const allowedAt = cooldowns.get(cooldownKey) ?? 0;
  if (now < allowedAt) {
    await interaction.reply({
      content: "Please wait a moment before using that command again.",
      ephemeral: true,
    });
    return;
  }
  cooldowns.set(cooldownKey, now + 1500);
  if (cooldowns.size > 2000) {
    for (const [key, expiresAt] of cooldowns) {
      if (expiresAt <= now) cooldowns.delete(key);
    }
  }
  await executeSlashCommand(interaction, api);
});

client.on(Events.Error, (error) => {
  console.error("Discord gateway error", { errorName: error.name });
});

async function main() {
  await client.login(token);
}

process.once("SIGINT", () => {
  client.destroy();
  process.exit(0);
});
process.once("SIGTERM", () => {
  client.destroy();
  process.exit(0);
});

void main().catch((error: unknown) => {
  console.error("Discord bot failed to start", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown startup error",
  });
  process.exitCode = 1;
});
