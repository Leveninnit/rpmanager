import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import {
  hasConfiguredSupervisorRole,
  isDiscordSnowflake,
  parseConfiguredRoleIds,
  signDiscordBotRequest,
  verifyDiscordBotSignature,
} from "../../../src/lib/discord-bot-security";

describe("Discord bot service request security", () => {
  it("binds signatures to method, path, body, nonce, and a short timestamp window", () => {
    const secret = "test-service-secret-0123456789-abcdef";
    const body = Buffer.from('{"action":"member.status"}');
    const timestamp = Date.now().toString();
    const nonce = randomBytes(16).toString("hex");
    const signature = signDiscordBotRequest(
      secret,
      "POST",
      "/api/bot/v1",
      timestamp,
      nonce,
      body
    );
    const request = {
      secret,
      method: "POST",
      pathAndQuery: "/api/bot/v1",
      timestamp,
      nonce,
      signature,
      body,
    };

    assert.equal(verifyDiscordBotSignature(request), true);
    assert.equal(
      verifyDiscordBotSignature({ ...request, pathAndQuery: "/api/bot/outbox" }),
      false
    );
    assert.equal(
      verifyDiscordBotSignature({ ...request, body: Buffer.from("{}") }),
      false
    );
    assert.equal(
      verifyDiscordBotSignature({ ...request, now: Date.now() + 61_000 }),
      false
    );
  });

  it("matches only configured role IDs and fails closed on malformed mappings", () => {
    const configured = parseConfiguredRoleIds(
      '["30000000000000001","30000000000000002"]'
    );
    assert.equal(
      hasConfiguredSupervisorRole(["30000000000000002"], configured),
      true
    );
    assert.equal(
      hasConfiguredSupervisorRole(["30000000000000003"], configured),
      false
    );
    assert.deepEqual(parseConfiguredRoleIds('{"role":"SUPERVISOR"}'), []);
    assert.equal(isDiscordSnowflake("30000000000000001"), true);
    assert.equal(isDiscordSnowflake("SUPERVISOR"), false);
  });
});
