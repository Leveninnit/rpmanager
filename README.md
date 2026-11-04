# RPManager

RPManager is a multi-community roleplay management website built with Next.js, NextAuth, Prisma, and SQLite for local development.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `NEXTAUTH_SECRET`. Discord OAuth and Stripe settings are optional.
3. Apply the Prisma schema with `npx prisma db push`.
4. Start the website with `npm run dev`.

The site is available at `http://localhost:3000`. New email/password registrations create a community workspace with Police, Fire & EMS, and Staff departments. Additional departments and subdivisions can be configured from the signed-in dashboard.

## Website modules

- Community dashboards, department rosters, personnel records, rank and status management, and transfers.
- Subdivision rosters and leadership assignments.
- Website duty clock, weekly hours reports, and authorized hour adjustments.
- Leave requests, command review, quota exclusions, notifications, and expiry.
- Configurable weekly inactivity reviews, exemptions, warnings, strikes, expiry, pardons, and manual disciplinary records.
- SOP version history and member acknowledgements.
- Application forms, review stages, decisions, and optional multiple-choice scoring.
- Training courses, completion records, and certifications.
- Confidential Internal Affairs cases, investigator assignments, notes, interviews, and evidence references.
- Append-only workspace audit events and configurable game presets, terminology, and access roles.
- The public homepage includes interactive, clearly labeled sample previews for the dashboard, department rosters, and inactivity reviews; these controls are demonstrations and do not write workspace data.

Department ranks can be entered as a comma-separated list from lowest to highest. Discord role-to-rank mappings remain available in the department's advanced settings.

Dashboard API requests verify the signed-in user and their active community membership. Investigation data is restricted to High Command, the owner, or assigned investigators. Administrative actions are scoped to the selected community.

## Discord and game integrations

To enable Discord OAuth, set `DISCORD_CLIENT_ID` (the Discord application ID) and `DISCORD_CLIENT_SECRET` (from the application's OAuth2 settings) in the website environment, then register `http://localhost:3000/api/auth/callback/discord` as an OAuth redirect URI in the Discord application and restart the website. These OAuth credentials are separate from the bot token; never put the bot token in the website environment. RPManager requests `identify`, `email`, and `guilds.members.read`; signed-in users can verify their own membership and configured role mappings for linked servers.

Discord email-based account linking is allowed only when Discord marks the email address as verified. Accounts with unverified Discord email addresses are not linked to an existing account by email.

The landing page and navigation currently link to the RPManager Discord invite. For local builds, override it with `NEXT_PUBLIC_DISCORD_INVITE_URL`; for Docker deployments, provide it as a build argument because Next.js embeds `NEXT_PUBLIC_` values during the image build.

The optional Discord bot is a separate `discord.js` process. It uses a signed, timestamped service API and does not connect directly to Prisma or the database. Bot setup, guild mapping, permissions, commands, privacy, and troubleshooting are documented in [bot/README.md](./bot/README.md).

Implemented bot commands cover account linking, personal status, department rosters, website duty shifts, leave requests/reviews, SOP lookup/acknowledgement, and personal application status. Supervisor notifications are sent through a retryable outbox and contain no confidential case or application details. Bot commands stay disabled per guild until the owner enables them.

Voice duty tracking and automatic Discord role changes are not implemented. The bot requests neither privileged intents nor role-management permissions. Existing game APIs are not connected.

## Northflank deployment

The project includes a Dockerfile for Northflank, with separate web and Discord bot services. Local development and tests keep using SQLite; the production image generates a PostgreSQL Prisma client. See [deploy/DEPLOY.md](./deploy/DEPLOY.md) for the private GitHub setup, Northflank service configuration, and the limitations on transferring existing local data.
