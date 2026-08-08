import { createHmac, timingSafeEqual } from "node:crypto";
import { DEMO_TICKET_TTL_MS } from "@/lib/demo/demo-policy";

export type DemoLoginTicketPayload = {
  version: 1;
  userId: string;
  visitorHash: string;
  expiresAt: number;
};

function purposeKey(secret: string, purpose: "visitor" | "creator" | "ticket") {
  return createHmac("sha256", secret).update(`asset-tracker/public-demo/${purpose}/v1`).digest();
}

function assertDemoSecret(secret: unknown): asserts secret is string {
  if (typeof secret !== "string" || secret.trim().length === 0) {
    throw new TypeError("Demo secret must be a non-empty string");
  }
}

function isDemoLoginTicketPayload(payload: unknown): payload is DemoLoginTicketPayload {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Object.getPrototypeOf(payload) !== Object.prototype ||
    Reflect.ownKeys(payload).length !== 4
  ) {
    return false;
  }

  const values = payload as Record<PropertyKey, unknown>;
  const allowedKeys = ["version", "userId", "visitorHash", "expiresAt"];
  if (!allowedKeys.every((key) => Object.hasOwn(values, key))) return false;

  return (
    values.version === 1 &&
    typeof values.userId === "string" &&
    values.userId.length > 0 &&
    typeof values.visitorHash === "string" &&
    values.visitorHash.length > 0 &&
    typeof values.expiresAt === "number" &&
    Number.isFinite(values.expiresAt) &&
    Number.isSafeInteger(values.expiresAt)
  );
}

function assertValidIssuedAt(issuedAt: Date): number {
  const timestamp = issuedAt.getTime();
  if (!Number.isSafeInteger(timestamp)) {
    throw new TypeError("Demo ticket issuance time must be a valid date");
  }
  return timestamp;
}

function digest(value: string, secret: string, purpose: "visitor" | "creator") {
  return createHmac("sha256", purposeKey(secret, purpose)).update(value).digest("base64url");
}

function decodeCanonicalBase64url(value: string): Buffer | null {
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.toString("base64url") === value ? decoded : null;
  } catch {
    return null;
  }
}

export const hashDemoVisitor = (token: string, secret: string) => {
  assertDemoSecret(secret);
  return digest(token, secret, "visitor");
};

export const hashDemoCreator = (ip: string, secret: string) => {
  assertDemoSecret(secret);
  return digest(ip, secret, "creator");
};

export function demoHashesMatch(first: string, second: string): boolean {
  const firstBytes = Buffer.from(first);
  const secondBytes = Buffer.from(second);
  return firstBytes.length === secondBytes.length && timingSafeEqual(firstBytes, secondBytes);
}

export function createDemoLoginTicket(
  payload: DemoLoginTicketPayload,
  secret: string,
  issuedAt = new Date(),
): string {
  assertDemoSecret(secret);
  if (!isDemoLoginTicketPayload(payload)) {
    throw new TypeError("Demo ticket payload is invalid");
  }
  const expiresAt = assertValidIssuedAt(issuedAt) + DEMO_TICKET_TTL_MS;
  const ticketPayload: DemoLoginTicketPayload = { ...payload, expiresAt };
  const body = Buffer.from(JSON.stringify(ticketPayload)).toString("base64url");
  const signature = createHmac("sha256", purposeKey(secret, "ticket"))
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifyDemoLoginTicket(
  ticket: string,
  secret: string,
  now: Date,
): DemoLoginTicketPayload | null {
  assertDemoSecret(secret);
  const [body, suppliedSignature, trailing] = ticket.split(".");
  if (!body || !suppliedSignature || trailing !== undefined) return null;
  const base64url = /^[A-Za-z0-9_-]+$/;
  if (!base64url.test(body) || !base64url.test(suppliedSignature)) return null;
  const decodedBody = decodeCanonicalBase64url(body);
  const supplied = decodeCanonicalBase64url(suppliedSignature);
  if (!decodedBody || !supplied) return null;
  const expectedSignature = createHmac("sha256", purposeKey(secret, "ticket"))
    .update(body)
    .digest();
  if (supplied.length !== expectedSignature.length) return null;
  if (!timingSafeEqual(supplied, expectedSignature)) return null;
  try {
    const payload: unknown = JSON.parse(decodedBody.toString("utf8"));
    if (
      !isDemoLoginTicketPayload(payload) ||
      now.getTime() >= payload.expiresAt ||
      payload.expiresAt - now.getTime() > DEMO_TICKET_TTL_MS
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
