import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type PushType = "match_approved" | "match_cancelled" | "chat_message";

type RequestBody = {
  type?: PushType;
  requestId?: string;
  senderUserId?: string;
  senderName?: string;
  messagePreview?: string;
};

type TeamRow = {
  user_id: string;
  club: string;
  team: string;
  contact_name: string;
};

type MatchRequestRow = {
  id: string;
  match_id: string;
  from_team_id: string;
  status: string;
  teams: TeamRow | null;
};

type MatchRow = {
  id: string;
  sport: string;
  age_group: string;
  level: string | null;
  match_date: string;
  match_time: string | null;
  place: string;
  city: string | null;
  status: string;
  approved_request_id: string | null;
  teams: TeamRow | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
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

function formatTeamName(team: TeamRow | null) {
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

function trimPreview(value: string | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();

  if (text.length <= 90) {
    return text;
  }

  return `${text.slice(0, 87)}...`;
}

function isExpoPushToken(token: string) {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildNotification(
  type: PushType,
  match: MatchRow,
  approvedRequest: MatchRequestRow,
  senderName?: string,
  messagePreview?: string
) {
  const hostTeam = formatTeamName(match.teams);
  const awayTeam = formatTeamName(approvedRequest.teams);
  const matchLine = `${hostTeam} - ${awayTeam}`;
  const detailLine = `${formatDate(match.match_date)} ${formatTime(match.match_time)}${
    match.place ? ` - ${match.place}` : ""
  }`;

  if (type === "match_approved") {
    return {
      title: "Kamp avtalt",
      body: `${matchLine}. ${detailLine}`
    };
  }

  if (type === "match_cancelled") {
    return {
      title: "Kamp avlyst",
      body: `${matchLine}. ${detailLine}`
    };
  }

  const preview = trimPreview(messagePreview);

  return {
    title: "Ny melding i Playr",
    body: preview
      ? `${senderName || "En trener"}: ${preview}`
      : `${senderName || "En trener"} sendte en melding.`
  };
}

async function sendExpoPushMessages(messages: Record<string, unknown>[]) {
  if (messages.length === 0) {
    return { ok: true, tickets: [] };
  }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate"
    },
    body: JSON.stringify(messages)
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
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
    return jsonResponse({ error: "Du må være innlogget for å sende push-varsel." }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const requestId = body.requestId?.trim();
  const type = body.type;

  if (!requestId || !type) {
    return jsonResponse({ error: "Mangler requestId eller type." }, 400);
  }

  const { data: approvedRequest, error: requestError } = await supabase
    .from("match_requests")
    .select("id, match_id, from_team_id, status, teams(user_id, club, team, contact_name)")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !approvedRequest) {
    return jsonResponse({ error: "Fant ikke kampforespørselen." }, 404);
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, sport, age_group, level, match_date, match_time, place, city, status, approved_request_id, teams(user_id, club, team, contact_name)"
    )
    .eq("id", (approvedRequest as MatchRequestRow).match_id)
    .maybeSingle();

  if (matchError || !match) {
    return jsonResponse({ error: "Fant ikke kampen." }, 404);
  }

  const typedRequest = approvedRequest as MatchRequestRow;
  const typedMatch = match as MatchRow;

  const hostUserId = typedMatch.teams?.user_id;
  const requesterUserId = typedRequest.teams?.user_id;

  let targetUserIds = uniqueValues([hostUserId ?? "", requesterUserId ?? ""]);

  if (type === "chat_message" && body.senderUserId) {
    targetUserIds = targetUserIds.filter((userId) => userId !== body.senderUserId);
  }

  if (targetUserIds.length === 0) {
    return jsonResponse({ ok: true, sent: 0, reason: "Ingen mottakere." });
  }

  const { data: pushTokens, error: tokenError } = await supabase
    .from("push_tokens")
    .select("user_id, expo_push_token")
    .in("user_id", targetUserIds);

  if (tokenError) {
    return jsonResponse({ error: "Kunne ikke hente push-tokens." }, 500);
  }

  const notification = buildNotification(
    type,
    typedMatch,
    typedRequest,
    body.senderName,
    body.messagePreview
  );

  const messages = ((pushTokens ?? []) as PushTokenRow[])
    .filter((pushToken) => isExpoPushToken(pushToken.expo_push_token))
    .map((pushToken) => ({
      to: pushToken.expo_push_token,
      title: notification.title,
      body: notification.body,
      sound: "default",
      channelId: "playr",
      data: {
        type,
        requestId: typedRequest.id,
        matchId: typedMatch.id
      }
    }));

  const result = await sendExpoPushMessages(messages);

  if (!result.ok) {
    return jsonResponse({ ok: false, sent: 0, result }, 502);
  }

  return jsonResponse({ ok: true, sent: messages.length, result });
});