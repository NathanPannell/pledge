// AI provider cost reports. Both endpoints need an organization admin key.
// Returns daily totals as [{ date: "YYYY-MM-DD", cents }].

export class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function getJson(fetchImpl, url, headers) {
  const res = await fetchImpl(url, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Request failed (${res.status})`;
    throw new ProviderError(typeof msg === "string" ? msg : JSON.stringify(msg), res.status);
  }
  return json;
}

// Anthropic: GET /v1/organizations/cost_report, daily buckets, amounts are
// decimal strings in cents (USD).
export async function anthropicCosts({ baseUrl, key, start, end }, fetchImpl = fetch) {
  const days = [];
  let page;
  do {
    const url = new URL("/v1/organizations/cost_report", baseUrl);
    url.searchParams.set("starting_at", start.toISOString());
    url.searchParams.set("ending_at", end.toISOString());
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);
    const json = await getJson(fetchImpl, url, {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "user-agent": "Pledge/0.1",
    });
    for (const bucket of json.data || []) {
      const cents = (bucket.results || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
      days.push({ date: String(bucket.starting_at).slice(0, 10), cents: Math.round(cents) });
    }
    page = json.has_more ? json.next_page : null;
  } while (page);
  return days;
}

// OpenAI: GET /v1/organization/costs, daily buckets, amount.value in dollars.
export async function openaiCosts({ baseUrl, key, start, end }, fetchImpl = fetch) {
  const days = [];
  let page;
  do {
    const url = new URL("/v1/organization/costs", baseUrl);
    url.searchParams.set("start_time", String(Math.floor(start.getTime() / 1000)));
    url.searchParams.set("end_time", String(Math.floor(end.getTime() / 1000)));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "180");
    if (page) url.searchParams.set("page", page);
    const json = await getJson(fetchImpl, url, { authorization: `Bearer ${key}` });
    for (const bucket of json.data || []) {
      const dollars = (bucket.results || []).reduce((sum, r) => sum + Number(r.amount?.value || 0), 0);
      days.push({ date: new Date(bucket.start_time * 1000).toISOString().slice(0, 10), cents: Math.round(dollars * 100) });
    }
    page = json.has_more ? json.next_page : null;
  } while (page);
  return days;
}
