import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  createDemoLoginTicket,
  hashDemoCreator,
  hashDemoVisitor,
  demoHashesMatch,
  verifyDemoLoginTicket,
} from "@/lib/demo/demo-crypto";
import { DEMO_TICKET_TTL_MS } from "@/lib/demo/demo-policy";

const secret = "unit-test-secret";
const now = new Date("2026-08-01T00:00:00.000Z");

function signRawTicket(payload: unknown, signingSecret = secret): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const ticketKey = createHmac("sha256", signingSecret)
    .update("asset-tracker/public-demo/ticket/v1")
    .digest();
  const signature = createHmac("sha256", ticketKey).update(body).digest("base64url");
  return `${body}.${signature}`;
}

describe("public Demo crypto", () => {
  it("uses different purpose keys for visitor tokens and source IPs", () => {
    expect(hashDemoVisitor("same-input", secret)).not.toBe(hashDemoCreator("same-input", secret));
  });

  it("compares fixed digests without accepting length or value mismatches", () => {
    const hash = hashDemoVisitor("visitor", secret);
    expect(demoHashesMatch(hash, hash)).toBe(true);
    expect(demoHashesMatch(hash, `${hash}x`)).toBe(false);
    expect(demoHashesMatch(hash, hashDemoVisitor("different", secret))).toBe(false);
  });

  it("round-trips an unexpired signed ticket", () => {
    const payload = {
      version: 1 as const,
      userId: "demo-user",
      visitorHash: "visitor-hash",
      expiresAt: now.getTime() + DEMO_TICKET_TTL_MS,
    };
    const ticket = createDemoLoginTicket(payload, secret, now);
    expect(verifyDemoLoginTicket(ticket, secret, now)).toEqual(payload);
  });

  it("rejects tampering and the exact expiry boundary", () => {
    const expiresAt = now.getTime() + DEMO_TICKET_TTL_MS;
    const ticket = createDemoLoginTicket(
      { version: 1, userId: "demo-user", visitorHash: "visitor-hash", expiresAt },
      secret,
      now,
    );
    expect(verifyDemoLoginTicket(`${ticket}x`, secret, now)).toBeNull();
    expect(verifyDemoLoginTicket(`${ticket}!`, secret, now)).toBeNull();
    expect(verifyDemoLoginTicket(ticket, secret, new Date(expiresAt))).toBeNull();
  });

  it("rejects a non-canonical base64url signature encoding", () => {
    const ticket = createDemoLoginTicket(
      {
        version: 1,
        userId: "demo-user",
        visitorHash: "visitor-hash",
        expiresAt: now.getTime() + DEMO_TICKET_TTL_MS,
      },
      secret,
      now,
    );
    const [body, signature] = ticket.split(".");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const lastCharacter = signature.at(-1)!;
    const nonCanonicalLastCharacter = alphabet[alphabet.indexOf(lastCharacter) ^ 1];

    expect(
      verifyDemoLoginTicket(
        `${body}.${signature.slice(0, -1)}${nonCanonicalLastCharacter}`,
        secret,
        now,
      ),
    ).toBeNull();
  });

  it("rejects empty and non-string secrets before cryptographic use", () => {
    const payload = {
      version: 1 as const,
      userId: "demo-user",
      visitorHash: "visitor-hash",
      expiresAt: now.getTime() + DEMO_TICKET_TTL_MS,
    };
    const ticket = createDemoLoginTicket(payload, secret, now);

    expect(() => hashDemoVisitor("visitor", "")).toThrow();
    expect(() => hashDemoCreator("127.0.0.1", "   ")).toThrow();
    expect(() => createDemoLoginTicket(payload, "", now)).toThrow();
    expect(() => verifyDemoLoginTicket(ticket, "" as string, now)).toThrow();
    expect(() => hashDemoVisitor("visitor", null as unknown as string)).toThrow();
  });

  it("constrains ticket lifetime at signing and verification", () => {
    const overlongPayload = {
      version: 1 as const,
      userId: "demo-user",
      visitorHash: "visitor-hash",
      expiresAt: now.getTime() + DEMO_TICKET_TTL_MS + 1,
    };

    const ticket = createDemoLoginTicket(overlongPayload, secret, now);
    expect(verifyDemoLoginTicket(ticket, secret, now)).toEqual({
      ...overlongPayload,
      expiresAt: now.getTime() + DEMO_TICKET_TTL_MS,
    });
    expect(verifyDemoLoginTicket(signRawTicket(overlongPayload), secret, now)).toBeNull();
  });

  it("rejects non-canonical ticket payloads before signing and after verification", () => {
    const validPayload = {
      version: 1 as const,
      userId: "demo-user",
      visitorHash: "visitor-hash",
      expiresAt: now.getTime() + DEMO_TICKET_TTL_MS,
    };
    const invalidPayloads = [
      { ...validPayload, unexpected: true },
      { ...validPayload, userId: "" },
      { ...validPayload, visitorHash: "" },
      { ...validPayload, expiresAt: validPayload.expiresAt + 0.5 },
      { ...validPayload, expiresAt: Number.MAX_SAFE_INTEGER + 1 },
      null,
    ];

    for (const payload of invalidPayloads) {
      expect(() => createDemoLoginTicket(payload as never, secret, now)).toThrow();
      expect(verifyDemoLoginTicket(signRawTicket(payload), secret, now)).toBeNull();
    }
  });
});
