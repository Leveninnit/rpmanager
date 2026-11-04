import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isDiscordSnowflake,
  sha256,
} from "@/lib/discord-bot-security";
import { enqueueDiscordNotice } from "@/lib/discord-bot-outbox";
import {
  assertDepartmentAccess,
  hasHighCommandAccess,
  hasIAAccess,
  hasManagerAccess,
  getWorkspaceContext,
  requireHighCommand,
  requireIACommandAccess,
  requireIAAccess,
  requireManager,
  WorkspaceError,
  writeAudit,
  writeSystemAudit,
} from "@/lib/workspace";

type Input = Record<string, unknown>;

const PRESETS = [
  "MODERN_POLICE",
  "UK_POLICE",
  "US_POLICE",
  "FIRE_EMS",
  "MILITARY",
  "REDM_WILD_WEST",
  "SCP",
  "ROBLOX",
  "CUSTOM",
];
const MEMBER_STATUSES = ["ACTIVE", "LOA", "PROBATIONARY", "SUSPENDED"];
const APPLICATION_STATUSES = [
  "UNDER_REVIEW",
  "INTERVIEW",
  "ACCEPTED",
  "DENIED",
];

function stringValue(input: Input, key: string, required = true, max = 5000) {
  const value = input[key];
  if (typeof value !== "string" || (required && !value.trim())) {
    if (!required && (value === undefined || value === null || value === "")) {
      return "";
    }
    throw new WorkspaceError(`${key} is required`, 400);
  }
  const result = value.trim();
  if (result.length > max) {
    throw new WorkspaceError(`${key} exceeds the maximum length`, 400);
  }
  return result;
}

function numberValue(input: Input, key: string, min: number, max: number) {
  const value = Number(input[key]);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new WorkspaceError(`${key} must be between ${min} and ${max}`, 400);
  }
  return value;
}

function integerValue(input: Input, key: string, min: number, max: number) {
  const value = numberValue(input, key, min, max);
  if (!Number.isInteger(value)) {
    throw new WorkspaceError(`${key} must be a whole number`, 400);
  }
  return value;
}

function booleanValue(input: Input, key: string) {
  const value = input[key];
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new WorkspaceError(`${key} must be a boolean`, 400);
}

function jsonInput<T>(value: unknown, fallback: T, key: string): T {
  if (typeof value !== "string") {
    return value === undefined || value === null ? fallback : (value as T);
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new WorkspaceError(`${key} must contain valid JSON`, 400);
  }
}

function jsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return value === undefined || value === null ? fallback : (value as T);
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function validDate(value: string, key: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new WorkspaceError(`${key} must be a valid date`, 400);
  }
  return date;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function getWeekStart(date = new Date()) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

async function expireLeaveRequests(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>,
  userIds: string[],
  departmentIds: string[]
) {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const expired = await prisma.leaveOfAbsence.findMany({
    where: {
      userId: { in: userIds },
      departmentId: { in: departmentIds },
      status: "APPROVED",
      endDate: { lt: now },
    },
    select: { id: true, userId: true },
  });

  for (const request of expired) {
    const leave = await prisma.leaveOfAbsence.findUnique({
      where: { id: request.id },
      select: { departmentId: true },
    });
    await prisma.$transaction(async (transaction) => {
      await transaction.leaveOfAbsence.update({
        where: { id: request.id },
        data: { status: "EXPIRED" },
      });
      if (leave?.departmentId) {
        await transaction.departmentMember.updateMany({
          where: {
            departmentId: leave.departmentId,
            userId: request.userId,
            status: "LOA",
          },
          data: { status: "ACTIVE" },
        });
      }
    });
    await prisma.notification.create({
      data: {
        communityId: context.community.id,
        userId: request.userId,
        title: "Leave of absence ended",
        message: "Your approved leave has expired and normal activity requirements resume.",
      },
    });
    await writeSystemAudit(
      context.community.id,
      "LOA_EXPIRED",
      request.id,
      "Approved leave expired"
    );
  }
}

async function expireDisciplinaryRecords(
  communityId: string,
  departmentIds: string[]
) {
  const expired = await prisma.disciplinaryRecord.findMany({
    where: {
      departmentId: { in: departmentIds },
      status: "ACTIVE",
      expiresAt: { lte: new Date() },
    },
    select: { id: true },
  });
  for (const record of expired) {
    await prisma.disciplinaryRecord.update({
      where: { id: record.id },
      data: { status: "EXPIRED" },
    });
    await writeSystemAudit(
      communityId,
      "DISCIPLINE_EXPIRED",
      record.id,
      "Disciplinary record reached its expiry date"
    );
  }
}

async function expireInactivityStrikes(
  communityId: string,
  departmentIds: string[]
) {
  const expired = await prisma.inactivityStrike.findMany({
    where: {
      departmentId: { in: departmentIds },
      status: "CONFIRMED",
      expiresAt: { lte: new Date() },
    },
    select: { id: true, officerId: true },
  });
  for (const strike of expired) {
    const updated = await prisma.inactivityStrike.updateMany({
      where: { id: strike.id, status: "CONFIRMED" },
      data: { status: "EXPIRED" },
    });
    if (updated.count === 0) continue;
    await prisma.notification.create({
      data: {
        communityId,
        userId: strike.officerId,
        title: "Inactivity record expired",
        message: "An inactivity record reached its configured expiry date.",
      },
    });
    await writeSystemAudit(
      communityId,
      "INACTIVITY_EXPIRED",
      strike.id,
      "Inactivity record reached its expiry date"
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const context = await getWorkspaceContext(url.searchParams.get("communityId") || undefined);
    const linkedDiscordAccount = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { discordId: true },
    });
    const memberships = await prisma.communityMember.findMany({
      where: { userId: context.userId, isActive: true },
      select: {
        role: true,
        community: { select: { id: true, name: true, slug: true, gamePreset: true } },
      },
      orderBy: { joinedAt: "asc" },
    });
    const departments = await prisma.department.findMany({
      where: { communityId: context.community.id },
      include: {
        _count: { select: { members: true, subdivisions: true, sops: true } },
        subdivisions: {
          orderBy: { name: "asc" },
          include: {
            members: {
              include: { user: { select: { id: true, name: true } } },
              orderBy: { role: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const departmentIds = departments.map((department) => department.id);
    const weekStart = getWeekStart();
    const communityMembers = await prisma.communityMember.findMany({
      where: { communityId: context.community.id, isActive: true },
      select: { userId: true },
    });
    const userIds = communityMembers.map((member) => member.userId);
    const communityPeople = await prisma.communityMember.findMany({
      where: { communityId: context.community.id, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, discordId: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    await expireLeaveRequests(context, userIds, departmentIds);
    await expireDisciplinaryRecords(context.community.id, departmentIds);
    await expireInactivityStrikes(context.community.id, departmentIds);

    const isManager = hasManagerAccess(context);
    const isHighCommand = hasHighCommandAccess(context);
    const canAccessIA = hasIAAccess(context);

    const [
      roster,
      dutyShifts,
      weeklyDutyShifts,
      leaveRequests,
      strikes,
      disciplinaryRecords,
      sops,
      rawForms,
      applications,
      courses,
      trainingRecords,
      auditLogs,
      connectedServers,
      investigations,
      policy,
      notifications,
    ] = await Promise.all([
      prisma.departmentMember.findMany({
        where: {
          departmentId: { in: departmentIds },
          status: { not: "TRANSFERRED" },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, discordId: true },
          },
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ departmentId: "asc" }, { rank: "asc" }],
      }),
      prisma.dutyShift.findMany({
        where: { departmentId: { in: departmentIds } },
        include: {
          user: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          subdivision: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "desc" },
        take: 200,
      }),
      prisma.dutyShift.findMany({
        where: {
          departmentId: { in: departmentIds },
          startTime: { lt: new Date(weekStart.getTime() + 7 * 86400000) },
          OR: [{ endTime: null }, { endTime: { gte: weekStart } }],
        },
        select: {
          userId: true,
          departmentId: true,
          startTime: true,
          endTime: true,
          durationMinutes: true,
        },
      }),
      prisma.leaveOfAbsence.findMany({
        where: {
          departmentId: { in: departmentIds },
          ...(isManager ? {} : { userId: context.userId }),
        },
        include: {
          user: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.inactivityStrike.findMany({
        where: {
          departmentId: { in: departmentIds },
          ...(isHighCommand ? {} : { officerId: context.userId }),
        },
        include: {
          officer: { select: { id: true, name: true, callsign: true } },
          department: { select: { id: true, name: true } },
          commander: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.disciplinaryRecord.findMany({
        where: {
          departmentId: { in: departmentIds },
          ...(isHighCommand ? {} : { subjectId: context.userId }),
        },
        include: {
          subject: { select: { id: true, name: true } },
          issuer: { select: { name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.standardOperatingProcedure.findMany({
        where: { departmentId: { in: departmentIds } },
        include: {
          department: { select: { id: true, name: true } },
          subdivision: { select: { id: true, name: true } },
          _count: { select: { acknowledgements: true } },
          ...(isManager ? { versions: { orderBy: { createdAt: "desc" as const } } } : {}),
          ...(isManager
            ? {
                acknowledgements: {
                  include: { user: { select: { id: true, name: true } } },
                  orderBy: { acknowledgedAt: "desc" as const },
                },
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.applicationForm.findMany({
        where: { communityId: context.community.id, isOpen: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.application.findMany({
            where: {
              departmentId: { in: departmentIds },
              ...(isHighCommand ? {} : { applicantUserId: context.userId }),
            },
            include: {
              department: { select: { id: true, name: true } },
              applicant: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
      prisma.trainingCourse.findMany({
        where: { communityId: context.community.id },
        include: {
          department: { select: { id: true, name: true } },
          subdivision: { select: { id: true, name: true } },
          _count: { select: { records: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.trainingRecord.findMany({
        where: { course: { communityId: context.community.id } },
        include: {
          user: { select: { id: true, name: true } },
          course: { select: { id: true, title: true, certification: true } },
        },
        orderBy: { completedAt: "desc" },
        take: 150,
      }),
      isManager
        ? prisma.auditLog.findMany({
            where: { communityId: context.community.id },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
      prisma.connectedServer.findMany({
        where: { communityId: context.community.id },
        orderBy: { createdAt: "asc" },
      }),
      canAccessIA
        ? prisma.investigationCase.findMany({
            where: {
              communityId: context.community.id,
              ...(context.community.ownerId !== context.userId &&
              context.membership.role === "INVESTIGATOR"
                ? { investigatorUserId: context.userId }
                : {}),
            },
            include: {
              subject: { select: { id: true, name: true } },
              investigator: { select: { id: true, name: true } },
              entries: {
                include: { createdBy: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]),
      prisma.inactivityPolicy.findUnique({
        where: { communityId: context.community.id },
      }),
      prisma.notification.findMany({
        where: { userId: context.userId, communityId: context.community.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    if (canAccessIA) {
      await writeAudit(
        context,
        "IA_RECORDS_ACCESSED",
        null,
        "Confidential investigation records viewed"
      );
    }

    const safeForms = rawForms.map((form) => ({
      ...form,
      questionsJson: JSON.stringify(
        jsonValue<Array<Record<string, unknown>>>(form.questionsJson, []).map(
          (question) =>
            Object.fromEntries(
              Object.entries(question).filter(([key]) => key !== "correctAnswer")
            )
        )
      ),
    }));

    const activeShifts = dutyShifts.filter((shift) => !shift.endTime);
    const weeklyHours = new Map<string, number>();
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
    for (const shift of weeklyDutyShifts) {
      if (!shift.departmentId) continue;
      const key = `${shift.userId}:${shift.departmentId}`;
      const start = Math.max(shift.startTime.getTime(), weekStart.getTime());
      const end = Math.min(
        shift.endTime?.getTime() ?? Date.now(),
        weekEnd.getTime()
      );
      const minutes = Math.max(0, Math.round((end - start) / 60000));
      weeklyHours.set(key, (weeklyHours.get(key) ?? 0) + minutes);
    }
    const totalHours = [...weeklyHours.values()].reduce((sum, minutes) => sum + minutes, 0) / 60;
    const weeklyHourReport = [...weeklyHours.entries()].map(([key, minutes]) => {
      const [userId, departmentId] = key.split(":");
      return {
        userId,
        departmentId,
        minutes,
        hours: Math.round((minutes / 60) * 100) / 100,
      };
    });
    const uniqueMemberIds = new Set(roster.map((member) => member.userId));
    const safeRoster = roster.map((member) => ({
      ...member,
      inactivityExempt: isHighCommand ? member.inactivityExempt : false,
      exemptionReason: isHighCommand ? member.exemptionReason : null,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: isManager ? member.user.email : null,
      },
    }));
    const safeCommunityPeople = isManager
      ? communityPeople
      : communityPeople
          .filter((member) => member.userId === context.userId)
          .map((member) => ({
            ...member,
            discordRoleIdsJson: "[]",
          }));
    const isOwner = context.community.ownerId === context.userId;
    const safeConnectedServers = connectedServers.map((server) => ({
      ...server,
      supervisorRoleIdsJson: isOwner ? server.supervisorRoleIdsJson : "[]",
      notificationChannelId: isOwner ? server.notificationChannelId : null,
      notifyLeave: isOwner && server.notifyLeave,
      notifyApplications: isOwner && server.notifyApplications,
      notifyInactivity: isOwner && server.notifyInactivity,
    }));

    return NextResponse.json({
      community: {
        id: context.community.id,
        name: context.community.name,
        slug: context.community.slug,
        gamePreset: context.community.gamePreset,
        customTerminologyJson: context.community.customTerminologyJson,
        permissionConfigJson: context.community.permissionConfigJson,
        mainDiscordGuildId: context.community.mainDiscordGuildId,
        role: context.membership.role,
      },
      discordAccountLinked: Boolean(linkedDiscordAccount?.discordId),
      memberships,
      departments,
      roster: safeRoster,
      communityPeople: safeCommunityPeople,
      dutyShifts,
      weeklyHours: weeklyHourReport,
      weekStartsAt: weekStart,
      leaveRequests,
      strikes,
      disciplinaryRecords,
      sops,
      applicationForms: safeForms,
      applications,
      courses,
      trainingRecords,
      auditLogs,
      connectedServers: safeConnectedServers,
      investigations,
      policy,
      notifications,
      analytics: {
        members: uniqueMemberIds.size,
        departments: departments.length,
        subdivisions: departments.reduce(
          (sum, department) => sum + department.subdivisions.length,
          0
        ),
        pendingApplications: applications.filter(
          (application) => !["ACCEPTED", "DENIED"].includes(application.status)
        ).length,
        activeShifts: activeShifts.length,
        collectiveHours: Math.round((totalHours / 60) * 10) / 10,
        trainingRecords: trainingRecords.length,
        pendingLeave: leaveRequests.filter((leave) => leave.status === "PENDING").length,
      },
      capabilities: {
        manager: isManager,
        highCommand: isHighCommand,
        internalAffairs: canAccessIA,
        iaCommand:
          context.community.ownerId === context.userId ||
          ["OWNER", "HIGH_COMMAND"].includes(context.membership.role),
      },
    });
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Workspace read failed:", error);
    return NextResponse.json(
      { error: "Unable to load workspace data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let input: Input;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    input = body as Input;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  try {
    const communityId =
      typeof input.communityId === "string" ? input.communityId : undefined;
    const context = await getWorkspaceContext(communityId);
    const action = stringValue(input, "action", true, 60);
    let result: unknown = { success: true };

    switch (action) {
      case "department.create": {
        requireManager(context, false);
        const name = stringValue(input, "name", true, 100);
        const code = stringValue(input, "code", true, 20).toUpperCase();
        const quota = numberValue(input, "weeklyQuotaHours", 0, 168);
        const ranks = jsonInput<unknown>(input.ranks, [
          "Member",
          "Supervisor",
          "High Command",
        ], "ranks");
        if (!/^[A-Z0-9_-]+$/.test(code) || !Array.isArray(ranks) || ranks.length > 50) {
          throw new WorkspaceError("Invalid department code or rank structure", 400);
        }
        const existingDepartment = await prisma.department.findFirst({
          where: { communityId: context.community.id, code },
          select: { id: true },
        });
        if (existingDepartment) {
          throw new WorkspaceError("A department with that code already exists", 409);
        }
        const department = await prisma.department.create({
          data: {
            communityId: context.community.id,
            name,
            code,
            weeklyQuotaHours: quota,
            rankStructureJson: JSON.stringify(ranks),
          },
        });
        await writeAudit(context, "DEPARTMENT_CREATED", department.id, `Created ${name} department`);
        result = { department };
        break;
      }

      case "department.update": {
        requireManager(context, false);
        const departmentId = stringValue(input, "departmentId", true, 100);
        const department = await assertDepartmentAccess(context, departmentId);
        const name = stringValue(input, "name", true, 100);
        const quota = numberValue(input, "weeklyQuotaHours", 0, 168);
        const ranks = jsonInput<unknown>(input.ranks, [], "ranks");
        if (!Array.isArray(ranks) || ranks.length > 50) {
          throw new WorkspaceError("Rank structure must be a list of up to 50 ranks", 400);
        }
        const roleMappings = jsonInput<unknown>(
          input.discordRoleMappings,
          {},
          "discordRoleMappings"
        );
        if (!roleMappings || typeof roleMappings !== "object" || Array.isArray(roleMappings)) {
          throw new WorkspaceError("Discord role mappings must be a JSON object", 400);
        }
        const updated = await prisma.department.update({
          where: { id: departmentId },
          data: {
            name,
            weeklyQuotaHours: quota,
            rankStructureJson: JSON.stringify(ranks),
            discordRoleMappingsJson: JSON.stringify(roleMappings),
            discordGuildId: stringValue(input, "discordGuildId", false, 32) || null,
            discordRoleId: stringValue(input, "discordRoleId", false, 32) || null,
          },
        });
        await writeAudit(
          context,
          "DEPARTMENT_UPDATED",
          department.id,
          `Updated department settings for ${updated.name}`
        );
        result = { department: updated };
        break;
      }

      case "subdivision.create": {
        requireManager(context, false);
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const name = stringValue(input, "name", true, 100);
        const code = stringValue(input, "code", true, 20).toUpperCase();
        if (!/^[A-Z0-9_-]+$/.test(code)) {
          throw new WorkspaceError("Invalid subdivision code", 400);
        }
        const subdivision = await prisma.subdivision.create({
          data: {
            departmentId,
            name,
            code,
            maxUnits: integerValue(input, "maxUnits", 1, 1000),
            callsignPrefix: stringValue(input, "callsignPrefix", false, 20) || null,
            callsignPattern: stringValue(input, "callsignPattern", false, 100) || null,
          },
        });
        await writeAudit(context, "SUBDIVISION_CREATED", subdivision.id, `Created ${name}`);
        result = { subdivision };
        break;
      }

      case "member.add": {
        requireManager(context, false);
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const email = stringValue(input, "email", true, 254).toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          throw new WorkspaceError(
            "The member must create an RPManager account before they can be added",
            404
          );
        }
        await prisma.communityMember.upsert({
          where: {
            communityId_userId: {
              communityId: context.community.id,
              userId: user.id,
            },
          },
          create: {
            communityId: context.community.id,
            userId: user.id,
            role: "MEMBER",
          },
          update: { isActive: true },
        });
        const member = await prisma.departmentMember.upsert({
          where: { departmentId_userId: { departmentId, userId: user.id } },
          create: {
            departmentId,
            userId: user.id,
            rank: stringValue(input, "rank", false, 80) || "Member",
            badgeNumber: stringValue(input, "badgeNumber", false, 40) || null,
            callsign: stringValue(input, "callsign", false, 40) || null,
          },
          update: { status: "ACTIVE" },
        });
        await writeAudit(context, "ROSTER_MEMBER_ADDED", member.id, `Added ${user.name ?? email}`);
        result = { member };
        break;
      }

      case "member.update": {
        requireManager(context, false);
        const memberId = stringValue(input, "memberId", true, 100);
        const member = await prisma.departmentMember.findFirst({
          where: {
            id: memberId,
            department: { communityId: context.community.id },
          },
          include: { user: { select: { id: true, name: true } } },
        });
        if (!member) throw new WorkspaceError("Roster member not found", 404);
        const rank = stringValue(input, "rank", true, 80);
        const status = stringValue(input, "status", true, 30).toUpperCase();
        if (!MEMBER_STATUSES.includes(status)) {
          throw new WorkspaceError("Invalid personnel status", 400);
        }
        const updated = await prisma.departmentMember.update({
          where: { id: member.id },
          data: {
            rank,
            status,
            badgeNumber: stringValue(input, "badgeNumber", false, 40) || null,
            callsign: stringValue(input, "callsign", false, 40) || null,
            inactivityExempt: input.inactivityExempt === true || input.inactivityExempt === "on",
            exemptionReason:
              input.inactivityExempt === undefined
                ? member.exemptionReason
                : stringValue(input, "exemptionReason", false, 500) || null,
          },
        });
        await writeAudit(
          context,
          "ROSTER_MEMBER_UPDATED",
          member.id,
          `Updated ${member.user.name ?? "member"}: rank ${member.rank} to ${rank}, status ${status}`
        );
        result = { member: updated };
        break;
      }

      case "subdivision.member.add": {
        requireManager(context, false);
        const subdivisionId = stringValue(input, "subdivisionId", true, 100);
        const subdivision = await prisma.subdivision.findFirst({
          where: {
            id: subdivisionId,
            department: { communityId: context.community.id },
          },
        });
        if (!subdivision) throw new WorkspaceError("Subdivision not found", 404);
        const userId = stringValue(input, "userId", true, 100);
        const departmentMember = await prisma.departmentMember.findUnique({
          where: {
            departmentId_userId: {
              departmentId: subdivision.departmentId,
              userId,
            },
          },
        });
        if (!departmentMember) {
          throw new WorkspaceError("Member must be on the parent department roster", 400);
        }
        const role = stringValue(input, "role", true, 30).toUpperCase();
        if (!["LEAD", "SUPERVISOR", "OPERATOR"].includes(role)) {
          throw new WorkspaceError("Invalid subdivision role", 400);
        }
        const member = await prisma.subdivisionMember.upsert({
          where: { userId_subdivisionId: { userId, subdivisionId } },
          create: { userId, subdivisionId, role },
          update: { role },
        });
        await writeAudit(context, "SUBDIVISION_MEMBER_UPDATED", member.id, `Set subdivision role to ${role}`);
        result = { member };
        break;
      }

      case "subdivision.member.remove": {
        requireManager(context, false);
        const subdivisionId = stringValue(input, "subdivisionId", true, 100);
        const userId = stringValue(input, "userId", true, 100);
        const member = await prisma.subdivisionMember.findFirst({
          where: {
            subdivisionId,
            userId,
            subdivision: { department: { communityId: context.community.id } },
          },
        });
        if (!member) throw new WorkspaceError("Subdivision member not found", 404);
        await prisma.subdivisionMember.delete({ where: { id: member.id } });
        await writeAudit(context, "SUBDIVISION_MEMBER_REMOVED", member.id, "Removed subdivision membership");
        break;
      }

      case "member.role": {
        if (context.community.ownerId !== context.userId) {
          throw new WorkspaceError("Only the workspace owner can change access roles", 403);
        }
        const userId = stringValue(input, "userId", true, 100);
        const role = stringValue(input, "role", true, 40).toUpperCase();
        if (!["HIGH_COMMAND", "SUPERVISOR", "INVESTIGATOR", "MEMBER"].includes(role)) {
          throw new WorkspaceError("Invalid workspace role", 400);
        }
        const membership = await prisma.communityMember.findFirst({
          where: { userId, communityId: context.community.id },
        });
        if (!membership) throw new WorkspaceError("Community member not found", 404);
        if (context.community.ownerId === userId) {
          throw new WorkspaceError("The community owner role cannot be changed", 403);
        }
        await prisma.communityMember.update({
          where: { id: membership.id },
          data: { role },
        });
        await writeAudit(context, "PERMISSION_CHANGED", membership.id, `Access role changed to ${role}`);
        break;
      }

      case "member.transfer": {
        requireManager(context, false);
        const memberId = stringValue(input, "memberId", true, 100);
        const destinationId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, destinationId);
        const member = await prisma.departmentMember.findFirst({
          where: {
            id: memberId,
            department: { communityId: context.community.id },
          },
          include: { department: { select: { name: true } } },
        });
        if (!member) throw new WorkspaceError("Roster member not found", 404);
        if (member.departmentId === destinationId) {
          throw new WorkspaceError("Choose a different destination department", 400);
        }
        await prisma.$transaction([
          prisma.departmentMember.update({
            where: { id: member.id },
            data: { status: "TRANSFERRED" },
          }),
          prisma.departmentMember.upsert({
            where: {
              departmentId_userId: {
                departmentId: destinationId,
                userId: member.userId,
              },
            },
            create: {
              departmentId: destinationId,
              userId: member.userId,
              rank: "Member",
            },
            update: { status: "ACTIVE" },
          }),
        ]);
        await writeAudit(context, "PERSONNEL_TRANSFERRED", member.id, `Transferred from ${member.department.name}`);
        break;
      }

      case "duty.clockIn": {
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const membership = await prisma.departmentMember.findUnique({
          where: { departmentId_userId: { departmentId, userId: context.userId } },
        });
        if (!membership || !["ACTIVE", "PROBATIONARY"].includes(membership.status)) {
          throw new WorkspaceError("An active department roster membership is required to clock in", 403);
        }
        const subdivisionId = stringValue(input, "subdivisionId", false, 100) || null;
        if (subdivisionId) {
          const subdivision = await prisma.subdivision.findFirst({
            where: { id: subdivisionId, departmentId },
          });
          if (!subdivision) throw new WorkspaceError("Subdivision not found in this department", 404);
        }
        const activeShift = await prisma.dutyShift.findFirst({
          where: { userId: context.userId, endTime: null },
        });
        if (activeShift) throw new WorkspaceError("Clock out of your current shift first", 409);
        const shift = await prisma.dutyShift.create({
            data: {
              userId: context.userId,
              activeUserId: context.userId,
              departmentId,
              subdivisionId,
              callsign: stringValue(input, "callsign", false, 40) || membership.callsign || "UNASSIGNED",
              source: "WEB",
            },
          }).catch((error: unknown) => {
            if (isUniqueConstraintError(error)) {
              throw new WorkspaceError(
                "Another active duty shift already exists for this account",
                409
              );
            }
            throw error;
          });
        await writeAudit(context, "DUTY_CLOCK_IN", shift.id, `Clocked in as ${shift.callsign}`);
        result = { shift };
        break;
      }

      case "duty.clockOut": {
        const shift = await prisma.dutyShift.findFirst({
          where: {
            userId: context.userId,
            endTime: null,
            department: { communityId: context.community.id },
          },
        });
        if (!shift) throw new WorkspaceError("No active shift was found", 404);
        const endTime = new Date();
        const closed = await prisma.dutyShift.updateMany({
          where: { id: shift.id, userId: context.userId, endTime: null },
          data: {
            endTime,
            activeUserId: null,
            durationMinutes: Math.max(0, Math.round((endTime.getTime() - shift.startTime.getTime()) / 60000)),
          },
        });
        if (closed.count !== 1) {
          throw new WorkspaceError("This shift was already ended", 409);
        }
        const updated = await prisma.dutyShift.findUniqueOrThrow({
          where: { id: shift.id },
        });
        await writeAudit(context, "DUTY_CLOCK_OUT", shift.id, "Clocked out of web duty");
        result = { shift: updated };
        break;
      }

      case "duty.adjust": {
        requireManager(context, false);
        const userId = stringValue(input, "userId", true, 100);
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const member = await prisma.departmentMember.findUnique({
          where: { departmentId_userId: { departmentId, userId } },
        });
        if (!member) throw new WorkspaceError("Member is not on this department roster", 404);
        const startTime = validDate(stringValue(input, "startTime"), "startTime");
        const endTime = validDate(stringValue(input, "endTime"), "endTime");
        if (endTime <= startTime || endTime.getTime() - startTime.getTime() > 7 * 86400000) {
          throw new WorkspaceError("The adjusted shift duration must be between 1 minute and 7 days", 400);
        }
        const shift = await prisma.dutyShift.create({
          data: {
            userId,
            departmentId,
            callsign: stringValue(input, "callsign", false, 40) || member.callsign || "ADJUSTED",
            startTime,
            endTime,
            durationMinutes: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
            source: "AUTHORIZED_ADJUSTMENT",
          },
        });
        await writeAudit(context, "HOURS_ADJUSTED", shift.id, "Authorized duty hours adjustment");
        result = { shift };
        break;
      }

      case "loa.create": {
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const member = await prisma.departmentMember.findUnique({
          where: { departmentId_userId: { departmentId, userId: context.userId } },
        });
        if (!member) throw new WorkspaceError("You must be on the department roster to request leave", 403);
        const startDate = validDate(stringValue(input, "startDate"), "startDate");
        const endDate = validDate(stringValue(input, "endDate"), "endDate");
        if (startDate > endDate || endDate.getTime() - startDate.getTime() > 366 * 86400000) {
          throw new WorkspaceError("Choose a valid leave period of no more than one year", 400);
        }
        const reason = stringValue(input, "reason", true, 2000);
        const overlap = await prisma.leaveOfAbsence.findFirst({
          where: {
            userId: context.userId,
            status: { in: ["PENDING", "APPROVED"] },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });
        if (overlap) throw new WorkspaceError("You already have a pending or approved leave request for those dates", 409);
        const leave = await prisma.leaveOfAbsence.create({
          data: { userId: context.userId, departmentId, startDate, endDate, reason },
        });
        await enqueueDiscordNotice(prisma, {
          communityId: context.community.id,
          departmentId,
          eventKey: `leave:${leave.id}:submitted`,
          type: "leave",
          content: "A leave request is waiting for review.",
        });
        const commandMembers = await prisma.communityMember.findMany({
          where: {
            communityId: context.community.id,
            isActive: true,
            role: { in: ["OWNER", "HIGH_COMMAND", "SUPERVISOR"] },
          },
          select: { userId: true },
        });
        await prisma.notification.createMany({
          data: commandMembers.map((member) => ({
            communityId: context.community.id,
            userId: member.userId,
            title: "New leave request",
            message: `${context.userName} submitted a leave request for review.`,
          })),
        });
        await writeAudit(context, "LOA_REQUESTED", leave.id, "Leave of absence requested");
        result = { leave };
        break;
      }

      case "loa.review": {
        requireManager(context, false);
        const leaveId = stringValue(input, "leaveId", true, 100);
        const decision = stringValue(input, "decision", true, 20).toUpperCase();
        if (!["APPROVED", "DENIED"].includes(decision)) {
          throw new WorkspaceError("Decision must be APPROVED or DENIED", 400);
        }
        const leave = await prisma.leaveOfAbsence.findFirst({
          where: {
            id: leaveId,
            department: { communityId: context.community.id },
            status: "PENDING",
          },
        });
        if (!leave) throw new WorkspaceError("Pending leave request not found", 404);
        const updated = await prisma.$transaction(async (transaction) => {
          const current = await transaction.leaveOfAbsence.update({
            where: { id: leave.id },
            data: {
              status: decision,
              reviewedBy: context.userId,
              reviewNotes: stringValue(input, "notes", false, 1000) || null,
            },
          });
          if (decision === "APPROVED" && leave.departmentId) {
            await transaction.departmentMember.updateMany({
              where: {
                departmentId: leave.departmentId,
                userId: leave.userId,
                status: "ACTIVE",
              },
              data: { status: "LOA" },
            });
          }
          return current;
        });
        await prisma.notification.create({
          data: {
            communityId: context.community.id,
            userId: leave.userId,
            title: `Leave request ${decision.toLowerCase()}`,
            message: `Your leave request was ${decision.toLowerCase()}.`,
          },
        });
        await writeAudit(context, `LOA_${decision}`, leave.id, `Leave request ${decision.toLowerCase()}`);
        result = { leave: updated };
        break;
      }

      case "sop.create": {
        requireManager(context, false);
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const title = stringValue(input, "title", true, 150);
        const content = stringValue(input, "content", true, 20000);
        const version = "1.0";
        const sop = await prisma.$transaction(async (transaction) => {
          const created = await transaction.standardOperatingProcedure.create({
            data: {
              departmentId,
              subdivisionId: stringValue(input, "subdivisionId", false, 100) || null,
              title,
              category: stringValue(input, "category", true, 100),
              content,
              requireSignOff:
                input.requireSignOff !== false && input.requireSignOff !== "false",
              version,
            },
          });
          await transaction.sOPVersion.create({
            data: { sopId: created.id, version, content, editorId: context.userId },
          });
          return created;
        });
        await writeAudit(context, "SOP_CREATED", sop.id, `Created SOP: ${title}`);
        result = { sop };
        break;
      }

      case "sop.update": {
        requireManager(context, false);
        const sopId = stringValue(input, "sopId", true, 100);
        const sop = await prisma.standardOperatingProcedure.findFirst({
          where: { id: sopId, department: { communityId: context.community.id } },
        });
        if (!sop) throw new WorkspaceError("SOP not found", 404);
        const content = stringValue(input, "content", true, 20000);
        const changeNotes = stringValue(input, "changeNotes", false, 1000);
        const versionMatch = /^(\d+)\.(\d+)$/.exec(sop.version);
        const nextVersion = versionMatch
          ? `${versionMatch[1]}.${Number(versionMatch[2]) + 1}`
          : "1.1";
        const updated = await prisma.$transaction(async (transaction) => {
          const current = await transaction.standardOperatingProcedure.update({
            where: { id: sop.id },
            data: { content, version: nextVersion },
          });
          await transaction.sOPVersion.create({
            data: {
              sopId: sop.id,
              version: nextVersion,
              content,
              changeNotes: changeNotes || null,
              editorId: context.userId,
            },
          });
          if (sop.requireSignOff) {
            const members = await transaction.departmentMember.findMany({
              where: { departmentId: sop.departmentId, status: "ACTIVE" },
              select: { userId: true },
            });
            await transaction.notification.createMany({
              data: members.map((member) => ({
                communityId: context.community.id,
                userId: member.userId,
                title: "SOP updated",
                message: `${sop.title} updated to version ${nextVersion}; please review and acknowledge it.`,
              })),
            });
          }
          return current;
        });
        await writeAudit(context, "SOP_UPDATED", sop.id, `Updated SOP to version ${nextVersion}`);
        result = { sop: updated };
        break;
      }

      case "sop.acknowledge": {
        const sopId = stringValue(input, "sopId", true, 100);
        const sop = await prisma.standardOperatingProcedure.findFirst({
          where: { id: sopId, department: { communityId: context.community.id } },
        });
        if (!sop) throw new WorkspaceError("SOP not found", 404);
        const member = await prisma.departmentMember.findUnique({
          where: {
            departmentId_userId: {
              departmentId: sop.departmentId,
              userId: context.userId,
            },
          },
        });
        if (!member) throw new WorkspaceError("Department membership is required", 403);
        const acknowledgement = await prisma.sOPAcknowledgement.upsert({
          where: {
            sopId_version_userId: {
              sopId: sop.id,
              version: sop.version,
              userId: context.userId,
            },
          },
          create: { sopId: sop.id, version: sop.version, userId: context.userId },
          update: {},
        });
        await writeAudit(context, "SOP_ACKNOWLEDGED", sop.id, `Acknowledged version ${sop.version}`);
        result = { acknowledgement };
        break;
      }

      case "application.form.create": {
        requireManager(context, false);
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const rawQuestions = input.questions;
        if (!Array.isArray(rawQuestions) || rawQuestions.length > 50) {
          throw new WorkspaceError("Provide up to 50 application questions", 400);
        }
        const form = await prisma.applicationForm.create({
          data: {
            communityId: context.community.id,
            departmentId,
            title: stringValue(input, "title", true, 150),
            description: stringValue(input, "description", false, 1000) || null,
            questionsJson: JSON.stringify(rawQuestions),
            autoScore: input.autoScore === true,
          },
        });
        await writeAudit(context, "APPLICATION_FORM_CREATED", form.id, `Created form: ${form.title}`);
        result = { form };
        break;
      }

      case "application.submit": {
        const formId = stringValue(input, "formId", true, 100);
        const form = await prisma.applicationForm.findFirst({
          where: { id: formId, communityId: context.community.id, isOpen: true },
        });
        if (!form) throw new WorkspaceError("Open application form not found", 404);
        const questions = jsonValue<Array<Record<string, unknown>>>(form.questionsJson, []);
        const answers = input.answers;
        if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
          throw new WorkspaceError("Application answers must be provided", 400);
        }
        const answersJson = JSON.stringify(answers);
        if (answersJson.length > 20000) throw new WorkspaceError("Application is too long", 400);
        let score: number | null = null;
        if (form.autoScore && questions.length > 0) {
          const answerValues = answers as Record<string, unknown>;
          const scored = questions.filter(
            (question) =>
              typeof question.id === "string" && typeof question.correctAnswer === "string"
          );
          if (scored.length > 0) {
            const correct = scored.filter(
              (question) =>
                String(answerValues[String(question.id)] ?? "").trim().toLowerCase() ===
                String(question.correctAnswer).trim().toLowerCase()
            ).length;
            score = Math.round((correct / scored.length) * 100);
          }
        }
        const user = await prisma.user.findUnique({
          where: { id: context.userId },
          select: { name: true, discordId: true },
        });
        const application = await prisma.application.create({
          data: {
            departmentId: form.departmentId,
            applicantUserId: context.userId,
            applicantDiscordId: user?.discordId ?? context.userId,
            applicantName: user?.name ?? context.userName,
            answersJson,
            score,
          },
        });
        await enqueueDiscordNotice(prisma, {
          communityId: context.community.id,
          departmentId: form.departmentId,
          eventKey: `application:${application.id}:submitted`,
          type: "application",
          content: "A new application is waiting for review.",
        });
        await writeAudit(context, "APPLICATION_SUBMITTED", application.id, `Submitted to ${form.title}`);
        result = { application };
        break;
      }

      case "application.review": {
        requireManager(context, false);
        const applicationId = stringValue(input, "applicationId", true, 100);
        const status = stringValue(input, "status", true, 30).toUpperCase();
        if (!APPLICATION_STATUSES.includes(status)) {
          throw new WorkspaceError("Invalid application decision", 400);
        }
        const application = await prisma.application.findFirst({
          where: { id: applicationId, department: { communityId: context.community.id } },
        });
        if (!application) throw new WorkspaceError("Application not found", 404);
        const notes = stringValue(input, "notes", false, 2000) || null;
        const updated = await prisma.$transaction(async (transaction) => {
          const current = await transaction.application.update({
            where: { id: application.id },
            data: { status, stage: status, reviewerId: context.userId, reviewerNotes: notes },
          });
          await transaction.applicationReview.create({
            data: {
              applicationId: application.id,
              reviewerId: context.userId,
              stage: status,
              decision: status,
              notes,
            },
          });
          return current;
        });
        if (application.applicantUserId) {
          await prisma.notification.create({
            data: {
              communityId: context.community.id,
              userId: application.applicantUserId,
              title: "Application status updated",
              message: `Your application status changed to ${status.toLowerCase()}.`,
            },
          });
        }
        await writeAudit(context, "APPLICATION_REVIEWED", application.id, `Application moved to ${status}`);
        result = { application: updated };
        break;
      }

      case "training.course.create": {
        requireManager(context, false);
        const departmentId = stringValue(input, "departmentId", false, 100) || null;
        if (departmentId) await assertDepartmentAccess(context, departmentId);
        const subdivisionId = stringValue(input, "subdivisionId", false, 100) || null;
        if (subdivisionId) {
          const subdivision = await prisma.subdivision.findFirst({
            where: { id: subdivisionId, department: { communityId: context.community.id } },
          });
          if (!subdivision) throw new WorkspaceError("Subdivision not found", 404);
        }
        const course = await prisma.trainingCourse.create({
          data: {
            communityId: context.community.id,
            departmentId,
            subdivisionId,
            title: stringValue(input, "title", true, 150),
            description: stringValue(input, "description", false, 2000) || null,
            certification: stringValue(input, "certification", false, 100) || null,
            required: input.required === true,
          },
        });
        await writeAudit(context, "TRAINING_COURSE_CREATED", course.id, `Created ${course.title}`);
        result = { course };
        break;
      }

      case "training.record": {
        requireManager(context, false);
        const courseId = stringValue(input, "courseId", true, 100);
        const course = await prisma.trainingCourse.findFirst({
          where: { id: courseId, communityId: context.community.id },
        });
        if (!course) throw new WorkspaceError("Training course not found", 404);
        const userId = stringValue(input, "userId", true, 100);
        const member = await prisma.communityMember.findFirst({
          where: { userId, communityId: context.community.id, isActive: true },
        });
        if (!member) throw new WorkspaceError("Member is not in this community", 404);
        const record = await prisma.trainingRecord.create({
          data: {
            courseId,
            userId,
            certifiedById: context.userId,
            status: "COMPLETED",
            expiresAt: input.expiresAt
              ? validDate(String(input.expiresAt), "expiresAt")
              : null,
            notes: stringValue(input, "notes", false, 1000) || null,
          },
        });
        await prisma.notification.create({
          data: {
            communityId: context.community.id,
            userId,
            title: "Training record updated",
            message: `${course.title} has been recorded on your training profile.`,
          },
        });
        await writeAudit(context, "TRAINING_COMPLETED", record.id, `Recorded training for ${userId}`);
        result = { record };
        break;
      }

      case "ia.case.create": {
        requireIACommandAccess(context);
        const title = stringValue(input, "title", true, 150);
        const subjectUserId = stringValue(input, "subjectUserId", false, 100) || null;
        if (subjectUserId) {
          const subject = await prisma.communityMember.findFirst({
            where: { userId: subjectUserId, communityId: context.community.id, isActive: true },
          });
          if (!subject) throw new WorkspaceError("Subject is not a community member", 404);
        }
        const investigatorUserId =
          stringValue(input, "investigatorUserId", false, 100) || context.userId;
        const investigator = await prisma.communityMember.findFirst({
          where: {
            userId: investigatorUserId,
            communityId: context.community.id,
            isActive: true,
          },
        });
        if (!investigator) throw new WorkspaceError("Investigator is not a community member", 404);
        const caseNumber = `IA-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${randomUUID().slice(0, 5).toUpperCase()}`;
        const investigation = await prisma.investigationCase.create({
          data: {
            communityId: context.community.id,
            caseNumber,
            title,
            allegations: stringValue(input, "allegations", true, 5000),
            subjectUserId,
            investigatorUserId,
          },
        });
        await writeAudit(context, "IA_CASE_CREATED", investigation.id, `Created confidential case ${caseNumber}`);
        result = { investigation };
        break;
      }

      case "ia.case.update": {
        requireIACommandAccess(context);
        const caseId = stringValue(input, "caseId", true, 100);
        const investigation = await prisma.investigationCase.findFirst({
          where: { id: caseId, communityId: context.community.id },
        });
        if (!investigation) throw new WorkspaceError("Investigation not found", 404);
        const status = stringValue(input, "status", true, 40).toUpperCase();
        if (!["OPEN", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED", "UNSUBSTANTIATED"].includes(status)) {
          throw new WorkspaceError("Invalid investigation status", 400);
        }
        const investigatorUserId =
          stringValue(input, "investigatorUserId", false, 100) || investigation.investigatorUserId;
        if (investigatorUserId) {
          const investigator = await prisma.communityMember.findFirst({
            where: {
              userId: investigatorUserId,
              communityId: context.community.id,
              isActive: true,
            },
          });
          if (!investigator) throw new WorkspaceError("Investigator is not a community member", 404);
        }
        const updated = await prisma.investigationCase.update({
          where: { id: investigation.id },
          data: {
            status,
            investigatorUserId,
            finding: stringValue(input, "finding", false, 5000) || null,
            outcome: stringValue(input, "outcome", false, 5000) || null,
          },
        });
        await writeAudit(context, "IA_CASE_UPDATED", investigation.id, `Investigation status changed to ${status}`);
        result = { investigation: updated };
        break;
      }

      case "ia.case.entry": {
        requireIAAccess(context);
        const caseId = stringValue(input, "caseId", true, 100);
        const investigation = await prisma.investigationCase.findFirst({
          where: { id: caseId, communityId: context.community.id },
        });
        if (!investigation) throw new WorkspaceError("Investigation not found", 404);
        if (
          context.community.ownerId !== context.userId &&
          context.membership.role === "INVESTIGATOR" &&
          investigation.investigatorUserId !== context.userId
        ) {
          throw new WorkspaceError("This investigation is not assigned to you", 403);
        }
        const type = stringValue(input, "type", true, 30).toUpperCase();
        if (!["NOTE", "INTERVIEW", "EVIDENCE", "FINDING"].includes(type)) {
          throw new WorkspaceError("Invalid investigation entry type", 400);
        }
        const referenceUrl = stringValue(input, "referenceUrl", false, 2000);
        if (referenceUrl) {
          let parsed: URL;
          try {
            parsed = new URL(referenceUrl);
          } catch {
            throw new WorkspaceError("Evidence reference must be a valid URL", 400);
          }
          if (!["https:", "http:"].includes(parsed.protocol)) {
            throw new WorkspaceError("Evidence reference must use HTTP or HTTPS", 400);
          }
        }
        const entry = await prisma.investigationEntry.create({
          data: {
            caseId,
            createdById: context.userId,
            type,
            content: stringValue(input, "content", true, 10000),
            referenceUrl: referenceUrl || null,
          },
        });
        await writeAudit(context, "IA_CASE_ENTRY_ADDED", investigation.id, `Added ${type.toLowerCase()} record`);
        result = { entry };
        break;
      }

      case "discipline.create": {
        requireHighCommand(context);
        const departmentId = stringValue(input, "departmentId", true, 100);
        await assertDepartmentAccess(context, departmentId);
        const subjectId = stringValue(input, "subjectId", true, 100);
        const member = await prisma.departmentMember.findFirst({
          where: {
            departmentId,
            userId: subjectId,
            status: { not: "TRANSFERRED" },
          },
        });
        if (!member) {
          throw new WorkspaceError("Select a member on this department roster", 400);
        }
        const type = stringValue(input, "type", true, 30).toUpperCase();
        if (!["WARNING", "REPRIMAND", "SUSPENSION", "DEMOTION", "OTHER"].includes(type)) {
          throw new WorkspaceError("Invalid disciplinary action type", 400);
        }
        const expiresAt = stringValue(input, "expiresAt", false, 40);
        const record = await prisma.disciplinaryRecord.create({
          data: {
            departmentId,
            subjectId,
            issuerId: context.userId,
            type,
            title: stringValue(input, "title", true, 150),
            details: stringValue(input, "details", true, 5000),
            expiresAt: expiresAt ? validDate(expiresAt, "expiresAt") : null,
          },
        });
        await prisma.notification.create({
          data: {
            communityId: context.community.id,
            userId: subjectId,
            title: "Disciplinary record added",
            message: `A ${type.toLowerCase()} has been recorded on your personnel file.`,
          },
        });
        await writeAudit(context, "DISCIPLINE_ISSUED", record.id, `Issued ${type.toLowerCase()} record`);
        result = { record };
        break;
      }

      case "discipline.pardon": {
        requireHighCommand(context);
        const recordId = stringValue(input, "recordId", true, 100);
        const record = await prisma.disciplinaryRecord.findFirst({
          where: {
            id: recordId,
            department: { communityId: context.community.id },
            status: "ACTIVE",
          },
        });
        if (!record) throw new WorkspaceError("Active disciplinary record not found", 404);
        const updated = await prisma.disciplinaryRecord.update({
          where: { id: record.id },
          data: {
            status: "PARDONED",
            pardonedAt: new Date(),
            pardonNotes: stringValue(input, "notes", false, 1000) || null,
          },
        });
        await writeAudit(context, "DISCIPLINE_PARDONED", record.id, "Disciplinary record pardoned");
        result = { record: updated };
        break;
      }

      case "inactivity.audit": {
        requireHighCommand(context);
        const weekEnd = getWeekStart();
        const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
        const policy = await prisma.inactivityPolicy.findUnique({
          where: { communityId: context.community.id },
        });
        if (
          Date.now() <
          weekEnd.getTime() + (policy?.gracePeriodDays ?? 0) * 86400000
        ) {
          throw new WorkspaceError(
            "The previous week is still within its grace period",
            409
          );
        }
        const departments = await prisma.department.findMany({
          where: { communityId: context.community.id },
          include: {
            members: {
              where: { status: { in: ["ACTIVE", "PROBATIONARY", "LOA"] } },
              include: { user: { select: { id: true, name: true } } },
            },
          },
        });
        const created: string[] = [];
        for (const department of departments) {
          for (const member of department.members) {
            if (member.inactivityExempt) continue;
            const communityMembership = await prisma.communityMember.findFirst({
              where: {
                userId: member.userId,
                communityId: context.community.id,
                isActive: true,
              },
              select: { joinedAt: true },
            });
            if (
              policy &&
              communityMembership &&
              Date.now() - communityMembership.joinedAt.getTime() <
                policy.gracePeriodDays * 86400000
            ) {
              continue;
            }
            const leave = await prisma.leaveOfAbsence.findMany({
              where: {
                userId: member.userId,
                departmentId: department.id,
                status: "APPROVED",
                startDate: { lt: weekEnd },
                endDate: { gte: weekStart },
              },
              select: { startDate: true, endDate: true },
            });
            const excusedDays = new Set<string>();
            for (const item of leave) {
              const from = new Date(Math.max(item.startDate.getTime(), weekStart.getTime()));
              const to = new Date(Math.min(item.endDate.getTime(), weekEnd.getTime() - 1));
              for (let day = new Date(from); day <= to; day.setUTCDate(day.getUTCDate() + 1)) {
                excusedDays.add(day.toISOString().slice(0, 10));
              }
            }
            const hoursRequired =
              department.weeklyQuotaHours * ((7 - excusedDays.size) / 7);
            if (hoursRequired <= 0) continue;
            const shifts = await prisma.dutyShift.findMany({
              where: {
                userId: member.userId,
                departmentId: department.id,
                startTime: { lt: weekEnd },
                OR: [{ endTime: null }, { endTime: { gte: weekStart } }],
              },
              select: { startTime: true, endTime: true, durationMinutes: true },
            });
            const hoursLogged =
              shifts.reduce(
                (sum, shift) => {
                  const start = Math.max(shift.startTime.getTime(), weekStart.getTime());
                  const end = Math.min(
                    shift.endTime?.getTime() ?? weekEnd.getTime(),
                    weekEnd.getTime()
                  );
                  return sum + Math.max(0, Math.round((end - start) / 60000));
                },
                0
              ) / 60;
            if (hoursLogged >= hoursRequired) continue;
            const existing = await prisma.inactivityStrike.findFirst({
              where: {
                officerId: member.userId,
                departmentId: department.id,
                weekStartDate: weekStart,
              },
            });
            if (existing) continue;
            const priorStrikes = await prisma.inactivityStrike.count({
              where: {
                officerId: member.userId,
                departmentId: department.id,
                status: "CONFIRMED",
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            });
            const occurrence = priorStrikes + 1;
            if (occurrence < (policy?.warningThreshold ?? 1)) continue;
            const strikeLevel =
              occurrence >= (policy?.strikeThreshold ?? 2) ? 2 : 1;
            const strike = await prisma.inactivityStrike.create({
              data: {
                officerId: member.userId,
                departmentId: department.id,
                commanderId: context.userId,
                weekStartDate: weekStart,
                hoursLogged: Math.round(hoursLogged * 100) / 100,
                hoursRequired: Math.round(hoursRequired * 100) / 100,
                strikeLevel,
                status:
                  policy?.autoApplyWarnings && strikeLevel === 1
                    ? "CONFIRMED"
                    : "DRAFT",
                expiresAt: policy
                  ? new Date(Date.now() + policy.strikeExpiryDays * 86400000)
                  : new Date(Date.now() + 90 * 86400000),
              },
            });
            created.push(strike.id);
            await enqueueDiscordNotice(prisma, {
              communityId: context.community.id,
              departmentId: department.id,
              eventKey: `inactivity:${strike.id}:review`,
              type: "inactivity",
              content: "An inactivity item is waiting for supervisor review.",
            });
            const supervisors = await prisma.communityMember.findMany({
              where: {
                communityId: context.community.id,
                isActive: true,
                role: { in: ["OWNER", "HIGH_COMMAND", "SUPERVISOR"] },
              },
              select: { userId: true },
            });
            await prisma.notification.createMany({
              data: supervisors.map((supervisor) => ({
                communityId: context.community.id,
                userId: supervisor.userId,
                title: "Inactivity review item",
                message: `${member.user.name || "A member"} is below the weekly hours requirement in ${department.name}.`,
              })),
            });
          }
        }
        await writeAudit(context, "INACTIVITY_AUDIT_RUN", null, `Created ${created.length} review items`);
        result = { created: created.length };
        break;
      }

      case "inactivity.strike": {
        requireHighCommand(context);
        const strikeId = stringValue(input, "strikeId", true, 100);
        const decision = stringValue(input, "decision", true, 20).toUpperCase();
        if (!["CONFIRMED", "PARDONED"].includes(decision)) {
          throw new WorkspaceError("Decision must be CONFIRMED or PARDONED", 400);
        }
        const strike = await prisma.inactivityStrike.findFirst({
          where: {
            id: strikeId,
            department: { communityId: context.community.id },
            status: "DRAFT",
          },
        });
        if (!strike) throw new WorkspaceError("Draft inactivity record not found", 404);
        const updated = await prisma.inactivityStrike.update({
          where: { id: strike.id },
          data: {
            status: decision,
            commanderId: context.userId,
            commandNotes: stringValue(input, "notes", false, 1000) || null,
            pardonedAt: decision === "PARDONED" ? new Date() : null,
          },
        });
        await prisma.notification.create({
          data: {
            communityId: context.community.id,
            userId: strike.officerId,
            title: decision === "CONFIRMED" ? "Inactivity warning issued" : "Inactivity record pardoned",
            message:
              decision === "CONFIRMED"
                ? "A weekly inactivity review was confirmed on your personnel record."
                : "A weekly inactivity review was pardoned.",
          },
        });
        await writeAudit(context, `INACTIVITY_${decision}`, strike.id, `Inactivity item ${decision.toLowerCase()}`);
        result = { strike: updated };
        break;
      }

      case "inactivity.policy": {
        requireHighCommand(context);
        const weeklyQuotaHours = numberValue(input, "weeklyQuotaHours", 0, 168);
        const warningThreshold = integerValue(input, "warningThreshold", 1, 20);
        const strikeThreshold = integerValue(input, "strikeThreshold", 1, 20);
        if (strikeThreshold < warningThreshold) {
          throw new WorkspaceError("Strike threshold must be at least the warning threshold", 400);
        }
        const gracePeriodDays = integerValue(input, "gracePeriodDays", 0, 365);
        const strikeExpiryDays = integerValue(input, "strikeExpiryDays", 1, 3650);
        const policy = await prisma.inactivityPolicy.upsert({
          where: { communityId: context.community.id },
          create: {
            communityId: context.community.id,
            weeklyQuotaHours,
            warningThreshold,
            strikeThreshold,
            gracePeriodDays,
            strikeExpiryDays,
            autoApplyWarnings:
              input.autoApplyWarnings === true || input.autoApplyWarnings === "on",
          },
          update: {
            weeklyQuotaHours,
            warningThreshold,
            strikeThreshold,
            gracePeriodDays,
            strikeExpiryDays,
            autoApplyWarnings:
              input.autoApplyWarnings === true || input.autoApplyWarnings === "on",
          },
        });
        await writeAudit(context, "INACTIVITY_POLICY_UPDATED", policy.id, "Inactivity settings changed");
        result = { policy };
        break;
      }

      case "settings.update": {
        if (context.community.ownerId !== context.userId) {
          throw new WorkspaceError("Only the workspace owner can change community settings", 403);
        }
        const gamePreset = stringValue(input, "gamePreset", true, 40).toUpperCase();
        if (!PRESETS.includes(gamePreset)) throw new WorkspaceError("Unknown game preset", 400);
        const customTerminology = jsonValue<unknown>(input.customTerminology, {});
        const permissionConfig = jsonValue<unknown>(input.permissionConfig, {});
        const mainDiscordGuildId =
          stringValue(input, "mainDiscordGuildId", false, 20) || null;
        if (mainDiscordGuildId && !isDiscordSnowflake(mainDiscordGuildId)) {
          throw new WorkspaceError("Enter a valid Discord server ID", 400);
        }
        if (mainDiscordGuildId) {
          const [mappedElsewhere, existingMapping, localDepartmentMapping] = await Promise.all([
            prisma.community.findFirst({
              where: {
                mainDiscordGuildId,
                id: { not: context.community.id },
              },
              select: { id: true },
            }),
            prisma.connectedServer.findFirst({
              where: {
                guildId: mainDiscordGuildId,
                communityId: { not: context.community.id },
              },
              select: { id: true },
            }),
            prisma.connectedServer.findFirst({
              where: {
                guildId: mainDiscordGuildId,
                communityId: context.community.id,
                kind: "DEPARTMENT",
              },
              select: { id: true },
            }),
          ]);
          if (localDepartmentMapping) {
            throw new WorkspaceError(
              "This Discord server is already connected as a department server",
              409
            );
          }
          if (mappedElsewhere || existingMapping) {
            throw new WorkspaceError(
              "This Discord server is already mapped to another community",
              409
            );
          }
        }
        if (
          context.community.mainDiscordGuildId &&
          context.community.mainDiscordGuildId !== mainDiscordGuildId
        ) {
          await prisma.connectedServer.updateMany({
            where: {
              communityId: context.community.id,
              guildId: context.community.mainDiscordGuildId,
              kind: "MAIN",
            },
            data: { botEnabled: false },
          });
        }
        const community = await prisma.community.update({
          where: { id: context.community.id },
          data: {
            gamePreset,
            customTerminologyJson: JSON.stringify(customTerminology),
            permissionConfigJson: JSON.stringify(permissionConfig),
            mainDiscordGuildId,
          },
        });
        await writeAudit(context, "COMMUNITY_SETTINGS_UPDATED", community.id, `Preset changed to ${gamePreset}`);
        result = { community };
        break;
      }

      case "discord.link.complete": {
        const code = stringValue(input, "code", true, 12);
        if (!/^[A-Za-z0-9_-]{12}$/.test(code)) {
          throw new WorkspaceError("Enter the unexpired code shown by the Discord bot", 400);
        }
        const codeHash = sha256(code);
        await prisma.$transaction(async (transaction) => {
          const linkCode = await transaction.discordLinkCode.findFirst({
            where: { codeHash, expiresAt: { gt: new Date() } },
            select: { id: true, discordId: true },
          });
          if (!linkCode) {
            throw new WorkspaceError("That Discord link code is invalid or expired", 400);
          }
          const user = await transaction.user.findUnique({
            where: { id: context.userId },
            select: { discordId: true },
          });
          if (user?.discordId && user.discordId !== linkCode.discordId) {
            throw new WorkspaceError(
              "This RPManager account is already linked to a different Discord account",
              409
            );
          }
          const existingOwner = await transaction.user.findUnique({
            where: { discordId: linkCode.discordId },
            select: { id: true },
          });
          if (existingOwner && existingOwner.id !== context.userId) {
            throw new WorkspaceError(
              "That Discord account is already linked to another RPManager account",
              409
            );
          }
          await transaction.user.update({
            where: { id: context.userId },
            data: { discordId: linkCode.discordId },
          });
          const consumed = await transaction.discordLinkCode.deleteMany({
            where: { id: linkCode.id, expiresAt: { gt: new Date() } },
          });
          if (consumed.count !== 1) {
            throw new WorkspaceError("That Discord link code has already been used", 409);
          }
          await transaction.auditLog.create({
            data: {
              communityId: context.community.id,
              actorId: context.userId,
              actorName: context.userName,
              action: "DISCORD_ACCOUNT_LINKED",
              targetId: context.userId,
              details: "Linked a Discord account using a one-time bot code",
            },
          });
        });
        result = { linked: true };
        break;
      }

      case "server.bot-config.update": {
        if (context.community.ownerId !== context.userId) {
          throw new WorkspaceError("Only the workspace owner can configure Discord bot settings", 403);
        }
        const guildId = stringValue(input, "guildId", true, 20);
        if (!isDiscordSnowflake(guildId)) {
          throw new WorkspaceError("Enter a valid Discord server ID", 400);
        }
        const server = await prisma.connectedServer.findFirst({
          where: { communityId: context.community.id, guildId },
        });
        if (!server) throw new WorkspaceError("Connect this Discord server first", 404);
        const notificationChannelId =
          stringValue(input, "notificationChannelId", false, 20) || null;
        if (notificationChannelId && !isDiscordSnowflake(notificationChannelId)) {
          throw new WorkspaceError("Enter a valid notification channel ID", 400);
        }
        const rawRoleIds = input.supervisorRoleIds;
        const supervisorRoleIds =
          typeof rawRoleIds === "string"
            ? rawRoleIds.split(",").map((roleId) => roleId.trim()).filter(Boolean)
            : rawRoleIds;
        if (
          !Array.isArray(supervisorRoleIds) ||
          supervisorRoleIds.length > 50 ||
          !supervisorRoleIds.every(isDiscordSnowflake)
        ) {
          throw new WorkspaceError("Supervisor role IDs must be valid Discord IDs", 400);
        }
        const notifyLeave = booleanValue(input, "notifyLeave");
        const notifyApplications = booleanValue(input, "notifyApplications");
        const notifyInactivity = booleanValue(input, "notifyInactivity");
        const botEnabled = booleanValue(input, "botEnabled");
        if (
          (notifyLeave || notifyApplications || notifyInactivity) &&
          !notificationChannelId
        ) {
          throw new WorkspaceError(
            "Set a notification channel before enabling notifications",
            400
          );
        }
        if (
          botEnabled &&
          (!process.env.DISCORD_BOT_SERVICE_SECRET ||
            process.env.DISCORD_BOT_SERVICE_SECRET.length < 32)
        ) {
          throw new WorkspaceError(
            "Configure the Discord bot service secret on the website server before enabling the bot",
            503
          );
        }
        if (
          botEnabled &&
          (!process.env.DISCORD_APPLICATION_ID ||
            !isDiscordSnowflake(process.env.DISCORD_APPLICATION_ID))
        ) {
          throw new WorkspaceError(
            "Configure the Discord application ID on the website server before enabling the bot",
            503
          );
        }
        const updated = await prisma.connectedServer.update({
          where: { id: server.id },
          data: {
            botEnabled,
            supervisorRoleIdsJson: JSON.stringify(supervisorRoleIds),
            notificationChannelId,
            notifyLeave,
            notifyApplications,
            notifyInactivity,
          },
        });
        await writeAudit(
          context,
          "DISCORD_BOT_CONFIG_UPDATED",
          server.id,
          `Updated Discord bot settings (enabled: ${botEnabled}; leave: ${notifyLeave}; applications: ${notifyApplications}; inactivity: ${notifyInactivity})`
        );
        result = { server: updated };
        break;
      }

      case "discord.sync": {
        const account = await prisma.account.findFirst({
          where: { userId: context.userId, provider: "discord" },
          select: { access_token: true, expires_at: true },
        });
        if (!account?.access_token) {
          throw new WorkspaceError("Connect your Discord account using Discord sign-in first", 409);
        }
        if (account.expires_at && account.expires_at <= Math.floor(Date.now() / 1000)) {
          throw new WorkspaceError("Your Discord authorization has expired. Sign out and sign in again to reconnect.", 409);
        }

        const guildIds = new Set<string>();
        if (context.community.mainDiscordGuildId) {
          guildIds.add(context.community.mainDiscordGuildId);
        }
        const linkedDepartments = await prisma.department.findMany({
          where: {
            communityId: context.community.id,
            discordGuildId: { not: null },
          },
        });
        const configuredServers = await prisma.connectedServer.findMany({
          where: {
            communityId: context.community.id,
            kind: "DEPARTMENT",
            departmentId: { not: null },
          },
        });
        for (const department of linkedDepartments) {
          if (department.discordGuildId) guildIds.add(department.discordGuildId);
        }
        for (const server of configuredServers) guildIds.add(server.guildId);

        const memberRoles = new Map<string, string[] | null>();
        for (const guildId of guildIds) {
          const response = await fetch(
            `https://discord.com/api/v10/users/@me/guilds/${encodeURIComponent(guildId)}/member`,
            {
              headers: { Authorization: `Bearer ${account.access_token}` },
              cache: "no-store",
            }
          );
          if (response.status === 404) {
            memberRoles.set(guildId, null);
            continue;
          }
          if (!response.ok) {
            throw new WorkspaceError(
              response.status === 403
                ? "Discord denied member access. Reconnect with the guilds.members.read scope."
                : "Discord could not verify server membership",
              502
            );
          }
          const guildMember: unknown = await response.json();
          if (
            !guildMember ||
            typeof guildMember !== "object" ||
            !("roles" in guildMember) ||
            !Array.isArray(guildMember.roles) ||
            !guildMember.roles.every((role) => typeof role === "string")
          ) {
            throw new WorkspaceError("Discord returned an unexpected membership response", 502);
          }
          memberRoles.set(guildId, guildMember.roles);
        }

        const mainGuildId = context.community.mainDiscordGuildId;
        const mainGuildRoles = mainGuildId ? memberRoles.get(mainGuildId) : undefined;
        const mainRoles = mainGuildRoles ?? [];
        await prisma.communityMember.update({
          where: {
            communityId_userId: {
              communityId: context.community.id,
              userId: context.userId,
            },
          },
          data: {
            discordMainMember:
              mainGuildId && mainGuildRoles !== undefined
                ? mainGuildRoles !== null
                : null,
            discordRoleIdsJson: JSON.stringify(mainRoles),
            discordSyncedAt: new Date(),
          },
        });
        const departmentsWithLinks = new Map(
          linkedDepartments.map((department) => [department.id, department])
        );
        for (const server of configuredServers) {
          if (!server.departmentId || !departmentsWithLinks.has(server.departmentId)) {
            const department = server.departmentId
              ? await prisma.department.findFirst({
                  where: {
                    id: server.departmentId,
                    communityId: context.community.id,
                  },
                })
              : null;
            if (department) departmentsWithLinks.set(department.id, department);
          }
        }
        const linkedGuilds = new Map<string, Set<string>>();
        for (const department of departmentsWithLinks.values()) {
          const guilds = linkedGuilds.get(department.id) ?? new Set<string>();
          if (department.discordGuildId) guilds.add(department.discordGuildId);
          for (const server of configuredServers) {
            if (server.departmentId === department.id) guilds.add(server.guildId);
          }
          linkedGuilds.set(department.id, guilds);
        }
        for (const department of departmentsWithLinks.values()) {
          const mappings = jsonValue<Record<string, string>>(
            department.discordRoleMappingsJson,
            {}
          );
          const guilds = linkedGuilds.get(department.id) ?? new Set<string>();
          const roles = [...guilds]
            .flatMap((guildId) => memberRoles.get(guildId) ?? [])
            .filter((roleId) => roleId.length > 0);
          const matchedRank = roles
            .map((roleId) => mappings[roleId])
            .find((rank): rank is string => typeof rank === "string");
          const isLinkedServerMember = [...guilds].some(
            (guildId) => memberRoles.get(guildId) !== undefined && memberRoles.get(guildId) !== null
          );
          const hasConfiguredRankMappings = Object.keys(mappings).length > 0;
          const hasMappedRole = hasConfiguredRankMappings
            ? Boolean(matchedRank)
            : !department.discordRoleId || roles.includes(department.discordRoleId);
          if (!isLinkedServerMember || !hasMappedRole) continue;
          await prisma.departmentMember.upsert({
            where: {
              departmentId_userId: {
                departmentId: department.id,
                userId: context.userId,
              },
            },
            create: {
              departmentId: department.id,
              userId: context.userId,
              rank: matchedRank || "Member",
              status: "ACTIVE",
            },
            update: {
              rank: matchedRank || undefined,
            },
          });
        }

        const config = jsonValue<Record<string, unknown>>(
          context.community.permissionConfigJson,
          {}
        );
        const roleMapping =
          config.discordRoleMapping &&
          typeof config.discordRoleMapping === "object"
            ? (config.discordRoleMapping as Record<string, unknown>)
            : {};
        const mappedCommunityRole = mainRoles
          .map((roleId) => roleMapping[roleId])
          .find(
            (role): role is string =>
              typeof role === "string" &&
              ["HIGH_COMMAND", "SUPERVISOR", "INVESTIGATOR", "MEMBER"].includes(role)
          );
        if (
          mainGuildId &&
          Object.keys(roleMapping).length > 0 &&
          context.community.ownerId !== context.userId
        ) {
          await prisma.communityMember.update({
            where: {
              communityId_userId: {
                communityId: context.community.id,
                userId: context.userId,
              },
            },
            data: {
              role:
                mainGuildRoles !== null && mainGuildRoles !== undefined
                  ? mappedCommunityRole || "MEMBER"
                  : "MEMBER",
            },
          });
        }
        await writeAudit(context, "DISCORD_MEMBERSHIP_SYNCED", context.userId, "Discord membership and configured role mappings checked");
        result = {
          mainGuildConfigured: Boolean(mainGuildId),
          isMainGuildMember:
            mainGuildId && mainGuildRoles !== undefined
              ? mainGuildRoles !== null
              : null,
          departmentMembershipsUpdated: linkedDepartments.filter(
            (department) =>
              department.discordGuildId &&
              (memberRoles.get(department.discordGuildId)?.length ?? 0) > 0
          ).length,
        };
        break;
      }

      case "server.connect": {
        requireManager(context, false);
        const guildId = stringValue(input, "guildId", true, 32);
        if (!isDiscordSnowflake(guildId)) {
          throw new WorkspaceError("Enter a valid Discord server ID", 400);
        }
        const name = stringValue(input, "name", true, 100);
        const kind = stringValue(input, "kind", true, 20).toUpperCase();
        if (!["MAIN", "DEPARTMENT"].includes(kind)) {
          throw new WorkspaceError("Server type must be MAIN or DEPARTMENT", 400);
        }
        const departmentId = stringValue(input, "departmentId", false, 100) || null;
        const subdivisionId =
          stringValue(input, "subdivisionId", false, 100) || null;
        if (kind === "DEPARTMENT") {
          if (!departmentId) throw new WorkspaceError("Choose the department for this server", 400);
          if (context.community.mainDiscordGuildId === guildId) {
            throw new WorkspaceError(
              "This Discord server is already configured as the community server",
              409
            );
          }
          await assertDepartmentAccess(context, departmentId);
          if (subdivisionId) {
            const subdivision = await prisma.subdivision.findFirst({
              where: { id: subdivisionId, departmentId },
              select: { id: true },
            });
            if (!subdivision) {
              throw new WorkspaceError("Subdivision must belong to the selected department", 400);
            }
          }
        } else if (departmentId || subdivisionId) {
          throw new WorkspaceError("Main community servers cannot be mapped to a department or subdivision", 400);
        }
        const otherWorkspaceServer = await prisma.connectedServer.findFirst({
          where: { guildId, communityId: { not: context.community.id } },
          select: { id: true },
        });
        const otherWorkspaceMainGuild = await prisma.community.findFirst({
          where: {
            mainDiscordGuildId: guildId,
            id: { not: context.community.id },
          },
          select: { id: true },
        });
        if (otherWorkspaceServer || otherWorkspaceMainGuild) {
          throw new WorkspaceError(
            "This Discord server is already mapped to another community",
            409
          );
        }
        if (
          kind === "MAIN" &&
          context.community.mainDiscordGuildId &&
          context.community.mainDiscordGuildId !== guildId
        ) {
          throw new WorkspaceError(
            "Remove the current main Discord server before connecting a different one",
            409
          );
        }
        const existingServer = await prisma.connectedServer.findUnique({
          where: { communityId_guildId: { communityId: context.community.id, guildId } },
          select: { id: true, departmentId: true, subdivisionId: true, kind: true },
        });
        const mappingChanged = Boolean(
          existingServer &&
            (existingServer.departmentId !== departmentId ||
              existingServer.subdivisionId !== subdivisionId ||
              existingServer.kind !== kind)
        );
        const server = await prisma.connectedServer.upsert({
          where: {
            communityId_guildId: {
              communityId: context.community.id,
              guildId,
            },
          },
          create: {
            communityId: context.community.id,
            guildId,
            departmentId,
            subdivisionId,
            name,
            kind,
          },
          update: {
            departmentId,
            subdivisionId,
            name,
            kind,
            ...(mappingChanged
              ? {
                  botEnabled: false,
                  supervisorRoleIdsJson: "[]",
                  notificationChannelId: null,
                  notifyLeave: false,
                  notifyApplications: false,
                  notifyInactivity: false,
                }
              : {}),
          },
        });
        if (kind === "MAIN") {
          await prisma.community.update({
            where: { id: context.community.id },
            data: { mainDiscordGuildId: guildId },
          });
        } else if (departmentId) {
          await prisma.department.update({
            where: { id: departmentId },
            data: { discordGuildId: guildId },
          });
        }
        await writeAudit(
          context,
          "DISCORD_SERVER_CONFIGURED",
          server.id,
          `Configured ${kind.toLowerCase()} Discord server (department: ${departmentId || "none"}; subdivision: ${subdivisionId || "none"})`
        );
        result = { server };
        break;
      }

      default:
        throw new WorkspaceError("Unknown workspace action", 400);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Workspace action failed:", error);
    return NextResponse.json(
      { error: "Unable to complete workspace action" },
      { status: 500 }
    );
  }
}
