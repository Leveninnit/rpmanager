import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyDiscordBotSignature } from "@/lib/discord-bot-security";

export class DiscordBotServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function readDiscordBotRequestBody(
  request: Request,
  maxBytes: number
) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new DiscordBotServiceError("Request body is too large", 413);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function authenticateDiscordBotRequest(
  request: Request,
  body: Uint8Array
) {
  const secret = process.env.DISCORD_BOT_SERVICE_SECRET;
  if (!secret || secret.length < 32) {
    throw new DiscordBotServiceError("Discord bot service is not configured", 503);
  }
  const timestamp = request.headers.get("x-rpmanager-timestamp") || "";
  const nonce = request.headers.get("x-rpmanager-nonce") || "";
  const signature = request.headers.get("x-rpmanager-signature") || "";
  const url = new URL(request.url);
  const pathAndQuery = `${url.pathname}${url.search}`;
  if (
    !verifyDiscordBotSignature({
      secret,
      method: request.method,
      pathAndQuery,
      timestamp,
      nonce,
      signature,
      body,
    })
  ) {
    throw new DiscordBotServiceError("Bot request authentication failed", 401);
  }

  try {
    await prisma.discordApiNonce.create({
      data: {
        nonce,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DiscordBotServiceError("Bot request was already used", 409);
    }
    throw error;
  }
}

export async function consumeDiscordBotRateLimit(
  guildId: string,
  discordId: string,
  limit = 20
) {
  const bucket = Math.floor(Date.now() / 60_000);
  const entry = await prisma.discordRateLimit.upsert({
    where: {
      guildId_discordId_bucket: { guildId, discordId, bucket },
    },
    create: { guildId, discordId, bucket, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  if (entry.count > limit) {
    throw new DiscordBotServiceError("Too many commands. Wait a minute and try again.", 429);
  }
}

let lastCleanupAt = 0;

export async function cleanupDiscordBotRecords() {
  const now = Date.now();
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  const bucket = Math.floor(now / 60_000) - 2;
  await Promise.all([
    prisma.discordApiNonce.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    prisma.discordRateLimit.deleteMany({ where: { bucket: { lt: bucket } } }),
    prisma.discordLinkCode.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    prisma.discordInteraction.deleteMany({
      where: { createdAt: { lt: new Date(now - 30 * 86_400_000) } },
    }),
    prisma.discordOutboxEvent.deleteMany({
      where: {
        OR: [
          { deliveredAt: { lt: new Date(now - 30 * 86_400_000) } },
          { deadLetteredAt: { lt: new Date(now - 30 * 86_400_000) } },
        ],
      },
    }),
  ]);
}
