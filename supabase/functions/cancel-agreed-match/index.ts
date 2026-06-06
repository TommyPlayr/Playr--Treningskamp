import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type RequestBody = {
  requestId?: string;
};

type MatchRequestRow = {
  id: string;
  match_id: string;
  from_team_id: string;
  status: string;
};

type MatchRow = {
  id: string;
  host_team_id: string;
  status: string;
  approved_request_id: string | null;
};

type TeamRow = {
  id: string;
  user_id: string;
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
    return jsonResponse({ error: "Du maa vaere innlogget for aa avlyse kamp." }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;

  if (!body.requestId) {
    return jsonResponse({ error: "requestId mangler." }, 400);
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("match_requests")
    .select("id, match_id, from_team_id, status")
    .eq("id", body.requestId)
    .maybeSingle();

  if (requestError || !requestRow) {
    return jsonResponse({ error: requestError?.message ?? "Forespoerselen finnes ikke." }, 404);
  }

  const approvedRequest = requestRow as MatchRequestRow;

  const { data: matchRow, error: matchError } = await supabase
    .from("matches")
    .select("id, host_team_id, status, approved_request_id")
    .eq("id", approvedRequest.match_id)
    .maybeSingle();

  if (matchError || !matchRow) {
    return jsonResponse({ error: matchError?.message ?? "Kampen finnes ikke." }, 404);
  }

  const match = matchRow as MatchRow;

  if (match.status === "ledig" && approvedRequest.status === "avslatt") {
    return jsonResponse({
      ok: true,
      alreadyCancelled: true,
      matchId: match.id,
      requestId: approvedRequest.id
    });
  }

  if (
    match.status !== "avtalt" ||
    match.approved_request_id !== approvedRequest.id ||
    approvedRequest.status !== "godkjent"
  ) {
    return jsonResponse({ error: "Kampen er ikke avtalt med denne forespoerselen." }, 409);
  }

  const [{ data: hostTeam, error: hostTeamError }, { data: requestTeam, error: requestTeamError }] =
    await Promise.all([
      supabase.from("teams").select("id, user_id").eq("id", match.host_team_id).maybeSingle(),
      supabase.from("teams").select("id, user_id").eq("id", approvedRequest.from_team_id).maybeSingle()
    ]);

  if (hostTeamError || requestTeamError || !hostTeam || !requestTeam) {
    return jsonResponse(
      { error: hostTeamError?.message ?? requestTeamError?.message ?? "Fant ikke lagene i kampen." },
      404
    );
  }

  const authUserId = userData.user.id;
  const isHostOwner = (hostTeam as TeamRow).user_id === authUserId;
  const isRequestOwner = (requestTeam as TeamRow).user_id === authUserId;

  if (!isHostOwner && !isRequestOwner) {
    return jsonResponse({ error: "Du kan bare avlyse kamper der ditt lag er involvert." }, 403);
  }

  const { error: updateRequestError } = await supabase
    .from("match_requests")
    .update({ status: "avslatt" })
    .eq("id", approvedRequest.id);

  if (updateRequestError) {
    return jsonResponse({ error: updateRequestError.message }, 500);
  }

  const { error: updateMatchError } = await supabase
    .from("matches")
    .update({ status: "ledig", approved_request_id: null })
    .eq("id", match.id);

  if (updateMatchError) {
    return jsonResponse({ error: updateMatchError.message }, 500);
  }

  return jsonResponse({
    ok: true,
    matchId: match.id,
    requestId: approvedRequest.id,
    canceledBy: isHostOwner ? "host" : "requester"
  });
});