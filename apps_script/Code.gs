var TIMEZONE = 'Asia/Ho_Chi_Minh';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonError('Invalid payload.');
    }

    var payload = JSON.parse(e.postData.contents);
    var mssv = (payload.mssv || '').toString().trim();
    if (!mssv) {
      return jsonError('Missing mssv.');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var membersSheet = ss.getSheetByName('Members');
    var attendanceSheet = ss.getSheetByName('Attendance');
    if (!membersSheet || !attendanceSheet) {
      return jsonError('Missing Members/Attendance sheet.');
    }

    if (!isActiveMember(membersSheet, mssv)) {
      return jsonError('MSSV not found or inactive.');
    }

    var now = new Date();
    var sessionInfo = getSessionInfo(now, TIMEZONE);
    if (!sessionInfo.session) {
      return jsonError('Outside of check-in window.');
    }

    if (hasDuplicateAttendance(attendanceSheet, mssv, sessionInfo.dateStr, sessionInfo.session)) {
      return jsonError('\u0110\u00e3 check-in r\u1ed3i');
    }

    var newId = getNextId(attendanceSheet);
    attendanceSheet.appendRow([
      newId,
      mssv,
      sessionInfo.timeStr,
      sessionInfo.dateStr,
      sessionInfo.session,
      sessionInfo.weekNumber,
      sessionInfo.year
    ]);

    var successMessage = sessionInfo.session === 'sang'
      ? 'Check-in th\u00e0nh c\u00f4ng - Bu\u1ed5i s\u00e1ng'
      : 'Check-in th\u00e0nh c\u00f4ng - Bu\u1ed5i chi\u1ec1u';

    return jsonSuccess(successMessage);
  } catch (err) {
    return jsonError('Server error.');
  }
}

function isActiveMember(sheet, mssv) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return false;
  }

  var header = data[0];
  var idxMssv = header.indexOf('mssv');
  var idxActive = header.indexOf('is_active');
  if (idxMssv < 0 || idxActive < 0) {
    return false;
  }

  for (var i = 1; i < data.length; i++) {
    var value = (data[i][idxMssv] || '').toString().trim();
    if (value === mssv) {
      return isTruthy(data[i][idxActive]);
    }
  }

  return false;
}

function hasDuplicateAttendance(sheet, mssv, dateStr, session) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return false;
  }

  var header = data[0];
  var idxMssv = header.indexOf('mssv');
  var idxDate = header.indexOf('date');
  var idxSession = header.indexOf('session');
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

function getNextId(sheet) {
  var lastRow = sheet.getLastRow();
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

function jsonSuccess(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'success', message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
