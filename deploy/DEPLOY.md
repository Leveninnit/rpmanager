# Deploy RPManager on Northflank

This setup deploys RPManager as two always-on services (the Next.js website and the Discord bot) with one Northflank PostgreSQL database. Northflank's current Sandbox pricing lists two services, two jobs, one database, up to $20/month of included resource usage, and no sleeping. Free-tier rules and availability can change; confirm current billing and resource limits in your account before deploying.

Sources:

- [Northflank pricing and Sandbox limits](https://northflank.com/pricing)
- [Cloudflare Workers pricing and limits](https://developers.cloudflare.com/workers/platform/pricing/) (Cloudflare is not used to run this Node.js bot)

The website's existing local development and tests continue to use SQLite. The production Docker image generates a PostgreSQL Prisma client from the same schema; the generated production schema is not committed. Do not copy production credentials or database URLs into the repository.

## 1. Publish a private GitHub repository

Northflank deploys from a Git repository; it does not deploy this workspace ZIP directly. Create an empty **private** repository on GitHub, then from PowerShell in the RPManager folder:

```powershell
git init
git add .
git status --short
```

Before committing, confirm the status does **not** list `.env`, `bot/.env`, any `.env.production` file, or `prisma/dev.db`. Those files are excluded by `.gitignore`. The example environment files contain placeholders only.

```powershell
git commit -m "Prepare RPManager for hosting"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rpmanager.git
git push -u origin main
```

GitHub will prompt you to authenticate. Keep the repository private; do not put a bot token, OAuth secret, service secret, database URL, or database backup in GitHub.

## 2. Create the Northflank project and database

1. Sign up at [Northflank](https://app.northflank.com/signup), create a project, and link the private GitHub repository.
2. Add one managed PostgreSQL database in the project's development environment. Copy its private/internal connection URL from Northflank. Do not use a public database URL if the services can use internal networking.
3. Keep the project within the free Sandbox allowance shown on the billing page: two services, one database, and up to $20/month of included resource usage. Do not enable a paid plan or add resources unless you intend to pay.

## 3. Deploy the website service

Create a service from the repository with:

- Build type: Dockerfile at repository root.
- Branch: `main`.
- Public HTTP port: `3000`.
- Start command: use the Dockerfile default (`npm run start`).
- Health check path: `/`.

Add these runtime variables in the website service settings. `NEXTAUTH_URL` must match the public HTTPS domain assigned by Northflank. For the first deployment, create the service, set a temporary placeholder URL if necessary, deploy to get the assigned domain, then update `NEXTAUTH_URL` and redeploy.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Private Northflank PostgreSQL connection URL |
| `NEXTAUTH_URL` | `https://` plus the website's assigned public domain |
| `NEXTAUTH_SECRET` | New random value generated privately |
| `DISCORD_CLIENT_ID` | Discord application ID |
| `DISCORD_CLIENT_SECRET` | OAuth2 client secret from the Discord Developer Portal |
| `DISCORD_APPLICATION_ID` | Same Discord application ID |
| `DISCORD_BOT_SERVICE_SECRET` | New random secret of at least 32 characters |

The default Discord invite is included in the website. If you need a custom invite, provide `NEXT_PUBLIC_DISCORD_INVITE_URL` as a Docker build argument; Next.js embeds `NEXT_PUBLIC_` values during the image build, so changing it as a runtime-only service variable will not update the page.

Use the Northflank secret manager for all credentials. Never enter the bot token in the website service.

Once the public domain is assigned, add `https://YOUR-DOMAIN/api/auth/callback/discord` to the Discord application's OAuth2 redirect URLs.

## 4. Initialize the hosted database

Before the website handles registrations, create a one-off Northflank Job from the same repository and Dockerfile. Use the same `DATABASE_URL` as the website and set the job command to:

```text
npm run db:push:postgres
```

Run the job once and confirm it completes successfully. This applies the existing Prisma schema to the new PostgreSQL database. For future schema updates, back up the database and review Prisma's planned changes before rerunning this job. Never add `--accept-data-loss` to production schema commands.

## 5. Deploy the Discord bot service

Create a second service from the same private repository and Dockerfile. Set its start command to:

```text
npm run bot:start
```

Configure these variables for the bot service only:

| Variable | Value |
|---|---|
| `DISCORD_BOT_TOKEN` | A newly reset bot token; keep it private |
| `DISCORD_APPLICATION_ID` | Same Discord application ID as the website |
| `DISCORD_BOT_SERVICE_SECRET` | Exact same secret as the website |
| `RP_MANAGER_API_URL` | Website's public HTTPS URL |

Do not pass `NEXTAUTH_SECRET`, `DISCORD_CLIENT_SECRET`, or `DATABASE_URL` to the bot.

Deploy slash commands once using a Northflank Job with the bot token and application ID:

```text
npm run bot:commands
```

Invite the bot with only the required bot and application-command scopes. In RPManager, sign in as the workspace owner, open **Dashboard → Workspace settings → Connected Discord servers**, connect the intended server, and enable the bot for that server.

## Existing local workspace data

The hosted PostgreSQL database is separate from the local SQLite database. This deployment does not automatically transfer users, communities, or records. Keep `prisma/dev.db` untouched and backed up; do not upload it to GitHub. Start with a new hosted workspace unless you arrange a reviewed SQLite-to-PostgreSQL data migration. Verify login, OAuth, workspace creation, bot heartbeat, and a test bot command before relying on hosted records.

## Troubleshooting

- **GitHub detects a secret:** Stop before pushing. Remove the file from the staging area, rotate the exposed credential, and verify `.gitignore`.
- **Prisma cannot connect:** Check that the database is running and `DATABASE_URL` uses the private connection string and the correct database credentials.
- **Discord OAuth fails:** Confirm `NEXTAUTH_URL` exactly matches the public HTTPS domain and that the Discord redirect URL ends in `/api/auth/callback/discord`.
- **Bot says disabled or unmapped:** Connect the exact Discord guild in workspace settings and enable the bot for that server. The website and bot must use the same application ID and service secret.
- **Free usage is exceeded:** Check Northflank billing and resource usage before increasing limits; free availability is subject to provider terms and quotas.
