const { app } = require("@azure/functions");
const crypto = require("crypto");

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const MAX_GRAPH_PAGES = 20;

app.http("capacity-absence", {
  methods: ["GET", "OPTIONS"],
  authLevel: "function",
  handler: async (request, context) => {
    const cors = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return { status: cors.allowed ? 204 : 403, headers: cors.headers };
    }

    if (!cors.allowed) {
      return jsonResponse(403, { error: "origin_not_allowed" }, cors.headers);
    }

    try {
      const settings = readRequiredSettings();
      const range = readRange(request);
      const accessToken = await getGraphAccessToken(settings);
      const graphEvents = await readCalendarView(settings, range, accessToken, context);
      const aliases = readPersonAliases();
      const events = graphEvents.map((event) => toSafeAbsenceEvent(event, aliases)).filter(Boolean);

      return jsonResponse(200, {
        events,
        range: {
          start: range.start,
          end: range.end,
          timezone: range.timezone
        }
      }, {
        ...cors.headers,
        "Cache-Control": "private, max-age=300"
      });
    } catch (error) {
      context.error("capacity-absence failed", {
        message: error && error.message,
        status: error && error.status,
        source: error && error.source
      });

      return jsonResponse(error.status || 500, {
        error: error.publicCode || "absence_proxy_failed"
      }, cors.headers);
    }
  }
});

function readRequiredSettings() {
  return {
    tenantId: requiredEnv("MS_TENANT_ID"),
    clientId: requiredEnv("MS_CLIENT_ID"),
    clientSecret: requiredEnv("MS_CLIENT_SECRET"),
    mailbox: requiredEnv("ABSENCE_MAILBOX"),
    calendarId: requiredEnv("ABSENCE_CALENDAR_ID")
  };
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    const error = new Error(`Missing required app setting ${name}.`);
    error.status = 500;
    error.publicCode = "missing_configuration";
    throw error;
  }
  return value;
}

function readRange(request) {
  const start = validDateParam(request.query.get("start"));
  const end = validDateParam(request.query.get("end"));
  const timezone = validTimezone(request.query.get("timezone")) || "Europe/London";

  if (!start || !end) {
    const error = new Error("start and end query parameters must be YYYY-MM-DD.");
    error.status = 400;
    error.publicCode = "invalid_range";
    throw error;
  }

  if (Date.parse(`${end}T00:00:00Z`) < Date.parse(`${start}T00:00:00Z`)) {
    const error = new Error("end must be on or after start.");
    error.status = 400;
    error.publicCode = "invalid_range";
    throw error;
  }

  return {
    start,
    end,
    graphStart: `${start}T00:00:00`,
    graphEnd: `${addDays(end, 1)}T00:00:00`,
    timezone
  };
}

function validDateParam(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : text;
}

function validTimezone(value) {
  const text = String(value || "").trim();
  return /^[A-Za-z0-9_+\-./ ]{1,80}$/.test(text) ? text : "";
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getGraphAccessToken(settings) {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(settings.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    grant_type: "client_credentials",
    scope: GRAPH_SCOPE
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const payload = await readJsonResponse(response);
  if (!response.ok || !payload.access_token) {
    const error = new Error("Microsoft identity platform rejected the client credentials.");
    error.status = response.status || 502;
    error.publicCode = "token_request_failed";
    error.source = "entra";
    throw error;
  }

  return payload.access_token;
}

async function readCalendarView(settings, range, accessToken, context) {
  const params = new URLSearchParams({
    startDateTime: range.graphStart,
    endDateTime: range.graphEnd,
    "$select": "id,subject,start,end,isAllDay",
    "$top": "1000"
  });

  let url =
    "https://graph.microsoft.com/v1.0/users/" +
    encodeURIComponent(settings.mailbox) +
    "/calendars/" +
    encodeURIComponent(settings.calendarId) +
    "/calendarView?" +
    params.toString();

  const events = [];
  for (let page = 1; url && page <= MAX_GRAPH_PAGES; page += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        Prefer: `outlook.timezone="${range.timezone}"`
      }
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      context.warn("Microsoft Graph calendarView failed", {
        status: response.status,
        code: payload && payload.error && payload.error.code
      });

      const error = new Error("Microsoft Graph calendarView failed.");
      error.status = response.status || 502;
      error.publicCode = "graph_calendar_failed";
      error.source = "graph";
      throw error;
    }

    events.push(...(Array.isArray(payload.value) ? payload.value : []));
    url = payload["@odata.nextLink"] || "";
  }

  return events;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

function readPersonAliases() {
  const aliases = {};
  const raw = String(process.env.PERSON_ALIASES_JSON || "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      Object.keys(parsed || {}).forEach((key) => {
        const from = normalisePersonName(key);
        const to = normalisePersonName(parsed[key]);
        if (from && to) aliases[from] = to;
      });
    } catch (error) {
      throw publicError(500, "invalid_alias_configuration", "PERSON_ALIASES_JSON must be valid JSON.");
    }
  }

  const compact = String(process.env.PERSON_ALIASES || "").trim();
  compact.split(",").forEach((pair) => {
    const parts = pair.split("=");
    if (parts.length !== 2) return;
    const from = normalisePersonName(parts[0]);
    const to = normalisePersonName(parts[1]);
    if (from && to) aliases[from] = to;
  });

  return aliases;
}

function toSafeAbsenceEvent(event, aliases) {
  const subject = cleanText(event && event.subject);
  const person = extractPersonName(subject);
  const rawPersonKey = normalisePersonName(person);
  const personKey = aliases[rawPersonKey] || rawPersonKey;
  if (!personKey) return null;

  const start = graphDate(event && event.start);
  const endExclusive = graphDate(event && event.end);
  if (!start) return null;

  return {
    uid: stableId([personKey, start, endExclusive || "", event.id || ""].join("|")),
    personKey,
    start,
    endExclusive: endExclusive || addDays(start, 1),
    allDay: event && event.isAllDay !== false
  };
}

function graphDate(value) {
  const raw = value && typeof value === "object" ? value.dateTime : value;
  const text = String(raw || "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function extractPersonName(subject) {
  const text = cleanText(subject).replace(/\([^)]*\)/g, " ");
  if (!text) return "";

  const pieces = text
    .split(/\s+(?:-|--|\u2013|\u2014|\||:)\s+/)
    .map(cleanText)
    .filter(Boolean);

  return pieces[0] || text;
}

function normalisePersonName(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stableId(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function publicError(status, publicCode, message) {
  const error = new Error(message || publicCode);
  error.status = status;
  error.publicCode = publicCode;
  return error;
}

function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = String(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const allowed = allowedOrigins.length ? allowedOrigins.includes(origin) : !origin;
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (origin && allowed) headers["Access-Control-Allow-Origin"] = origin;
  return { allowed, headers };
}

function jsonResponse(status, body, headers) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    },
    body: JSON.stringify(body)
  };
}
