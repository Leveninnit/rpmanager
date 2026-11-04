import { prisma } from "@/lib/prisma";
import { DiscordBotServiceError } from "@/lib/discord-bot-auth";

export async function assertEnabledDiscordGuild(guildId: string) {
  const mappings = await prisma.connectedServer.findMany({
    where: { guildId },
    select: {
      id: true,
      communityId: true,
      kind: true,
      departmentId: true,
      subdivisionId: true,
      botEnabled: true,
    },
  });
  if (mappings.length !== 1) {
    throw new DiscordBotServiceError(
      mappings.length === 0
        ? "Discord server is not connected"
        : "Discord server mapping is ambiguous",
      mappings.length === 0 ? 404 : 409
    );
  }
  const server = mappings[0];
  if (!server.botEnabled) {
    throw new DiscordBotServiceError("Discord bot is disabled for this server", 409);
  }
  const community = await prisma.community.findUnique({
    where: { id: server.communityId },
    select: { mainDiscordGuildId: true },
  });
  if (!community) {
    throw new DiscordBotServiceError("Workspace configuration is unavailable", 409);
  }
  const otherCommunityMain = await prisma.community.findFirst({
    where: {
      mainDiscordGuildId: guildId,
      id: { not: server.communityId },
    },
    select: { id: true },
  });
  if (otherCommunityMain) {
    throw new DiscordBotServiceError(
      "Discord server is mapped to multiple communities",
      409
    );
  }
  if (server.kind === "MAIN") {
    if (server.departmentId || community.mainDiscordGuildId !== guildId) {
      throw new DiscordBotServiceError("Main server mapping is incomplete", 409);
    }
    return server;
  }
  if (server.kind !== "DEPARTMENT" || !server.departmentId) {
    throw new DiscordBotServiceError("Department server mapping is incomplete", 409);
  }
  if (community.mainDiscordGuildId === guildId) {
    throw new DiscordBotServiceError(
      "Department server is also configured as a main server",
      409
    );
  }
  const department = await prisma.department.findFirst({
    where: {
      id: server.departmentId,
      communityId: server.communityId,
      discordGuildId: guildId,
    },
    select: { id: true },
  });
  if (!department) {
    throw new DiscordBotServiceError("Department server mapping is incomplete", 409);
  }
  if (server.subdivisionId) {
    const subdivision = await prisma.subdivision.findFirst({
      where: {
        id: server.subdivisionId,
        departmentId: department.id,
      },
      select: { id: true },
    });
    if (!subdivision) {
      throw new DiscordBotServiceError("Subdivision server mapping is incomplete", 409);
    }
  }
  return server;
}
