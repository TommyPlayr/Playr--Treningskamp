import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type RequestBody = {
  action?: "send" | "lookup" | "accept" | "decline";
  matchId?: string;
  token?: string;
  phone?: string;
  invitedTeamName?: string;
  fromTeamId?: string;
  message?: string;
};

type TeamRow = {
  id: string;
  user_id: string;
  club: string;
  team: string;
  contact_name: string;
};

type MatchRow = {
  id: string;
  sport: string;
  title: string;
  age_group: string;
  level: string | null;
  match_date: string;
  match_time: string | null;
  place: string;
  city: string | null;
  match_type: string;
  comment: string | null;
  status: string;
  approved_request_id: string | null;
  host_team_id: string;
  teams: TeamRow | null;
};

type InvitationRow = {
  id: string;
  match_id: string;
  host_team_id: string;
  invited_phone: string;
  invited_team_name: string | null;
  token: string;
  status: string;
  expires_at: string;
  matches: MatchRow | null;
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

function createToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getBaseUrl() {
  return (Deno.env.get("PLAYR_INVITE_BASE_URL") || "https://playrmatch.com").replace(/\/+$/, "");
}

function buildInviteUrl(token: string) {
  return `${getBaseUrl()}/?invite=${encodeURIComponent(token)}`;
}

function buildInviteMessage(match: MatchRow, phone: string, invitedTeamName: string | undefined, token: string) {
  const hostTeam = formatTeamName(match.teams);
  const invitedTeam = invitedTeamName?.trim() || "laget ditt";
  const ageAndLevel = [match.age_group, match.level].filter(Boolean).join(" - ");
  const place = [match.place, match.city].filter(Boolean).join(", ");

  return [
    "Playr: Invitasjon til treningskamp",
    "",
    `${hostTeam} inviterer ${invitedTeam} til kamp.`,
    `${match.sport}${ageAndLevel ? ` ${ageAndLevel}` : ""}`,
    `Dato: ${formatDate(match.match_date)}`,
    `Tid: ${formatTime(match.match_time)}`,
    `Sted: ${place || "Ikke satt"}`,
    match.comment ? `Info: ${match.comment}` : "",
    "",
    "Se kampen og svar her:",
    buildInviteUrl(token),
    "",
    `Sendt til ${phone}`
  ].filter(Boolean).join("\n");
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

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function getUserFromRequest(supabase: ReturnType<typeof createClient>, request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";

  if (!authorization) {
    return null;
  }

  const token = authorization.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

async function getInvitation(supabase: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await supabase
    .from("match_invitations")
    .select(
      "id, match_id, host_team_id, invited_phone, invited_team_name, token, status, expires_at, matches(id, sport, title, age_group, level, match_date, match_time, place, city, match_type, comment, status, approved_request_id, host_team_id, teams(id, user_id, club, team, contact_name))"
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as InvitationRow;
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

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Mangler serverkonfigurasjon." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const action = body.action ?? "lookup";

  if (action === "lookup") {
    const token = body.token?.trim();

    if (!token) {
      return jsonResponse({ error: "Invitasjonslenken mangler token." }, 400);
    }

    const invitation = await getInvitation(supabase, token);

    if (!invitation || !invitation.matches) {
      return jsonResponse({ error: "Fant ikke invitasjonen." }, 404);
    }

    return jsonResponse({
      ok: true,
      invitation: {
        token: invitation.token,
        status: invitation.status,
        expiresAt: invitation.expires_at,
        invitedTeamName: invitation.invited_team_name,
        match: invitation.matches
      }
    });
  }

  const user = await getUserFromRequest(supabase, request);

  if (!user) {
    return jsonResponse({ error: "Du må være innlogget." }, 401);
  }

  if (action === "send") {
    const matchId = body.matchId?.trim();
    const phone = normalizePhone(body.phone);
    const invitedTeamName = body.invitedTeamName?.trim() ?? "";

    if (!matchId || !phone) {
      return jsonResponse({ error: "Kamp og gyldig telefonnummer må fylles ut." }, 400);
    }

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, sport, title, age_group, level, match_date, match_time, place, city, match_type, comment, status, approved_request_id, host_team_id, teams(id, user_id, club, team, contact_name)"
      )
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !matchData) {
      return jsonResponse({ error: "Fant ikke kampen." }, 404);
    }

    const match = matchData as MatchRow;

    if (match.teams?.user_id !== user.id) {
      return jsonResponse({ error: "Du kan bare invitere til kamper du selv har lagt ut." }, 403);
    }

    if (match.status !== "ledig") {
      return jsonResponse({ error: "Du kan bare invitere til ledige kamper." }, 409);
    }

    const token = createToken();
    const message = buildInviteMessage(match, phone, invitedTeamName, token);
    const smsResult = await sendSms(phone, message);

    const { data: invitationData, error: invitationError } = await supabase
      .from("match_invitations")
      .insert({
        match_id: match.id,
        host_team_id: match.host_team_id,
        invited_phone: phone,
        invited_team_name: invitedTeamName || null,
        token,
        sent_at: smsResult.ok ? new Date().toISOString() : null,
        twilio_sid: typeof smsResult.data?.sid === "string" ? smsResult.data.sid : null,
        error: smsResult.ok ? null : JSON.stringify(smsResult.data ?? {})
      })
      .select("id, token")
      .single();

    if (invitationError) {
      return jsonResponse({ error: invitationError.message }, 500);
    }

    if (!smsResult.ok) {
      return jsonResponse({
        ok: false,
        error: "SMS-invitasjonen ble ikke sendt.",
        smsResult
      }, 502);
    }

    return jsonResponse({
      ok: true,
      invitationId: invitationData.id,
      token,
      inviteUrl: buildInviteUrl(token)
    });
  }

  if (action === "decline") {
    const token = body.token?.trim();

    if (!token) {
      return jsonResponse({ error: "Invitasjonslenken mangler token." }, 400);
    }

    const { error } = await supabase
      .from("match_invitations")
      .update({
        status: "declined",
        updated_at: new Date().toISOString()
      })
      .eq("token", token)
      .eq("status", "pending");

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ ok: true });
  }

  if (action === "accept") {
    const token = body.token?.trim();
    const fromTeamId = body.fromTeamId?.trim();

    if (!token || !fromTeamId) {
      return jsonResponse({ error: "Invitasjon og lagprofil må være valgt." }, 400);
    }

    const invitation = await getInvitation(supabase, token);

    if (!invitation || !invitation.matches) {
      return jsonResponse({ error: "Fant ikke invitasjonen." }, 404);
    }

    if (invitation.status !== "pending") {
      return jsonResponse({ error: "Invitasjonen er allerede besvart." }, 409);
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await supabase
        .from("match_invitations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      return jsonResponse({ error: "Invitasjonen er utløpt." }, 410);
    }

    const match = invitation.matches;

    if (match.status !== "ledig") {
      return jsonResponse({ error: "Kampen er ikke lenger ledig." }, 409);
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, user_id, club, team, contact_name")
      .eq("id", fromTeamId)
      .maybeSingle();

    if (teamError || !teamData) {
      return jsonResponse({ error: "Fant ikke lagprofilen din." }, 404);
    }

    const fromTeam = teamData as TeamRow;

    if (fromTeam.user_id !== user.id) {
      return jsonResponse({ error: "Du kan bare svare med en lagprofil du selv eier." }, 403);
    }

    if (fromTeam.id === match.host_team_id) {
      return jsonResponse({
        error: "Du kan ikke godkjenne invitasjonen med samme lag som inviterte."
      }, 409);
    }

    const requestMessage =
      body.message?.trim() ||
      `${formatTeamName(fromTeam)} godkjente invitasjonen fra ${formatTeamName(match.teams)}.`;

    const { data: requestData, error: requestError } = await supabase
      .from("match_requests")
      .upsert(
        {
          match_id: match.id,
          from_team_id: fromTeam.id,
          message: requestMessage,
          status: "godkjent"
        },
        {
          onConflict: "match_id,from_team_id"
        }
      )
      .select("id")
      .single();

    if (requestError || !requestData) {
      return jsonResponse({
        error: requestError?.message ?? "Kunne ikke opprette kampforespørsel."
      }, 500);
    }

    const { data: updatedMatch, error: matchUpdateError } = await supabase
      .from("matches")
      .update({
        status: "avtalt",
        approved_request_id: requestData.id
      })
      .eq("id", match.id)
      .eq("status", "ledig")
      .select("id")
      .maybeSingle();

    if (matchUpdateError) {
      return jsonResponse({ error: matchUpdateError.message }, 500);
    }

    if (!updatedMatch) {
      return jsonResponse({ error: "Kampen ble akkurat avtalt av noen andre." }, 409);
    }

    await supabase
      .from("match_requests")
      .update({ status: "avslatt" })
      .eq("match_id", match.id)
      .eq("status", "venter")
      .neq("id", requestData.id);

    await supabase
      .from("match_invitations")
      .update({
        status: "accepted",
        accepted_by_team_id: fromTeam.id,
        accepted_request_id: requestData.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", invitation.id);

    return jsonResponse({
      ok: true,
      requestId: requestData.id,
      matchId: match.id
    });
  }

  return jsonResponse({ error: "Ukjent handling." }, 400);
});