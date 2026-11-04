import dotenv from "dotenv";

import { REST, Routes } from "discord.js";
import { commandDefinitions } from "./commands";

dotenv.config({ path: process.env.BOT_ENV_FILE ?? "bot/.env" });

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!token || !applicationId) {
  throw new Error("Set DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID before deploying commands.");
}

async function main(botToken: string, appId: string) {
  const rest = new REST({ version: "10" }).setToken(botToken);
  await rest.put(Routes.applicationCommands(appId), {
    body: commandDefinitions,
  });
  console.info("RPManager slash commands registered.");
}

void main(token, applicationId).catch((error: unknown) => {
  console.error("Discord slash command deployment failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    message:
      error instanceof Error ? error.message : "Unknown deployment error",
  });
  process.exitCode = 1;
});
