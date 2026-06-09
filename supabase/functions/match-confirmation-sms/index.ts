import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type RequestBody = {
  requestId?: string;
  messageType?: "confirmation" | "cancellation";
};

type MatchRequestRow = {
  id: string;
  match_id: string;
  from_team_id: string;
  status: string;
  teams:
    | {
        club: string;
        team: string;
        contact_name: string;
        users: { phone: string | null } | null;
      }
    | null;
};

type MatchRow = {
  id: string;
  sport: string;
  age_group: string;
  level: string | null;
  match_date: string;
  match_time: string | null;
  place: string;
  status: string;
  approved_request_id: string | null;
  teams:
    | {
        club: string;
        team: string;
        contact_name: string;
        users: { phone: string | null } | null;
      }
    | null;
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

function normalizePhone(value: string | null | undefined) {
  const compact = (value ?? "").replace(/[\s().-]/g, "");

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

function formatTeamName(team: MatchRequestRow["teams"] | MatchRow["teams"]) {
  const club = team?.club?.trim() ?? "";
  const teamName = team?.team?.trim() ?? "";

  if (club && teamName && club.toLowerCase() !== teamName.toLowerCase()) {
    return `${club} ${teamName}`;
  }

  return teamName || club || "Ukjent lag";
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "Ikke satt";
}

function buildConfirmationMessage(match: MatchRow, approvedRequest: MatchRequestRow) {
  const hostTeam = formatTeamName(match.teams);
  const awayTeam = formatTeamName(approvedRequest.teams);
  const ageAndLevel = [match.age_group, match.level].filter(Boolean).join(" - ");

  return [
    "Playr: Kamp avtalt",
    "",
    `${hostTeam} - ${awayTeam}`,
    `${match.sport}${ageAndLevel ? ` ${ageAndLevel}` : ""}`,
    `Dato: ${formatDate(match.match_date)}`,
    `Tid: ${formatTime(match.match_time)}`,
    `Sted: ${match.place}`,
    "",
    "Bruk Playr-chatten ved endringer."
  ].join("\n");
}

function buildCancellationMessage(match: MatchRow, approvedRequest: MatchRequestRow) {
  const hostTeam = formatTeamName(match.teams);
  const awayTeam = formatTeamName(approvedRequest.teams);

  return [
    "Playr: Kamp avlyst",
    "",
    `${hostTeam} - ${awayTeam}`,
    `Dato: ${formatDate(match.match_date)}`,
    `Tid: ${formatTime(match.match_time)}`,
    `Sted: ${match.place}`,
    "",
    "Kampen er avlyst i Playr."
  ].join("\n");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextAttemptAt(attempts: number) {
  const delaySeconds = Math.min(60, Math.max(5, attempts * attempts * 5));
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

async function sendSms(phone: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    return {
      ok: false,
      status: 500,
      data: {
        message:
          "Twilio SMS er ikke konfigurert. Legg inn TWILIO_MESSAGING_SERVICE_SID eller TWILIO_FROM_NUMBER."
      }
    };
  }

  const params = new URLSearchParams({
    To: phone,
    Body: body
  });

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    params.set("From", fromNumber);
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
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
    return jsonResponse({ error: "Du maa vaere innlogget for aa sende kamp-SMS." }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;

  if (!body.requestId) {
    return jsonResponse({ error: "requestId mangler." }, 400);
  }

  const messageType = body.messageType === "cancellation" ? "cancellation" : "confirmation";

  const { data: approvedRequest, error: requestError } = await supabase
    .from("match_requests")
    .select("id, match_id, from_team_id, status, teams(club, team, contact_name, users(phone))")
    .eq("id", body.requestId)
    .maybeSingle();

  if (requestError || !approvedRequest) {
    return jsonResponse({ error: requestError?.message ?? "Foresporselen finnes ikke." }, 404);
  }

  const requestRow = approvedRequest as MatchRequestRow;

  if (messageType === "confirmation" && requestRow.status !== "godkjent") {
    return jsonResponse({ error: "Foresporselen er ikke godkjent." }, 409);
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, sport, age_group, level, match_date, match_time, place, status, approved_request_id, teams(club, team, contact_name, users(phone))")
    .eq("id", requestRow.match_id)
    .maybeSingle();

  if (matchError || !match) {
    return jsonResponse({ error: matchError?.message ?? "Kampen finnes ikke." }, 404);
  }

  const matchRow = match as MatchRow;

  if (
    messageType === "confirmation" &&
    (matchRow.status !== "avtalt" || matchRow.approved_request_id !== requestRow.id)
  ) {
    return jsonResponse({ error: "Kampen er ikke avtalt med denne foresporselen." }, 409);
  }

  const message =
    messageType === "cancellation"
      ? buildCancellationMessage(matchRow, requestRow)
      : buildConfirmationMessage(matchRow, requestRow);

  const recipients = [
    { role: "host", phone: normalizePhone(matchRow.teams?.users?.phone) },
    { role: "away", phone: normalizePhone(requestRow.teams?.users?.phone) }
  ].filter((recipient) => recipient.phone);

  if (recipients.length === 0) {
    return jsonResponse({ ok: true, sent: 0, skipped: 0, message: "Ingen telefonnummer aa sende til." });
  }

  for (const recipient of recipients) {
    const { error: queueError } = await supabase
      .from("match_confirmation_sms_log")
      .upsert(
        {
          match_id: matchRow.id,
          request_id: requestRow.id,
          phone: recipient.phone,
          recipient_role: recipient.role,
          message_type: messageType,
          message_body: message,
          status: "pending",
          error: null
        },
        { onConflict: "request_id,phone,message_type", ignoreDuplicates: true }
      );

    if (queueError) {
      return jsonResponse({ ok: false, error: queueError.message }, 500);
    }
  }

  await supabase
    .from("match_confirmation_sms_log")
    .update({
      status: "pending",
      next_attempt_at: new Date().toISOString()
    })
    .eq("status", "sending")
    .lt("last_attempt_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .lt("attempts", 4);

  const { data: queuedRows, error: queuedError } = await supabase
    .from("match_confirmation_sms_log")
    .select("id, phone, attempts, status, message_body")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .lt("attempts", 4)
    .order("next_attempt_at", { ascending: true })
    .limit(10);

  if (queuedError) {
    return jsonResponse({ ok: false, error: queuedError.message }, 500);
  }

  let sent = 0;
  let queued = 0;
  const errors: string[] = [];

  for (const row of queuedRows ?? []) {
    const nextAttempts = (row.attempts ?? 0) + 1;
    const { data: claimedRow, error: claimError } = await supabase
      .from("match_confirmation_sms_log")
      .update({
        status: "sending",
        attempts: nextAttempts,
        last_attempt_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .in("status", ["pending", "failed"])
      .lt("attempts", 4)
      .select("id")
      .maybeSingle();

    if (claimError) {
      errors.push(claimError.message);
      continue;
    }

    if (!claimedRow) {
      continue;
    }

    const result = await sendSms(row.phone, row.message_body || message);
    const shouldRetry = !result.ok && (result.status === 429 || result.status >= 500) && nextAttempts < 4;
    const nextStatus = result.ok ? "sent" : shouldRetry ? "pending" : "failed";
    const errorMessage = result.ok ? null : result.data?.message ?? "Kunne ikke sende SMS.";

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      twilio_sid: result.data?.sid ?? null,
      error: errorMessage,
      next_attempt_at: shouldRetry ? getNextAttemptAt(nextAttempts) : new Date().toISOString()
    };

    if (result.ok) {
      updatePayload.sent_at = new Date().toISOString();
    }

    const { error: logError } = await supabase
      .from("match_confirmation_sms_log")
      .update(updatePayload)
      .eq("id", row.id);

    if (logError) {
      errors.push(logError.message);
    }

    if (result.ok) {
      sent += 1;
    } else {
      errors.push(errorMessage ?? "Kunne ikke sende SMS.");
      if (shouldRetry) {
        queued += 1;
      }
    }

    await wait(750);
  }

  return jsonResponse({ ok: errors.length === 0, sent, queued, errors });
});