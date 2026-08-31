/* Civic Signal live data layer: keeps the original red glassmorphism pages while replacing mock content with role-scoped Worker data. */
(function () {
  "use strict";

  var config = window.SANGKHA_CONFIG || {};
  var baseUrl = String(config.API_BASE_URL || "").replace(/\/$/, "");
  var sessionId = new URLSearchParams(location.search).get("sessionId") || sessionStorage.getItem("sessionId") || "";
  var rawUser = sessionStorage.getItem("user") || "";
  var user = {};
  try { user = rawUser ? JSON.parse(rawUser) : {}; } catch (_) { user = {}; }
  if (!Object.keys(user).length && sessionId) {
    try {
      var payload = sessionId.split(".")[0];
      var base64 = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4);
      user = JSON.parse(atob(base64));
      sessionStorage.setItem("sessionId", sessionId);
      sessionStorage.setItem("user", JSON.stringify(user));
    } catch (_) { user = {}; }
  }
  var normalizedPath = location.pathname.replace(/\/+$/, "");
  var page = normalizedPath.split("/").pop() || "index.html";
  var isAdminPage = /^admin(?:-|\.html|$)/i.test(page);
  var isSupervisorPage = /^supervisor(?:-|\.html|$)/i.test(page);
  var isInspectorPage = /^inspector(?:\.html)?$/i.test(page);
  var isHubPage = /^(admin|admin-main|supervisor)(?:\.html)?$/i.test(page);
  var currentData = {};

  function showAccessDenied(message) {
    var render = function () {
      document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#fff7f5;color:#142436;font-family:system-ui,sans-serif"><section style="max-width:520px;padding:28px;border:1px solid #f1d9d4;border-left:5px solid #ab0013;border-radius:18px;background:#fff;box-shadow:0 14px 32px rgba(72,18,20,.12);text-align:center"><h1 style="margin:0 0 10px;color:#ab0013;font-size:1.35rem">ไม่สามารถเปิดหน้านี้ได้</h1><p style="margin:0 0 18px">' + escapeHtml(message || "กรุณาเข้าสู่ระบบก่อนใช้งาน") + '</p><a href="/" style="display:inline-block;padding:10px 18px;border-radius:9px;background:#ab0013;color:#fff;text-decoration:none;font-weight:700">กลับหน้าเข้าสู่ระบบ</a></section></main>';
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true }); else render();
  }

  if (!baseUrl || (!isAdminPage && !isSupervisorPage && !isInspectorPage)) return;
  if (!sessionId) { showAccessDenied("กรุณาเข้าสู่ระบบก่อนใช้งานหน้านี้"); return; }
  var role = String(user.Role || user.role || "").trim().toUpperCase();
  if ((isAdminPage && role !== "ADMIN") || (isSupervisorPage && role !== "SUPERVISOR") || (isInspectorPage && role !== "INSPECTOR")) {
    showAccessDenied("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานหน้านี้");
    return;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function value(row, keys, fallback) {
    for (var i = 0; i < keys.length; i += 1) {
      var found = row && row[keys[i]];
      if (found !== undefined && found !== null && String(found).trim() !== "") return String(found).trim();
    }
    return fallback == null ? "-" : String(fallback);
  }

  function score(row) {
    var direct = Number(value(row, ["Average_Score", "AverageScore", "Score_Percent", "ScorePercent"], "NaN"));
    if (Number.isFinite(direct)) return direct <= 1 ? direct * 100 : direct;
    var total = Number(value(row, ["Total_Score", "TotalScore", "Score"], "NaN"));
    return Number.isFinite(total) ? total : NaN;
  }

  function dateText(row) { return value(row, ["Date", "Timestamp", "Created_At", "CreatedAt"], "-"); }
  function locationText(row) { return value(row, ["Location_Name", "Location_ID", "Room", "Location"], "-"); }
  function roleText(row) { return value(row, ["Role"], "-").toUpperCase(); }
  function numberText(number) { return Number.isFinite(Number(number)) ? String(number) : "0"; }
  function formatAverage(number) { return Number.isFinite(Number(number)) ? Number(number).toFixed(1) : "0.0"; }

  async function request(path) {
    var response = await fetch(baseUrl + path, { headers: { Accept: "application/json", Authorization: "Bearer " + sessionId } });
    var text = await response.text();
    var data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text || "ระบบตอบกลับไม่ใช่ JSON" }; }
    if (!response.ok) throw new Error(data.message || "เชื่อมต่อข้อมูลไม่สำเร็จ");
    return data;
  }

  function table(headers, rows) {
    if (!rows.length) return '<div class="live-empty">ยังไม่มีข้อมูลในชุดข้อมูลที่ผู้ใช้มีสิทธิ์ดู</div>';
    return '<div class="live-table-wrap"><table class="live-table"><thead><tr>' + headers.map(function (header) { return '<th>' + escapeHtml(header) + '</th>'; }).join("") + '</tr></thead><tbody>' + rows.map(function (row) { return '<tr>' + row.map(function (cell) { return '<td>' + escapeHtml(cell) + '</td>'; }).join("") + '</tr>'; }).join("") + '</tbody></table></div>';
  }

  function stat(label, valueText) {
    return '<div class="live-stat"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(valueText) + '</strong></div>';
  }

  function badge(label, tone) { return '<span class="live-badge ' + (tone || "neutral") + '">' + escapeHtml(label) + '</span>'; }

  function currentDate(data) { return value(data, ["today"], "วันนี้"); }

  function scoreSummaryMarkup(data) {
    var summary = data && data.scoreSummary ? data.scoreSummary : null;
    if (!summary || !summary.periods) return '<div class="live-empty">Worker รุ่นปัจจุบันยังไม่ส่งข้อมูลสรุปคะแนน</div>';
    var period = summary.periods;
    function rowsFor(key) {
      var value = period[key] || {};
      var rows = Array.isArray(value.inspectorLocations) ? value.inspectorLocations : [];
      return rows.map(function (row) { return [row.type, row.locationId, row.inspectorId, String(row.count || 0), formatAverage(row.average)]; });
    }
    function roomRows(key) {
      var value = period[key] || {};
      var rows = Array.isArray(value.rooms) ? value.rooms : [];
      return rows.map(function (row) { return [row.type, row.locationId, row.locationName, row.grade, String(row.count || 0), formatAverage(row.average)]; });
    }
    return '<h3>สรุปคะแนนแยกห้องและผู้ตรวจ</h3>' + '<div class="live-period-grid">' + [
      ["รายวัน", "daily"], ["รายสัปดาห์", "weekly"], ["รายเดือน", "monthly"]
    ].map(function (item) { var p = period[item[1]] || {}; return '<section class="live-period"><strong>' + item[0] + '</strong><span>ส่งสำเร็จ ' + String(p.submitted || 0) + ' รายการ · เฉลี่ย ' + formatAverage(p.average) + '</span>' + table(["ประเภท", "รหัสห้อง/เขต", "ชื่อห้อง/เขต", "ชั้น", "จำนวน", "เฉลี่ย"], roomRows(item[1])) + '<details><summary>ดูค่าเฉลี่ยรายผู้ตรวจต่อห้อง</summary>' + table(["ประเภท", "รหัสห้อง/เขต", "ผู้ตรวจ", "จำนวน", "เฉลี่ย"], rowsFor(item[1])) + '</details></section>'; }).join("") + '</div>';
  }

  function adminMarkup(data) {
    var users = Array.isArray(data.users) ? data.users : [];
    var locations = Array.isArray(data.locations) ? data.locations : [];
    var logs = Array.isArray(data.logs) ? data.logs : [];
    var today = currentDate(data);
    var logsToday = logs.filter(function (row) { return dateText(row).indexOf(today) === 0; });
    var completedIds = new Set(logsToday.map(function (row) { return locationText(row).toUpperCase(); }));
    var summary = data && data.success ? data : {};
    var common = '<div class="live-meta">ข้อมูลจริงจาก Worker · วันที่ระบบ ' + escapeHtml(today) + ' · บัญชี ' + escapeHtml(value(data.user || user, ["Full_Name", "Student_ID"], "Admin")) + '</div>';
    var content;
    if (/admin-users/.test(page)) {
      content = '<h3>ผู้ใช้จากชีต Users</h3>' + table(["รหัสผู้ใช้", "ชื่อ", "บทบาท", "ชั้น", "ประเภท", "สถานะ"], users.map(function (row) { return [value(row, ["Student_ID"]), value(row, ["Full_Name"]), roleText(row), value(row, ["Assigned_Grade"]), value(row, ["Assigned_Type"]), value(row, ["Inspector_Status"], "-")]; }));
    } else if (/admin-locations/.test(page)) {
      content = '<h3>สถานที่จากชีต Locations</h3>' + table(["รหัส", "สถานที่", "ชั้น", "ประเภท", "SME", "สถานะวันนี้"], locations.map(function (row) { var id = locationText(row); return [value(row, ["Location_ID"]), value(row, ["Location_Name"], id), value(row, ["Grade_Level"]), value(row, ["Type"]), value(row, ["Is_SME"], "-") , completedIds.has(id.toUpperCase()) ? "ตรวจแล้ว" : "ยังไม่ตรวจ"]; }));
    } else if (/admin-inspection/.test(page)) {
      content = '<h3>ผลตรวจวันนี้จากชีต Inspection_Logs</h3>' + table(["เวลา/วันที่", "สถานที่", "ผู้ตรวจ", "คะแนน", "รูปหลักฐาน", "หมายเหตุ"], logsToday.map(function (row) { return [dateText(row), locationText(row), value(row, ["Inspector_ID", "Student_ID"]), Number.isFinite(score(row)) ? formatAverage(score(row)) : "-", value(row, ["Photo_URL", "PhotoUrl", "Evidence_URL"], "มี/ไม่มีตามข้อมูล"), value(row, ["Remark", "Comment"], "-")]; }));
    } else if (/admin-ranking/.test(page)) {
      var groups = {};
      logsToday.forEach(function (row) { var id = value(row, ["Inspector_ID", "Student_ID"], "ไม่ระบุ"); groups[id] = groups[id] || []; if (Number.isFinite(score(row))) groups[id].push(score(row)); });
      var ranking = Object.keys(groups).map(function (id) { var values = groups[id]; return [id, values.length ? formatAverage(values.reduce(function (a, b) { return a + b; }, 0) / values.length) : "-", String(values.length)]; }).sort(function (a, b) { return Number(b[1]) - Number(a[1]); });
      content = '<h3>อันดับจากผลตรวจวันนี้</h3>' + table(["ผู้ตรวจ", "คะแนนเฉลี่ย", "จำนวนรายการ"], ranking.slice(0, 50));
    } else if (/admin-reports/.test(page)) {
      content = '<h3>รายงานจากข้อมูลจริง</h3>' + table(["รายการ", "ค่า"], [["สถานที่ทั้งหมด", numberText(locations.length)], ["รายการตรวจวันนี้", numberText(logsToday.length)], ["ผู้ใช้ในระบบ", numberText(users.length)], ["ค่าเฉลี่ยวันนี้", formatAverage(logsToday.map(score).filter(Number.isFinite).reduce(function (a, b, _, arr) { return a + b / arr.length; }, 0))], ["ข้อมูลวันล่าสุด", today]]) + scoreSummaryMarkup(data);
    } else if (/admin-dashboard/.test(page)) {
      content = '<h3>ภาพรวมคะแนน Admin</h3>' + scoreSummaryMarkup(data);
    } else if (/admin-calendar/.test(page)) {
      var dates = {};
      logs.forEach(function (row) { var d = dateText(row).slice(0, 10) || "ไม่ระบุ"; dates[d] = (dates[d] || 0) + 1; });
      content = '<h3>ปฏิทินผลตรวจจาก Inspection_Logs</h3>' + table(["วันที่", "จำนวนรายการ"], Object.keys(dates).sort().reverse().slice(0, 60).map(function (d) { return [d, String(dates[d])]; }));
    } else if (/admin-settings/.test(page)) {
      var settings = Array.isArray(data.settings) ? data.settings : [];
      content = '<h3>ค่าระบบจาก System_Settings</h3>' + table(["ชื่อการตั้งค่า", "ค่า"], settings.reduce(function (rows, row) { Object.keys(row).forEach(function (key) { rows.push([key, value(row, [key])]); }); return rows; }, []));
    } else if (/admin-(approval|maintenance|attendance|proxy|alerts|audit-log)/.test(page)) {
      var label = /approval/.test(page) ? "รายการสำหรับศูนย์อนุมัติ" : /maintenance/.test(page) ? "รายการแจ้งซ่อมที่มีในข้อมูล" : /attendance/.test(page) ? "สถานะกรรมการจาก Users" : /proxy/.test(page) ? "รายการที่เกี่ยวข้องกับการตรวจแทน" : /alerts/.test(page) ? "รายการแจ้งเตือนจากผลตรวจ" : "ประวัติการใช้งานจาก Inspection_Logs";
      var rows = /attendance/.test(page) ? users.filter(function (row) { return roleText(row) === "INSPECTOR"; }).map(function (row) { return [value(row, ["Student_ID"]), value(row, ["Full_Name"]), value(row, ["Inspector_Status"], "ยังไม่มีข้อมูล")]; }) : logsToday.map(function (row) { return [dateText(row), locationText(row), value(row, ["Inspector_ID", "Student_ID"]), value(row, ["Remark", "Status", "Approval_Status"], "ไม่มีคอลัมน์เฉพาะรายการ")]; });
      content = '<h3>' + label + '</h3>' + table(/attendance/.test(page) ? ["รหัส", "ชื่อ", "สถานะ"] : ["วันที่", "สถานที่", "ผู้ตรวจ", "รายละเอียด"], rows);
    } else {
      content = '<h3>ภาพรวมข้อมูลจริงของ Admin</h3>' + table(["รายการ", "ค่า"], [["ตรวจแล้ววันนี้", numberText(summary.completed != null ? summary.completed : completedIds.size)], ["ยังไม่ตรวจวันนี้", numberText(summary.pending != null ? summary.pending : Math.max(0, locations.length - completedIds.size))], ["สถานที่ทั้งหมด", numberText(summary.totalLocations != null ? summary.totalLocations : locations.length)], ["ผู้ใช้", numberText(summary.users != null ? summary.users : users.length)], ["คะแนนเฉลี่ย", formatAverage(summary.average != null ? summary.average : 0)]]);
    }
    return common + content;
  }

  function supervisorMarkup(data) {
    var locations = Array.isArray(data.locations) ? data.locations : [];
    var logs = Array.isArray(data.logs) ? data.logs : [];
    var committee = Array.isArray(data.committee) ? data.committee : [];
    var today = currentDate(data);
    var logsToday = logs.filter(function (row) { return dateText(row).indexOf(today) === 0; });
    var summary = data && data.summary ? data.summary : {};
    var content;
    if (/supervisor-attendance/.test(page) || /supervisor-substitute/.test(page)) {
      content = '<h3>กรรมการในขอบเขตที่มีสิทธิ์</h3>' + table(["รหัส", "ชื่อ", "ชั้น", "สถานะ"], committee.map(function (row) { return [value(row, ["Student_ID"]), value(row, ["Full_Name"]), value(row, ["Assigned_Grade"]), value(row, ["Inspector_Status"], "ยังไม่มีข้อมูล")]; }));
    } else if (/supervisor-score-requests/.test(page)) {
      content = '<h3>รายการคะแนนในขอบเขต Supervisor</h3>' + table(["วันที่", "สถานที่", "ผู้ตรวจ", "คะแนน", "หมายเหตุ"], logs.map(function (row) { return [dateText(row), locationText(row), value(row, ["Inspector_ID", "Student_ID"]), Number.isFinite(score(row)) ? formatAverage(score(row)) : "-", value(row, ["Remark", "Approval_Status"], "-")]; }));
    } else if (/supervisor-repairs/.test(page)) {
      content = '<h3>ข้อมูลที่อาจต้องติดตามจากผลตรวจ</h3>' + table(["วันที่", "สถานที่", "รายละเอียด"], logs.filter(function (row) { return value(row, ["Remark", "Comment"], "").trim() !== ""; }).map(function (row) { return [dateText(row), locationText(row), value(row, ["Remark", "Comment"])]; }));
    } else if (/supervisor-history/.test(page)) {
      content = '<h3>ประวัติการตรวจในขอบเขต Supervisor</h3>' + table(["วันที่", "สถานที่", "ผู้ตรวจ", "คะแนน"], logs.map(function (row) { return [dateText(row), locationText(row), value(row, ["Inspector_ID", "Student_ID"]), Number.isFinite(score(row)) ? formatAverage(score(row)) : "-"]; })) + scoreSummaryMarkup(data);
    } else {
      content = '<h3>สถานที่ในขอบเขต Supervisor</h3>' + table(["รหัส", "สถานที่", "ชั้น", "ประเภท", "สถานะวันนี้"], locations.map(function (row) { return [value(row, ["Location_ID"]), value(row, ["Location_Name", "Location_ID"]), value(row, ["Grade_Level"]), value(row, ["Type"]), value(row, ["Completed"], "-") === "true" ? "ตรวจแล้ว" : "ยังไม่ตรวจ"]; })) + scoreSummaryMarkup(data);
    }
    return '<div class="live-meta">ข้อมูลจริงแบบจำกัดสิทธิ์จาก Worker · วันที่ระบบ ' + escapeHtml(today) + ' · ' + escapeHtml(value(data.user || user, ["Full_Name", "Student_ID"], "Supervisor")) + '</div>' + '<div class="live-stats">' + stat("สถานที่ในขอบเขต", numberText(locations.length)) + stat("ผลตรวจวันนี้", numberText(logsToday.length)) + stat("กรรมการ", numberText(committee.length)) + stat("คะแนนเฉลี่ย", formatAverage(logsToday.map(score).filter(Number.isFinite).reduce(function (a, b, _, arr) { return a + b / arr.length; }, 0))) + '</div>' + content;
  }

  function addStyles() {
    if (document.getElementById("live-data-styles")) return;
    var style = document.createElement("style");
    style.id = "live-data-styles";
    style.textContent = ".live-panel{margin:18px 0 28px;padding:20px;border:1px solid #e2e8f0;border-left:5px solid #ab0013;border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(255,248,246,.92));box-shadow:0 14px 32px rgba(72,18,20,.10);color:#142436}.live-panel h3{margin:0 0 12px;font-family:Kanit, sans-serif;font-size:1.25rem;color:#ab0013}.live-meta{margin-bottom:14px;font-size:.82rem;color:#71808c}.live-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 18px}.live-stat{padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #f1d9d4}.live-stat span{display:block;font-size:.75rem;color:#71808c}.live-stat strong{display:block;margin-top:4px;font-size:1.45rem;color:#142436}.live-table-wrap{overflow:auto;border:1px solid #e5e8ea;border-radius:12px;background:#fff}.live-table{width:100%;min-width:620px;border-collapse:collapse;font-size:.85rem}.live-table th,.live-table td{padding:10px 12px;border-bottom:1px solid #eef0f2;text-align:left;vertical-align:top}.live-table th{background:#fff4f2;color:#7b1e22;font-weight:700;white-space:nowrap}.live-table tr:last-child td{border-bottom:0} .live-empty{padding:18px;border-radius:12px;background:#fff8f6;color:#71808c}.live-error{padding:14px;border-radius:12px;background:#fff2f1;color:#93000a}.live-actions{margin-top:14px;padding:14px;border-top:1px solid #f1d9d4;background:#fffaf9}.live-actions form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}.live-field{display:flex;flex-direction:column;gap:4px;font-size:.78rem;color:#7b1e22}.live-field input{padding:9px;border:1px solid #e3c9c4;border-radius:8px;background:#fff;color:#142436}.live-actions button{grid-column:1/-1;padding:10px;border:0;border-radius:9px;background:#ab0013;color:#fff;font-weight:700;cursor:pointer}.live-action-status{grid-column:1/-1;color:#7b1e22;font-size:.82rem}@media(max-width:760px){.live-actions{grid-template-columns:1fr}}.live-period-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.live-period{padding:12px;border:1px solid #f1d9d4;border-radius:12px;background:#fffaf9}.live-period>strong,.live-period>span{display:block}.live-period>strong{color:#7b1e22}.live-period>span{margin:4px 0 10px;font-size:.78rem;color:#71808c}.live-period .live-table-wrap{margin-top:8px}.live-period details{margin-top:10px;font-size:.82rem;color:#7b1e22}.live-period summary{cursor:pointer;font-weight:700}@media(max-width:980px){.live-period-grid{grid-template-columns:1fr}}.live-badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:.72rem}.live-badge.success{background:#d1fae5;color:#065f46}.live-badge.neutral{background:#eef2f7;color:#475569}@media(max-width:760px){.live-panel{padding:15px}.live-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.live-table{min-width:560px}}";
    document.head.appendChild(style);
  }

  function removeMockHandlers() {
    document.querySelectorAll('[data-action="mock"]').forEach(function (element) {
      var aria = element.getAttribute("aria-label") || "";
      if (aria === "การแจ้งเตือน" || aria === "บัญชีผู้ใช้") return;
      element.removeAttribute("data-action");
      element.setAttribute("data-live-action", "true");
      element.title = "เปิดฟังก์ชันจริง";
    });
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue || "";
      if (/mock UI|mock only|โหมดตัวอย่าง|ข้อมูลตัวอย่าง|ยังไม่เชื่อมระบบ|รายการตัวอย่าง/.test(text)) {
        node.nodeValue = text
          .replace(/Admin module · mock/gi, "Admin module · ข้อมูลจริง")
          .replace(/mock UI/gi, "ข้อมูลจริงจาก Worker")
          .replace(/mock only/gi, "ข้อมูลจริงจาก Worker")
          .replace(/โหมดตัวอย่าง/g, "ข้อมูลจริง")
          .replace(/ข้อมูลตัวอย่าง/g, "ข้อมูลจากระบบ")
          .replace(/ยังไม่เชื่อมระบบ/g, "พร้อมตรวจสอบจากระบบ")
          .replace(/รายการตัวอย่าง/g, "รายการจากระบบ");
      }
    }
  }

  function wireHeaderActions() {
    document.querySelectorAll('[aria-label="การแจ้งเตือน"]').forEach(function (button) {
      if (button.dataset.liveHeaderBound) return;
      button.dataset.liveHeaderBound = "true";
      button.removeAttribute("data-action");
      button.title = "เปิดรายการที่ต้องติดตาม";
      button.addEventListener("click", function () { location.href = isAdminPage ? "admin-alerts.html" : "supervisor-repairs.html"; });
    });
    document.querySelectorAll('[aria-label="บัญชีผู้ใช้"]').forEach(function (button) {
      if (button.dataset.liveHeaderBound) return;
      button.dataset.liveHeaderBound = "true";
      button.removeAttribute("data-action");
      button.title = "ออกจากระบบ";
      button.addEventListener("click", async function () {
        try { if (window.SangkhaAPI && SangkhaAPI.logout) await SangkhaAPI.logout(); } catch (error) { console.warn("logout request failed", error); }
        sessionStorage.removeItem("sessionId");
        location.href = "login.html";
      });
    });
  }

  function syncIdentity(data) {
    var identity = data && data.user ? data.user : user;
    var name = value(identity, ["Full_Name", "Name", "Student_ID"], "ผู้ใช้งาน");
    var id = value(identity, ["Student_ID", "Username"], "-");
    document.querySelectorAll("[data-live-user-name]").forEach(function (node) { node.textContent = name; });
    document.querySelectorAll("[data-live-user-id]").forEach(function (node) { node.textContent = id; });
    var supervisorName = document.getElementById("supervisorName");
    var supervisorId = document.getElementById("supervisorId");
    if (supervisorName) supervisorName.textContent = name;
    if (supervisorId) supervisorId.textContent = "Supervisor | ID: " + id;
    var assignment = document.getElementById("supervisorAssignment");
    if (assignment) assignment.textContent = "เขตรับผิดชอบ: " + (value(identity, ["Assigned_Type"], "CLASSROOM").toUpperCase() === "ZONE" ? "เขตพื้นที่ " : "ห้องเรียน ") + "ม." + value(identity, ["Assigned_Grade"], "-");
    if (isAdminPage && isHubPage) {
      document.querySelectorAll("main section").forEach(function (section) {
        var sectionText = (section.textContent || "").trim();
        if (sectionText.indexOf("ผู้ใช้งานปัจจุบัน") === 0) {
          var heading = section.querySelector("h2");
          var detail = section.querySelector("p");
          if (heading) heading.textContent = name;
          if (detail) detail.textContent = "Admin · รหัสผู้ใช้งาน: " + id;
        }
      });
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.includes("นายกิตติพงศ์ ใจดี")) node.nodeValue = node.nodeValue.replaceAll("นายกิตติพงศ์ ใจดี", name);
      if (node.nodeValue.includes("ADM001")) node.nodeValue = node.nodeValue.replaceAll("ADM001", id);
    }
  }

  function removeLegacyContent() {
    var main = document.querySelector("main"); if (!main || isHubPage) return;
    var keep = /admin-dashboard/.test(page) ? main.firstElementChild : null;
    Array.prototype.slice.call(main.children).forEach(function (element) {
      if (element.id === "live-data-panel" || element.id === "live-actions" || element === keep) return;
      element.remove();
    });
  }

  function syncLegacyCards(data) {
    var locations = data && Array.isArray(data.locations) ? data.locations : [];
    var logs = data && Array.isArray(data.logs) ? data.logs : [];
    var today = currentDate(data);
    var committeeValue = data && data.committee;
    var committeeCount = Array.isArray(committeeValue) ? committeeValue.length : (Number.isFinite(Number(committeeValue)) ? Number(committeeValue) : null);
    var completedValue = data && data.completed;
    var pendingValue = data && data.pending;
    var averageValue = data && data.average;
    var completed = Number.isFinite(Number(completedValue)) ? Number(completedValue) : (locations.length ? locations.filter(function (row) { return String(row.Completed).toLowerCase() === "true"; }).length : null);
    var pending = Number.isFinite(Number(pendingValue)) ? Number(pendingValue) : (locations.length && completed != null ? Math.max(0, locations.length - completed) : null);
    var numericScores = logs.map(score).filter(Number.isFinite);
    var average = Number.isFinite(Number(averageValue)) ? Number(averageValue) : (numericScores.length ? numericScores.reduce(function (sum, value) { return sum + value; }, 0) / numericScores.length : null);
    var todayScores = logs.filter(function (row) { return dateText(row).indexOf(today) === 0; }).map(score).filter(Number.isFinite);
    var todayAverage = todayScores.length ? todayScores.reduce(function (sum, value) { return sum + value; }, 0) / todayScores.length : null;
    var displayCount = function (value) { return value == null ? "—" : String(value); };
    var displayAverage = function (value) { return value == null ? "—" : formatAverage(value); };
    var displayTodayAverage = function (value) { return value == null ? "ยังไม่มีผลตรวจ" : formatAverage(value); };
    var mappings = { statCompleted: displayCount(completed), statPending: displayCount(pending), statCommittee: displayCount(committeeCount), statAverage: displayAverage(average), statAverageToday: displayTodayAverage(todayAverage) };
    Object.keys(mappings).forEach(function (id) { var node = document.getElementById(id); if (node) node.textContent = String(mappings[id]); });
    document.querySelectorAll("p,span").forEach(function (node) {
      var text = (node.textContent || "").trim();
      if (/Mock Real-time|ข้อมูลตัวอย่าง/.test(text)) node.textContent = "Live data จาก Worker";
    });
  }

  function actionForPage() {
    if (/admin-users/.test(page)) return { title: "เพิ่มผู้ใช้งาน", action: "user_create", fields: [["Student_ID","รหัสผู้ใช้"],["Full_Name","ชื่อ-นามสกุล"],["Role","บทบาท (ADMIN/SUPERVISOR/INSPECTOR)"],["PIN","รหัสผ่าน"],["Assigned_Grade","ชั้น"],["Assigned_Type","ประเภท"],["Assigned_Locations","สถานที่ที่รับผิดชอบ"]] };
    if (/admin-locations/.test(page)) return { title: "เพิ่มสถานที่", action: "location_create", fields: [["Location_ID","รหัสสถานที่"],["Location_Name","ชื่อสถานที่"],["Grade_Level","ชั้น"],["Type","ประเภท"],["Is_SME","เป็น SME หรือไม่ (TRUE/FALSE)"]] };
    if (/admin-calendar/.test(page)) return { title: "เพิ่มกิจกรรม/วันงดตรวจ", action: "calendar_event", fields: [["Event_Date","วันที่ (YYYY-MM-DD)"],["Event_Name","ชื่อกิจกรรม"],["Skip_Type","งดตรวจอะไร (NONE/ZONE/CLASSROOM/ALL)"],["Detail","รายละเอียด"]] };
    if (/admin-settings/.test(page)) return { title: "บันทึกการตั้งค่า", action: "settings_update", fields: [["Key","ชื่อการตั้งค่า"],["Value","ค่า"]] };
    if (/admin-(approval|approval)/.test(page)) return { title: "บันทึกผลอนุมัติ", action: "approval_update", fields: [["Request_ID","รหัสคำขอ"],["Status","สถานะ (APPROVED/REJECTED)"],["Remark","หมายเหตุ"]] };
    if (/admin-(maintenance|repairs)/.test(page)) return { title: "รับแจ้งซ่อม", action: "repair_update", fields: [["Location_ID","รหัสสถานที่"],["Detail","รายละเอียดปัญหา"],["Status","สถานะ"]] };
    if (/admin-attendance/.test(page)) return { title: "บันทึกการเช็คชื่อ", action: "attendance_update", fields: [["Inspector_ID","รหัส Inspector"],["Attendance_Date","วันที่ (YYYY-MM-DD)"],["Status","สถานะ (มา/ลา/ลากิจ/ป่วย/กิจกรรม/อื่นๆ)"],["Remark","หมายเหตุ"]] };
    if (/admin-(proxy|override)/.test(page)) return { title: "สร้าง Master Override", action: "override", fields: [["Effective_Date","วันที่มีผล (YYYY-MM-DD)"],["Scope","ขอบเขต (ZONE/CLASSROOM/ALL)"],["Detail","รายละเอียดคำสั่ง"]] };
    if (/admin-reports/.test(page)) return { title: "ส่งออกรายงาน", action: "export_audit", fields: [["date","วันที่รายงาน (YYYY-MM-DD)"]] };
    if (/supervisor-attendance/.test(page)) return { title: "เช็คชื่อ Inspector", action: "attendance_update", fields: [["Inspector_ID","รหัส Inspector"],["Attendance_Date","วันที่ (YYYY-MM-DD)"],["Status","สถานะ (มา/ลา/ลากิจ/ป่วย/กิจกรรม/อื่นๆ)"],["Remark","หมายเหตุ"]] };
    if (/supervisor-substitute/.test(page)) return { title: "ขอประเมินตรวจแทน", action: "substitute_request", fields: [["Inspector_ID","รหัส Inspector"],["Request_ID","รหัสคำขอ"],["Evaluation","ผลประเมิน"],["Remark","หมายเหตุ"]] };
    if (/supervisor-score-requests/.test(page)) return { title: "ขอแก้ไขคะแนน", action: "score_review", fields: [["Log_ID","รหัสผลตรวจ"],["Requested_Score","คะแนนที่ขอแก้"],["Reason","เหตุผล"]] };
    if (/supervisor-repairs/.test(page)) return { title: "รับแจ้งซ่อม", action: "repair_update", fields: [["Location_ID","รหัสสถานที่"],["Detail","รายละเอียดปัญหา"],["Status","สถานะ"]] };
    return null;
  }

  function buildActionPanel() {
    var spec = actionForPage();
    if (!spec) return "";
    var fields = spec.fields.map(function (field) { return '<label class="live-field">' + escapeHtml(field[1]) + '<input name="' + escapeHtml(field[0]) + '" placeholder="' + escapeHtml(field[1]) + '" required></label>'; }).join("");
    return '<div class="live-actions"><strong>' + escapeHtml(spec.title) + '</strong><form id="live-action-form" data-action-name="' + escapeHtml(spec.action) + '">' + fields + '<button type="submit">บันทึกข้อมูลจริง</button><span class="live-action-status" aria-live="polite"></span></form></div>';
  }

  async function submitAction(form) {
    var action = form.getAttribute("data-action-name");
    var record = {};
    Array.prototype.forEach.call(form.querySelectorAll("[name]"), function (input) { record[input.name] = input.value.trim(); });
    var status = form.querySelector(".live-action-status");
    if (status) status.textContent = "กำลังบันทึก...";
    try {
      if (action === "export_audit") {
        var date = record.date || new Date().toISOString().slice(0, 10);
        await window.SangkhaAPI.exportAudit(date);
        var rows = Array.isArray(currentData.logs) ? currentData.logs.filter(function (row) { return dateText(row).indexOf(date) === 0; }) : [];
        var keys = rows.length ? Object.keys(rows[0]) : ["วันที่","ข้อมูล"];
        var csv = [keys.join(",")].concat(rows.map(function (row) { return keys.map(function (key) { return '"' + String(row[key] == null ? "" : row[key]).replace(/"/g, '""') + '"'; }).join(","); })).join("\\n");
        var blob = new Blob(["\\ufeff" + csv], { type: "text/csv;charset=utf-8" }); var link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "sangkha-report-" + date + ".csv"; link.click();
      } else await window.SangkhaAPI.managementAction(action, record);
      if (status) status.textContent = "บันทึกสำเร็จ";
    } catch (error) { if (status) status.textContent = error.message || "บันทึกไม่สำเร็จ"; }
  }

  function mountActions() {
    var main = document.querySelector("main"); if (!main) return;
    var old = document.getElementById("live-actions"); if (old) old.remove();
    var wrapper = document.createElement("section"); wrapper.id = "live-actions"; wrapper.className = "live-panel"; wrapper.innerHTML = buildActionPanel();
    if (wrapper.innerHTML) main.insertBefore(wrapper, document.getElementById("live-data-panel") ? document.getElementById("live-data-panel").nextSibling : main.firstElementChild);
    var form = wrapper.querySelector("#live-action-form"); if (form) form.addEventListener("submit", function (event) { event.preventDefault(); submitAction(form); });
    document.querySelectorAll("[data-live-action]").forEach(function (element) { element.addEventListener("click", function (event) { if (!actionForPage()) return; event.preventDefault(); wrapper.scrollIntoView({ behavior: "smooth", block: "center" }); var first = wrapper.querySelector("input"); if (first) first.focus(); }); });
  }

  function render(markup, data) {
    currentData = data || {};
    addStyles();
    removeMockHandlers();
    wireHeaderActions();
    addStyles();
    syncIdentity(data);
    syncLegacyCards(data);
    if (isHubPage) return;
    removeLegacyContent();
    var main = document.querySelector("main");
    if (!main) return;
    var panel = document.createElement("section");
    panel.id = "live-data-panel";
    panel.className = "live-panel";
    panel.innerHTML = markup;
    var anchor = /admin-dashboard/.test(page) ? main.children[1] || null : main.firstElementChild;
    main.insertBefore(panel, anchor);
    mountActions();
  }

  function renderError(error) {
    render('<h3>โหลดข้อมูลจริงไม่สำเร็จ</h3><div class="live-error">' + escapeHtml(error && error.message ? error.message : "ระบบตอบกลับผิดพลาด") + '</div>', {});
  }

  (async function () {
    try {
      var data = isAdminPage ? await request("/admin/data") : await request("/supervisor/data");
      render(isAdminPage ? '<div class="live-stats">' + stat("ตรวจแล้ววันนี้", numberText(data.completed)) + stat("รอตรวจ", numberText(data.pending)) + stat("สถานที่ทั้งหมด", numberText(data.totalLocations)) + stat("คะแนนเฉลี่ย", formatAverage(data.average)) + '</div>' + adminMarkup(data) : supervisorMarkup(data), data);
    } catch (error) {
      renderError(error);
    }
  })();
})();
