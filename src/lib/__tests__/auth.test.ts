// @vitest-environment node
import { webcrypto } from "node:crypto";
import { test, expect, vi, beforeEach } from "vitest";

if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.crypto = webcrypto as any;
}
import { SignJWT } from "jose";

const fakeCookieStore = new Map<string, { value: string; options?: unknown }>();

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: (name: string, value: string, options?: unknown) => {
      fakeCookieStore.set(name, { value, options });
    },
    get: (name: string) => {
      const entry = fakeCookieStore.get(name);
      return entry ? { value: entry.value } : undefined;
    },
    delete: (name: string) => {
      fakeCookieStore.delete(name);
    },
  })),
}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  fakeCookieStore.clear();
});

test("createSession sets a valid JWT httpOnly cookie", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-1", "test@example.com");

  const cookie = fakeCookieStore.get("auth-token");
  expect(cookie).toBeDefined();
  expect(cookie!.value).toBeTypeOf("string");

  const opts = cookie!.options as Record<string, unknown>;
  expect(opts.httpOnly).toBe(true);
  expect(opts.sameSite).toBe("lax");
  expect(opts.path).toBe("/");
  expect(opts.expires).toBeInstanceOf(Date);
});

test("getSession returns session payload when valid token exists", async () => {
  const { createSession, getSession } = await import("@/lib/auth");

  await createSession("user-1", "test@example.com");
  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-1");
  expect(session!.email).toBe("test@example.com");
});

test("getSession returns null when no token", async () => {
  const { getSession } = await import("@/lib/auth");

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for invalid token", async () => {
  const { getSession } = await import("@/lib/auth");

  fakeCookieStore.set("auth-token", { value: "not-a-valid-jwt" });
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for expired token", async () => {
  const { getSession } = await import("@/lib/auth");

  const token = await new SignJWT({ userId: "user-1", email: "test@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // expired 1 minute ago
    .sign(JWT_SECRET);

  fakeCookieStore.set("auth-token", { value: token });
  const session = await getSession();
  expect(session).toBeNull();
});

test("deleteSession deletes the auth cookie", async () => {
  const { createSession, deleteSession } = await import("@/lib/auth");

  await createSession("user-1", "test@example.com");
  expect(fakeCookieStore.has("auth-token")).toBe(true);

  await deleteSession();
  expect(fakeCookieStore.has("auth-token")).toBe(false);
});

test("verifySession returns session from NextRequest cookies when valid", async () => {
  const { verifySession } = await import("@/lib/auth");

  const token = await new SignJWT({
    userId: "user-1",
    email: "test@example.com",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  const request = {
    cookies: {
      get: (name: string) =>
        name === "auth-token" ? { value: token } : undefined,
    },
  } as unknown as import("next/server").NextRequest;

  const session = await verifySession(request);
  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-1");
  expect(session!.email).toBe("test@example.com");
});

test("getSession returns null after deleteSession", async () => {
  const { createSession, getSession, deleteSession } = await import("@/lib/auth");

  await createSession("user-1", "test@example.com");
  expect(await getSession()).not.toBeNull();

  await deleteSession();
  expect(await getSession()).toBeNull();
});

test("verifySession returns null when no token in request", async () => {
  const { verifySession } = await import("@/lib/auth");

  const request = {
    cookies: { get: () => undefined },
  } as unknown as import("next/server").NextRequest;

  const session = await verifySession(request);
  expect(session).toBeNull();
});

test("verifySession returns null for invalid token in request", async () => {
  const { verifySession } = await import("@/lib/auth");

  const request = {
    cookies: {
      get: (name: string) =>
        name === "auth-token" ? { value: "garbage-token" } : undefined,
    },
  } as unknown as import("next/server").NextRequest;

  const session = await verifySession(request);
  expect(session).toBeNull();
});
