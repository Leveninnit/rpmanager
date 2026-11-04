import { randomBytes } from "node:crypto";
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

const MAX_DELIVERY_ATTEMPTS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function authenticateAndCheckGuild(request: Request, body: Uint8Array) {
  await authenticateDiscordBotRequest(request, body);
  await cleanupDiscordBotRecords();
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId || !isDiscordSnowflake(applicationId)) {
    throw new DiscordBotServiceError("Discord application ID is not configured", 503);
  }
  return applicationId;
}

export async function GET(request: Request) {
  const body = new Uint8Array();
  try {
    const applicationId = await authenticateAndCheckGuild(request, body);
    const guildId = new URL(request.url).searchParams.get("guildId") || "";
    if (!isDiscordSnowflake(guildId)) {
      throw new DiscordBotServiceError("A valid Discord server ID is required", 400);
    }
    await consumeDiscordBotRateLimit(guildId, applicationId);
    await assertEnabledDiscordGuild(guildId);
    const now = new Date();
    const events = await prisma.discordOutboxEvent.findMany({
      where: {
        guildId,
        deliveredAt: null,
        deadLetteredAt: null,
        attempts: { lt: MAX_DELIVERY_ATTEMPTS },
        availableAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { id: true },
    });
    const claimed = [];
    for (const event of events) {
      const leaseToken = randomBytes(16).toString("hex");
      const leaseUntil = new Date(now.getTime() + 60_000);
      const result = await prisma.discordOutboxEvent.updateMany({
        where: {
          id: event.id,
          guildId,
          deliveredAt: null,
          deadLetteredAt: null,
          attempts: { lt: MAX_DELIVERY_ATTEMPTS },
          availableAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        data: {
          leaseToken,
          leaseUntil,
          attempts: { increment: 1 },
        },
      });
      if (result.count !== 1) continue;
      const record = await prisma.discordOutboxEvent.findFirst({
        where: { id: event.id, guildId, leaseToken },
        select: { id: true, channelId: true, content: true },
      });
      if (record) claimed.push({ ...record, leaseToken });
    }
    return NextResponse.json(
      { events: claimed },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof DiscordBotServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Discord notification poll failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Unable to load Discord notifications" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request) {
  let body: Uint8Array;
  try {
    body = await readDiscordBotRequestBody(request, 2048);
  } catch (error) {
    const status =
      error instanceof DiscordBotServiceError ? error.status : 400;
    const message =
      error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status });
  }
  try {
    const applicationId = await authenticateAndCheckGuild(request, body);
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(body));
    } catch {
      throw new DiscordBotServiceError("Invalid JSON request body", 400);
    }
    if (
      !isRecord(payload) ||
      !isDiscordSnowflake(payload.guildId) ||
      typeof payload.eventId !== "string" ||
      !/^[A-Za-z0-9_-]{10,40}$/.test(payload.eventId) ||
      typeof payload.leaseToken !== "string" ||
      !/^[a-f0-9]{32}$/.test(payload.leaseToken) ||
      !["ack", "nack"].includes(String(payload.action))
    ) {
      throw new DiscordBotServiceError("Invalid notification acknowledgement", 400);
    }
    const { guildId, eventId, leaseToken } = payload as {
      guildId: string;
      eventId: string;
      leaseToken: string;
      action: "ack" | "nack";
    };
    const action = payload.action as "ack" | "nack";
    await consumeDiscordBotRateLimit(guildId, applicationId);
    await assertEnabledDiscordGuild(guildId);
    const event = await prisma.discordOutboxEvent.findFirst({
      where: {
        id: eventId,
        guildId,
        leaseToken,
        deliveredAt: null,
        deadLetteredAt: null,
      },
      select: { id: true, attempts: true },
    });
    if (!event) {
      throw new DiscordBotServiceError("Notification lease is missing or expired", 409);
    }
    const update =
      action === "ack"
        ? {
            deliveredAt: new Date(),
            leaseToken: null,
            leaseUntil: null,
          }
        : event.attempts >= MAX_DELIVERY_ATTEMPTS
          ? {
              deadLetteredAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
            }
          : {
              availableAt: new Date(
                Date.now() + Math.min(2 ** event.attempts, 60) * 60_000
              ),
              leaseToken: null,
              leaseUntil: null,
            };
    const result = await prisma.discordOutboxEvent.updateMany({
      where: {
        id: event.id,
        guildId,
        leaseToken,
        deliveredAt: null,
        deadLetteredAt: null,
      },
      data: update,
    });
    if (result.count !== 1) {
      throw new DiscordBotServiceError("Notification was already processed", 409);
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof DiscordBotServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Discord notification acknowledgement failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Unable to acknowledge Discord notification" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
