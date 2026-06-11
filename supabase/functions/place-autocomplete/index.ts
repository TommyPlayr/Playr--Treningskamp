const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type GooglePlacePrediction = {
  place_id?: string;
  description?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  terms?: Array<{ value?: string }>;
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

function extractCity(prediction: GooglePlacePrediction) {
  const terms = (prediction.terms ?? [])
    .map((term) => term.value?.trim())
    .filter((value): value is string => Boolean(value));

  if (terms.length === 0) {
    return "";
  }

  const countryIndex = terms.findIndex((term) => /^(norge|norway)$/i.test(term));
  if (countryIndex > 0) {
    return terms[countryIndex - 1] ?? "";
  }

  return terms.length > 1 ? terms[terms.length - 2] ?? "" : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? Deno.env.get("GOOGLE_MAPS_API_KEY");

  if (!apiKey) {
    return jsonResponse({ error: "Google Places API er ikke konfigurert." }, 500);
  }

  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = body.query?.trim() ?? "";

  if (query.length < 3) {
    return jsonResponse({ suggestions: [] });
  }

  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    language: "no",
    components: "country:no"
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
  );

  const data = (await response.json().catch(() => ({}))) as {
    predictions?: GooglePlacePrediction[];
    error_message?: string;
    status?: string;
  };

  if (!response.ok || (data.status && !["OK", "ZERO_RESULTS"].includes(data.status))) {
    return jsonResponse(
      { error: data.error_message ?? "Kunne ikke hente stedforslag." },
      response.ok ? 400 : response.status
    );
  }

  const suggestions = (data.predictions ?? []).slice(0, 6).map((prediction) => {
    const name = prediction.structured_formatting?.main_text ?? prediction.description ?? "";
    const address = prediction.structured_formatting?.secondary_text ?? prediction.description ?? "";
    const city = extractCity(prediction);

    return {
      id: prediction.place_id ?? prediction.description ?? name,
      name,
      address,
      city,
      description: prediction.description ?? [name, address].filter(Boolean).join(", ")
    };
  });

  return jsonResponse({ suggestions });
});