# Capacity Tracker Absence Overlay

`7-captrack.js` can overlay absence ranges in person-based views, but production auth must not live in the browser. The test helper `WiseCapacityTracker.setMs365AbsenceAccessToken(...)` is deliberately session-only.

## Recommended Production Shape

Use a small absence proxy:

1. The browser calls one stable HTTPS endpoint.
2. The endpoint authenticates to Microsoft Graph or the calendar provider.
3. The endpoint returns only the fields needed by the Gantt overlay.

This keeps access tokens, client secrets, refresh tokens, and raw calendar records out of `7-captrack.js`.

Microsoft references:

- Microsoft says client credentials are for confidential services and credentials must not be published in source or embedded in web pages: <https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow>
- Microsoft Graph `calendarView` supports ranged calendar reads and lists `Calendars.ReadBasic` as the least-privileged permission for this API: <https://learn.microsoft.com/en-us/graph/api/user-list-calendarview?view=graph-rest-1.0>
- The Graph permissions reference notes application access policies can restrict calendar app access to specific mailboxes: <https://learn.microsoft.com/en-us/graph/permissions-reference?view=graph-rest-1.0#calendarsread>

## Front-End Config

Load this before `7-captrack.js`, either as a tiny config script in the HireHop plugin string or as part of an existing config file:

```js
window.WiseCapacityTrackerConfig = window.WiseCapacityTrackerConfig || {};
window.WiseCapacityTrackerConfig.absence = {
  proxyUrl: "https://your-absence-proxy.example.com/capacity-absence"
};
```

The tracker will request:

```text
GET /capacity-absence?start=YYYY-MM-DD&end=YYYY-MM-DD&timezone=Europe%2FLondon
```

## Proxy Response Contract

Return JSON like this:

```json
{
  "events": [
    {
      "uid": "optional-stable-id",
      "personKey": "jane smith",
      "start": "2026-05-25",
      "endExclusive": "2026-05-28",
      "allDay": true
    }
  ]
}
```

Supported person fields are `personKey`, `name`, `person`, `employee`, `summary`, `title`, or `subject`. The safest response is `personKey` plus dates only. `personKey` should match the normalised person name used in HireHop role fields.

Use `endExclusive` where possible. If the source system gives an inclusive all-day end date, return `end` plus `"endInclusive": true`.

## Microsoft 365 Setup Notes

For the proxy:

- Register an Entra ID app for the service.
- Prefer certificate or managed identity auth over a long-lived shared secret where hosting allows it.
- Grant the least Graph permission that returns the fields you need, usually `Calendars.ReadBasic.All` or `Calendars.Read`.
- Restrict application access to the absence mailbox/calendar rather than allowing all mailboxes.
- Query Graph `calendarView` for the requested range.
- Strip body, location, attendees, leave reason, notes, and any source-only metadata before responding.
- Add CORS only for the HireHop origin or the domain that hosts this plugin.

## Existing Fallbacks

For a quick non-Graph feed, `WiseCapacityTrackerAbsenceFeedUrl` or `WiseCapacityTrackerConfig.absenceFeedUrl` still works with an HTTPS iCalendar URL. That is convenient but exposes the feed URL and raw feed to the browser, so it is not the preferred GDPR-conscious route.

For manual testing, this remains available:

```js
WiseCapacityTracker.setMs365AbsenceAccessToken(accessToken, calendarId, userPath);
```
