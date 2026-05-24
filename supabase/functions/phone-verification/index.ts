import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type RequestBody = {
  action?: "send" | "verify";
  phone?: string;
  code?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function normalizePhone(value: string) {
  const compact = value.replace(/[\s().-]/g, "");

  if (!compact) {
    return "";
  }

  const withCountryCode =
    compact.startsWith("+")
      ? compact
      : compact.startsWith("00")
        ? `+${compact.slice(2)}`
        : compact.length === 8
          ? `+47${compact}`
          : compact.startsWith("47") && compact.length === 10
            ? `+${compact}`
            : "";

  return /^\+[1-9]\d{7,14}$/.test(withCountryCode) ? withCountryCode : "";
}

async function callTwilioVerify(path: string, body: URLSearchParams) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const verifyServiceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

  if (!accountSid || !authToken || !verifyServiceSid) {
    return {
      ok: false,
      status: 500,
      data: { message: "Twilio Verify er ikke konfigurert." }
    };
  }

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  return { ok: response.ok, status: response.status, data };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: "Mangler serverkonfigurasjon eller innlogging." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const token = authorization.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return jsonResponse({ error: "Du må være innlogget for å bekrefte telefonnummer." }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const phone = normalizePhone(body.phone ?? "");

  if (!phone) {
    return jsonResponse({ error: "Ugyldig telefonnummer." }, 400);
  }

  const userId = userData.user.id;
  const { data: existingPhoneOwner, error: existingPhoneError } = await supabase
    .from("users")
    .select("id")
    .eq("phone", phone)
    .neq("id", userId)
    .maybeSingle();

  if (existingPhoneError) {
    return jsonResponse({ error: existingPhoneError.message }, 500);
  }

  if (existingPhoneOwner) {
    return jsonResponse(
      { error: "Dette telefonnummeret er allerede knyttet til en annen bruker." },
      409
    );
  }

  if (body.action === "send") {
    const result = await callTwilioVerify(
      "Verifications",
      new URLSearchParams({
        To: phone,
        Channel: "sms"
      })
    );

    if (!result.ok) {
      return jsonResponse(
        { error: result.data?.message ?? "Kunne ikke sende SMS-kode." },
        result.status
      );
    }

    return jsonResponse({ ok: true, phone });
  }

  if (body.action === "verify") {
    const code = (body.code ?? "").trim();

    if (!code) {
      return jsonResponse({ error: "SMS-kode mangler." }, 400);
    }

    const result = await callTwilioVerify(
      "VerificationCheck",
      new URLSearchParams({
        To: phone,
        Code: code
      })
    );

    if (!result.ok || result.data?.status !== "approved") {
      return jsonResponse({ error: "SMS-koden ble ikke godkjent." }, 400);
    }

    const email = userData.user.email ?? "";
    const fallbackName = email.split("@")[0] || "Trener";
    const now = new Date().toISOString();

    const { data: existingUser } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const { error: upsertError } = await supabase
      .from("users")
      .upsert({
        id: userId,
        full_name: existingUser?.full_name ?? fallbackName,
        email,
        phone,
        phone_verified: true,
        phone_verified_at: now
      });

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 500);
    }

    const { error: verificationError } = await supabase
      .from("phone_verifications")
      .upsert({
        user_id: userId,
        phone,
        verified_at: now
      });

    if (verificationError) {
      return jsonResponse({ error: verificationError.message }, 500);
    }

    return jsonResponse({ ok: true, phone, verified: true });
  }

  return jsonResponse({ error: "Ukjent handling." }, 400);
});