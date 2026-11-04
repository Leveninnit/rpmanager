import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import DiscordProvider from "next-auth/providers/discord";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error("Please enter your email and password");
      }

      const email = credentials.email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user?.password) {
        throw new Error("Invalid email or password");
      }

      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.password
      );

      if (!isPasswordValid) {
        throw new Error("Invalid email or password");
      }

      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  providers.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: { scope: "identify email guilds.members.read" },
      },
      profile(profile) {
        const defaultAvatar = Number.parseInt(profile.discriminator, 10) % 5;
        return {
          id: profile.id,
          name: profile.username,
          email: profile.verified ? profile.email : null,
          image: profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith("a_") ? "gif" : "png"}`
            : `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`,
        };
      },
    })
  );
}

async function ensureCommunity(userId: string, userName: string | null | undefined) {
  const existing = await prisma.communityMember.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
  });
  if (existing) return;

  const communityName = `${userName?.trim() || "New"} Community`.slice(0, 80);
  const slugBase =
    communityName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "community";

  await prisma.$transaction(async (transaction) => {
    const membership = await transaction.communityMember.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    });
    if (membership) return;

    const community = await transaction.community.create({
      data: {
        name: communityName,
        slug: `${slugBase}-${userId.slice(-6)}`,
        ownerId: userId,
        memberships: { create: { userId, role: "OWNER" } },
        departments: {
          create: [
            { name: "Police", code: "POLICE" },
            { name: "Fire & EMS", code: "FIRE-EMS" },
            { name: "Staff", code: "STAFF" },
          ],
        },
        inactivityPolicy: { create: {} },
      },
    });
    await transaction.auditLog.create({
      data: {
        communityId: community.id,
        actorId: userId,
        actorName: userName || "Workspace owner",
        action: "COMMUNITY_CREATED",
        targetId: community.id,
        details: "Community workspace created",
      },
    });
  });
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        await ensureCommunity(user.id, user.name);
      }
      if (account?.provider === "discord" && user?.id) {
        const linkedUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { discordId: true },
        });
        if (!linkedUser?.discordId || linkedUser.discordId === account.providerAccountId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { discordId: account.providerAccountId },
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;

        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            subscriptionTier: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripeCurrentPeriodEnd: true,
          },
        });

        if (dbUser) {
          session.user.subscriptionTier = dbUser.subscriptionTier;
          session.user.stripeCustomerId = dbUser.stripeCustomerId;
          session.user.isSubscribed = !!(
            dbUser.subscriptionTier !== "free" &&
            dbUser.stripeCurrentPeriodEnd &&
            dbUser.stripeCurrentPeriodEnd.getTime() > Date.now()
          );
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
