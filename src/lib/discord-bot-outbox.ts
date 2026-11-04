import type { Prisma } from "@prisma/client";

type OutboxClient = Pick<
  Prisma.TransactionClient,
  "connectedServer" | "discordOutboxEvent"
>;

type DiscordNoticeType = "leave" | "application" | "inactivity";

const noticeSettings = {
  leave: "notifyLeave",
  application: "notifyApplications",
  inactivity: "notifyInactivity",
} as const;

export async function enqueueDiscordNotice(
  client: OutboxClient,
  {
    communityId,
    departmentId,
    eventKey,
    type,
    content,
  }: {
    communityId: string;
    departmentId: string;
    eventKey: string;
    type: DiscordNoticeType;
    content: string;
  }
) {
  const servers = await client.connectedServer.findMany({
    where: {
      communityId,
      botEnabled: true,
      notificationChannelId: { not: null },
      OR: [{ departmentId }, { kind: "MAIN" }],
    },
    select: {
      guildId: true,
      notificationChannelId: true,
      notifyLeave: true,
      notifyApplications: true,
      notifyInactivity: true,
    },
  });

  for (const server of servers) {
    if (!server[noticeSettings[type]] || !server.notificationChannelId) continue;

    await client.discordOutboxEvent.upsert({
      where: { eventKey: `${eventKey}:${server.guildId}` },
      create: {
        eventKey: `${eventKey}:${server.guildId}`,
        communityId,
        guildId: server.guildId,
        channelId: server.notificationChannelId,
        content,
      },
      update: {},
    });
  }
}
