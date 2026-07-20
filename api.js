let sheet_id = "1exSHvxKBZh3yajgHnns9fdFYWum-_jnMgi_nwdt4xk4";
let sheet_name = "Registration Data"; //Hardcoding fr now

let centerCode = {
  "NLAG":"VBSNL",
  "NLCC": "VBSNC"
}

const READ_CACHE_TTL_SECONDS = 30;
const AUTH_USER_CACHE_TTL_SECONDS = 120;
const CONFIG_CACHE_TTL_SECONDS = 120;

// Centralized column map (0-based for row arrays from getValues).
const COL = Object.freeze({
  REG_NO: 1,
  ROLE: 2,
  NAME: 3,
  MOBILE_NO: 4,
  CENTER: 5,
  SERVICE: 6,
  DEPARTMENT: 7,
  BUS_REQUIRED_PRIMARY: 8,
  BUS_REQUIRED_SECONDARY: 9,
  LUNCH_PREFERENCE: 10,
  REG_AMOUNT: 12,
  PAYMENT_MODE: 13,
  PAYMENT_STATUS: 14,
  PAYMENT_RECEIVED_BY: 15,
  TOKEN_STATUS: 16,
  TOKEN_ISSUED_BY: 17,
});

// 1-based indexes for sheet.getRange(row, col).
const COL_NUM = Object.freeze({
  REG_NO: COL.REG_NO + 1,
  REG_AMOUNT: COL.REG_AMOUNT + 1,
  PAYMENT_MODE: COL.PAYMENT_MODE + 1,
  PAYMENT_STATUS: COL.PAYMENT_STATUS + 1,
  PAYMENT_RECEIVED_BY: COL.PAYMENT_RECEIVED_BY + 1,
  TOKEN_STATUS: COL.TOKEN_STATUS + 1,
  TOKEN_ISSUED_BY: COL.TOKEN_ISSUED_BY + 1,
});

function isDebugModeEnabled() {
  const value = PropertiesService.getScriptProperties().getProperty("DEBUG_MODE");
  return String(value || "").toLowerCase() === "true";
}

function debugLog() {
  if (!isDebugModeEnabled()) {
    return;
  }

  if (arguments.length === 0) {
    return;
  }

  const parts = [];
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];
    if (typeof arg === "string") {
      parts.push(arg);
    } else {
      try {
        parts.push(JSON.stringify(arg));
      } catch (error) {
        parts.push(String(arg));
      }
    }
  }

  console.log(parts.join(" "));
}

function enableDebugMode() {
  PropertiesService.getScriptProperties().setProperty("DEBUG_MODE", "true");
}

function disableDebugMode() {
  PropertiesService.getScriptProperties().setProperty("DEBUG_MODE", "false");
}

function buildCacheKey(prefix, payload) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, payload);
  const hash = Utilities.base64EncodeWebSafe(digest).replace(/=+$/, "");
  return `${prefix}:${hash}`;
}

function getCachedJson(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function putCachedJson(key, value, ttlSeconds) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), ttlSeconds);
  } catch (error) {
    // Ignore cache write failures (e.g. size limits) and serve live results.
  }
}

function getCachedUserDetails(accessToken) {
  const tokenKey = String(accessToken || "").trim();
  if (!tokenKey) {
    throw new Error("Missing auth token");
  }

  const cacheKey = buildCacheKey("auth0User", tokenKey);
  const cached = getCachedJson(cacheKey);
  if (cached) {
    return cached;
  }

  const userDetails = getUserDetails(tokenKey);
  putCachedJson(cacheKey, userDetails, AUTH_USER_CACHE_TTL_SECONDS);
  return userDetails;
}

function getCachedConfigData() {
  const cacheKey = "configData:v1";
  const cached = getCachedJson(cacheKey);
  if (cached) {
    return cached;
  }

  const configData = getConfigData();
  putCachedJson(cacheKey, configData, CONFIG_CACHE_TTL_SECONDS);
  return configData;
}

function getSheetReadRows(sheetName, columnCount) {
  const sheet = SpreadsheetApp.openById(sheet_id).getSheetByName(sheetName);
  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, columnCount).getValues();
}

function getSheetReadRowsWindow(sheetName, startSheetRow, endSheetRow, columnCount) {
  const sheet = SpreadsheetApp.openById(sheet_id).getSheetByName(sheetName);
  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  const safeStart = Math.max(2, startSheetRow);
  const safeEnd = Math.min(lastRow, endSheetRow);
  if (safeEnd < safeStart) {
    return [];
  }

  const rowCount = safeEnd - safeStart + 1;
  const rangeValues = sheet.getRange(safeStart, 1, rowCount, columnCount).getValues();

  const rowsWithMeta = [];
  for (let offset = 0; offset < rangeValues.length; offset++) {
    const sheetRow = safeStart + offset;
    rowsWithMeta.push({
      row: rangeValues[offset],
      rowNo: sheetRow - 1,
    });
  }

  return rowsWithMeta;
}

function parseRegNo(input) {
  const normalized = String(input || "").trim().toUpperCase();
  const match = normalized.match(/^([A-Z]{2,})(\d{3,})$/);
  if (!match) {
    return null;
  }

  return {
    value: normalized,
    numericPart: parseInt(match[2], 10),
  };
}

function normalizeToLowerArray(values) {
  return (values || []).map(value => String(value).toLowerCase());
}

function buildUserFilter(userConfig) {
  const centers = normalizeToLowerArray(userConfig.center);
  const services = normalizeToLowerArray(userConfig.service);
  const departments = normalizeToLowerArray(userConfig.department);

  return {
    centerAll: centers[0] === "all",
    serviceAll: services[0] === "all",
    departmentAll: departments[0] === "all",
    centers: new Set(centers),
    services: new Set(services),
    departments: new Set(departments),
  };
}

function isAllowedByFilter(filter, center, service, department) {
  const centerValue = String(center || "").toLowerCase();
  const serviceValue = String(service || "").toLowerCase();
  const departmentValue = String(department || "").toLowerCase();

  if (!centerValue) {
    return false;
  }

  const centerMatch = filter.centerAll || filter.centers.has(centerValue);
  const serviceMatch = filter.serviceAll || filter.services.has(serviceValue);
  const departmentMatch = filter.departmentAll || filter.departments.has(departmentValue);

  return centerMatch && serviceMatch && departmentMatch;
}

function doGet(e) {
  const response = {
    status: 'error',
    data: [],
    message: 'Invalid request',
  };

  const action = e.parameter.action;
  const token = e.parameter.authToken;
  const userDetails = getCachedUserDetails(token);
  const userConfig = getCachedConfigData()
  if (!(userDetails.email  in userConfig)) {
    response.status = 'failed';
    response.message = 'you are not authorized to access this page';

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  }
  //let sheet_name = getCenterByEmail(userDetails.email) //Sheet_name is the center name for the user email ID

  debugLog(action)
  if (action === 'getStudentDetails') {
    debugLog(userConfig[userDetails.email])
    if (userConfig[userDetails.email].allowCheckIn !== "yes") {
      response.status = 'failed';
      response.message = 'you are not authorized to access this page';

      return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    }
    const input = e.parameter.input;
    response.status = 'success';
    debugLog("sheet name", sheet_name)


    response.data = getStudentDetails(input, sheet_name)
    response.message = response.data.length ? '' : 'Student not found';
  } else if (action === 'checkInStudent') {
    if (userConfig[userDetails.email].allowCheckIn !== "yes") {
      response.status = 'failed';
      response.message = 'you are not authorized to access this page';

      return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    }
    const regRefNo = parseInt(e.parameter.regRefNo);
    const checkInType = e.parameter.status;
    const paymentMode = e.parameter.paymentMode;
    response.status = 'success';
    response.data = checkInStudent(regRefNo, checkInType, paymentMode, userDetails.email);
  } else if (action === 'listStudentDetails') {
    debugLog(userConfig[userDetails.email])
    response.status = 'success';
    response.data = listStudentDetails(userConfig[userDetails.email], sheet_name)
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  }
  else if (action === 'checkedInSummary') {
    debugLog(userConfig[userDetails.email])
    response.status = 'success';
    response.data = checkedInSummary(userDetails.email, sheet_name)
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  }
  else if(action=="submitPayment"){
     if (userConfig[userDetails.email].allowCheckIn !== "yes") {
      response.status = 'failed';
      response.message = 'you are not authorized to access this page';

      return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    }
    const regRefNo = e.parameter.regRefNo;
    const amount = e.parameter.amount;
    response.status = 'success';
    response.data = addAmountToRegRef(sheet_name,regRefNo,amount)
  }

  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

const AUTH0_DOMAIN = 'https://dev-sazlz3uf0genwd7a.us.auth0.com'; // Replace with your Auth0 domain

/**
 * Fetch user details using access token
 * @param {string} accessToken - The access token from Auth0
 * @return {object} - The user's profile details
 */
function getUserDetails(accessToken) {
  const url = `${AUTH0_DOMAIN}/userinfo`;

  // Make the HTTP request
  const options = {
    method: 'get',
    headers: {
      Authorization: `Bearer ${accessToken}`, // Attach access token
    },
    muteHttpExceptions: true, // Ensure we can handle errors
  };

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();

  if (statusCode === 200) {
    // Parse and return user details
    return JSON.parse(response.getContentText());
  } else {
    // Handle errors
    debugLog(response.getContentText())
    const error = JSON.parse(response.getContentText());
    throw new Error(`Error ${statusCode}: ${error.error || error.message}`);
  }
}


function testGetUserDetails() {
  const accessToken = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIiwiaXNzIjoiaHR0cHM6Ly9kZXYtc2F6bHozdWYwZ2Vud2Q3YS51cy5hdXRoMC5jb20vIn0..wOxfX4AQ2Marec6T.1-hWYE-9usVzZAqTz9WD9nHsP_OOqMxMpp2OFBo9EUyReWKuplPMUAG6q2VeHiGyVELpv9W--uE5ZOnPlQxpzj2bXjgHm_g_9iLoC0HL7NRIpzSu7oyPsUfL3H8PEkWOReJYXMtICnHVspJJkWGboiRSPyYZMT2fWLB78hs7XOwZcD-UreF_VkfanmLYHqkEPwMbwL7DCDMsDoO6yNY5q7K3ER79qVKyyU_YS6JwrFd1ZrR5zWXub_5iphr4lrNlDvZ8eZXf_Tm3G8HQRKJH6yiSQrUBBKc-RC7gFUdgwt0-PNxzXx04NmV41HTPuym2FtlWdss5qCeCI6v1OtlzFXXhigeV240.2SpZrgOU4Q_Vk0nlsKdgng'; // Replace with a valid token
  try {
    const userDetails = getUserDetails(accessToken);
    Logger.log(userDetails); // Log or process the user details
    Logger.log(userDetails.email)
  } catch (error) {
    Logger.log(`Failed to get user details: ${error.message}`);
  }
}


function testGetStudentDetails() {
  data = getStudentDetails("9042859505", "Registration Data")

}

function getStudentDetails(input ,sheet_name ) {
  const normalizedInput = String(input || "").trim();
  const cacheKey = buildCacheKey("getStudentDetails", `${sheet_name}|${normalizedInput}`);
  const cachedResult = getCachedJson(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  let queryInput = normalizedInput;
  const isnum = /^\d+$/.test(queryInput);
  if (isnum === true && queryInput.length <= 4) {
    // Numeric short input is treated as Reg No (e.g. 2 -> KR0002).
    queryInput = UID.PREFIX + queryInput.padStart(4, "0");
  } else if (isnum === true && queryInput.length < 6) {
    queryInput = UID.PREFIX + queryInput
  }
  const upperQueryInput = queryInput.toUpperCase();
  const regNoSearch = parseRegNo(upperQueryInput);

  if (regNoSearch) {
    const startRowNo = Math.max(1, regNoSearch.numericPart - 7);
    const endRowNo = regNoSearch.numericPart + 7;
    const rows = getSheetReadRowsWindow(sheet_name, startRowNo + 1, endRowNo + 1, 18);
    const regResults = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const meta = rows[idx];
      const row = meta.row;
      const regRefNo = String(row[COL.REG_NO] || "").toUpperCase();
      if (regRefNo !== regNoSearch.value) {
        continue;
      }

      regResults.push({
        name: row[COL.NAME],
        role: row[COL.ROLE],
        regRefNo: row[COL.REG_NO],
        rowNo: meta.rowNo,
        paymentMode: row[COL.PAYMENT_MODE],
        totalAmount: row[COL.REG_AMOUNT],
        center: row[COL.CENTER],
        department: row[COL.DEPARTMENT],
        mobileNumber: row[COL.MOBILE_NO],
        busRequired: row[COL.BUS_REQUIRED_PRIMARY] ? row[COL.BUS_REQUIRED_PRIMARY] : row[COL.BUS_REQUIRED_SECONDARY],
        paymentStatus: row[COL.PAYMENT_STATUS],
        paymentReceivedBy: row[COL.PAYMENT_RECEIVED_BY],
        tokenStatus: row[COL.TOKEN_STATUS],
        tokenIssuedBy: row[COL.TOKEN_ISSUED_BY],
        reg_amount: row[COL.REG_AMOUNT],
        foodPreference: row[COL.LUNCH_PREFERENCE],
      });
    }

    putCachedJson(cacheKey, regResults, READ_CACHE_TTL_SECONDS);
    return regResults;
  }

  const data = getSheetReadRows(sheet_name, 18);
  const results = [];
  for (let idx = 0; idx < data.length; idx++) {
    const row = data[idx];
    const regRefNo = row[COL.REG_NO]; // Reg Ref No
    const role = row[COL.ROLE];
    let name = row[COL.NAME];
    const mobileNumber = row[COL.MOBILE_NO]
    const center =  row[COL.CENTER];
    const department =  row[COL.DEPARTMENT];
    const paymentMode = row[COL.PAYMENT_MODE] ;
    const totalAmount = row[COL.REG_AMOUNT] ;
    const paymentStatus = row[COL.PAYMENT_STATUS] ;
    const tokenStatus = row[COL.TOKEN_STATUS] ;
    const paymentReceivedBy = row[COL.PAYMENT_RECEIVED_BY];
    const tokenIssuedBy = row[COL.TOKEN_ISSUED_BY] ;
    const busRequired = row[COL.BUS_REQUIRED_PRIMARY] ? row[COL.BUS_REQUIRED_PRIMARY] : row[COL.BUS_REQUIRED_SECONDARY];
    const reg_amount = row[COL.REG_AMOUNT] ;
    const foodPreference = row[COL.LUNCH_PREFERENCE] ;


    // const checkedIn = data[i][25]

    name = name.toString();
    const upperName = name.toUpperCase();
    const exactMobileMatch = mobileNumber == queryInput;
    const exactRegRefMatch = regRefNo === upperQueryInput;
    const directNameMatch = upperName.includes(upperQueryInput);
    const fuzzyNameMatch = !exactMobileMatch && !exactRegRefMatch && !directNameMatch && similarity(name, queryInput) >= 0.65;

    if (exactMobileMatch || exactRegRefMatch || directNameMatch || fuzzyNameMatch) {
      results.push({
        name: name,
        role: role,
        regRefNo: regRefNo,
        rowNo: idx + 1,
        paymentMode: paymentMode,
        totalAmount: totalAmount,
        center: center,
        department: department,
        mobileNumber: mobileNumber,
        busRequired: busRequired,
        paymentStatus: paymentStatus,
        paymentReceivedBy: paymentReceivedBy,
        tokenStatus: tokenStatus,
        tokenIssuedBy: tokenIssuedBy,
        reg_amount: reg_amount,
        foodPreference: foodPreference,
      });
    }
  }

  putCachedJson(cacheKey, results, READ_CACHE_TTL_SECONDS);
  return results;
}

function filterstudDet(userConfig, center, service, department) {
  const centerMatch =
    userConfig.center[0].toLowerCase() === "all" ||
    userConfig.center.some(c => c.toLowerCase() === center.toLowerCase());

  const serviceMatch =
    userConfig.service[0].toLowerCase() === "all" ||
    userConfig.service.some(s => s.toLowerCase() === service.toLowerCase());

  const departmentMatch =
    userConfig.department[0].toLowerCase() === "all" ||
    userConfig.department.some(d => d.toLowerCase() === department.toLowerCase());


  return center != "" && centerMatch && serviceMatch && departmentMatch;
}



function testCheckedInSummary() {
  const userConfig = "shyam - Day 1-3"

  data = checkedInSummary(userConfig, "Registration Data");
  debugLog(data)
}

function checkedInSummary(userEmail ,sheet_name) {
  const cacheKey = buildCacheKey("checkedInSummary", `${sheet_name}|${userEmail}`);
  const cachedResult = getCachedJson(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const data = getSheetReadRows(sheet_name, 18);
  let totalUPI = 0;
  let totalCash = 0;
  const payments = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    const paymentMode = String(row[COL.PAYMENT_MODE] || "").toUpperCase();
    const paymentReceivedBy = String(row[COL.PAYMENT_RECEIVED_BY] || "");
    const paymentStatus = String(row[COL.PAYMENT_STATUS] || "").toUpperCase();
    const amount = parseInt(row[COL.REG_AMOUNT], 10) || 0;
    const isMatchedPayment = paymentReceivedBy === userEmail && paymentStatus === "PAID";

    if (isMatchedPayment) {
      payments.push({
        regRefNo: row[COL.REG_NO],
        name: row[COL.NAME],
        center: row[COL.CENTER],
        paymentMode: paymentMode,
        amount: amount,
      });
    }

    if (isMatchedPayment && paymentMode === "UPI")  {
      totalUPI += amount
    }
    if (isMatchedPayment && paymentMode === "CASH")  {
      totalCash += amount
    }
  }

  const summary = {
    "paymentReceivedBy": userEmail,
    "totalUPI": totalUPI,
    "totalCash": totalCash,
    "totalAmount": totalUPI + totalCash,
    "payments": payments,
  };

  putCachedJson(cacheKey, summary, READ_CACHE_TTL_SECONDS);
  return summary;
}

function testListStudentDetails() {
  const userConfig = {
    center: [ 'nlag' ],
  service: [ '4th Service' ],
  department: [ 'all' ],
  allowCheckIn: 'yes'
  }

  data = listStudentDetails(userConfig, "Registration Data");
  debugLog(data)
}


function listStudentDetails(userConfig ,sheet_name) {
  const cacheKey = buildCacheKey("listStudentDetails", `${sheet_name}|${JSON.stringify(userConfig)}`);
  const cachedResult = getCachedJson(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const data = getSheetReadRows(sheet_name, 18);
  const results = [];
  const filter = buildUserFilter(userConfig);

  for (let idx = 0; idx < data.length; idx++) {
    const row = data[idx];
    const regRefNo = row[COL.REG_NO]; // Reg Ref No
    const role = row[COL.ROLE];
    let name = row[COL.NAME];
    const mobileNumber = row[COL.MOBILE_NO]
    const center =  row[COL.CENTER];
    const service =  row[COL.SERVICE];
    const department =  row[COL.DEPARTMENT];
    const paymentMode = row[COL.PAYMENT_MODE] ;
    const totalAmount = row[COL.REG_AMOUNT] ;
    const paymentStatus = row[COL.PAYMENT_STATUS] ;
    const tokenStatus = row[COL.TOKEN_STATUS] ;
    const paymentReceivedBy = row[COL.PAYMENT_RECEIVED_BY];
    const tokenIssuedBy = row[COL.TOKEN_ISSUED_BY] ;
    const busRequired = row[COL.BUS_REQUIRED_PRIMARY] ? row[COL.BUS_REQUIRED_PRIMARY] : row[COL.BUS_REQUIRED_SECONDARY];
    const reg_amount = row[COL.REG_AMOUNT] ;
    const foodPreference = row[COL.LUNCH_PREFERENCE] ;

    if (isAllowedByFilter(filter, center, service, department) === true)  {
      results.push({
        name: name,
        role: role,
        regRefNo: regRefNo,
        rowNo: idx + 1,
        paymentMode: paymentMode,
        center: center,
        service: service,
        department: department,
        mobileNumber: mobileNumber,
        busRequired: busRequired,
        paymentStatus: paymentStatus,
        tokenStatus: tokenStatus,
        reg_amount: reg_amount,
      });
    }
  }

  putCachedJson(cacheKey, results, READ_CACHE_TTL_SECONDS);
  return results;
}

function testCheckInStudent(rowNo, checkInType, email) {
  checkInStudent(20, "paid", "UPI", "xyz@gmail.com");
}

function checkInStudent(rowNo, checkInType, paymentMode, email) {
  const  sheetName = sheet_name
  const sheet = SpreadsheetApp.openById(sheet_id).getSheetByName(sheetName);
  const checkInTypes = {
    'paid': [COL_NUM.PAYMENT_STATUS, COL_NUM.PAYMENT_RECEIVED_BY, "PAID"],
    'token_issued': [COL_NUM.TOKEN_STATUS, COL_NUM.TOKEN_ISSUED_BY, "YES"],
    'complete_checkin': null,
  }
  if (sheet == null) {
    debugLog(`sheet not found: ${sheetName}`)
    return {status: 'Failed', regRefNo: ''};
  }

  let i = rowNo
  const rowIndex = i + 1;
  debugLog("row no", i)

  const rowValues = sheet.getRange(rowIndex, 1, 1, COL_NUM.TOKEN_ISSUED_BY).getValues()[0];
  let regRefNo = rowValues[COL.REG_NO];
  const currentPaymentStatus = String(rowValues[COL.PAYMENT_STATUS] || "").trim().toUpperCase();
  const currentTokenStatus = String(rowValues[COL.TOKEN_STATUS] || "").trim().toUpperCase();
  debugLog(regRefNo)

  if (checkInType === 'complete_checkin') {
    if (currentPaymentStatus !== 'PAID') {
      sheet.getRange(rowIndex, COL_NUM.PAYMENT_MODE, 1, 3).setValues([[paymentMode, 'PAID', email]]);
    }

    if (currentTokenStatus !== 'YES') {
      sheet.getRange(rowIndex, COL_NUM.TOKEN_STATUS, 1, 2).setValues([['YES', email]]);
    }

    return {
      status: 'Success',
      regRefNo: regRefNo,
      paymentStatus: 'PAID',
      paymentReceivedBy: currentPaymentStatus === 'PAID' ? rowValues[COL.PAYMENT_RECEIVED_BY] : email,
      tokenStatus: 'YES',
      tokenIssuedBy: currentTokenStatus === 'YES' ? rowValues[COL.TOKEN_ISSUED_BY] : email,
      paymentMode: paymentMode || rowValues[COL.PAYMENT_MODE] || '',
    };
  }

  debugLog(checkInTypes[checkInType][0]);
  sheet.getRange(rowIndex, checkInTypes[checkInType][0]).setValue(checkInTypes[checkInType][2]); // Assuming column Z for Checked-In status
  sheet.getRange(rowIndex, checkInTypes[checkInType][1]).setValue(email);
  if (checkInType == "paid") {
    // Sample sheet mapping: Payment Mode is column 14.
    sheet.getRange(rowIndex, COL_NUM.PAYMENT_MODE).setValue(paymentMode);
  }
  debugLog({status: 'Success', regRefNo: regRefNo})

  return {
    status: 'Success',
    regRefNo: regRefNo,
    paymentStatus: checkInType === 'paid' ? 'PAID' : currentPaymentStatus,
    paymentReceivedBy: checkInType === 'paid' ? email : rowValues[COL.PAYMENT_RECEIVED_BY],
    tokenStatus: checkInType === 'token_issued' ? 'YES' : currentTokenStatus,
    tokenIssuedBy: checkInType === 'token_issued' ? email : rowValues[COL.TOKEN_ISSUED_BY],
    paymentMode: checkInType === 'paid' ? paymentMode : (rowValues[COL.PAYMENT_MODE] || ''),
  };
}

function getCenterByEmail(email) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("accesslist");
  const data = sheet.getDataRange().getValues();

  // Assuming headers are in the first row
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toLowerCase() === email.toLowerCase()) {
      return data[i][1].toUpperCase();
    }
  }

  return ;
}

function addAmountToRegRef(sheetName = "NLCC", regRefNo = "VBSNC0002", amount = "5000") {
  const sheet = SpreadsheetApp.openById(sheet_id).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }

  const data = sheet.getDataRange().getValues();
  const amountColIndex = 9; // Column J is the 10th column, so index = 9 (0-based)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(regRefNo).trim()) {

      sheet.getRange(i + 1, amountColIndex + 1).setValue(amount);
      debugLog( {status: 'Success', regRefNo: regRefNo})
      return {status: 'Success', regRefNo: regRefNo};
    }
  }
  debugLog( {status: 'Failed', regRefNo: regRefNo})
  return {status: 'Failed', regRefNo: regRefNo};
}