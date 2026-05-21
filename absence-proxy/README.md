# Wise Capacity Absence Proxy

Azure Functions HTTP proxy for `7-captrack.js`.

The function reads a scoped Microsoft 365 calendar with app-only Graph auth and returns only sanitized absence ranges:

```json
{
  "events": [
    {
      "uid": "stable-id",
      "personKey": "jane smith",
      "start": "2026-05-25",
      "endExclusive": "2026-05-28",
      "allDay": true
    }
  ]
}
```

No client secrets, Graph tokens, calendar bodies, locations, attendees, or absence reasons are returned.

## Azure App Settings

Set these on the Function App:

```text
MS_TENANT_ID=<tenant-id>
MS_CLIENT_ID=<client-id>
MS_CLIENT_SECRET=<rotated secret>
ABSENCE_MAILBOX=<absence-mailbox>
ABSENCE_CALENDAR_ID=<calendar id>
ALLOWED_ORIGINS=<allowed browser origin 1>,<allowed browser origin 2>
CAPTRACK_ABSENCE_PROXY_URL=<capacity-absence function url including function key>
```

## Deploy From Local PowerShell

From this folder:

```powershell
npm install
npm test
func azure functionapp publish <YOUR_FUNCTION_APP_NAME>
```

After deployment, open the function in Azure and use **Get Function Url** for `capacity-absence`.

Quick PowerShell smoke test:

```powershell
$url = "https://<YOUR_FUNCTION_APP_NAME>.azurewebsites.net/api/capacity-absence?code=<FUNCTION_KEY>&start=2026-05-01&end=2026-06-01&timezone=Europe/London"
Invoke-RestMethod -Uri $url -Headers @{ Origin = "https://hirehop.co.uk" }
```

Use that URL as:

```js
window.WiseCapacityTrackerConfig = window.WiseCapacityTrackerConfig || {};
window.WiseCapacityTrackerConfig.absence = {
  proxyUrl: "https://<YOUR_FUNCTION_APP_NAME>.azurewebsites.net/api/capacity-absence?code=<FUNCTION_KEY>"
};
```

The tracker appends `start`, `end`, and `timezone` query parameters automatically.

## Private Config Script

For HireHop, avoid putting the `capacity-absence` function URL in the public plugin repo. Instead, set this app setting:

```text
CAPTRACK_ABSENCE_PROXY_URL=https://<YOUR_FUNCTION_APP_NAME>.azurewebsites.net/api/capacity-absence?code=<FUNCTION_KEY>
```

Then deploy and copy the **Get Function Url** value for `captrack-config`.

Put that `captrack-config` URL in the HireHop plugin string immediately before `7-captrack.js`. The config function returns JavaScript like:

```js
window.WiseCapacityTrackerConfig = window.WiseCapacityTrackerConfig || {};
window.WiseCapacityTrackerConfig.absence = window.WiseCapacityTrackerConfig.absence || {};
window.WiseCapacityTrackerConfig.absence.proxyUrl = "https://...";
```

This keeps the private proxy URL out of the public GitHub repo. Browser-loaded config is still visible to authenticated HireHop users, so regenerate keys if the URL is shared outside the company.
