"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  signJWT,
  COOKIE_NAME,
} from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface AuthActionState {
  error?: string;
  success?: boolean;
}

export async function signupAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!name || !email || !password) {
    return { error: "All fields are required." };
  }

  if (name.length < 2) {
    return { error: "Name must be at least 2 characters long." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }

  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return { error: "An account with this email already exists." };
    }

    // Hash password and insert
    const hashedPassword = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
      })
      .returning({ id: users.id, name: users.name, email: users.email });

    // Generate JWT
    const token = await signJWT({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    // Set HTTP-only Cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
  } catch (err: unknown) {
    console.error("Signup error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to create account. Please try again.",
    };
  }

  redirect("/dashboard");
}

export async function loginAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return { error: "Invalid email or password." };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return { error: "Invalid email or password." };
    }

    // Generate JWT
    const token = await signJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Set HTTP-only Cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
  } catch (err: unknown) {
    console.error("Login error:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to log in. Please try again.",
    };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}
