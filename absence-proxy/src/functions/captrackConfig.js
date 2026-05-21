const { app } = require("@azure/functions");

app.http("captrack-config", {
  methods: ["GET"],
  authLevel: "function",
  handler: async () => {
    const proxyUrl = String(process.env.CAPTRACK_ABSENCE_PROXY_URL || "").trim();
    const body = [
      "(function () {",
      "  window.WiseCapacityTrackerConfig = window.WiseCapacityTrackerConfig || {};",
      "  window.WiseCapacityTrackerConfig.absence = window.WiseCapacityTrackerConfig.absence || {};",
      "  window.WiseCapacityTrackerConfig.absence.proxyUrl = " + JSON.stringify(proxyUrl) + ";",
      "}());",
      ""
    ].join("\n");

    return {
      status: proxyUrl ? 200 : 500,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      },
      body: proxyUrl ? body : "throw new Error('Missing CAPTRACK_ABSENCE_PROXY_URL app setting');\n"
    };
  }
});
