import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function getWorkspaceContext(communityId?: string) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new WorkspaceError("Authentication required", 401);
  }

  const membership = await prisma.communityMember.findFirst({
    where: {
      userId,
      isActive: true,
      ...(communityId ? { communityId } : {}),
    },
    include: { community: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) {
    throw new WorkspaceError(
      communityId ? "Workspace access denied" : "No community workspace found",
      communityId ? 403 : 404
    );
  }

  return {
    userId,
    userName: session.user?.name || session.user?.email || "Workspace member",
    membership,
    community: membership.community,
  };
}

export function requireManager(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>,
  supervisorAllowed = true
) {
  if (!hasManagerAccess(context, supervisorAllowed)) {
    throw new WorkspaceError("You do not have permission to perform this action", 403);
  }
}

export function hasManagerAccess(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>,
  supervisorAllowed = true
) {
  if (context.community.ownerId === context.userId) return true;
  const defaultRoles = supervisorAllowed
    ? ["OWNER", "HIGH_COMMAND", "SUPERVISOR"]
    : ["OWNER", "HIGH_COMMAND"];
  const config = parsePermissionConfig(context.community.permissionConfigJson);
  const configuredRoles = config.permissions?.[
    supervisorAllowed ? "operations" : "administrative"
  ];
  const allowedRoles =
    configuredRoles?.filter((role) =>
      ["OWNER", "HIGH_COMMAND", "SUPERVISOR", "MEMBER"].includes(role)
    ) ?? defaultRoles;

  return allowedRoles.includes(context.membership.role);
}

export function requireHighCommand(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>
) {
  if (!hasHighCommandAccess(context)) {
    throw new WorkspaceError("Confidential access is restricted", 403);
  }
}

export function hasHighCommandAccess(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>
) {
  if (context.community.ownerId === context.userId) return true;
  const configuredRoles = parsePermissionConfig(
    context.community.permissionConfigJson
  ).permissions?.administrative;
  const allowedRoles =
    configuredRoles?.filter((role) =>
      ["OWNER", "HIGH_COMMAND", "SUPERVISOR"].includes(role)
    ) ?? ["OWNER", "HIGH_COMMAND"];
  return allowedRoles.includes(context.membership.role);
}

export function requireIAAccess(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>
) {
  if (!hasIAAccess(context)) {
    throw new WorkspaceError("Confidential access is restricted", 403);
  }
}

export function requireIACommandAccess(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>
) {
  if (
    context.community.ownerId !== context.userId &&
    !["OWNER", "HIGH_COMMAND"].includes(context.membership.role)
  ) {
    throw new WorkspaceError("Internal Affairs command access is restricted", 403);
  }
}

export function hasIAAccess(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>
) {
  return (
    context.community.ownerId === context.userId ||
    ["OWNER", "HIGH_COMMAND", "INVESTIGATOR"].includes(context.membership.role)
  );
}

function parsePermissionConfig(value: string) {
  try {
    const config: unknown = JSON.parse(value);
    if (!config || typeof config !== "object" || !("permissions" in config)) {
      return {};
    }
    const permissions = (config as { permissions?: unknown }).permissions;
    if (!permissions || typeof permissions !== "object") return {};
    const result: Record<string, string[]> = {};
    for (const [key, roles] of Object.entries(permissions)) {
      if (
        Array.isArray(roles) &&
        roles.every((role) => typeof role === "string")
      ) {
        result[key] = roles;
      }
    }
    return { permissions: result };
  } catch {
    return {};
  }
}

export async function assertDepartmentAccess(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>,
  departmentId: string
) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, communityId: context.community.id },
  });

  if (!department) {
    throw new WorkspaceError("Department not found in this workspace", 404);
  }

  return department;
}

export async function writeAudit(
  context: Awaited<ReturnType<typeof getWorkspaceContext>>,
  action: string,
  targetId: string | null,
  details: string
) {
  await prisma.auditLog.create({
    data: {
      communityId: context.community.id,
      actorId: context.userId,
      actorName: context.userName,
      action,
      targetId,
      details,
    },
  });
}

export async function writeSystemAudit(
  communityId: string,
  action: string,
  targetId: string,
  details: string
) {
  await prisma.auditLog.create({
    data: {
      communityId,
      actorId: "SYSTEM",
      actorName: "RPManager",
      action,
      targetId,
      details,
    },
  });
}
