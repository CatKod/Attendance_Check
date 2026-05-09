var TIMEZONE = 'Asia/Ho_Chi_Minh';
var DEBUG_VERBOSE = true;

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
