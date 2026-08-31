/* Sangkha Inspection - Server-to-server Drive upload bridge
 * Deploy as Web app: Execute as Me, Who has access: Anyone
 * The Worker calls this endpoint with application/x-www-form-urlencoded payload.
 * This version returns JSON directly; it does not redirect through an iframe.
 */
const FOLDER_ID = "1yJ-MOxjfAycOezQo_BNBi5z-YkI61u_X";
const MAX_BYTES = 10 * 1024 * 1024;

function doGet() {
  return jsonResult_({ success: true, service: "sangkha-upload-bridge" });
}

function doPost(e) {
  try {
    const body = JSON.parse(String(e?.parameter?.payload || "{}"));
    const ticket = String(body.ticket || "");
    const secret = PropertiesService.getScriptProperties().getProperty("BRIDGE_SECRET") || "";
    const ticketData = verifyTicket_(ticket, secret);
    if (!ticketData) return jsonResult_({ success: false, message: "Upload ticket ไม่ถูกต้องหรือหมดอายุ" });

    const photo = body.photoData || {};
    const match = String(photo.base64 || "").match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) return jsonResult_({ success: false, message: "รูปหลักฐานมีรูปแบบไม่ถูกต้อง" });

    const bytes = Utilities.base64Decode(match[2].replace(/\s/g, ""));
    if (bytes.length > MAX_BYTES) return jsonResult_({ success: false, message: "รูปหลักฐานมีขนาดเกิน 10 MB" });

    const mimeType = String(photo.mimeType || match[1] || "image/jpeg");
    const originalName = String(photo.fileName || "evidence.jpg").replace(/[^a-zA-Z0-9ก-๙._-]/g, "_");
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Bangkok", "yyyyMMdd_HHmmss");
    const file = DriveApp.getFolderById(FOLDER_ID).createFile(
      Utilities.newBlob(bytes, mimeType, `inspection_${stamp}_${originalName}`)
    );

    const publicLink = String(PropertiesService.getScriptProperties().getProperty("PUBLIC_LINK") || "false").toLowerCase() === "true";
    if (publicLink) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return jsonResult_({
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      url: `https://drive.google.com/file/d/${file.getId()}/view`
    });
  } catch (error) {
    console.error(error);
    return jsonResult_({ success: false, message: String(error?.message || error) });
  }
}

function verifyTicket_(ticket, secret) {
  try {
    if (!secret) return null;
    const parts = ticket.split(".");
    if (parts.length !== 2) return null;
    const payloadText = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    const payload = JSON.parse(payloadText);
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    const expected = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(parts[0], secret)
    ).replace(/=+$/, "");
    return expected === parts[1] ? payload : null;
  } catch (error) {
    return null;
  }
}

function jsonResult_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function testFolderAccess() {
  console.log(DriveApp.getFolderById(FOLDER_ID).getName());
}
