var TIMEZONE = 'Asia/Ho_Chi_Minh';
var DEBUG_VERBOSE = true;
var APES_LOGO_URL = 'https://drive.google.com/uc?export=view&id=1zZrUqxbCM1-_iOaV2VW8cuTW14mqzVWt';

function doPost(e) {
  var requestId = makeRequestId();
  try {
    logDebug(requestId, 'Incoming doPost request');
    logDebug(requestId, 'Raw payload', e && e.postData ? e.postData.contents : '(missing)');

    if (!e || !e.postData || !e.postData.contents) {
      return jsonError('Missing request body.', 'INVALID_PAYLOAD', { requestId: requestId, stage: 'validate_payload' });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      logError(requestId, 'JSON parse failed', parseErr);
      return jsonError('Invalid JSON body.', 'INVALID_JSON', {
        requestId: requestId,
        stage: 'parse_json',
        details: String(parseErr)
      });
    }

    var mssv = (payload.mssv || '').toString().trim();
    logDebug(requestId, 'Parsed MSSV', mssv || '(empty)');
    if (!mssv) {
      return jsonError('Missing mssv.', 'MISSING_MSSV', { requestId: requestId, stage: 'validate_mssv' });
    }

    return processCheckin(requestId, mssv);
  } catch (err) {
    logError(requestId, 'Unhandled server error', err);
    return jsonError('Server error.', 'SERVER_ERROR', {
      requestId: requestId,
      stage: 'unhandled',
      details: String(err)
    });
  }
}

function doGet(e) {
  var requestId = makeRequestId();
  try {
    var action = e && e.parameter ? (e.parameter.action || '').toString().trim().toLowerCase() : '';
    var mssv = e && e.parameter ? (e.parameter.mssv || '').toString().trim() : '';
    logDebug(requestId, 'Incoming doGet request', JSON.stringify({ action: action, mssv: mssv }));

    if (action === 'validate_member') {
      if (!mssv) {
        return jsonError('Missing mssv.', 'MISSING_MSSV', { requestId: requestId, stage: 'validate_member' });
      }

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) {
        return jsonError('Spreadsheet not available.', 'SHEET_UNAVAILABLE', { requestId: requestId, stage: 'open_sheet' });
      }

      var membersSheet = ss.getSheetByName('Members');
      if (!membersSheet) {
        return jsonError('Missing Members sheet.', 'SHEET_MISSING', { requestId: requestId, stage: 'find_members_sheet' });
      }

      var memberInfo = findMemberInfo(membersSheet, mssv, requestId);
      if (!memberInfo.found) {
        return jsonResponse({
          ok: true,
          code: 'MEMBER_NOT_FOUND',
          status: 'not_found',
          message: 'MSSV không tồn tại trong danh sách.',
          data: {
            requestId: requestId,
            mssv: mssv
          }
        });
      }

      if (!memberInfo.active) {
        return jsonResponse({
          ok: true,
          code: 'MEMBER_INACTIVE',
          status: 'inactive',
          message: 'MSSV đã có trong danh sách nhưng đang bị khóa.',
          data: {
            requestId: requestId,
            mssv: mssv
          }
        });
      }

      return jsonResponse({
        ok: true,
        code: 'MEMBER_ACTIVE',
        status: 'active',
        message: 'MSSV hợp lệ.',
        data: {
          requestId: requestId,
          mssv: mssv
        }
      });
    }

    return jsonError('Not found.', 'NOT_FOUND', { requestId: requestId, stage: 'do_get' });
  } catch (err) {
    logError(requestId, 'Unhandled GET error', err);
    return jsonError('Server error.', 'SERVER_ERROR', {
      requestId: requestId,
      stage: 'unhandled_get',
      details: String(err)
    });
  }
}

function findMemberInfo(sheet, mssv, requestId) {
  var data = sheet.getDataRange().getValues();
  logDebug(requestId, 'Members rows', String(data.length));
  if (data.length < 2) {
    return { found: false, active: false };
  }

  var header = data[0];
  var idxMssv = header.indexOf('mssv');
  var idxActive = header.indexOf('is_active');
  logDebug(requestId, 'Members columns', JSON.stringify({ idxMssv: idxMssv, idxActive: idxActive }));
  if (idxMssv < 0 || idxActive < 0) {
    return { found: false, active: false };
  }

  for (var i = 1; i < data.length; i++) {
    var value = (data[i][idxMssv] || '').toString().trim();
    if (value === mssv) {
      var active = isTruthy(data[i][idxActive]);
      logDebug(requestId, 'Member matched', JSON.stringify({ row: i + 1, active: active }));
      return { found: true, active: active };
    }
  }

  return { found: false, active: false };
}

function isActiveMember(sheet, mssv, requestId) {
  var memberInfo = findMemberInfo(sheet, mssv, requestId);
  return memberInfo.found && memberInfo.active;
}

function processCheckin(requestId, mssv) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    return jsonError('Spreadsheet not available.', 'SHEET_UNAVAILABLE', { requestId: requestId, stage: 'open_sheet' });
  }

  var membersSheet = ss.getSheetByName('Members');
  var attendanceSheet = ss.getSheetByName('Attendance');
  if (!membersSheet || !attendanceSheet) {
    return jsonError('Missing Members/Attendance sheet.', 'SHEET_MISSING', {
      requestId: requestId,
      stage: 'find_sheets'
    });
  }

  var memberInfo = findMemberInfo(membersSheet, mssv, requestId);
  if (!memberInfo.found) {
    return jsonResponse({
      ok: true,
      code: 'MEMBER_NOT_FOUND',
      status: 'not_found',
      message: 'MSSV không tồn tại trong danh sách.',
      data: {
        requestId: requestId,
        mssv: mssv
      }
    });
  }

  if (!memberInfo.active) {
    return jsonResponse({
      ok: true,
      code: 'MEMBER_INACTIVE',
      status: 'inactive',
      message: 'MSSV đã có trong danh sách nhưng đang bị khóa.',
      data: {
        requestId: requestId,
        mssv: mssv
      }
    });
  }

  var now = new Date();
  var sessionInfo = getSessionInfo(now, TIMEZONE);
  logDebug(requestId, 'Session info', JSON.stringify(sessionInfo));
  if (!sessionInfo.session) {
    return jsonError('Outside of check-in window.', 'OUTSIDE_SESSION', {
      requestId: requestId,
      stage: 'session_window',
      hour: Utilities.formatDate(now, TIMEZONE, 'HH:mm')
    });
  }

  if (hasDuplicateAttendance(attendanceSheet, mssv, sessionInfo.dateStr, sessionInfo.session, requestId)) {
    return jsonAlreadyCheckedIn('Đã check-in rồi.', 'ALREADY_CHECKED_IN', {
      requestId: requestId,
      stage: 'duplicate_check',
      mssv: mssv,
      date: sessionInfo.dateStr,
      session: sessionInfo.session
    });
  }

  var newId = getNextId(attendanceSheet, requestId);
  var row = [
    newId,
    mssv,
    sessionInfo.timeStr,
    sessionInfo.dateStr,
    sessionInfo.session,
    sessionInfo.weekNumber,
    sessionInfo.year
  ];
  logDebug(requestId, 'Appending row', JSON.stringify(row));
  attendanceSheet.appendRow(row);

  var successMessage = sessionInfo.session === 'sang'
    ? 'Check-in thành công - Buổi sáng'
    : 'Check-in thành công - Buổi chiều';

  return jsonSuccess(successMessage, 'CHECKIN_OK', {
    requestId: requestId,
    mssv: mssv,
    session: sessionInfo.session,
    date: sessionInfo.dateStr,
    time: sessionInfo.timeStr
  });
}

function hasDuplicateAttendance(sheet, mssv, dateStr, session, requestId) {
  var data = sheet.getDataRange().getValues();
  logDebug(requestId, 'Attendance rows', String(data.length));
  if (data.length < 2) {
    return false;
  }

  var header = data[0];
  var idxMssv = header.indexOf('mssv');
  var idxDate = header.indexOf('date');
  var idxSession = header.indexOf('session');
  logDebug(requestId, 'Attendance columns', JSON.stringify({ idxMssv: idxMssv, idxDate: idxDate, idxSession: idxSession }));
  if (idxMssv < 0 || idxDate < 0 || idxSession < 0) {
    return false;
  }

  for (var i = 1; i < data.length; i++) {
    var rowMssv = (data[i][idxMssv] || '').toString().trim();
    var rowDateValue = data[i][idxDate];
    var rowDate = '';
    if (rowDateValue instanceof Date) {
      rowDate = Utilities.formatDate(rowDateValue, TIMEZONE, 'yyyy-MM-dd');
    } else {
      rowDate = (rowDateValue || '').toString().trim();
    }
    var rowSession = (data[i][idxSession] || '').toString().trim();
    if (rowMssv === mssv && rowDate === dateStr && rowSession === session) {
      logDebug(requestId, 'Duplicate detected', JSON.stringify({ row: i + 1 }));
      return true;
    }
  }

  return false;
}

function getSessionInfo(now, timezone) {
  var hour = parseInt(Utilities.formatDate(now, timezone, 'H'), 10);
  var minute = parseInt(Utilities.formatDate(now, timezone, 'm'), 10);
  var dateStr = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
  var timeStr = Utilities.formatDate(now, timezone, 'HH:mm:ss');
  var year = parseInt(Utilities.formatDate(now, timezone, 'yyyy'), 10);

  var session = null;
  if (hour >= 8 && (hour < 12 || (hour === 12 && minute === 0))) {
    session = 'sang';
  } else if (hour >= 13 && (hour < 17 || (hour === 17 && minute === 0))) {
    session = 'chieu';
  }

  return {
    session: session,
    dateStr: dateStr,
    timeStr: timeStr,
    weekNumber: getISOWeekNumber(dateStr),
    year: year
  };
}

function getISOWeekNumber(dateStr) {
  var parts = dateStr.split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  var week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(
    ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
}

function getNextId(sheet, requestId) {
  var lastRow = sheet.getLastRow();
  logDebug(requestId, 'Last attendance row', String(lastRow));
  if (lastRow < 2) {
    return 1;
  }

  var lastId = sheet.getRange(lastRow, 1).getValue();
  var idNum = parseInt(lastId, 10);
  if (isNaN(idNum)) {
    return lastRow;
  }

  return idNum + 1;
}

function isTruthy(value) {
  if (value === true) {
    return true;
  }

  var text = (value || '').toString().trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'y';
}

function jsonSuccess(message, code, meta) {
  return jsonResponse({
    ok: true,
    code: code || 'OK',
    status: 'success',
    message: message,
    data: meta || {}
  });
}

function jsonError(message, code, meta) {
  return jsonResponse({
    ok: false,
    code: code || 'ERROR',
    status: 'error',
    message: message,
    data: meta || {}
  });
}

function jsonAlreadyCheckedIn(message, code, meta) {
  return jsonResponse({
    ok: true,
    code: code || 'ALREADY_CHECKED_IN',
    status: 'already_checked_in',
    message: message,
    data: meta || {}
  });
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function logDebug(requestId, message, data) {
  if (!DEBUG_VERBOSE) {
    return;
  }
  var parts = ['[CHECKIN]', '[' + requestId + ']', message];
  if (typeof data !== 'undefined') {
    parts.push(typeof data === 'string' ? data : JSON.stringify(data));
  }
  Logger.log(parts.join(' | '));
}

function logError(requestId, message, err) {
  var details = err && err.stack ? err.stack : String(err);
  Logger.log('[CHECKIN] [' + requestId + '] ERROR | ' + message + ' | ' + details);
}

function makeRequestId() {
  return Utilities.getUuid().slice(0, 8).toUpperCase();
}

function runWeeklyAttendanceAlerts() {
  var requestId = makeRequestId();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error('Spreadsheet not available.');
    }

    var membersSheet = ss.getSheetByName('Members');
    var attendanceSheet = ss.getSheetByName('Attendance');
    if (!membersSheet || !attendanceSheet) {
      throw new Error('Missing Members/Attendance sheet.');
    }

    var weekRange = getPreviousMondayToFridayRange(new Date(), TIMEZONE);
    var members = getMembersForWeeklyAlert(membersSheet, requestId);
    var counts = getAttendanceCountsByMember(attendanceSheet, weekRange.startStr, weekRange.endStr, requestId);

    var sentCount = 0;
    for (var i = 0; i < members.length; i++) {
      var member = members[i];
      var total = counts[member.mssv] || 0;
      if (total >= 2) {
        continue;
      }

      if (!member.email) {
        logDebug(requestId, 'Skip alert (missing email)', JSON.stringify({ mssv: member.mssv }));
        continue;
      }

      sendWeeklyAttendanceAlertEmail(member, total, weekRange, requestId);
      sentCount++;
    }

    logDebug(requestId, 'Weekly attendance alerts sent', JSON.stringify({ sentCount: sentCount, weekRange: weekRange }));
    return jsonSuccess('Weekly attendance alerts processed.', 'WEEKLY_ALERT_DONE', {
      requestId: requestId,
      sentCount: sentCount,
      weekStart: weekRange.startStr,
      weekEnd: weekRange.endStr
    });
  } catch (err) {
    logError(requestId, 'Weekly alert job failed', err);
    return jsonError('Weekly alert job failed.', 'WEEKLY_ALERT_FAILED', {
      requestId: requestId,
      details: String(err)
    });
  }
}

function createWeeklyAttendanceAlertTrigger() {
  ScriptApp.newTrigger('runWeeklyAttendanceAlerts')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
}

function getMembersForWeeklyAlert(sheet, requestId) {
  var data = sheet.getDataRange().getValues();
  var rows = [];
  if (data.length < 2) {
    return rows;
  }

  var header = data[0];
  var idxMssv = header.indexOf('mssv');
  var idxName = header.indexOf('name');
  var idxActive = header.indexOf('is_active');
  var idxEmail = header.indexOf('email');
  logDebug(requestId, 'Weekly alert member columns', JSON.stringify({ idxMssv: idxMssv, idxName: idxName, idxActive: idxActive, idxEmail: idxEmail }));
  if (idxMssv < 0 || idxActive < 0 || idxEmail < 0) {
    return rows;
  }

  for (var i = 1; i < data.length; i++) {
    var mssv = (data[i][idxMssv] || '').toString().trim();
    if (!mssv) {
      continue;
    }
    if (!isTruthy(data[i][idxActive])) {
      continue;
    }

    var name = idxName >= 0 ? (data[i][idxName] || '').toString().trim() : '';
    var email = (data[i][idxEmail] || '').toString().trim();
    rows.push({
      mssv: mssv,
      name: name,
      email: email,
      row: i + 1
    });
  }

  return rows;
}

function getAttendanceCountsByMember(sheet, startStr, endStr, requestId) {
  var data = sheet.getDataRange().getValues();
  var counts = {};
  if (data.length < 2) {
    return counts;
  }

  var header = data[0];
  var idxMssv = header.indexOf('mssv');
  var idxDate = header.indexOf('date');
  if (idxMssv < 0 || idxDate < 0) {
    return counts;
  }

  for (var i = 1; i < data.length; i++) {
    var mssv = (data[i][idxMssv] || '').toString().trim();
    if (!mssv) {
      continue;
    }

    var dateValue = data[i][idxDate];
    var dateStr = '';
    if (dateValue instanceof Date) {
      dateStr = Utilities.formatDate(dateValue, TIMEZONE, 'yyyy-MM-dd');
    } else {
      dateStr = (dateValue || '').toString().trim();
    }

    if (dateStr < startStr || dateStr > endStr) {
      continue;
    }

    counts[mssv] = (counts[mssv] || 0) + 1;
  }

  logDebug(requestId, 'Attendance counts', JSON.stringify(counts));
  return counts;
}

function getPreviousMondayToFridayRange(now, timezone) {
  var current = new Date(now);
  var currentDay = current.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  var daysSinceMonday = (currentDay + 6) % 7;
  var thisMonday = new Date(current);
  thisMonday.setDate(current.getDate() - daysSinceMonday);
  thisMonday.setHours(0, 0, 0, 0);

  var previousMonday = new Date(thisMonday);
  previousMonday.setDate(thisMonday.getDate() - 7);
  var previousFriday = new Date(previousMonday);
  previousFriday.setDate(previousMonday.getDate() + 4);

  return {
    startStr: Utilities.formatDate(previousMonday, timezone, 'yyyy-MM-dd'),
    endStr: Utilities.formatDate(previousFriday, timezone, 'yyyy-MM-dd')
  };
}

function sendWeeklyAttendanceAlertEmail(member, totalCheckins, weekRange, requestId) {
  var subject = 'Cảnh báo điểm danh tuần ' + weekRange.startStr + ' - ' + weekRange.endStr;
  var displayName = member.name || member.mssv;
  var totalExpected = 2;
  var missingCount = Math.max(totalExpected - totalCheckins, 0);

  // 1. Lấy file ảnh từ Google Drive thông qua ID
  var logoFileId = '1zZrUqxbCM1-_iOaV2VW8cuTW14mqzVWt';
  var logoBlob = DriveApp.getFileById(logoFileId).getBlob().setName("logo.png");

  var htmlBody = [
    '<div style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">',
    '  <div style="max-width:640px;margin:0 auto;padding:24px;">',
    '    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);border:1px solid #e5e7eb;">',
    '      <div style="background:linear-gradient(135deg,#0b76f6,#22c55e);padding:22px 28px;color:#ffffff;">',
    '        <div style="display:flex;align-items:center;gap:14px;">',
    '          <div style="width:52px;height:52px;border-radius:14px;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">',
    // 2. Sửa thuộc tính src thành cid:apesLogo
    '            <img src="cid:apesLogo" alt="APES" style="width:100%;height:100%;object-fit:contain;display:block;">',
    '          </div>',
    '          <div style="flex:1;min-width:0;padding-left:4px;">',
    '            <div style="font-size:13px;opacity:0.9;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">APES Attendance</div>',
    '            <div style="font-size:22px;font-weight:700;margin-top:10px;line-height:1.2;">Cảnh báo điểm danh tuần</div>',
    '          </div>',
    '        </div>',
    '      </div>',
    '      <div style="padding:28px;">',
    '        <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Xin chào <strong>' + escapeHtml(displayName) + '</strong>,</p>',
    '        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;">Hệ thống điểm danh ghi nhận bạn chỉ có <strong>' + totalCheckins + ' lần check-in</strong> trong tuần từ thứ 2 đến thứ 6.</p>',
    '        <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0;">',
    '          <div style="flex:1;min-width:170px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;">',
    '            <div style="font-size:12px;color:#2563eb;text-transform:uppercase;letter-spacing:0.04em;">MSSV</div>',
    '            <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">' + escapeHtml(member.mssv) + '</div>',
    '          </div>',
    '          <div style="flex:1;min-width:170px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;">',
    '            <div style="font-size:12px;color:#16a34a;text-transform:uppercase;letter-spacing:0.04em;">Số lần check-in</div>',
    '            <div style="font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;">' + totalCheckins + '/2</div>',
    '          </div>',
    '        </div>',
    '        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;margin:20px 0;">',
    '          <div style="font-size:14px;color:#9a3412;line-height:1.6;">Bạn còn thiếu <strong>' + missingCount + ' lần check-in</strong> để đạt mức tối thiểu trong tuần này.</div>',
    '        </div>',
    '        <div style="font-size:14px;color:#4b5563;line-height:1.7;">',
    '          <div><strong>Thời gian thống kê:</strong> ' + weekRange.startStr + ' đến ' + weekRange.endStr + '</div>',
    '          <div><strong>Quy định:</strong> Tối thiểu 2 lần check-in / tuần (thứ 2 - thứ 6)</div>',
    '        </div>',
    '        <p style="margin:24px 0 0 0;font-size:14px;line-height:1.7;color:#6b7280;">Vui lòng kiểm tra và bổ sung check-in nếu cần. Cảm ơn bạn đã hợp tác.</p>',
    '      </div>',
    '      <div style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">',
    '        Email này được gửi tự động từ hệ thống điểm danh. Vui lòng không trả lời trực tiếp email này.',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('');

  // 3. Khai báo thuộc tính inlineImages khi gửi mail
  MailApp.sendEmail({
    to: member.email,
    subject: subject,
    htmlBody: htmlBody,
    body: 'Cảnh báo điểm danh tuần ' + weekRange.startStr + ' - ' + weekRange.endStr + ' | MSSV: ' + member.mssv + ' | Số lần check-in: ' + totalCheckins,
    name: "APES Attendance", // Cấu hình thêm tên người gửi cho chuyên nghiệp
    inlineImages: {
      apesLogo: logoBlob
    }
  });
  logDebug(requestId, 'Weekly alert email sent', JSON.stringify({ mssv: member.mssv, email: member.email, totalCheckins: totalCheckins }));
}

function escapeHtml(value) {
  return (value || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}