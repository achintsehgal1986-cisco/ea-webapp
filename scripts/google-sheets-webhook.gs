/**
 * LC EA Playbook — Google Sheets usage tracker
 *
 * Setup (5 minutes):
 * 1. Create a new Google Sheet
 * 2. Row 1 headers: Timestamp | Event | Email | Customer | Role | Role detail | Skipped setup
 * 3. Extensions → Apps Script → paste this file → save
 * 4. Set WEBHOOK_SECRET below to a long random string (same value as GOOGLE_SHEETS_WEBHOOK_SECRET in .env.local)
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone  (NOT "Anyone with Google account")
 *    - If "Anyone" is missing, your Google Workspace admin must allow public web apps
 * 6. Copy the web app URL into GOOGLE_SHEETS_WEBHOOK_URL in .env.local (and Vercel env vars when deployed)
 */

const WEBHOOK_SECRET = "replace-with-a-long-random-secret";

function doGet() {
  return jsonResponse({ ok: true, message: "LC EA webhook is running. Use POST." });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.secret !== WEBHOOK_SECRET) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([
      new Date(),
      data.eventType || "",
      data.email || "",
      data.customerName || "",
      data.userRole || "",
      data.otherRoleLabel || "",
      data.skippedSetup ? "yes" : "no",
    ]);

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}

function jsonResponse(body, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );

  if (statusCode) {
    // Apps Script web apps don't support HTTP status codes directly in all cases,
    // but the JSON body is enough for our API route to check response.ok via content.
  }

  return output;
}
