import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  hasConfiguredSupervisorRole,
  isDiscordSnowflake,
  parseConfiguredRoleIds,
  sha256,
} from "@/lib/discord-bot-security";
import { enqueueDiscordNotice } from "@/lib/discord-bot-outbox";
import {
  authenticateDiscordBotRequest,
  cleanupDiscordBotRecords,
  consumeDiscordBotRateLimit,
  DiscordBotServiceError,
  readDiscordBotRequestBody,
} from "@/lib/discord-bot-auth";

type JsonRecord = Record<string, unknown>;

type BotCommand = {
  interactionId: string;
  guildId: string;
  discordId: string;
  roleIds: string[];
  action: string;
  input: JsonRecord;
};

type BotServerContext = {
  server: {
    id: string;
    guildId: string;
    kind: string;
    communityId: string;
    departmentId: string | null;
    subdivisionId: string | null;
    supervisorRoleIdsJson: string;
  };
  community: {
    id: string;
    name: string;
    ownerId: string;
    permissionConfigJson: string;
  };
  department: {
    id: string;
    name: string;
    discordGuildId: string | null;
  } | null;
  subdivision: { id: string; name: string } | null;
};

type LinkedActor = {
  id: string;
  discordId: string;
  name: string | null;
  communityRole: string;
  departmentMember: {
    id: string;
    rank: string;
    callsign: string | null;
    badgeNumber: string | null;
    status: string;
  } | null;
};

class BotApiError extends DiscordBotServiceError {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message, status);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readCommand(value: unknown): BotCommand {
  if (!isRecord(value)) throw new BotApiError("Invalid request body", 400);
  const { interactionId, guildId, discordId, roleIds, action, input } = value;
  if (
    !isDiscordSnowflake(interactionId) ||
    !isDiscordSnowflake(guildId) ||
    !isDiscordSnowflake(discordId) ||
    !Array.isArray(roleIds) ||
    !roleIds.every(isDiscordSnowflake) ||
    typeof action !== "string" ||
    action.length > 40 ||
    roleIds.length > 250 ||
    (input !== undefined && !isRecord(input))
  ) {
    throw new BotApiError("Invalid request fields", 400);
  }
  return {
    interactionId,
    guildId,
    discordId,
    roleIds,
    action,
    input: isRecord(input) ? input : {},
  };
}

function textValue(
  input: JsonRecord,
  key: string,
  { required = true, max = 5000 }: { required?: boolean; max?: number } = {}
) {
  const value = input[key];
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return "";
    throw new BotApiError(`${key} is required`, 400);
  }
  const result = value.trim();
  if ((required && !result) || result.length > max) {
    throw new BotApiError(`${key} is invalid`, 400);
  }
  return result;
}

function pageValue(input: JsonRecord) {
  const value = input.page ?? 1;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 50
  ) {
    throw new BotApiError("Page must be between 1 and 50", 400);
  }
  return value;
}

function parseDateOnly(value: string, key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BotApiError(`${key} must use YYYY-MM-DD`, 400);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BotApiError(`${key} is not a valid date`, 400);
  }
  return date;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function safePermissionRoles(
  permissionConfigJson: string,
  supervisorAllowed = true
) {
  const defaultRoles = supervisorAllowed
    ? ["OWNER", "HIGH_COMMAND", "SUPERVISOR"]
    : ["OWNER", "HIGH_COMMAND"];
  try {
    const config: unknown = JSON.parse(permissionConfigJson);
    if (!isRecord(config) || !isRecord(config.permissions)) return defaultRoles;
    const roles =
      config.permissions[supervisorAllowed ? "operations" : "administrative"];
    if (
      !Array.isArray(roles) ||
      !roles.every((role) => typeof role === "string")
    ) {
      return defaultRoles;
    }
    return roles.filter((role) =>
      ["OWNER", "HIGH_COMMAND", "SUPERVISOR", "MEMBER"].includes(role)
    );
  } catch {
    return defaultRoles;
  }
}

async function resolveServerContext(
  client: Prisma.TransactionClient,
  guildId: string
): Promise<BotServerContext> {
  const mappings = await client.connectedServer.findMany({
    where: { guildId },
    select: {
      id: true,
      guildId: true,
      kind: true,
      communityId: true,
      departmentId: true,
      subdivisionId: true,
      supervisorRoleIdsJson: true,
      botEnabled: true,
    },
  });
  if (mappings.length !== 1) {
    throw new BotApiError(
      mappings.length === 0
        ? "This Discord server is not connected to RPManager"
        : "This Discord server has an ambiguous workspace mapping",
      mappings.length === 0 ? 404 : 409
    );
  }
  const server = mappings[0];
  if (!server.botEnabled) {
    throw new BotApiError("The bot is not enabled for this Discord server", 409);
  }

  const community = await client.community.findUnique({
    where: { id: server.communityId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      permissionConfigJson: true,
      mainDiscordGuildId: true,
    },
  });
  if (!community) throw new BotApiError("Workspace configuration is unavailable", 409);
  const otherCommunityMain = await client.community.findFirst({
    where: {
      mainDiscordGuildId: guildId,
      id: { not: community.id },
    },
    select: { id: true },
  });
  if (otherCommunityMain) {
    throw new BotApiError("This Discord server is mapped to multiple communities", 409);
  }

  let department: BotServerContext["department"] = null;
  let subdivision: BotServerContext["subdivision"] = null;
  if (server.kind === "MAIN") {
    if (community.mainDiscordGuildId !== guildId || server.departmentId) {
      throw new BotApiError("Main server mapping is incomplete", 409);
    }
  } else if (server.kind === "DEPARTMENT" && server.departmentId) {
    if (community.mainDiscordGuildId === guildId) {
      throw new BotApiError("Department server is also configured as a main server", 409);
    }
    department = await client.department.findFirst({
      where: {
        id: server.departmentId,
        communityId: community.id,
        discordGuildId: guildId,
      },
      select: { id: true, name: true, discordGuildId: true },
    });
    if (!department) {
      throw new BotApiError("Department server mapping is incomplete", 409);
    }
    if (server.subdivisionId) {
      subdivision = await client.subdivision.findFirst({
        where: {
          id: server.subdivisionId,
          departmentId: department.id,
        },
        select: { id: true, name: true },
      });
      if (!subdivision) {
        throw new BotApiError("Subdivision server mapping is incomplete", 409);
      }
    }
  } else {
    throw new BotApiError("Discord server type is not supported", 409);
  }

  return {
    server: {
      ...server,
      supervisorRoleIdsJson: server.supervisorRoleIdsJson,
    },
    community,
    department,
    subdivision,
  };
}

async function requireLinkedActor(
  client: Prisma.TransactionClient,
  command: BotCommand,
  context: BotServerContext
): Promise<LinkedActor> {
  const user = await client.user.findUnique({
    where: { discordId: command.discordId },
    select: {
      id: true,
      name: true,
      communityMemberships: {
        where: { communityId: context.community.id, isActive: true },
        select: { role: true },
        take: 1,
      },
    },
  });
  const membership = user?.communityMemberships[0];
  if (!user || !membership) {
    throw new BotApiError(
      "Link your Discord account and join this RPManager workspace first",
      403
    );
  }
  const departmentMember = context.department
    ? await client.departmentMember.findUnique({
        where: {
          departmentId_userId: {
            departmentId: context.department.id,
            userId: user.id,
          },
        },
        select: {
          id: true,
          rank: true,
          callsign: true,
          badgeNumber: true,
          status: true,
        },
      })
    : null;
  return {
    id: user.id,
    discordId: command.discordId,
    name: user.name,
    communityRole: membership.role,
    departmentMember,
  };
}

function requireDepartmentMember(actor: LinkedActor) {
  if (
    !actor.departmentMember ||
    !["ACTIVE", "PROBATIONARY"].includes(actor.departmentMember.status)
  ) {
    throw new BotApiError("An active department roster membership is required", 403);
  }
  return actor.departmentMember;
}

function requireSupervisor(
  actor: LinkedActor,
  command: BotCommand,
  context: BotServerContext,
  supervisorAllowed = true
) {
  const websiteRoles = safePermissionRoles(
    context.community.permissionConfigJson,
    supervisorAllowed
  );
  const websiteAccess =
    context.community.ownerId === actor.id ||
    Boolean(websiteRoles?.includes(actor.communityRole));
  const discordAccess = hasConfiguredSupervisorRole(
    command.roleIds,
    parseConfiguredRoleIds(context.server.supervisorRoleIdsJson)
  );
  if (!websiteAccess || !discordAccess) {
    throw new BotApiError(
      "This action requires an authorized RPManager role and a configured Discord supervisor role",
      403
    );
  }
}

async function writeBotAudit(
  client: Prisma.TransactionClient,
  context: BotServerContext,
  actor: LinkedActor,
  action: string,
  targetId: string | null,
  details: string
) {
  await client.auditLog.create({
    data: {
      communityId: context.community.id,
      actorId: actor.id,
      actorName: actor.name || "Linked Discord member",
      action,
      targetId,
      details,
    },
  });
}

async function getDepartmentMember(
  client: Prisma.TransactionClient,
  actor: LinkedActor,
  context: BotServerContext
) {
  if (!context.department) {
    throw new BotApiError("Map this Discord server to a department first", 409);
  }
  const member = requireDepartmentMember(actor);
  if (context.subdivision) {
    const subdivisionMember = await client.subdivisionMember.findUnique({
      where: {
        userId_subdivisionId: {
          userId: actor.id,
          subdivisionId: context.subdivision.id,
        },
      },
      select: { id: true },
    });
    if (!subdivisionMember) {
      throw new BotApiError("Subdivision membership is required in this server", 403);
    }
  }
  return member;
}

async function executeCommand(
  client: Prisma.TransactionClient,
  command: BotCommand,
  context: BotServerContext
) {
  if (command.action === "link.request") {
    const linked = await client.user.findUnique({
      where: { discordId: command.discordId },
      select: { id: true },
    });
    if (linked) return { linked: true };

    const code = randomBytes(9).toString("base64url");
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await client.discordLinkCode.upsert({
      where: { discordId: command.discordId },
      create: { discordId: command.discordId, codeHash, expiresAt },
      update: { codeHash, expiresAt, createdAt: new Date() },
    });
    return { linked: false, code, expiresAt: expiresAt.toISOString() };
  }

  const actor = await requireLinkedActor(client, command, context);

  switch (command.action) {
    case "member.status": {
      return {
        community: context.community.name,
        communityRole: actor.communityRole,
        department: context.department?.name ?? null,
        rank: actor.departmentMember?.rank ?? null,
        callsign: actor.departmentMember?.callsign ?? null,
        status: actor.departmentMember?.status ?? null,
        linked: true,
      };
    }

    case "roster.list": {
      const member = await getDepartmentMember(client, actor, context);
      const page = pageValue(command.input);
      const pageSize = 10;
      const roster = await client.departmentMember.findMany({
        where: {
          departmentId: context.department!.id,
          status: { not: "TRANSFERRED" },
          user: context.subdivision
            ? {
                subdivisionMemberships: {
                  some: { subdivisionId: context.subdivision.id },
                },
              }
            : undefined,
        },
        select: {
          rank: true,
          callsign: true,
          status: true,
          user: { select: { name: true } },
        },
        orderBy: [{ rank: "asc" }, { callsign: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      });
      if (!member) throw new BotApiError("Department membership is required", 403);
      return {
        department: context.department!.name,
        subdivision: context.subdivision?.name ?? null,
        page,
        members: roster.slice(0, pageSize).map((entry) => ({
          name: entry.user.name || "Unnamed member",
          callsign: entry.callsign,
          rank: entry.rank,
          status: entry.status,
        })),
        hasMore: roster.length > pageSize,
      };
    }

    case "duty.clockIn": {
      const rosterMember = await getDepartmentMember(client, actor, context);
      const current = await client.dutyShift.findFirst({
        where: { userId: actor.id, endTime: null },
        select: { id: true },
      });
      if (current) {
        throw new BotApiError("You already have an active shift. End it before clocking in.", 409);
      }
      const requestedCallsign = textValue(command.input, "callsign", {
        required: false,
        max: 32,
      });
      const callsign =
        requestedCallsign || rosterMember.callsign || "UNASSIGNED";
      if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]{0,31}$/u.test(callsign)) {
        throw new BotApiError("Callsign contains unsupported characters", 400);
      }
      const existingCallsign = await client.departmentMember.findFirst({
        where: {
          departmentId: context.department!.id,
          userId: { not: actor.id },
          callsign,
          status: { not: "TRANSFERRED" },
        },
        select: { id: true },
      });
      if (existingCallsign) {
        throw new BotApiError("That callsign is assigned to another roster member", 409);
      }
      const shift = await client.dutyShift.create({
          data: {
            userId: actor.id,
            activeUserId: actor.id,
            departmentId: context.department!.id,
            subdivisionId: context.subdivision?.id ?? null,
            callsign,
            source: "DISCORD_BOT",
            sourceEventId: command.interactionId,
          },
          select: { id: true, callsign: true, startTime: true },
        }).catch(async (error: unknown) => {
        if (isUniqueConstraintError(error)) {
          const previousShift = await client.dutyShift.findUnique({
            where: { sourceEventId: command.interactionId },
            select: { id: true, callsign: true, startTime: true },
          });
          if (previousShift) return previousShift;
          throw new BotApiError(
            "Another active duty shift already exists for this account",
            409
          );
        }
        throw error;
      });
      await writeBotAudit(
        client,
        context,
        actor,
        "DUTY_CLOCK_IN",
        shift.id,
        "Clocked in through the Discord bot"
      );
      return shift;
    }

    case "duty.clockOut": {
      if (context.department && !actor.departmentMember) {
        throw new BotApiError("Department membership is required to use duty tracking", 403);
      }
      const shift = await client.dutyShift.findFirst({
        where: {
          userId: actor.id,
          endTime: null,
          department: { communityId: context.community.id },
          ...(context.department ? { departmentId: context.department.id } : {}),
          ...(context.subdivision ? { subdivisionId: context.subdivision.id } : {}),
        },
        select: { id: true, startTime: true, callsign: true },
        orderBy: { startTime: "desc" },
      });
      if (!shift) throw new BotApiError("No active shift was found in this workspace", 404);
      const endTime = new Date();
      const closed = await client.dutyShift.updateMany({
        where: { id: shift.id, userId: actor.id, endTime: null },
        data: {
          endTime,
          activeUserId: null,
          durationMinutes: Math.max(
            0,
            Math.round((endTime.getTime() - shift.startTime.getTime()) / 60_000)
          ),
        },
      });
      if (closed.count !== 1) {
        throw new BotApiError("This shift was already ended", 409);
      }
      await writeBotAudit(
        client,
        context,
        actor,
        "DUTY_CLOCK_OUT",
        shift.id,
        "Clocked out through the Discord bot"
      );
      return {
        callsign: shift.callsign,
        startTime: shift.startTime,
        endTime,
        durationMinutes: Math.max(
          0,
          Math.round((endTime.getTime() - shift.startTime.getTime()) / 60_000)
        ),
      };
    }

    case "leave.submit": {
      await getDepartmentMember(client, actor, context);
      const startDate = parseDateOnly(
        textValue(command.input, "startDate", { max: 10 }),
        "Start date"
      );
      const endDate = parseDateOnly(
        textValue(command.input, "endDate", { max: 10 }),
        "End date"
      );
      if (
        startDate > endDate ||
        endDate.getTime() - startDate.getTime() > 366 * 86_400_000
      ) {
        throw new BotApiError("Choose a valid leave period of no more than one year", 400);
      }
      const reason = textValue(command.input, "reason", { max: 2000 });
      const overlapping = await client.leaveOfAbsence.findFirst({
        where: {
          userId: actor.id,
          status: { in: ["PENDING", "APPROVED"] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      });
      if (overlapping) {
        throw new BotApiError("You already have pending or approved leave for those dates", 409);
      }
      const leave = await client.leaveOfAbsence.create({
        data: {
          userId: actor.id,
          departmentId: context.department!.id,
          startDate,
          endDate,
          reason,
        },
        select: { id: true, status: true, startDate: true, endDate: true },
      });
      await client.notification.createMany({
        data: await client.communityMember
          .findMany({
            where: {
              communityId: context.community.id,
              isActive: true,
              role: { in: ["OWNER", "HIGH_COMMAND", "SUPERVISOR"] },
            },
            select: { userId: true },
          })
          .then((members) =>
            members.map((member) => ({
              communityId: context.community.id,
              userId: member.userId,
              title: "New leave request",
              message: "A department member submitted a leave request for review.",
            }))
          ),
      });
      await enqueueDiscordNotice(client, {
        communityId: context.community.id,
        departmentId: context.department!.id,
        eventKey: `leave:${leave.id}:submitted`,
        type: "leave",
        content: "A leave request is waiting for review.",
      });
      await writeBotAudit(
        client,
        context,
        actor,
        "LOA_REQUESTED",
        leave.id,
        "Leave of absence requested through the Discord bot"
      );
      return { id: leave.id, status: leave.status, startDate: leave.startDate, endDate: leave.endDate };
    }

    case "leave.review": {
      requireSupervisor(actor, command, context, false);
      const leaveId = textValue(command.input, "leaveId", { max: 100 });
      const decision = textValue(command.input, "decision", { max: 20 }).toUpperCase();
      if (!["APPROVED", "DENIED"].includes(decision)) {
        throw new BotApiError("Decision must be APPROVED or DENIED", 400);
      }
      const leave = await client.leaveOfAbsence.findFirst({
        where: {
          id: leaveId,
          departmentId: context.department?.id,
          department: { communityId: context.community.id },
          status: "PENDING",
        },
        select: { id: true, userId: true, departmentId: true },
      });
      if (!leave) throw new BotApiError("Pending leave request not found", 404);
      const updated = await client.leaveOfAbsence.updateMany({
        where: { id: leave.id, status: "PENDING" },
        data: { status: decision, reviewedBy: actor.id, reviewNotes: null },
      });
      if (updated.count !== 1) {
        throw new BotApiError("This leave request was already reviewed", 409);
      }
      if (decision === "APPROVED" && leave.departmentId) {
        await client.departmentMember.updateMany({
          where: {
            departmentId: leave.departmentId,
            userId: leave.userId,
            status: "ACTIVE",
          },
          data: { status: "LOA" },
        });
      }
      await client.notification.create({
        data: {
          communityId: context.community.id,
          userId: leave.userId,
          title: `Leave request ${decision.toLowerCase()}`,
          message: `Your leave request was ${decision.toLowerCase()}.`,
        },
      });
      await writeBotAudit(
        client,
        context,
        actor,
        `LOA_${decision}`,
        leave.id,
        `Leave request ${decision.toLowerCase()} through the Discord bot`
      );
      return { id: leave.id, status: decision };
    }

    case "leave.pending": {
      requireSupervisor(actor, command, context, false);
      const page = pageValue(command.input);
      const pending = await client.leaveOfAbsence.findMany({
        where: {
          status: "PENDING",
          department: {
            communityId: context.community.id,
            ...(context.department ? { id: context.department.id } : {}),
          },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          department: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * 10,
        take: 11,
      });
      return {
        page,
        requests: pending.slice(0, 10).map((leave) => ({
          id: leave.id,
          startDate: leave.startDate,
          endDate: leave.endDate,
          department: leave.department?.name ?? "Department",
          member: leave.user.name || "Unnamed member",
        })),
        hasMore: pending.length > 10,
      };
    }

    case "sop.list": {
      await getDepartmentMember(client, actor, context);
      const page = pageValue(command.input);
      const pageSize = 10;
      const sops = await client.standardOperatingProcedure.findMany({
        where: {
          departmentId: context.department!.id,
          ...(context.subdivision
            ? { OR: [{ subdivisionId: null }, { subdivisionId: context.subdivision.id }] }
            : {}),
        },
        select: {
          id: true,
          title: true,
          category: true,
          version: true,
          requireSignOff: true,
        },
        orderBy: [{ title: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
      });
      return {
        page,
        sops: sops.slice(0, pageSize),
        hasMore: sops.length > pageSize,
      };
    }

    case "sop.read": {
      await getDepartmentMember(client, actor, context);
      const sopId = textValue(command.input, "sopId", { max: 100 });
      const page = pageValue(command.input);
      const sop = await client.standardOperatingProcedure.findFirst({
        where: {
          id: sopId,
          departmentId: context.department?.id,
          ...(context.subdivision
            ? { OR: [{ subdivisionId: null }, { subdivisionId: context.subdivision.id }] }
            : {}),
        },
        select: { id: true, title: true, version: true, content: true },
      });
      if (!sop) throw new BotApiError("SOP not found in this department", 404);
      const pageSize = 1600;
      const pageCount = Math.max(1, Math.ceil(sop.content.length / pageSize));
      if (page > pageCount) {
        throw new BotApiError(`This SOP has ${pageCount} page(s)`, 400);
      }
      return {
        title: sop.title,
        version: sop.version,
        page,
        pageCount,
        content: sop.content.slice((page - 1) * pageSize, page * pageSize),
      };
    }

    case "sop.acknowledge": {
      await getDepartmentMember(client, actor, context);
      const sopId = textValue(command.input, "sopId", { max: 100 });
      const sop = await client.standardOperatingProcedure.findFirst({
        where: {
          id: sopId,
          departmentId: context.department?.id,
          ...(context.subdivision
            ? { OR: [{ subdivisionId: null }, { subdivisionId: context.subdivision.id }] }
            : {}),
        },
        select: { id: true, title: true, version: true },
      });
      if (!sop) throw new BotApiError("SOP not found in this department", 404);
      const acknowledgement = await client.sOPAcknowledgement.upsert({
        where: {
          sopId_version_userId: {
            sopId: sop.id,
            version: sop.version,
            userId: actor.id,
          },
        },
        create: {
          sopId: sop.id,
          version: sop.version,
          userId: actor.id,
        },
        update: {},
        select: { acknowledgedAt: true },
      });
      await writeBotAudit(
        client,
        context,
        actor,
        "SOP_ACKNOWLEDGED",
        sop.id,
        `Acknowledged SOP version ${sop.version} through the Discord bot`
      );
      return { title: sop.title, version: sop.version, acknowledgedAt: acknowledgement.acknowledgedAt };
    }

    case "application.status": {
      const applications = await client.application.findMany({
        where: {
          applicantUserId: actor.id,
          department: {
            communityId: context.community.id,
            ...(context.department ? { id: context.department.id } : {}),
          },
        },
        select: {
          id: true,
          status: true,
          stage: true,
          createdAt: true,
          updatedAt: true,
          department: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return {
        applications: applications.map((application) => ({
          id: application.id,
          status: application.status,
          stage: application.stage,
          department: application.department.name,
          submittedAt: application.createdAt,
          updatedAt: application.updatedAt,
        })),
      };
    }

    default:
      throw new BotApiError("Unknown Discord bot command", 400);
  }
}

async function processCommand(command: BotCommand, requestHash: string) {
  try {
    return await prisma.$transaction(async (client) => {
      await client.discordInteraction.create({
        data: {
          interactionId: command.interactionId,
          requestHash,
          responseJson: "{}",
        },
      });
      const context = await resolveServerContext(client, command.guildId);
      const data = await executeCommand(client, command, context);
      const response = { data };
      await client.discordInteraction.update({
        where: { interactionId: command.interactionId },
        data: { responseJson: JSON.stringify(response) },
      });
      return response;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const previous = await prisma.discordInteraction.findUnique({
      where: { interactionId: command.interactionId },
      select: { requestHash: true, responseJson: true },
    });
    if (!previous || previous.requestHash !== requestHash) {
      throw new BotApiError("Discord interaction identifier was already used", 409);
    }
    if (previous.responseJson === "{}") {
      throw new BotApiError("The original command is still processing; retry shortly", 409);
    }
    return JSON.parse(previous.responseJson) as { data: unknown };
  }
}

export async function POST(request: Request) {
  let body: Uint8Array;
  try {
    body = await readDiscordBotRequestBody(request, 32_768);
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body));
    } catch {
      throw new BotApiError("Invalid JSON request body", 400);
    }
    const command = readCommand(parsed);
    await consumeDiscordBotRateLimit(command.guildId, command.discordId);
    const response = await processCommand(command, sha256(body));
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DiscordBotServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Discord bot API request failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Unable to complete Discord command" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
