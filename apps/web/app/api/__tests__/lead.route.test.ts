import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/lead/route";
import type { LeadInput } from "@/lib/lead-schema";

function req(body: unknown): Request {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID: LeadInput = {
  name: "Иван",
  phone: "+7 900 123-45-67",
  source: "contacts",
  interest: "Мини-экскаватор",
  comment: "Перезвоните после 15:00",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/lead", () => {
  it("returns 400 when the body is not JSON", async () => {
    const res = await POST(req("not json"));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("invalid_json");
  });

  it("returns 400 with issues when name/phone are missing", async () => {
    const res = await POST(req({ source: "contacts" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; issues: unknown[] };
    expect(json.error).toBe("validation");
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it("rejects a phone without enough digits", async () => {
    const res = await POST(req({ ...VALID, phone: "12345" }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown source", async () => {
    const res = await POST(req({ ...VALID, source: "spam" }));
    expect(res.status).toBe(400);
  });

  it("accepts a valid lead without Telegram env (graceful dev fallback)", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("silently drops honeypot submissions without contacting Telegram", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(req({ ...VALID, website: "http://spam.example" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("delivers to Telegram when env is configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.telegram.org");
    expect(url).toContain("sendMessage");
    const sent = JSON.parse(String(init.body)) as {
      chat_id: string;
      text: string;
    };
    expect(sent.chat_id).toBe("42");
    expect(sent.text).toContain("Иван");
    expect(sent.text).toContain("Страница контактов");
  });

  it("returns 502 when Telegram delivery fails", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "kaput" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(req(VALID));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("delivery_failed");
  });
});
