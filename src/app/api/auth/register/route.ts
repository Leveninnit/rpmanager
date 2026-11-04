import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { name, email, password } = body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (name.trim().length > 80 || email.trim().length > 254) {
      return NextResponse.json(
        { error: "Name or email exceeds the maximum length" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          subscriptionTier: "free",
        },
      });

      const slugBase = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "community";
      const community = await transaction.community.create({
        data: {
          name: name.trim(),
          slug: `${slugBase}-${createdUser.id.slice(-6)}`,
          ownerId: createdUser.id,
          memberships: {
            create: { userId: createdUser.id, role: "OWNER" },
          },
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
          actorId: createdUser.id,
          actorName: createdUser.name ?? "Workspace owner",
          action: "COMMUNITY_CREATED",
          targetId: community.id,
          details: "Community workspace created",
        },
      });

      return createdUser;
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
