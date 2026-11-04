# RPManager Discord bot

The bot runs separately from Next.js and communicates with the website through signed service endpoints. It never connects to Prisma or receives database credentials.

## Requirements and setup

1. Use a supported Node.js release (Node 20 or newer), install the project dependencies with `npm install`, and apply the updated schema with `npx prisma db push`.
2. Create a Discord application and bot in the Discord Developer Portal. Copy the application ID and bot token into the bot host's environment; do not put the bot token in the website host's environment.
3. Generate one random service secret of at least 32 bytes (for example, `openssl rand -base64 32`). Set the same `DISCORD_BOT_SERVICE_SECRET` on the website server and bot host. Set `DISCORD_APPLICATION_ID` on both hosts.
4. On the website, set `DISCORD_APPLICATION_ID` and `DISCORD_BOT_SERVICE_SECRET` in its server environment only. Never put the bot token in the website environment. For local development, create a separate bot environment file:

   ```text
   Copy bot/.env.example to bot/.env
   ```

   Set the new bot token, application ID, and the same service secret as the website in `bot/.env`. The bot loads `bot/.env` separately, so its token is not loaded by Next.js. For local development, `RP_MANAGER_API_URL` may be `http://localhost:3000`; outside localhost, HTTPS is required. Do not copy any token from chat or commit either environment file.

5. Invite the application to each intended guild with OAuth2 scopes `bot` and `applications.commands`. The permission integer `3072` grants only `View Channels` and `Send Messages`, which are needed for configured notification channels. Slash replies are ephemeral. Do not grant `Administrator` or `Manage Roles`.
6. On the website, a community owner opens **Dashboard → Workspace settings → Connected Discord servers**. Connect each guild as the main community server or a department server, optionally scoped to a subdivision. A guild can map to only one RPManager community; ambiguous mappings are rejected. Set a notification channel if notifications are needed, configure exact supervisor role IDs, and enable the bot for that guild.
7. Start the website, then deploy global slash commands and start the bot:

   ```text
   npm run bot:commands
   npm run bot:dev
   ```

   The dashboard reports bot heartbeats. Keep `npm run bot:dev` running under a process manager in production.

## Commands

All responses are ephemeral. Member commands require an active Discord-to-RPManager link and active community membership. Department and subdivision data is scoped to the guild mapping and the caller's roster access.

- `/link` issues a one-time code. The signed-in member enters it in **Dashboard → Discord account**. Codes expire in 10 minutes and cannot link an already-linked Discord identity to another RPManager account.
- `/status` shows only the caller's linked workspace and department status.
- `/roster [page]` lists at most 10 roster members per page in the configured department/subdivision.
- `/duty clock-in [callsign]` and `/duty clock-out` create and close website duty shifts. A unique active-shift database key prevents a simultaneous website and Discord clock-in from creating two open shifts. Clock-in is rejected if any active shift already exists for the member.
- `/leave request` privately submits dates and a reason. The reason is stored only in RPManager and is never included in Discord notifications or logs.
- `/leave pending [page]` lists pending request IDs, dates, and member names for authorized supervisors; it never returns leave reasons.
- `/leave review` approves or denies a pending request in the mapped department/community.
- `/sop list [page]`, `/sop read`, and `/sop acknowledge` look up and acknowledge current SOP versions. Long SOP content is paginated.
- `/application status` shows only the caller's application status/stage; answers and reviewer notes are excluded.

Supervisor operations require both an RPManager management membership and a Discord role ID explicitly configured by the community owner. Role names and command-supplied community IDs are not used for authorization.

## Notifications and privacy

Owners can opt each connected guild into generic leave, application, and inactivity-review notifications. Messages are sent through a persistent outbox with leases and exponential retry delays. Delivery is at-least-once: a process or network failure after Discord accepts a message but before acknowledgement can result in a duplicate. Missing channel permissions are retried and eventually dead-lettered.

The bot does not expose Internal Affairs, disciplinary, strike details, leave reasons, application answers, or reviewer notes. It does not read message content, member presence, or voice state. Bot logs include command names and error categories only; credentials, request bodies, and personnel details are not logged.

Voice duty tracking is not implemented. The bot requests only the `Guilds` gateway intent. It does not request `GuildMembers`, `GuildPresences`, `MessageContent`, or `GuildVoiceStates`. Automatic website-to-Discord role changes are also not implemented; no role-management permission is requested.

## Troubleshooting

- **Bot remains disabled:** Confirm the owner connected the guild, selected its community/department/subdivision mapping, configured `DISCORD_BOT_SERVICE_SECRET` on the website, and enabled the guild.
- **Signature/authentication errors:** The website and bot must use the exact same service secret. Check system clock synchronization; signed requests expire after 60 seconds and nonces cannot be reused.
- **Link code rejected:** Codes are case-sensitive, single-use, and expire after 10 minutes. Request a new `/link` code and enter it while signed into the RPManager account that should own the Discord identity.
- **Supervisor command denied:** Verify the caller has the required RPManager community role and one of the exact Discord role IDs configured by the owner for that guild.
- **No notification appears:** Check that the selected channel ID is valid, the notification type is enabled, the bot can view and send messages in that channel, and the dashboard's heartbeat is recent.
- **Duty clock conflict:** Check the member's website duty page and end the existing shift. Web and bot clocks share the same active-shift constraint.
- **Commands do not appear:** Run `npm run bot:commands` after setting `DISCORD_BOT_TOKEN` and `DISCORD_APPLICATION_ID`; global command registration can take time to propagate.

Command calls are cooled down per user, paginated, and additionally rate-limited by the service API. Run the bot checks with `npm run bot:typecheck` and `npm run bot:test`.
