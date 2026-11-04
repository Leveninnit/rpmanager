import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateDiscordBotRequest,
  cleanupDiscordBotRecords,
  consumeDiscordBotRateLimit,
  DiscordBotServiceError,
  readDiscordBotRequestBody,
} from "@/lib/discord-bot-auth";
import { assertEnabledDiscordGuild } from "@/lib/discord-bot-guild";
import { isDiscordSnowflake } from "@/lib/discord-bot-security";

export async function POST(request: Request) {
  let body: Uint8Array;
  try {
    body = await readDiscordBotRequestBody(request, 1024);
  } catch (error) {
    const status =
      error instanceof DiscordBotServiceError ? error.status : 400;
    const message =
      error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status });
  }

  try {
    await authenticateDiscordBotRequest(request, body);
    await cleanupDiscordBotRecords();
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(body));
    } catch {
      throw new DiscordBotServiceError("Invalid JSON request body", 400);
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      !("guildId" in payload) ||
      !isDiscordSnowflake(payload.guildId)
    ) {
      throw new DiscordBotServiceError("A valid Discord server ID is required", 400);
    }
    const applicationId = process.env.DISCORD_APPLICATION_ID;
    if (!applicationId || !isDiscordSnowflake(applicationId)) {
      throw new DiscordBotServiceError("Discord application ID is not configured", 503);
    }
    await consumeDiscordBotRateLimit(payload.guildId, applicationId);
    const server = await assertEnabledDiscordGuild(payload.guildId);
    const seenAt = new Date();
    await prisma.connectedServer.update({
      where: { id: server.id },
      data: { lastBotSeenAt: seenAt },
    });
    return NextResponse.json(
      { ok: true, seenAt: seenAt.toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof DiscordBotServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Discord bot heartbeat failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Unable to update bot status" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
