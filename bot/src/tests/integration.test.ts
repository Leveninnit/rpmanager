import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { signDiscordBotRequest } from "../../../src/lib/discord-bot-security";

const root = process.cwd();
const databasePath = path.resolve(root, "prisma", "bot-test.db");
const sharedSecret = "test-service-secret-0123456789-abcdef";
const guildA = "10000000000000001";
const guildB = "10000000000000002";
const guildUnknown = "10000000000000003";
const discordA = "20000000000000001";
const discordB = "20000000000000002";
const supervisorRole = "30000000000000001";

let prisma: typeof import("../../../src/lib/prisma").prisma;
let postCommand: typeof import("../../../src/app/api/bot/v1/route").POST;
let getOutbox: typeof import("../../../src/app/api/bot/outbox/route").GET;
let postOutbox: typeof import("../../../src/app/api/bot/outbox/route").POST;
let postHeartbeat: typeof import("../../../src/app/api/bot/heartbeat/route").POST;
let communityBId = "";
let foreignLeaveId = "";

before(async () => {
  process.env.DATABASE_URL = "file:./bot-test.db";
  process.env.DISCORD_BOT_SERVICE_SECRET = sharedSecret;
  process.env.DISCORD_APPLICATION_ID = "40000000000000001";
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules", "prisma", "build", "index.js"),
      "db",
      "push",
      "--accept-data-loss",
      "--schema",
      "prisma/schema.prisma",
      "--skip-generate",
    ],
    {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    }
  );
  ({ prisma } = await import("../../../src/lib/prisma"));
  ({ POST: postCommand } = await import("../../../src/app/api/bot/v1/route"));
  ({ GET: getOutbox, POST: postOutbox } = await import("../../../src/app/api/bot/outbox/route"));
  ({ POST: postHeartbeat } = await import("../../../src/app/api/bot/heartbeat/route"));

  const ownerA = await prisma.user.create({
    data: {
      name: "Community A Owner",
      email: "owner-a@example.invalid",
      discordId: discordA,
    },
  });
  const ownerB = await prisma.user.create({
    data: {
      name: "Community B Owner",
      email: "owner-b@example.invalid",
      discordId: discordB,
    },
  });
  const communityA = await prisma.community.create({
    data: {
      name: "Community A",
      slug: "community-a-test",
      ownerId: ownerA.id,
      mainDiscordGuildId: guildUnknown,
      memberships: { create: { userId: ownerA.id, role: "OWNER" } },
      departments: {
        create: {
          name: "Police A",
          code: "POLICE-A",
          discordGuildId: guildA,
        },
      },
    },
    include: { departments: true },
  });
  const communityB = await prisma.community.create({
    data: {
      name: "Community B",
      slug: "community-b-test",
      ownerId: ownerB.id,
      memberships: { create: { userId: ownerB.id, role: "OWNER" } },
      departments: {
        create: {
          name: "Police B",
          code: "POLICE-B",
          discordGuildId: guildB,
        },
      },
    },
    include: { departments: true },
  });
  communityBId = communityB.id;
  const departmentA = communityA.departments[0];
  const departmentB = communityB.departments[0];
  await prisma.departmentMember.createMany({
    data: [
      {
        departmentId: departmentA.id,
        userId: ownerA.id,
        rank: "High Command",
        callsign: "A-01",
      },
      {
        departmentId: departmentB.id,
        userId: ownerB.id,
        rank: "High Command",
        callsign: "B-01",
      },
    ],
  });
  await prisma.connectedServer.createMany({
    data: [
      {
        communityId: communityA.id,
        departmentId: departmentA.id,
        guildId: guildA,
        name: "Guild A",
        kind: "DEPARTMENT",
        botEnabled: true,
        supervisorRoleIdsJson: JSON.stringify([supervisorRole]),
        notificationChannelId: "60000000000000001",
        notifyLeave: true,
      },
      {
        communityId: communityB.id,
        departmentId: departmentB.id,
        guildId: guildB,
        name: "Guild B",
        kind: "DEPARTMENT",
        botEnabled: true,
      },
    ],
  });
  const leave = await prisma.leaveOfAbsence.create({
    data: {
      userId: ownerB.id,
      departmentId: departmentB.id,
      startDate: new Date("2026-12-01T00:00:00.000Z"),
      endDate: new Date("2026-12-10T00:00:00.000Z"),
      reason: "Private test reason",
    },
  });
  foreignLeaveId = leave.id;
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    await rm(`${databasePath}${suffix}`, { force: true });
  }
});

async function signedApiRequest(
  handler: (request: Request) => Promise<Response>,
  method: "GET" | "POST",
  pathAndQuery: string,
  payload?: Record<string, unknown>,
  nonce = randomBytes(16).toString("hex")
) {
  const body = Buffer.from(payload ? JSON.stringify(payload) : "");
  const timestamp = Date.now().toString();
  const signature = signDiscordBotRequest(
    sharedSecret,
    method,
    pathAndQuery,
    timestamp,
    nonce,
    body
  );
  return handler(
    new Request(`http://localhost${pathAndQuery}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-rpmanager-timestamp": timestamp,
        "x-rpmanager-nonce": nonce,
        "x-rpmanager-signature": signature,
      },
      ...(method === "POST" ? { body } : {}),
    })
  );
}

async function signedRequest(
  payload: Record<string, unknown>,
  nonce = randomBytes(16).toString("hex")
) {
  return signedApiRequest(
    postCommand,
    "POST",
    "/api/bot/v1",
    payload,
    nonce
  );
}

function command(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    interactionId: "50000000000000001",
    guildId: guildA,
    discordId: discordA,
    roleIds: [],
    action: "member.status",
    input: {},
    ...overrides,
  };
}

describe("signed Discord bot service API", () => {
  it("scopes guild requests, checks authorization, and deduplicates retried duty events", async () => {
    const statusResponse = await signedRequest(
      command({ communityId: communityBId })
    );
    assert.equal(statusResponse.status, 200);
    const statusBody = (await statusResponse.json()) as {
      data: { community: string; department: string };
    };
    assert.equal(statusBody.data.community, "Community A");
    assert.equal(statusBody.data.department, "Police A");

    const unknownGuild = await signedRequest(
      command({ guildId: guildUnknown, interactionId: "50000000000000002" })
    );
    assert.equal(unknownGuild.status, 404);

    const unauthorizedReview = await signedRequest(
      command({
        action: "leave.review",
        input: { leaveId: foreignLeaveId, decision: "APPROVED" },
        interactionId: "50000000000000003",
      })
    );
    assert.equal(unauthorizedReview.status, 403);

    const crossTenantReview = await signedRequest(
      command({
        roleIds: [supervisorRole],
        action: "leave.review",
        input: { leaveId: foreignLeaveId, decision: "APPROVED" },
        interactionId: "50000000000000004",
      })
    );
    assert.equal(crossTenantReview.status, 404);
    const untouchedForeignLeave = await prisma.leaveOfAbsence.findUniqueOrThrow({
      where: { id: foreignLeaveId },
    });
    assert.equal(untouchedForeignLeave.status, "PENDING");

    const privateReason = "Private test reason that must not reach Discord";
    const leaveSubmission = await signedRequest(
      command({
        action: "leave.submit",
        input: {
          startDate: "2026-12-01",
          endDate: "2026-12-10",
          reason: privateReason,
        },
        interactionId: "50000000000000008",
      })
    );
    assert.equal(leaveSubmission.status, 200);
    const leaveResponse = await leaveSubmission.json();
    assert.equal(JSON.stringify(leaveResponse).includes(privateReason), false);
    const submittedLeave = await prisma.leaveOfAbsence.findFirstOrThrow({
      where: { user: { discordId: discordA } },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(submittedLeave.reason, privateReason);
    const notice = await prisma.discordOutboxEvent.findUniqueOrThrow({
      where: { eventKey: `leave:${submittedLeave.id}:submitted:${guildA}` },
    });
    assert.equal(notice.content.includes(privateReason), false);
    const heartbeat = await signedApiRequest(
      postHeartbeat,
      "POST",
      "/api/bot/heartbeat",
      { guildId: guildA }
    );
    assert.equal(heartbeat.status, 200);
    const outboxPath = `/api/bot/outbox?guildId=${guildA}`;
    const poll = await signedApiRequest(getOutbox, "GET", outboxPath);
    assert.equal(poll.status, 200);
    const claimed = (await poll.json()) as {
      events: Array<{ id: string; leaseToken: string; content: string }>;
    };
    assert.equal(claimed.events.length, 1);
    assert.equal(claimed.events[0].content.includes(privateReason), false);
    const acknowledge = await signedApiRequest(
      postOutbox,
      "POST",
      "/api/bot/outbox",
      {
        action: "ack",
        guildId: guildA,
        eventId: claimed.events[0].id,
        leaseToken: claimed.events[0].leaseToken,
      }
    );
    assert.equal(acknowledge.status, 200);
    const acknowledgedNotice = await prisma.discordOutboxEvent.findUniqueOrThrow({
      where: { id: claimed.events[0].id },
    });
    assert.ok(acknowledgedNotice.deliveredAt);
    assert.equal(
      (
        (await (
          await signedApiRequest(getOutbox, "GET", outboxPath)
        ).json()) as { events: unknown[] }
      ).events.length,
      0
    );
    const pendingResponse = await signedRequest(
      command({
        roleIds: [supervisorRole],
        action: "leave.pending",
        input: { page: 1 },
        interactionId: "50000000000000009",
      })
    );
    assert.equal(pendingResponse.status, 200);
    assert.equal(
      JSON.stringify(await pendingResponse.json()).includes(privateReason),
      false
    );

    const dutyEvent = command({
      action: "duty.clockIn",
      input: { callsign: "A-01" },
      interactionId: "50000000000000005",
    });
    const firstClockIn = await signedRequest(dutyEvent);
    assert.equal(firstClockIn.status, 200);
    const firstResult = await firstClockIn.json();

    const repeatedClockIn = await signedRequest(dutyEvent);
    assert.equal(repeatedClockIn.status, 200);
    assert.deepEqual(await repeatedClockIn.json(), firstResult);
    assert.equal(
      await prisma.dutyShift.count({
        where: { user: { discordId: discordA }, sourceEventId: dutyEvent.interactionId as string },
      }),
      1
    );

    const distinctClockIn = await signedRequest(
      command({
        action: "duty.clockIn",
        input: { callsign: "A-01" },
        interactionId: "50000000000000006",
      })
    );
    assert.equal(distinctClockIn.status, 409);

    const replayNonce = randomBytes(16).toString("hex");
    const replayBody = command({ interactionId: "50000000000000007" });
    assert.equal((await signedRequest(replayBody, replayNonce)).status, 200);
    assert.equal((await signedRequest(replayBody, replayNonce)).status, 409);

    const conflictingGuild = await prisma.connectedServer.create({
      data: {
        communityId: communityBId,
        departmentId: (await prisma.department.findFirstOrThrow({
          where: { communityId: communityBId },
          select: { id: true },
        })).id,
        guildId: guildA,
        name: "Conflicting Guild",
        kind: "DEPARTMENT",
        botEnabled: true,
      },
    });
    assert.ok(conflictingGuild.id);
    const ambiguousGuild = await signedRequest(
      command({ interactionId: "50000000000000010" })
    );
    assert.equal(ambiguousGuild.status, 409);
  });
});
