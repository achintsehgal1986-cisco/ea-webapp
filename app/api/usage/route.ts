import { NextResponse } from "next/server";

import { isValidEmail, normalizeEmail } from "@/lib/email";
import type { UsageEventType } from "@/lib/usage-tracking";

type UsageRequestBody = {
  eventType?: UsageEventType;
  email?: string;
  customerName?: string;
  userRole?: string;
  otherRoleLabel?: string;
  skippedSetup?: boolean;
};

const MAX_FIELD_LENGTH = 200;

function clean(value: unknown, maxLength = MAX_FIELD_LENGTH): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : null;
}

async function postToGoogleSheetsWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
}

function trackingConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_WEBHOOK_URL &&
      process.env.GOOGLE_SHEETS_WEBHOOK_SECRET,
  );
}

export async function GET() {
  return NextResponse.json({
    configured: trackingConfigured(),
    message: trackingConfigured()
      ? "Usage tracking is configured."
      : "Set GOOGLE_SHEETS_WEBHOOK_URL and GOOGLE_SHEETS_WEBHOOK_SECRET in Vercel (Production).",
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as UsageRequestBody;
  const eventType = body.eventType;

  if (eventType !== "setup" && eventType !== "visit") {
    return NextResponse.json({ error: "Invalid event type." }, { status: 400 });
  }

  const emailRaw = clean(body.email, 320);
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const customerName = clean(body.customerName);
  const userRole = clean(body.userRole, 32);
  const otherRoleLabel = clean(body.otherRoleLabel);
  const skippedSetup = body.skippedSetup === true;

  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
  }

  if (eventType === "setup") {
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    if (!customerName) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }

    if (!userRole) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const webhookSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  if (!trackingConfigured()) {
    return NextResponse.json(
      { ok: false, stored: false, message: "Usage tracking is not configured." },
      { status: 202 },
    );
  }

  const response = await postToGoogleSheetsWebhook(webhookUrl!, {
    secret: webhookSecret!,
    eventType,
    email,
    customerName,
    userRole,
    otherRoleLabel,
    skippedSetup,
  });

  const responseText = await response.text();
  let parsed: { ok?: boolean; error?: string } | null = null;

  try {
    parsed = JSON.parse(responseText) as { ok?: boolean; error?: string };
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.error || parsed?.ok !== true) {
    return NextResponse.json({ error: "Failed to store usage event." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: true });
}
