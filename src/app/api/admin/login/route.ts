import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  AUTH_COOKIE_NAME,
  constantTimeCompare,
  createSessionToken,
} from "@/lib/auth";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { password } = result.data;
    const adminPassword = process.env.ADMIN_PASSWORD || "";
    const authSecret = process.env.AUTH_SECRET || "";

    if (!adminPassword || !authSecret) {
      return NextResponse.json(
        { error: "Server authentication configuration missing" },
        { status: 500 }
      );
    }

    const isValid = constantTimeCompare(password, adminPassword);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours
    const token = await createSessionToken({ role: "admin", exp }, authSecret);

    cookies().set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
