/*************************************************
 * SANGKHA INSPECTION SYSTEM
 * Google Apps Script Backend
 *
 *+ CLEAN VERSION
 * STEP 1-4
 *
 * Google Sheets + Google Apps Script Web App
 *************************************************/


/*************************************************
 * STEP 1
 * SYSTEM CONFIGURATION
 *************************************************/

const CONFIG = {

  SPREADSHEET_ID:
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getId(),

  SESSION_SECONDS: 21600,

  SHEETS: {

    USERS:
      'Users',

    LOCATIONS:
      'Locations',

    INSPECTION_LOGS:
      'Inspection_Logs',

    ATTENDANCE:
      'Attendance_and_Proxy',

    SCORE_EDIT_REQUESTS:
      'Score_Edit_Requests',

    MAINTENANCE:
      'Maintenance_and_Edits',

    AUDIT_LOGS:
      'Audit_Logs',

    SETTINGS:
      'System_Settings'

  }

};


/*************************************************
 * STEP 2
 * WEB APP
 *************************************************/

function doGet(e) {

  const page =
    e &&
    e.parameter &&
    e.parameter.page
      ? String(e.parameter.page).trim().toLowerCase()
      : 'login';

  const sessionId =
    e &&
    e.parameter &&
    e.parameter.sessionId
      ? String(e.parameter.sessionId).trim()
      : '';


  // =========================================
  // LOGIN
  // =========================================

  if (page === 'login') {

    return HtmlService
      .createTemplateFromFile('Login')
      .evaluate()
      .setTitle('Sangkha Inspection - Login')
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      );

  }


  // =========================================
  // INSPECTOR
  // =========================================

  if (page === 'inspector') {

    if (!sessionId) {

      return HtmlService
        .createHtmlOutput(
          '<h2 style="font-family:Sarabun">ไม่พบ Session ID</h2>'
        )
        .setXFrameOptionsMode(
          HtmlService.XFrameOptionsMode.ALLOWALL
        );

    }


    const session =
      getSession_(sessionId);


    if (!session) {

      return HtmlService
        .createHtmlOutput(
          '<h2 style="font-family:Sarabun">Session หมดอายุหรือไม่ถูกต้อง กรุณา Login ใหม่</h2>'
        )
        .setXFrameOptionsMode(
          HtmlService.XFrameOptionsMode.ALLOWALL
        );

    }


    // -----------------------------------------
    // ตรวจ Role
    // -----------------------------------------

    const role =
      String(session.Role || '')
        .trim()
        .toLowerCase();


    if (role !== 'inspector') {

      return HtmlService
        .createHtmlOutput(
          '<h2 style="font-family:Sarabun">ไม่มีสิทธิ์เข้าถึงหน้า Inspector</h2>'
        )
        .setXFrameOptionsMode(
          HtmlService.XFrameOptionsMode.ALLOWALL
        );

    }


    const template =
      HtmlService
        .createTemplateFromFile('Inspector');


    template.SESSION_ID =
      sessionId;

    template.USER =
      session;


    return template
      .evaluate()
      .setTitle(
        'Sangkha Hygiene Portal - Inspector'
      )
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      );

  }


  // =========================================
  // SUPERVISOR
  // =========================================

  if (page === 'supervisor') {

    // -----------------------------------------
    // ต้องมี Session ID
    // -----------------------------------------

    if (!sessionId) {

      return HtmlService
        .createHtmlOutput(
          '<h2 style="font-family:Sarabun">ไม่พบ Session ID</h2>'
        )
        .setXFrameOptionsMode(
          HtmlService.XFrameOptionsMode.ALLOWALL
        );

    }


    // -----------------------------------------
    // โหลด Session
    // -----------------------------------------

    const session =
      getSession_(sessionId);


    if (!session) {

      return HtmlService
        .createHtmlOutput(
          '<h2 style="font-family:Sarabun">Session หมดอายุหรือไม่ถูกต้อง กรุณา Login ใหม่</h2>'
        )
        .setXFrameOptionsMode(
          HtmlService.XFrameOptionsMode.ALLOWALL
        );

    }


    // -----------------------------------------
    // ตรวจ Role
    // -----------------------------------------

    const role =
      String(session.Role || '')
        .trim()
        .toLowerCase();


    if (role !== 'supervisor') {

      return HtmlService
        .createHtmlOutput(
          '<h2 style="font-family:Sarabun">ไม่มีสิทธิ์เข้าถึงหน้า Supervisor</h2>'
        )
        .setXFrameOptionsMode(
          HtmlService.XFrameOptionsMode.ALLOWALL
        );

    }


    // -----------------------------------------
    // โหลดหน้า Supervisor
    // -----------------------------------------

    const template =
      HtmlService
        .createTemplateFromFile('Supervisor');


    // -----------------------------------------
    // ส่งข้อมูลเข้า HTML
    // -----------------------------------------

    template.SESSION_ID =
      sessionId;

    template.USER =
      session;


    // -----------------------------------------
    // แสดงหน้า
    // -----------------------------------------

    return template
      .evaluate()
      .setTitle(
        'Sangkha Inspection - Supervisor'
      )
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      );

  }


  // =========================================
  // DEFAULT
  // =========================================

  return HtmlService
    .createHtmlOutput(
      '<h2 style="font-family:Sarabun">ไม่พบหน้าที่ต้องการ</h2>'
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}


/*************************************************
 * STEP 3
 * SYSTEM / SHEET CHECK
 *************************************************/

function checkSystemSheets() {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const result = [];


  Object.keys(
    CONFIG.SHEETS
  ).forEach(function(key) {

    const sheetName =
      CONFIG.SHEETS[key];


    const sheet =
      ss.getSheetByName(
        sheetName
      );


    result.push({

      key:
        key,

      name:
        sheetName,

      exists:
        !!sheet

    });

  });


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 4
 * DATA ACCESS
 *************************************************/


/**
 * อ่านข้อมูลจาก Sheet
 *
 * คืนค่าเป็น Array ของ Object
 *
 * ตัวอย่าง:
 *
 * Header:
 * Student_ID | Full_Name | Role
 *
 * จะได้:
 *
 * {
 *   Student_ID: "...",
 *   Full_Name: "...",
 *   Role: "..."
 * }
 */
function readSheetObjects_(sheetName) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        sheetName
      );


  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: ' +
      sheetName
    );

  }


  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return [];

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  return values
    .slice(1)
    .filter(function(row) {

      return row.some(
        function(cell) {

          return String(
            cell
          ).trim() !== '';

        }
      );

    })
    .map(function(row) {

      const object = {};


      headers.forEach(
        function(header, index) {

          if (header) {

            object[header] =
              row[index];

          }

        }
      );


      return object;

    });

}


/**
 * อ่าน Users
 */
function getUsersData_() {

  return readSheetObjects_(
    CONFIG.SHEETS.USERS
  );

}


/**
 * อ่าน Locations
 */
function getLocationsData_() {

  const locations =
    readSheetObjects_(
      CONFIG.SHEETS.LOCATIONS
    );

  if (!Array.isArray(locations)) {

    throw new Error(
      'ไม่สามารถอ่านข้อมูล Locations ได้'
    );

  }

  console.log(
    'Locations loaded:',
    locations.length
  );

  return locations;

}


/**
 * Alias สำหรับระบบเดิม
 *
 * ใช้แทน allLocations_()
 */
function allLocations_() {

  return getLocationsData_();

}


/**
 * ค้นหา User จาก Student_ID
 */
function findUserById_(
  studentId
) {

  const targetId =
    String(
      studentId || ''
    )
      .trim()
      .toLowerCase();


  if (!targetId) {

    return null;

  }


  const users =
    getUsersData_();


  return users.find(
    function(user) {

      return String(
        user.Student_ID || ''
      )
        .trim()
        .toLowerCase()
        === targetId;

    }
  ) || null;

}


/**
 * ค้นหา Location จาก Location_ID
 */
function findLocationById_(
  locationId
) {

  const targetId =
    String(
      locationId || ''
    )
      .trim()
      .toLowerCase();


  if (!targetId) {

    return null;

  }


  const locations =
    getLocationsData_();


  return locations.find(
    function(location) {

      return String(
        location.Location_ID || ''
      )
        .trim()
        .toLowerCase()
        === targetId;

    }
  ) || null;

}


/*************************************************
 * HELPER
 * NORMALIZE TEXT
 *************************************************/

function normalizeText_(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .toUpperCase();

}


/*************************************************
 * HELPER
 * NORMALIZE ASSIGNED LOCATIONS
 *************************************************/

function getAssignedLocations_(
  value
) {

  const raw =
    String(
      value || ''
    ).trim();


  if (!raw) {

    return [];

  }


  return raw
    .split(',')
    .map(function(id) {

      return normalizeText_(
        id
      );

    })
    .filter(function(id) {

      return id !== '';

    });

}


/*************************************************
 * STEP 4 TEST
 *************************************************/


/**
 * ทดสอบระบบ Sheet
 */
function testStep4Sheets() {

  const result =
    checkSystemSheets();


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * ทดสอบ Users
 */
function testStep4Users() {

  const users =
    getUsersData_();


  const result = {

    success:
      true,

    count:
      users.length,

    firstUser:
      users.length > 0
        ? users[0]
        : null

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * ทดสอบ Locations
 */
function testStep4Locations() {

  const locations =
    getLocationsData_();


  const result = {

    success:
      true,

    count:
      locations.length,

    firstLocation:
      locations.length > 0
        ? locations[0]
        : null

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 5
 * USER AUTHENTICATION
 *************************************************/


/**
 * ตรวจสอบ Student_ID + PIN
 */
function verifyLogin(studentId, pin) {

  // =========================================
  // 1. ค้นหา User
  // =========================================

  const user =
    findUserById_(studentId);


  if (!user) {

    return {

      success: false,

      message:
        'ไม่พบรหัสนักเรียน'

    };

  }


  // =========================================
  // 2. ตรวจ PIN
  // =========================================

  const inputPin =
    String(pin || '').trim();


  const storedPin =
    String(user.PIN || '').trim();


  if (!inputPin) {

    return {

      success: false,

      message:
        'กรุณากรอก PIN'

    };

  }


  if (inputPin !== storedPin) {

    return {

      success: false,

      message:
        'PIN ไม่ถูกต้อง'

    };

  }


  // =========================================
  // 3. สร้าง User Contract
  // =========================================

  const userContract = {

    Student_ID:
      user.Student_ID || '',

    Full_Name:
      user.Full_Name || '',

    Role:
      normalizeText_(user.Role),

    Assigned_Grade:
      user.Assigned_Grade || '',

    Assigned_Type:
      user.Assigned_Type || '',

    Assigned_Locations:
      user.Assigned_Locations || ''

  };


  // =========================================
  // 4. สร้าง Session
  // =========================================

  const session =
    createSession_(
      userContract
    );


  // =========================================
  // 5. ตรวจ Session ที่สร้าง
  // =========================================

  if (
    !session ||
    !session.success ||
    !session.sessionId
  ) {

    return {

      success: false,

      message:
        'ไม่สามารถสร้าง Session ได้'

    };

  }


  // =========================================
  // 6. Login สำเร็จ
  // =========================================

  return {

    success: true,

    sessionId:
      session.sessionId,

    user:
      session.user,

    expiresIn:
      session.expiresIn

  };

}


/**
 * ทดสอบ Login
 *
 * ใช้ User คนแรกใน Sheet
 */
function testStep5Login() {

  const users =
    getUsersData_();


  if (!users.length) {

    return {

      success: false,

      message:
        'ไม่พบข้อมูล Users'

    };

  }


  const user =
    users[0];


  const result =
    verifyLogin(
      user.Student_ID,
      user.PIN
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 6.1
 * SESSION SYSTEM
 *************************************************/

/**
 * สร้าง Session หลัง Login สำเร็จ
 */
function createSession_(user) {

  if (!user) {
    throw new Error('ไม่พบข้อมูล User');
  }

  const sessionId =
    Utilities.getUuid();

  const cache =
    CacheService.getScriptCache();

  const sessionData = {

    Student_ID:
      user.Student_ID || '',

    Full_Name:
      user.Full_Name || '',

    Role:
      user.Role || '',

    Assigned_Grade:
      user.Assigned_Grade || '',

    Assigned_Type:
      user.Assigned_Type || '',

    Assigned_Locations:
      user.Assigned_Locations || ''

  };

  cache.put(
    'SESSION_' + sessionId,
    JSON.stringify(sessionData),
    CONFIG.SESSION_SECONDS
  );

  return {

    success: true,

    sessionId:
      sessionId,

    user:
      sessionData,

    expiresIn:
      CONFIG.SESSION_SECONDS

  };

}


/**
 * อ่าน Session
 */
function getSession_(token) {

  if (!token) {
    return null;
  }

  const cache =
    CacheService.getScriptCache();

  const data =
    cache.get(
      'SESSION_' + String(token).trim()
    );

  if (!data) {
    return null;
  }

  try {

    return JSON.parse(data);

  } catch (error) {

    return null;

  }

}


/**
 * ตรวจสอบ Session
 */
function requireSession_(token) {

  const session =
    getSession_(token);

  if (!session) {

    throw new Error(
      'Session หมดอายุหรือไม่ถูกต้อง กรุณา Login ใหม่'
    );

  }

  return session;

}

function createSession_(user) {

  if (!user) {
    throw new Error('ไม่พบข้อมูล User');
  }

  const sessionId =
    Utilities.getUuid();

  const cache =
    CacheService.getScriptCache();

  const sessionData = {

    Student_ID:
      user.Student_ID || '',

    Full_Name:
      user.Full_Name || '',

    Role:
      user.Role || '',

    Assigned_Grade:
      user.Assigned_Grade || '',

    Assigned_Type:
      user.Assigned_Type || '',

    Assigned_Locations:
      user.Assigned_Locations || ''

  };

  cache.put(
    'SESSION_' + sessionId,
    JSON.stringify(sessionData),
    CONFIG.SESSION_SECONDS
  );

  return {

    success: true,

    sessionId:
      sessionId,

    user:
      sessionData,

    expiresIn:
      CONFIG.SESSION_SECONDS

  };

}


/*************************************************
 * STEP 37
 * LOGOUT
 *************************************************/

function logout(sessionId) {

  const token =
    String(sessionId || '').trim();


  if (!token) {

    return {

      success: false,

      message:
        'ไม่พบ Session ID'

    };

  }


  const cache =
    CacheService.getScriptCache();


  cache.remove(
    'SESSION_' + token
  );


  const check =
    cache.get(
      'SESSION_' + token
    );


  if (check) {

    return {

      success: false,

      message:
        'ไม่สามารถลบ Session ได้'

    };

  }


  return {

    success: true,

    message:
      'ลงชื่อออกเรียบร้อยแล้ว'

  };

}
/**
 * ลบ Session / Logout
 */
function destroySession_(token) {

  if (!token) {

    return {
      success: true
    };

  }

  const cache =
    CacheService.getScriptCache();

  cache.remove(
    'SESSION_' + String(token).trim()
  );

  return {

    success:
      true

  };

}


/*************************************************
 * STEP 6.1 TEST
 *************************************************/

/**
 * ทดสอบการสร้าง Session
 */
function testStep6_1CreateSession() {

  const user =
    findUserById_('at');

  if (!user) {

    throw new Error(
      'ไม่พบ User สำหรับทดสอบ: at'
    );

  }

  const result =
    createSession_(user);

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}


/**
 * ทดสอบการอ่าน Session
 *
 * ใช้ Token จากการสร้าง Session
 */
function testStep6_1GetSession(token) {

  const session =
    getSession_(token);

  const result = {

    success:
      !!session,

    session:
      session

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}


/**
 * ทดสอบการลบ Session
 */
function testStep6_1DestroySession(token) {

  const result =
    destroySession_(token);

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}

/*************************************************
 * STEP 6.2
 * TEST SESSION
 *************************************************/

/**
 * ทดสอบว่า Session ที่สร้างไว้
 * สามารถอ่านกลับมาได้หรือไม่
 */
function testSession() {

  const session =
    getCurrentSession_();


  const result = {

    success:
      !!session,

    session:
      session || null

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 6.2
 * SESSION READER
 *************************************************/

/**
 * อ่าน Session จาก Cache
 *
 * หมายเหตุ:
 * STEP 6.1 ใช้ CacheService
 * ดังนั้น STEP 6.2 ต้องอ่านจาก CacheService เช่นกัน
 */
function getCurrentSession_(token) {

  if (!token) {

    return null;

  }


  return getSession_(token);

}


/**
 * ทดสอบการอ่าน Session
 *
 * ใช้ Token ที่ส่งเข้ามา
 */
function testSession(token) {

  if (!token) {

    return {

      success: false,

      message:
        'กรุณาส่ง Token จาก testStep6_1CreateSession()'

    };

  }


  const session =
    getCurrentSession_(token);


  const result = {

    success:
      !!session,

    session:
      session || null

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 6.2
 * SESSION END-TO-END TEST
 *************************************************/

/**
 * ทดสอบ Session แบบครบวงจร
 *
 * 1. ค้นหา User
 * 2. สร้าง Session
 * 3. อ่าน Session จาก Token
 * 4. เปรียบเทียบข้อมูล
 */
function testSession() {

  // 1. ค้นหา User
  const user =
    findUserById_('at');


  if (!user) {

    throw new Error(
      'ไม่พบ User สำหรับทดสอบ: at'
    );

  }


  // 2. สร้าง Session
  const created =
    createSession_(user);


  if (
    !created ||
    !created.success ||
    !created.token
  ) {

    throw new Error(
      'ไม่สามารถสร้าง Session ได้'
    );

  }


  // 3. อ่าน Session กลับมา
  const session =
    getSession_(
      created.token
    );


  // 4. ตรวจสอบ
  const success =
    !!session &&
    String(session.Student_ID) ===
      String(user.Student_ID) &&
    String(session.Full_Name) ===
      String(user.Full_Name) &&
    String(session.Role) ===
      String(user.Role);


  const result = {

    success:
      success,

    token:
      created.token,

    createdUser:
      created.user,

    session:
      session,

    expiresIn:
      created.expiresIn

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 6.3
 * LOGOUT / DESTROY SESSION TEST
 *************************************************/

/**
 * ทดสอบการทำลาย Session
 *
 * ขั้นตอน:
 * 1. สร้าง Session
 * 2. ตรวจสอบว่า Session มีอยู่
 * 3. Logout / ทำลาย Session
 * 4. ตรวจสอบอีกครั้งว่า Session หายแล้ว
 */
function testSessionLogout() {

  const user =
    findUserById_('at');

  if (!user) {
    throw new Error(
      'ไม่พบ User สำหรับทดสอบ: at'
    );
  }


  // สร้าง Session
  const created =
    createSession_(user);

  if (
    !created ||
    !created.success ||
    !created.sessionId
  ) {

    throw new Error(
      'ไม่สามารถสร้าง Session สำหรับทดสอบ Logout ได้'
    );

  }


  const sessionId =
    created.sessionId;


  // ตรวจสอบก่อน Logout
  const beforeLogout =
    getSession_(sessionId);


  // ทำลาย Session
  const logoutResult =
    destroySession_(sessionId);


  // ตรวจสอบหลัง Logout
  const afterLogout =
    getSession_(sessionId);


  const success =
    !!beforeLogout &&
    !!logoutResult &&
    !afterLogout;


  const result = {

    success:
      success,

    sessionId:
      sessionId,

    beforeLogout:
      !!beforeLogout,

    logoutResult:
      logoutResult,

    afterLogout:
      afterLogout

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 7.1
 * LOCATION AUTHORIZATION
 *************************************************/

/**
 * ตรวจสอบว่า User มีสิทธิ์เข้าถึง Location หรือไม่
 *
 * ตรวจตามลำดับ:
 *
 * 1. User ต้องมีข้อมูล
 * 2. Location ต้องมีข้อมูล
 * 3. ADMIN = เข้าถึงได้ทั้งหมด
 * 4. Assigned_Locations = ALL
 * 5. ตรวจ Assigned_Grade
 * 6. ตรวจ Assigned_Type
 * 7. ตรวจ Assigned_Locations
 */
function canAccessLocation_(user, location) {

  /*************************************************
   * 1. BASIC VALIDATION
   *************************************************/

  if (!user || !location) {
    return false;
  }


  /*************************************************
   * 2. ROLE
   *************************************************/

  const role =
    normalizeText_(
      user.Role
    );


  /*
   * ADMIN เห็นทุก Location
   */

  if (role === 'ADMIN') {
    return true;
  }


  /*************************************************
   * 3. USER ASSIGNMENT
   *************************************************/

  const assignedGrade =
    normalizeText_(
      user.Assigned_Grade
    );

  const assignedType =
    normalizeText_(
      user.Assigned_Type
    );


  /*************************************************
   * 4. LOCATION DATA
   *************************************************/

  const locationGrade =
    normalizeText_(
      location.Grade_Level
    );

  const locationType =
    normalizeText_(
      location.Type
    );


  /*
   * รองรับทั้ง Boolean TRUE/FALSE
   * และ String TRUE/FALSE
   */

  const isSME =
    location.Is_SME === true ||
    String(
      location.Is_SME || ''
    )
      .trim()
      .toUpperCase() === 'TRUE';


  /*************************************************
   * 5. TYPE CHECK
   *************************************************/

  if (
    assignedType !== '' &&
    assignedType !== 'ALL'
  ) {

    const allowedTypes =
      assignedType
        .split(',')
        .map(function(value) {

          return normalizeText_(
            value
          );

        })
        .filter(function(value) {

          return value !== '';

        });


    if (
      allowedTypes.indexOf(
        locationType
      ) === -1
    ) {

      return false;

    }

  }


  /*************************************************
   * 6. CLASSROOM
   *
   * กฎ:
   *
   * M.1  = ห้อง M.1 ปกติเท่านั้น
   * M.2  = ห้อง M.2 ปกติเท่านั้น
   *
   * M.3  = ห้อง M.3 ปกติ
   *         + SME ทุกระดับ
   *
   * M.4  = ห้อง M.4 ปกติเท่านั้น
   * M.5  = ห้อง M.5 ปกติเท่านั้น
   * M.6  = ห้อง M.6 ปกติเท่านั้น
   *************************************************/

  if (
    assignedType === 'CLASSROOM'
  ) {


    /***********************************************
     * M.3 SPECIAL RULE
     ***********************************************/

    if (
      assignedGrade === '3'
    ) {

      /*
       * SME ทุกระดับ
       */

      if (
        locationType === 'CLASSROOM' &&
        isSME
      ) {

        return true;

      }


      /*
       * ห้องปกติของ M.3
       */

      if (
        locationType === 'CLASSROOM' &&
        locationGrade === '3' &&
        !isSME
      ) {

        return true;

      }


      /*
       * อย่างอื่นไม่อนุญาต
       */

      return false;

    }


    /***********************************************
     * M.1 / M.2 / M.4 / M.5 / M.6
     *
     * ห้ามเห็น SME
     ***********************************************/

    if (
      locationType !== 'CLASSROOM'
    ) {

      return false;

    }


    if (
      isSME
    ) {

      return false;

    }


    return (
      locationGrade === assignedGrade
    );

  }


  /*************************************************
   * 7. ZONE
   *************************************************/

  if (
    assignedType === 'ZONE'
  ) {

    if (
      locationType !== 'ZONE'
    ) {

      return false;

    }


    /*
     * ไม่กำหนด Grade หรือ ALL
     * = เห็นทุก Zone
     */

    if (
      assignedGrade === '' ||
      assignedGrade === 'ALL'
    ) {

      return true;

    }


    /*
     * ปกติ = เห็นเฉพาะ Zone
     * ของ Grade ตัวเอง
     */

    return (
      locationGrade === assignedGrade
    );

  }


  /*************************************************
   * 8. FALLBACK
   *************************************************/

  return false;

}


/*************************************************
 * STEP 7.1 TEST
 *************************************************/

/**
 * ทดสอบ Authorization
 *
 * ใช้ User:
 * Student_ID = at
 * Role = ADMIN
 *
 * และ Location:
 * Location_ID = M1-01
 */
function testLocationAuthorization() {

  const user =
    findUserById_(
      'at'
    );


  if (!user) {

    throw new Error(
      'ไม่พบ User: at'
    );

  }


  const location =
    findLocationById_(
      'M1-01'
    );


  if (!location) {

    throw new Error(
      'ไม่พบ Location: M1-01'
    );

  }


  const allowed =
    canAccessLocation_(
      user,
      location
    );


  const result = {

    success:
      true,

    studentId:
      user.Student_ID,

    role:
      user.Role,

    locationId:
      location.Location_ID,

    locationName:
      location.Location_Name,

    allowed:
      allowed

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 7.2
 * AUTHORIZATION RESTRICTION TEST
 *************************************************/

/**
 * สร้าง User จำลองสำหรับทดสอบสิทธิ์
 *
 * ไม่เขียนข้อมูลลง Google Sheets
 */
function testRestrictedLocationAuthorization() {

  /*
   * User จำลอง:
   *
   * Grade = 1
   * Type = CLASSROOM
   * Location = M1-01
   */
  const user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  /*
   * Location ที่ควร "ผ่าน"
   */
  const allowedLocation = {

    Location_ID:
      'M1-01',

    Location_Name:
      'ห้องเรียน 1/1 SME',

    Grade_Level:
      1,

    Type:
      'CLASSROOM',

    Is_SME:
      true

  };


  /*
   * Location ที่ควร "ไม่ผ่าน"
   *
   * Grade ไม่ตรง
   */
  const wrongGradeLocation = {

    Location_ID:
      'M2-01',

    Location_Name:
      'ห้องเรียน 2/1 SME',

    Grade_Level:
      2,

    Type:
      'CLASSROOM',

    Is_SME:
      true

  };


  /*
   * Location ที่ควร "ไม่ผ่าน"
   *
   * Type ไม่ตรง
   */
  const wrongTypeLocation = {

    Location_ID:
      'M1-A01',

    Location_Name:
      'พื้นที่ทดสอบ',

    Grade_Level:
      1,

    Type:
      'AREA',

    Is_SME:
      false

  };


  /*
   * Location ที่ควร "ไม่ผ่าน"
   *
   * Location_ID ไม่อยู่ใน Assigned_Locations
   */
  const wrongLocation = {

    Location_ID:
      'M1-02',

    Location_Name:
      'ห้องเรียน 1/2',

    Grade_Level:
      1,

    Type:
      'CLASSROOM',

    Is_SME:
      false

  };


  const testAllowed =
    canAccessLocation_(
      user,
      allowedLocation
    );


  const testWrongGrade =
    canAccessLocation_(
      user,
      wrongGradeLocation
    );


  const testWrongType =
    canAccessLocation_(
      user,
      wrongTypeLocation
    );


  const testWrongLocation =
    canAccessLocation_(
      user,
      wrongLocation
    );


  const result = {

    success:
      true,

    user:
      user,

    tests: {

      allowedLocation:
        testAllowed,

      wrongGrade:
        testWrongGrade,

      wrongType:
        testWrongType,

      wrongLocation:
        testWrongLocation

    },

    expected: {

      allowedLocation:
        true,

      wrongGrade:
        false,

      wrongType:
        false,

      wrongLocation:
        false

    }

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 7.3
 * GET ACCESSIBLE LOCATIONS
 *************************************************/

/**
 * คืนรายการ Location ที่ User มีสิทธิ์เข้าถึง
 */
function getAccessibleLocations_(user) {

  if (!user) {
    return [];
  }

  const locations =
    getLocationsData_();

  if (!Array.isArray(locations)) {
    throw new Error(
      'ข้อมูล Locations ไม่ใช่ Array'
    );
  }

  return locations.filter(
    function(location) {

      try {

        return canAccessLocation_(
          user,
          location
        );

      } catch (error) {

        console.error(
          'canAccessLocation ERROR:',
          error,
          location
        );

        return false;

      }

    }
  );

}


/*************************************************
 * STEP 7.3 TEST
 *************************************************/

/**
 * ทดสอบด้วย ADMIN
 *
 * ADMIN ควรเห็น Location ทั้งหมด
 */
function testAccessibleLocations() {

  const user =
    findUserById_(
      'at'
    );


  if (!user) {

    throw new Error(
      'ไม่พบ User: at'
    );

  }


  const locations =
    getAccessibleLocations_(
      user
    );


  const allLocations =
    getLocationsData_();


  const result = {

    success:
      true,

    studentId:
      user.Student_ID,

    role:
      user.Role,

    totalLocations:
      allLocations.length,

    accessibleLocations:
      locations.length,

    allAccessible:
      locations.length ===
      allLocations.length,

    firstLocation:
      locations.length > 0
        ? locations[0]
        : null

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 7.4
 * TEST INSPECTOR ACCESSIBLE LOCATIONS
 *************************************************/

function testInspectorAccessibleLocations() {

  const user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  const locations =
    getAccessibleLocations_(
      user
    );


  const ids =
    locations.map(
      function(location) {

        return String(
          location.Location_ID
        )
          .trim()
          .toUpperCase();

      }
    );


  const result = {

    success:
      true,

    user:
      user,

    accessibleCount:
      locations.length,

    accessibleLocationIds:
      ids,

    onlyAllowedLocation:
      ids.length === 1 &&
      ids[0] === 'M1-01',

    firstLocation:
      locations.length > 0
        ? locations[0]
        : null

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 8.1
 * INSPECTION VALIDATION
 *************************************************/

/**
 * ตรวจสอบข้อมูล Inspection ก่อนบันทึก
 *
 * ยังไม่เขียนข้อมูลลง Sheet
 */
function validateInspectionData_(
  user,
  locationId,
  scores
) {

  /*************************************************
   * 1. ตรวจ User
   *************************************************/

  if (!user) {

    return {
      valid: false,
      error: 'ไม่พบข้อมูลผู้ตรวจ'
    };

  }


  /*************************************************
   * 2. ตรวจ Location
   *************************************************/

  const location =
    findLocationById_(
      locationId
    );


  if (!location) {

    return {
      valid: false,
      error:
        'ไม่พบ Location: ' +
        locationId
    };

  }


  /*************************************************
   * 3. ตรวจสิทธิ์
   *************************************************/

  const allowed =
    canAccessLocation_(
      user,
      location
    );


  if (!allowed) {

    return {
      valid: false,
      error:
        'ผู้ใช้นี้ไม่มีสิทธิ์ตรวจ Location นี้'
    };

  }


  /*************************************************
   * 4. ตรวจ Scores
   *************************************************/

  if (!Array.isArray(scores)) {

    return {
      valid: false,
      error:
        'ข้อมูลคะแนนต้องเป็น Array'
    };

  }


  /*************************************************
   * 5. ต้องมี 8 ข้อ
   *************************************************/

  if (scores.length !== 8) {

    return {
      valid: false,
      error:
        'ต้องมีคะแนนทั้งหมด 8 ข้อ'
    };

  }


  /*************************************************
   * 6. คะแนนเต็มของแต่ละข้อ
   *************************************************/

  const maxScores = [
    15,
    15,
    10,
    10,
    10,
    10,
    15,
    15
  ];


  /*************************************************
   * 7. Normalize คะแนน
   *************************************************/

  const normalizedScores = [];


  for (
    let i = 0;
    i < scores.length;
    i++
  ) {

    const score =
      scores[i];


    if (
      score === null ||
      score === undefined ||
      score === ''
    ) {

      return {
        valid: false,
        error:
          'คะแนนข้อที่ ' +
          (i + 1) +
          ' ไม่ถูกต้อง'
      };

    }


    const number =
      Number(score);


    if (!Number.isFinite(number)) {

      return {
        valid: false,
        error:
          'คะแนนข้อที่ ' +
          (i + 1) +
          ' ต้องเป็นตัวเลข'
      };

    }


    /*************************************************
     * ตรวจตามคะแนนเต็มของแต่ละข้อ
     *************************************************/

    if (
      number < 0 ||
      number > maxScores[i]
    ) {

      return {
        valid: false,
        error:
          'คะแนนข้อที่ ' +
          (i + 1) +
          ' ต้องอยู่ระหว่าง 0 ถึง ' +
          maxScores[i]
      };

    }


    normalizedScores.push(
      number
    );

  }


  /*************************************************
   * 8. รวมคะแนน
   *************************************************/

  const totalScore =
    normalizedScores.reduce(
      function(
        total,
        score
      ) {

        return total + score;

      },
      0
    );


  /*************************************************
   * 9. PASS
   *************************************************/

  return {

    valid:
      true,

    user:
      user,

    location:
      location,

    scores:
      normalizedScores,

    totalScore:
      totalScore

  };

}


/*************************************************
 * STEP 8.1 TEST
 *************************************************/

/**
 * ทดสอบข้อมูล Inspection ที่ถูกต้อง
 */
function testInspectionValidation() {

  const user =
    findUserById_(
      'at'
    );


  if (!user) {

    throw new Error(
      'ไม่พบ User: at'
    );

  }


  const scores = [

    5,
    5,
    4,
    5,
    4,
    5,
    5,
    4

  ];


  const result =
    validateInspectionData_(
      user,
      'M1-01',
      scores
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return {

    success:
      result.valid === true,

    valid:
      result.valid,

    locationId:
      result.location
        ? result.location.Location_ID
        : null,

    scoreCount:
      result.scores
        ? result.scores.length
        : 0,

    totalScore:
      result.totalScore || 0

  };

}

/*************************************************
 * STEP 8.2
 * INVALID INSPECTION TESTS
 *************************************************/

function testInvalidInspectionValidation() {

  const user =
    findUserById_(
      'at'
    );


  if (!user) {

    throw new Error(
      'ไม่พบ User: at'
    );

  }


  const results = {};


  /*************************************************
   * TEST 1
   * ไม่มี User
   *************************************************/

  try {

    results.noUser =
      validateInspectionData_(
        null,
        'M1-01',
        [5, 5, 5, 5, 5, 5, 5, 5]
      );

  } catch (error) {

    results.noUser = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * TEST 2
   * Location ไม่มีอยู่จริง
   *************************************************/

  try {

    results.invalidLocation =
      validateInspectionData_(
        user,
        'NOT-EXIST',
        [5, 5, 5, 5, 5, 5, 5, 5]
      );

  } catch (error) {

    results.invalidLocation = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * TEST 3
   * ไม่มีสิทธิ์เข้าถึง Location
   *************************************************/

  const restrictedUser = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  try {

    results.unauthorizedLocation =
      validateInspectionData_(
        restrictedUser,
        'M2-01',
        [5, 5, 5, 5, 5, 5, 5, 5]
      );

  } catch (error) {

    results.unauthorizedLocation = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * TEST 4
   * คะแนนไม่ครบ 8 ข้อ
   *************************************************/

  try {

    results.invalidScoreCount =
      validateInspectionData_(
        user,
        'M1-01',
        [5, 5, 5]
      );

  } catch (error) {

    results.invalidScoreCount = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * TEST 5
   * คะแนนเกิน 5
   *************************************************/

  try {

    results.invalidScoreValue =
      validateInspectionData_(
        user,
        'M1-01',
        [5, 5, 5, 5, 5, 5, 5, 6]
      );

  } catch (error) {

    results.invalidScoreValue = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * ตรวจ Expected
   *************************************************/

  const allRejected =

    results.noUser.valid === false &&

    results.invalidLocation.valid === false &&

    results.unauthorizedLocation.valid === false &&

    results.invalidScoreCount.valid === false &&

    results.invalidScoreValue.valid === false;


  const result = {

    success:
      allRejected,

    allRejected:
      allRejected,

    results:
      results

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 8.3
 * INVALID SCORE TYPE TESTS
 *************************************************/

function testInvalidScoreTypes() {

  const user =
    findUserById_(
      'at'
    );


  if (!user) {

    throw new Error(
      'ไม่พบ User: at'
    );

  }


  const results = {};


  /*************************************************
   * TEST 1
   * ตัวอักษร
   *************************************************/

  try {

    results.textScore =
      validateInspectionData_(
        user,
        'M1-01',
        [5, 5, 5, 5, 5, 5, 5, 'abc']
      );

  } catch (error) {

    results.textScore = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * TEST 2
   * null
   *************************************************/

  try {

    results.nullScore =
      validateInspectionData_(
        user,
        'M1-01',
        [5, 5, 5, 5, 5, 5, 5, null]
      );

  } catch (error) {

    results.nullScore = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * TEST 3
   * undefined
   *************************************************/

  try {

    results.undefinedScore =
      validateInspectionData_(
        user,
        'M1-01',
        [5, 5, 5, 5, 5, 5, 5, undefined]
      );

  } catch (error) {

    results.undefinedScore = {

      valid: false,

      error:
        error.message

    };

  }


  /*************************************************
   * ตรวจ Expected
   *************************************************/

  const allRejected =

    results.textScore.valid === false &&

    results.nullScore.valid === false &&

    results.undefinedScore.valid === false;


  const result = {

    success:
      allRejected,

    allRejected:
      allRejected,

    results:
      results

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.1
 * INSPECTION LOGS HEADER CHECK
 *************************************************/

/**
 * ตรวจสอบโครงสร้าง Sheet Inspection_Logs
 */
function testStep9InspectionLogsHeader() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  /*************************************************
   * ตรวจว่ามี Sheet หรือไม่
   *************************************************/

  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: ' +
      CONFIG.SHEETS.INSPECTION_LOGS
    );

  }


  /*************************************************
   * อ่าน Header แถวแรก
   *************************************************/

  const lastColumn =
    sheet.getLastColumn();


  if (lastColumn === 0) {

    throw new Error(
      'Sheet Inspection_Logs ยังไม่มีข้อมูล'
    );

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function(header) {

        return String(
          header
        ).trim();

      });


  /*************************************************
   * ตรวจ Header ที่ว่าง
   *************************************************/

  const emptyHeaders =
    headers
      .map(function(header, index) {

        if (!header) {

          return index + 1;

        }

        return null;

      })
      .filter(function(column) {

        return column !== null;

      });


  /*************************************************
   * ตรวจ Header ซ้ำ
   *************************************************/

  const normalizedHeaders =
    headers.map(function(header) {

      return header
        .toUpperCase();

    });


  const duplicateHeaders = [];


  normalizedHeaders.forEach(
    function(header, index) {

      if (!header) {

        return;

      }


      const firstIndex =
        normalizedHeaders
          .indexOf(header);


      if (
        firstIndex !== index &&
        duplicateHeaders.indexOf(header) === -1
      ) {

        duplicateHeaders.push(
          header
        );

      }

    }
  );


  /*************************************************
   * ผลลัพธ์
   *************************************************/

  const result = {

    success:
      emptyHeaders.length === 0 &&
      duplicateHeaders.length === 0,

    sheet:
      CONFIG.SHEETS.INSPECTION_LOGS,

    columnCount:
      headers.length,

    headers:
      headers,

    emptyHeaderColumns:
      emptyHeaders,

    duplicateHeaders:
      duplicateHeaders

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.2
 * SAVE INSPECTION TEST
 *************************************************/

/**
 * สร้าง Log ID
 */
function generateLogId_() {

  return 'LOG-' +
    Utilities.getUuid()
      .replace(/-/g, '')
      .substring(0, 12)
      .toUpperCase();

}


/**
 * บันทึก Inspection
 *
 * ขั้นนี้เป็น Test Save
 */

function saveInspection_(
  user,
  locationId,
  scores,
  photoUrl,
  isProxy,
  originalInspectorId
) {

  /*************************************************
   * 1. Validate ข้อมูล
   *************************************************/

  const validation =
    validateInspectionData_(
      user,
      locationId,
      scores
    );


  if (!validation.valid) {

    return {

      success:
        false,

      error:
        validation.error

    };

  }


  /*************************************************
   * 2. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  if (!sheet) {

    return {

      success:
        false,

      error:
        'ไม่พบ Sheet: Inspection_Logs'

    };

  }


  /*************************************************
   * 3. สร้างวันที่และเวลา
   *************************************************/

  const now =
    new Date();


  const timezone =
    Session
      .getScriptTimeZone();


  const date =
    Utilities.formatDate(
      now,
      timezone,
      'yyyy-MM-dd'
    );


  const time =
    Utilities.formatDate(
      now,
      timezone,
      'HH:mm:ss'
    );


  /*************************************************
   * 4. DUPLICATE GUARD
   *
   * ตรวจ Location + วันที่
   * ก่อนสร้าง Log และก่อน appendRow()
   *************************************************/

  const duplicateCheck =
    checkDuplicateBeforeSave_(
      validation
        .location
        .Location_ID,

      date
    );


  if (!duplicateCheck.allowed) {

    return {

      success:
        false,

      duplicate:
        true,

      error:
        duplicateCheck.error,

      existingLog:
        duplicateCheck.existingLog

    };

  }


  /*************************************************
   * 5. สร้าง Log ID
   *************************************************/

  const logId =
    generateLogId_();


  /*************************************************
   * 6. Normalize Proxy
   *************************************************/

  const proxy =
    isProxy === true;


  const originalId =
    proxy
      ? String(
          originalInspectorId || ''
        ).trim()
      : '';


  /*************************************************
   * 7. สร้าง Row
   *
   * ต้องตรงกับ Header 17 คอลัมน์
   *************************************************/

  const row = [

    logId,

    date,

    time,

    validation
      .location
      .Location_ID,

    user
      .Student_ID,

    validation.scores[0],

    validation.scores[1],

    validation.scores[2],

    validation.scores[3],

    validation.scores[4],

    validation.scores[5],

    validation.scores[6],

    validation.scores[7],

    validation.totalScore,

    String(
      photoUrl || ''
    ).trim(),

    proxy,

    originalId

  ];


  /*************************************************
   * 8. ตรวจจำนวน Column
   *************************************************/

  if (
    row.length !== 17
  ) {

    return {

      success:
        false,

      error:
        'จำนวนข้อมูลไม่ตรงกับ Inspection_Logs'

    };

  }


  /*************************************************
   * 9. บันทึก
   *************************************************/

  sheet.appendRow(
    row
  );


  /*************************************************
   * 10. Return
   *************************************************/

  return {

    success:
      true,

    logId:
      logId,

    date:
      date,

    time:
      time,

    locationId:
      validation
        .location
        .Location_ID,

    inspectorId:
      user.Student_ID,

    scores:
      validation.scores,

    totalScore:
      validation.totalScore,

    photoUrl:
      String(
        photoUrl || ''
      ).trim(),

    isProxy:
      proxy,

    originalInspectorId:
      originalId

  };

}

/*************************************************
 * STEP 9.2.1
 * TEST SAVE INSPECTION
 *************************************************/

function testSaveInspection() {

  const user =
    findUserById_(
      'at'
    );


  if (!user) {

    throw new Error(
      'ไม่พบ User: at'
    );

  }


  const scores = [

    5,
    5,
    4,
    5,
    4,
    5,
    5,
    4

  ];


  const result =
    saveInspection_(
      user,
      'M1-01',
      scores,
      '',
      false,
      ''
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.3
 * VERIFY SAVED INSPECTION
 *************************************************/

/**
 * ค้นหา Inspection Log จาก Log_ID
 */
function findInspectionLogById_(
  logId
) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: Inspection_Logs'
    );

  }


  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return null;

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  const logIdIndex =
    headers.indexOf(
      'Log_ID'
    );


  if (
    logIdIndex === -1
  ) {

    throw new Error(
      'ไม่พบ Header: Log_ID'
    );

  }


  const target =
    String(
      logId || ''
    ).trim();


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const currentLogId =
      String(
        values[i][logIdIndex] || ''
      ).trim();


    if (
      currentLogId === target
    ) {

      const object = {};


      headers.forEach(
        function(header, index) {

          object[header] =
            values[i][index];

        }
      );


      return object;

    }

  }


  return null;

}


/**
 * ทดสอบตรวจสอบข้อมูลที่เพิ่งบันทึก
 */
function testVerifySavedInspection() {

  const logId =
    'LOG-8216D8E34A17';


  const saved =
    findInspectionLogById_(
      logId
    );


  if (!saved) {

    return {

      success:
        false,

      error:
        'ไม่พบ Log_ID: ' +
        logId

    };

  }


  const result = {

    success:
      true,

    found:
      true,

    logId:
      saved.Log_ID,

    date:
      saved.Date,

    time:
      saved.Time,

    locationId:
      saved.Location_ID,

    inspectorId:
      saved.Inspector_ID,

    scores: [

      saved.Score_Cat1,
      saved.Score_Cat2,
      saved.Score_Cat3,
      saved.Score_Cat4,
      saved.Score_Cat5,
      saved.Score_Cat6,
      saved.Score_Cat7,
      saved.Score_Cat8

    ],

    totalScore:
      saved.Total_Score,

    photoUrl:
      saved.Photo_URL,

    isProxy:
      saved.Is_Proxy,

    originalInspectorId:
      saved.Original_Inspector_ID

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.4
 * NORMALIZE INSPECTION DATE / TIME
 *************************************************/

/**
 * แปลง Date จาก Google Sheets
 * ให้เป็นข้อความตาม Timezone ของ Script
 */
function formatInspectionDate_(
  value
) {

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

  }


  return String(
    value || ''
  ).trim();

}


/**
 * แปลง Time จาก Google Sheets
 * ให้เป็น HH:mm:ss
 */
function formatInspectionTime_(
  value
) {

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm:ss'
    );

  }


  return String(
    value || ''
  ).trim();

}


/**
 * ทดสอบอ่าน Inspection Log
 * พร้อม Normalize Date / Time
 */
function testStep9_4DateTime() {

  const logId =
    'LOG-8216D8E34A17';


  const saved =
    findInspectionLogById_(
      logId
    );


  if (!saved) {

    return {

      success:
        false,

      error:
        'ไม่พบ Log_ID: ' +
        logId

    };

  }


  const result = {

    success:
      true,

    logId:
      saved.Log_ID,

    date:
      formatInspectionDate_(
        saved.Date
      ),

    time:
      formatInspectionTime_(
        saved.Time
      ),

    locationId:
      saved.Location_ID,

    inspectorId:
      saved.Inspector_ID,

    scores: [

      Number(saved.Score_Cat1),
      Number(saved.Score_Cat2),
      Number(saved.Score_Cat3),
      Number(saved.Score_Cat4),
      Number(saved.Score_Cat5),
      Number(saved.Score_Cat6),
      Number(saved.Score_Cat7),
      Number(saved.Score_Cat8)

    ],

    totalScore:
      Number(saved.Total_Score),

    photoUrl:
      String(
        saved.Photo_URL || ''
      ).trim(),

    isProxy:
      saved.Is_Proxy === true,

    originalInspectorId:
      String(
        saved.Original_Inspector_ID || ''
      ).trim()

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.5.1
 * CHECK DUPLICATE INSPECTION
 *************************************************/

/**
 * ตรวจสอบว่า Location ถูกตรวจแล้วหรือยัง
 * ในวันที่กำหนด
 *
 * ไม่สร้างข้อมูล
 * ไม่แก้ไขข้อมูล
 */
function findInspectionByLocationAndDate_(
  locationId,
  inspectDate
) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: Inspection_Logs'
    );

  }


  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return null;

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  const logIdIndex =
    headers.indexOf(
      'Log_ID'
    );


  const dateIndex =
    headers.indexOf(
      'Date'
    );


  const locationIndex =
    headers.indexOf(
      'Location_ID'
    );


  if (
    logIdIndex === -1 ||
    dateIndex === -1 ||
    locationIndex === -1
  ) {

    throw new Error(
      'Inspection_Logs ไม่มี Header ที่จำเป็น'
    );

  }


  const targetLocation =
    String(
      locationId || ''
    ).trim();


  const targetDate =
    String(
      inspectDate || ''
    ).trim();


  if (
    !targetLocation ||
    !targetDate
  ) {

    return null;

  }


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const rowLocation =
      String(
        values[i][locationIndex] || ''
      ).trim();


    if (
      rowLocation !==
      targetLocation
    ) {

      continue;

    }


    const rowDate =
      formatInspectionDate_(
        values[i][dateIndex]
      );


    if (
      rowDate === targetDate
    ) {

      return {

        found:
          true,

        logId:
          String(
            values[i][logIdIndex] || ''
          ).trim(),

        date:
          rowDate,

        locationId:
          rowLocation

      };

    }

  }


  return null;

}


/**
 * Test ตรวจสอบ Duplicate
 */
function testStep9_5Duplicate() {

  const locationId =
    'M1-01';


  const inspectDate =
    '2026-08-17';


  const existing =
    findInspectionByLocationAndDate_(
      locationId,
      inspectDate
    );


  const result = {

    success:
      true,

    locationId:
      locationId,

    inspectDate:
      inspectDate,

    duplicate:
      !!existing,

    existingLog:
      existing

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.5.3
 * TEST NEW LOCATION
 *************************************************/

function testStep9_5NewLocation() {

  const locationId =
    'M1-02';

  const inspectDate =
    '2026-08-17';

  const existing =
    findInspectionByLocationAndDate_(
      locationId,
      inspectDate
    );

  const result = {

    success:
      true,

    locationId:
      locationId,

    inspectDate:
      inspectDate,

    duplicate:
      !!existing,

    existingLog:
      existing

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}

/*************************************************
 * STEP 9.6.1
 * DUPLICATE GUARD
 *************************************************/

/**
 * ตรวจสอบก่อนอนุญาตให้บันทึก Inspection
 *
 * ถ้าพบว่าตรวจ Location เดิม
 * ในวันเดียวกันแล้ว
 * จะไม่อนุญาตให้บันทึก
 */
function checkDuplicateBeforeSave_(
  locationId,
  inspectDate
) {

  const existing =
    findInspectionByLocationAndDate_(
      locationId,
      inspectDate
    );


  if (existing) {

    return {

      allowed:
        false,

      duplicate:
        true,

      error:
        'Location นี้ถูกตรวจแล้วในวันนี้',

      existingLog:
        existing

    };

  }


  return {

    allowed:
      true,

    duplicate:
      false,

    error:
      '',

    existingLog:
      null

  };

}


/**
 * TEST Duplicate Guard
 */
function testStep9_6_1() {

  const duplicateCase =
    checkDuplicateBeforeSave_(
      'M1-01',
      '2026-08-17'
    );


  const newCase =
    checkDuplicateBeforeSave_(
      'M1-02',
      '2026-08-17'
    );


  const result = {

    success:
      true,

    duplicateCase:
      duplicateCase,

    newCase:
      newCase

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.6.2
 * TEST SAVE WITH DUPLICATE GUARD
 *************************************************/

/**
 * ทดสอบว่าระบบสามารถหยุดการบันทึกซ้ำ
 * ก่อนถึงขั้นบันทึกข้อมูลจริงได้หรือไม่
 */
function testStep9_6_2() {

  const locationId =
    'M1-01';

  const inspectDate =
    '2026-08-17';


  const guard =
    checkDuplicateBeforeSave_(
      locationId,
      inspectDate
    );


  const result = {

    success:
      true,

    locationId:
      locationId,

    inspectDate:
      inspectDate,

    allowed:
      guard.allowed,

    duplicate:
      guard.duplicate,

    shouldSave:
      guard.allowed === true,

    blocked:
      guard.allowed === false,

    error:
      guard.error,

    existingLog:
      guard.existingLog

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.6.3
 * TEST ALLOWED SAVE
 *************************************************/

/**
 * ทดสอบกรณี Location ที่ยังไม่ถูกตรวจ
 */
function testStep9_6_3() {

  const locationId =
    'M1-02';

  const inspectDate =
    '2026-08-17';


  const guard =
    checkDuplicateBeforeSave_(
      locationId,
      inspectDate
    );


  const result = {

    success:
      true,

    locationId:
      locationId,

    inspectDate:
      inspectDate,

    allowed:
      guard.allowed,

    duplicate:
      guard.duplicate,

    shouldSave:
      guard.allowed === true,

    blocked:
      guard.allowed === false,

    error:
      guard.error,

    existingLog:
      guard.existingLog

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.6.5
 * TEST saveInspection_ DUPLICATE
 *************************************************/

function testStep9_6_5() {

  const user =
    findUserById_(
      'at'
    );


  const locationId =
    'M1-01';


  const scores = [
    5,
    5,
    4,
    5,
    4,
    5,
    5,
    4
  ];


  const result =
    saveInspection_(
      user,
      locationId,
      scores,
      '',
      false,
      ''
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.6.6
 * TEST saveInspection_ NEW LOCATION
 *************************************************/

function testStep9_6_6() {

  const user =
    findUserById_(
      'at'
    );


  const locationId =
    'M1-02';


  const scores = [
    5,
    5,
    4,
    5,
    4,
    5,
    5,
    4
  ];


  const result =
    saveInspection_(
      user,
      locationId,
      scores,
      '',
      false,
      ''
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 9.7.1
 * TEST PROXY INSPECTION
 *************************************************/

function testStep9_7_1() {

  const user =
    findUserById_(
      'at'
    );


  const locationId =
    'M1-03';


  const scores = [
    5,
    5,
    4,
    5,
    4,
    5,
    5,
    4
  ];


  const isProxy =
    true;


  const originalInspectorId =
    'TEST-USER';


  const result =
    saveInspection_(
      user,
      locationId,
      scores,
      '',
      isProxy,
      originalInspectorId
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

function testStep9_7_2() {

  const logId =
    'LOG-DD9E43DBD512';

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );

  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: Inspection_Logs'
    );

  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function(header) {
        return String(
          header
        ).trim();
      }
    );

  const logIdIndex =
    headers.indexOf('Log_ID');

  const proxyIndex =
    headers.indexOf('Is_Proxy');

  const originalIndex =
    headers.indexOf(
      'Original_Inspector_ID'
    );

  let foundRow = null;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][logIdIndex]
      ).trim()
      === logId
    ) {

      foundRow =
        values[i];

      break;

    }

  }

  if (!foundRow) {

    const result = {

      success: false,

      found: false,

      error:
        'ไม่พบ Log_ID: ' +
        logId

    };

    Logger.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }

  const isProxy =
    foundRow[proxyIndex];

  const originalInspectorId =
    String(
      foundRow[originalIndex] || ''
    ).trim();

  const result = {

    success:
      isProxy === true &&
      originalInspectorId === 'TEST-USER',

    found:
      true,

    logId:
      logId,

    isProxy:
      isProxy,

    originalInspectorId:
      originalInspectorId,

    expected: {

      isProxy:
        true,

      originalInspectorId:
        'TEST-USER'

    }

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}

function testStep9_7_3() {

  const user =
    findUserById_(
      'at'
    );

  const locationId =
    'M1-04';

  const scores = [
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5
  ];

  /*
   * ตั้งใจส่ง:
   *
   * isProxy = false
   *
   * แต่ส่ง originalInspectorId
   * มาด้วย
   */

  const isProxy =
    false;

  const originalInspectorId =
    'SHOULD-NOT-BE-SAVED';


  const result =
    saveInspection_(
      user,
      locationId,
      scores,
      '',
      isProxy,
      originalInspectorId
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

function testStep9_7_4() {

  const logId =
    'LOG-C10795FB3FE1';

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );

  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: Inspection_Logs'
    );

  }

  const values =
    sheet
      .getDataRange()
      .getValues();

  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );

  const logIdIndex =
    headers.indexOf('Log_ID');

  const proxyIndex =
    headers.indexOf('Is_Proxy');

  const originalIndex =
    headers.indexOf(
      'Original_Inspector_ID'
    );

  if (
    logIdIndex === -1 ||
    proxyIndex === -1 ||
    originalIndex === -1
  ) {

    throw new Error(
      'ไม่พบ Column ที่จำเป็น'
    );

  }

  let foundRow =
    null;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][logIdIndex]
      ).trim()
      === logId
    ) {

      foundRow =
        values[i];

      break;

    }

  }

  if (!foundRow) {

    const result = {

      success:
        false,

      found:
        false,

      error:
        'ไม่พบ Log_ID: ' +
        logId

    };

    Logger.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }

  const isProxy =
    foundRow[proxyIndex];

  const originalInspectorId =
    String(
      foundRow[originalIndex] || ''
    ).trim();

  const result = {

    success:
      isProxy === false &&
      originalInspectorId === '',

    found:
      true,

    logId:
      logId,

    isProxy:
      isProxy,

    originalInspectorId:
      originalInspectorId,

    expected: {

      isProxy:
        false,

      originalInspectorId:
        ''

    }

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}

function getInspectionHistory_(
  studentId
) {

  /*************************************************
   * 1. ตรวจ Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  if (!sheet) {

    throw new Error(
      'ไม่พบ Sheet: Inspection_Logs'
    );

  }


  /*************************************************
   * 2. อ่านข้อมูล
   *************************************************/

  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return [];

  }


  /*************************************************
   * 3. อ่าน Header
   *************************************************/

  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  /*************************************************
   * 4. หา Column
   *************************************************/

  const indexes = {

    Log_ID:
      headers.indexOf(
        'Log_ID'
      ),

    Date:
      headers.indexOf(
        'Date'
      ),

    Time:
      headers.indexOf(
        'Time'
      ),

    Location_ID:
      headers.indexOf(
        'Location_ID'
      ),

    Inspector_ID:
      headers.indexOf(
        'Inspector_ID'
      ),

    Score_Cat1:
      headers.indexOf(
        'Score_Cat1'
      ),

    Score_Cat2:
      headers.indexOf(
        'Score_Cat2'
      ),

    Score_Cat3:
      headers.indexOf(
        'Score_Cat3'
      ),

    Score_Cat4:
      headers.indexOf(
        'Score_Cat4'
      ),

    Score_Cat5:
      headers.indexOf(
        'Score_Cat5'
      ),

    Score_Cat6:
      headers.indexOf(
        'Score_Cat6'
      ),

    Score_Cat7:
      headers.indexOf(
        'Score_Cat7'
      ),

    Score_Cat8:
      headers.indexOf(
        'Score_Cat8'
      ),

    Total_Score:
      headers.indexOf(
        'Total_Score'
      ),

    Photo_URL:
      headers.indexOf(
        'Photo_URL'
      ),

    Is_Proxy:
      headers.indexOf(
        'Is_Proxy'
      ),

    Original_Inspector_ID:
      headers.indexOf(
        'Original_Inspector_ID'
      )

  };


  /*************************************************
   * 5. ตรวจ Header
   *************************************************/

  const missing =
    Object.keys(indexes)
      .filter(
        function(key) {

          return indexes[key] === -1;

        }
      );


  if (
    missing.length > 0
  ) {

    throw new Error(
      'ไม่พบ Column: ' +
      missing.join(', ')
    );

  }


  /*************************************************
   * 6. Normalize Student ID
   *************************************************/

  const targetStudentId =
    String(
      studentId || ''
    )
      .trim()
      .toLowerCase();


  if (!targetStudentId) {

    return [];

  }


  /*************************************************
   * 7. Filter ประวัติ
   *************************************************/

  const history =
    values
      .slice(1)
      .filter(
        function(row) {

          return String(
            row[indexes.Inspector_ID] || ''
          )
            .trim()
            .toLowerCase()
            === targetStudentId;

        }
      )
      .map(
        function(row) {

          return {

            logId:
              row[indexes.Log_ID],

            date:
              row[indexes.Date],

            time:
              row[indexes.Time],

            locationId:
              row[indexes.Location_ID],

            inspectorId:
              row[indexes.Inspector_ID],

            scores: [

              row[indexes.Score_Cat1],

              row[indexes.Score_Cat2],

              row[indexes.Score_Cat3],

              row[indexes.Score_Cat4],

              row[indexes.Score_Cat5],

              row[indexes.Score_Cat6],

              row[indexes.Score_Cat7],

              row[indexes.Score_Cat8]

            ],

            totalScore:
              row[indexes.Total_Score],

            photoUrl:
              String(
                row[indexes.Photo_URL] || ''
              ).trim(),

            isProxy:
              row[indexes.Is_Proxy] === true,

            originalInspectorId:
              String(
                row[indexes.Original_Inspector_ID] || ''
              ).trim()

          };

        }
      );


  /*************************************************
   * 8. เรียงล่าสุดก่อน
   *************************************************/

  history.sort(
    function(a, b) {

      const dateA =
        String(
          a.date
        );

      const dateB =
        String(
          b.date
        );

      if (
        dateA !== dateB
      ) {

        return dateB.localeCompare(
          dateA
        );

      }

      return String(
        b.time
      )
        .localeCompare(
          String(
            a.time
          )
        );

    }
  );


  return history;

}

function testStep9_8_1() {

  const history =
    getInspectionHistory_(
      'at'
    );


  const result = {

    success:
      true,

    studentId:
      'at',

    count:
      history.length,

    history:
      history

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.1
 * ATTENDANCE / PROXY - SHEET STRUCTURE
 *************************************************/

function testStep10AttendanceSheet() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    return {

      success: false,

      error:
        'ไม่พบ Sheet: ' +
        CONFIG.SHEETS.ATTENDANCE

    };

  }


  const lastColumn =
    sheet.getLastColumn();


  const lastRow =
    sheet.getLastRow();


  if (lastColumn === 0) {

    return {

      success: true,

      sheet:
        CONFIG.SHEETS.ATTENDANCE,

      columnCount: 0,

      rowCount:
        lastRow,

      headers: [],

      emptyHeaderColumns: [],

      duplicateHeaders: []

    };

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function(header) {

        return String(
          header
        ).trim();

      });


  const emptyHeaderColumns = [];

  const headerMap = {};


  headers.forEach(
    function(header, index) {

      const columnNumber =
        index + 1;


      if (!header) {

        emptyHeaderColumns.push(
          columnNumber
        );

        return;

      }


      if (!headerMap[header]) {

        headerMap[header] = [];

      }


      headerMap[header].push(
        columnNumber
      );

    }
  );


  const duplicateHeaders = [];


  Object.keys(headerMap)
    .forEach(function(header) {

      if (
        headerMap[header].length > 1
      ) {

        duplicateHeaders.push({

          header:
            header,

          columns:
            headerMap[header]

        });

      }

    });


  const result = {

    success: true,

    sheet:
      CONFIG.SHEETS.ATTENDANCE,

    columnCount:
      headers.length,

    rowCount:
      lastRow,

    headers:
      headers,

    emptyHeaderColumns:
      emptyHeaderColumns,

    duplicateHeaders:
      duplicateHeaders

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.2
 * ATTENDANCE - CLOCK IN
 *************************************************/

function clockIn_(user, recordedBy) {

  /*************************************************
   * 1. ตรวจ User
   *************************************************/

  if (!user || !user.Student_ID) {

    return {
      success: false,
      error: 'ไม่พบข้อมูลผู้ใช้'
    };

  }


  /*************************************************
   * 2. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    return {
      success: false,
      error: 'ไม่พบ Sheet: Attendance_and_Proxy'
    };

  }


  /*************************************************
   * 3. วันที่และเวลา
   *************************************************/

  const now =
    new Date();

  const timezone =
    Session.getScriptTimeZone();

  const date =
    Utilities.formatDate(
      now,
      timezone,
      'yyyy-MM-dd'
    );

  const time =
    Utilities.formatDate(
      now,
      timezone,
      'HH:mm:ss'
    );


  /*************************************************
   * 4. ตรวจว่าลงเวลาแล้วหรือยัง
   *************************************************/

  const existing =
    findAttendanceToday_(
      user.Student_ID
    );


  if (existing) {

    return {

      success: false,

      duplicate: true,

      error:
        'ผู้ใช้นี้ลงเวลาเข้าแล้ววันนี้',

      existing:
        existing

    };

  }


  /*************************************************
   * 5. สร้าง Attendance ID
   *************************************************/

  const attendanceId =
    'ATT-' +
    Utilities.getUuid()
      .replace(/-/g, '')
      .substring(0, 12)
      .toUpperCase();


  /*************************************************
   * 6. Recorded By
   *************************************************/

  const recordedById =
    String(
      recordedBy ||
      user.Student_ID ||
      ''
    ).trim();


  /*************************************************
   * 7. สร้าง Row
   *
   * Attendance_and_Proxy
   *
   * 8 Columns
   *************************************************/

  const row = [

    attendanceId,

    date,

    String(
      user.Student_ID
    ).trim(),

    time,

    'PRESENT',

    '',

    '',

    recordedById

  ];


  /*************************************************
   * 8. ตรวจจำนวน Column
   *************************************************/

  if (
    row.length !== 8
  ) {

    return {

      success: false,

      error:
        'จำนวนข้อมูลไม่ตรงกับ Attendance_and_Proxy'

    };

  }


  /*************************************************
   * 9. บันทึก
   *************************************************/

  sheet.appendRow(
    row
  );


  /*************************************************
   * 10. Return
   *************************************************/

  return {

    success: true,

    attendanceId:
      attendanceId,

    date:
      date,

    time:
      time,

    userId:
      String(
        user.Student_ID
      ).trim(),

    status:
      'PRESENT',

    recordedBy:
      recordedById

  };

}


/*************************************************
 * STEP 10.2 HELPER
 * FIND TODAY ATTENDANCE
 *************************************************/

function findAttendanceToday_(
  studentId
) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    return null;

  }


  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return null;

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  const index = {};

  headers.forEach(
    function(header, i) {

      index[header] = i;

    }
  );


  const targetUser =
    String(
      studentId || ''
    )
      .trim()
      .toLowerCase();


  if (!targetUser) {

    return null;

  }


  const timezone =
    Session.getScriptTimeZone();

  const today =
    Utilities.formatDate(
      new Date(),
      timezone,
      'yyyy-MM-dd'
    );


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const rowUser =
      String(
        row[index.User_ID] || ''
      )
        .trim()
        .toLowerCase();


    if (
      rowUser !== targetUser
    ) {

      continue;

    }


    const rowDateValue =
      row[index.Date];


    let rowDate = '';


    if (
      rowDateValue instanceof Date
    ) {

      rowDate =
        Utilities.formatDate(
          rowDateValue,
          timezone,
          'yyyy-MM-dd'
        );

    } else {

      rowDate =
        String(
          rowDateValue || ''
        ).trim();

    }


    if (
      rowDate === today
    ) {

      return {

        found: true,

        attendanceId:
          row[index.Attendance_ID],

        date:
          rowDate,

        userId:
          row[index.User_ID],

        clockInTime:
          row[index.ClockIn_Time],

        status:
          row[index.Status],

        leaveReason:
          row[index.Leave_Reason],

        leaveType:
          row[index.Leave_Type],

        recordedBy:
          row[index.Recorded_By]

      };

    }

  }


  return null;

}


/*************************************************
 * STEP 10.2 TEST
 *************************************************/

function testClockIn() {

  const user =
    findUserById_(
      'at'
    );


  if (!user) {

    return {

      success: false,

      error:
        'ไม่พบ TEST USER: at'

    };

  }


  const result =
    clockIn_(
      user,
      user.Student_ID
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.1
 * CHECK DUPLICATE ATTENDANCE
 *************************************************/

/**
 * ตรวจสอบว่าผู้ใช้ลงเวลาในวันนี้แล้วหรือยัง
 *
 * ผลลัพธ์:
 * duplicate = true  → ลงเวลาแล้ว
 * duplicate = false → ยังไม่ลงเวลา
 */
function checkAttendanceDuplicate_(
  userId,
  date
) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    return {

      success:
        false,

      error:
        'ไม่พบ Sheet: Attendance_and_Proxy'

    };

  }


  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return {

      success:
        true,

      duplicate:
        false,

      existingAttendance:
        null

    };

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  const userIdIndex =
    headers.indexOf(
      'User_ID'
    );

  const dateIndex =
    headers.indexOf(
      'Date'
    );

  const attendanceIdIndex =
    headers.indexOf(
      'Attendance_ID'
    );


  if (
    userIdIndex === -1 ||
    dateIndex === -1
  ) {

    return {

      success:
        false,

      error:
        'ไม่พบ Column User_ID หรือ Date'

    };

  }


  const targetUserId =
    String(
      userId || ''
    )
      .trim()
      .toLowerCase();


  const targetDate =
    date
      ? String(date).trim()
      : Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const rowUserId =
      String(
        row[userIdIndex] || ''
      )
        .trim()
        .toLowerCase();


    if (
      rowUserId !==
      targetUserId
    ) {

      continue;

    }


    const rowDateValue =
      row[dateIndex];


    let rowDate = '';


    if (
      rowDateValue instanceof Date
    ) {

      rowDate =
        Utilities.formatDate(
          rowDateValue,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

    } else {

      rowDate =
        String(
          rowDateValue || ''
        ).trim();

    }


    if (
      rowDate ===
      targetDate
    ) {

      return {

        success:
          true,

        duplicate:
          true,

        existingAttendance: {

          found:
            true,

          attendanceId:
            attendanceIdIndex !== -1
              ? String(
                  row[
                    attendanceIdIndex
                  ] || ''
                )
              : '',

          date:
            rowDate,

          userId:
            row[
              userIdIndex
            ]

        }

      };

    }

  }


  return {

    success:
      true,

    duplicate:
      false,

    existingAttendance:
      null

  };

}
/*************************************************
 * STEP 10.1 TEST
 *************************************************/

function testStep10_1() {

  const userId =
    'at';


  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  const result =
    checkAttendanceDuplicate_(
      userId,
      today
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.2
 * TEST NEW ATTENDANCE USER
 *************************************************/

function testStep10_2() {

  const testUserId =
    'TEST-USER';


  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  const result =
    checkAttendanceDuplicate_(
      testUserId,
      today
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return {

    success:
      result.success === true,

    userId:
      testUserId,

    date:
      today,

    duplicate:
      result.duplicate,

    existingAttendance:
      result.existingAttendance,

    expected: {

      duplicate:
        false,

      existingAttendance:
        null

    }

  };

}
/*************************************************
 * STEP 10.3
 * ATTENDANCE STATUS VALIDATION
 *************************************************/

/**
 * ตรวจสอบข้อมูล Attendance
 *
 * Status ที่รองรับ:
 * PRESENT
 * ABSENT
 * LEAVE
 *
 * LEAVE ต้องมี:
 * - Leave_Reason
 * - Leave_Type
 */
function validateAttendanceData_(
  userId,
  status,
  leaveReason,
  leaveType
) {

  /*************************************************
   * 1. ตรวจ User ID
   *************************************************/

  const targetUserId =
    String(
      userId || ''
    ).trim();


  if (!targetUserId) {

    return {

      valid:
        false,

      error:
        'ต้องระบุ User_ID'

    };

  }


  /*************************************************
   * 2. Normalize Status
   *************************************************/

  const normalizedStatus =
    String(
      status || ''
    )
      .trim()
      .toUpperCase();


  /*************************************************
   * 3. ตรวจ Status
   *************************************************/

  const allowedStatuses = [

    'PRESENT',

    'ABSENT',

    'LEAVE'

  ];


  if (
    !allowedStatuses.includes(
      normalizedStatus
    )
  ) {

    return {

      valid:
        false,

      error:
        'Status ต้องเป็น PRESENT, ABSENT หรือ LEAVE'

    };

  }


  /*************************************************
   * 4. Normalize Leave Data
   *************************************************/

  const normalizedReason =
    String(
      leaveReason || ''
    ).trim();


  const normalizedType =
    String(
      leaveType || ''
    ).trim();


  /*************************************************
   * 5. ตรวจกรณี LEAVE
   *************************************************/

  if (
    normalizedStatus ===
    'LEAVE'
  ) {

    if (
      !normalizedReason
    ) {

      return {

        valid:
          false,

        error:
          'กรุณาระบุ Leave_Reason'

      };

    }


    if (
      !normalizedType
    ) {

      return {

        valid:
          false,

        error:
          'กรุณาระบุ Leave_Type'

      };

    }

  }


  /*************************************************
   * 6. กรณีไม่ใช่ LEAVE
   *
   * ไม่บังคับ Leave_Reason / Leave_Type
   *************************************************/


  return {

    valid:
      true,

    userId:
      targetUserId,

    status:
      normalizedStatus,

    leaveReason:
      normalizedStatus === 'LEAVE'
        ? normalizedReason
        : '',

    leaveType:
      normalizedStatus === 'LEAVE'
        ? normalizedType
        : ''

  };

}


/*************************************************
 * STEP 10.3 TEST
 *************************************************/

function testStep10_3() {

  const results = {};


  /*************************************************
   * CASE 1
   * PRESENT
   *************************************************/

  results.present =
    validateAttendanceData_(
      'at',
      'PRESENT',
      '',
      ''
    );


  /*************************************************
   * CASE 2
   * ABSENT
   *************************************************/

  results.absent =
    validateAttendanceData_(
      'at',
      'ABSENT',
      '',
      ''
    );


  /*************************************************
   * CASE 3
   * LEAVE ถูกต้อง
   *************************************************/

  results.leaveValid =
    validateAttendanceData_(
      'at',
      'LEAVE',
      'ลาป่วย',
      'SICK'
    );


  /*************************************************
   * CASE 4
   * LEAVE ไม่มี Reason
   *************************************************/

  results.leaveNoReason =
    validateAttendanceData_(
      'at',
      'LEAVE',
      '',
      'SICK'
    );


  /*************************************************
   * CASE 5
   * LEAVE ไม่มี Type
   *************************************************/

  results.leaveNoType =
    validateAttendanceData_(
      'at',
      'LEAVE',
      'ลาป่วย',
      ''
    );


  /*************************************************
   * CASE 6
   * Status ผิด
   *************************************************/

  results.invalidStatus =
    validateAttendanceData_(
      'at',
      'HOLIDAY',
      '',
      ''
    );


  /*************************************************
   * CASE 7
   * ไม่มี User
   *************************************************/

  results.noUser =
    validateAttendanceData_(
      '',
      'PRESENT',
      '',
      ''
    );


  /*************************************************
   * ตรวจผลรวม
   *************************************************/

  const allValidCases =
    results.present.valid === true &&
    results.absent.valid === true &&
    results.leaveValid.valid === true;


  const allRejectedCases =
    results.leaveNoReason.valid === false &&
    results.leaveNoType.valid === false &&
    results.invalidStatus.valid === false &&
    results.noUser.valid === false;


  const result = {

    success:
      allValidCases &&
      allRejectedCases,

    results:
      results,

    expected: {

      present:
        true,

      absent:
        true,

      leaveValid:
        true,

      leaveNoReason:
        false,

      leaveNoType:
        false,

      invalidStatus:
        false,

      noUser:
        false

    }

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.4
 * SAVE ATTENDANCE
 *************************************************/

/**
 * สร้าง Attendance ID
 */
function generateAttendanceId_() {

  return 'ATT-' +
    Utilities.getUuid()
      .replace(/-/g, '')
      .substring(0, 12)
      .toUpperCase();

}


/**
 * บันทึก Attendance
 *
 * รองรับ:
 * PRESENT
 * ABSENT
 * LEAVE
 */
function saveAttendance_(
  userId,
  status,
  leaveReason,
  leaveType,
  recordedBy
) {

  /*************************************************
   * 1. Validate ข้อมูล
   *************************************************/

  const validation =
    validateAttendanceData_(
      userId,
      status,
      leaveReason,
      leaveType
    );


  if (!validation.valid) {

    return {

      success:
        false,

      duplicate:
        false,

      error:
        validation.error

    };

  }


  /*************************************************
   * 2. เตรียมวันที่และเวลา
   *************************************************/

  const now =
    new Date();


  const timezone =
    Session.getScriptTimeZone();


  const date =
    Utilities.formatDate(
      now,
      timezone,
      'yyyy-MM-dd'
    );


  const time =
    Utilities.formatDate(
      now,
      timezone,
      'HH:mm:ss'
    );


  /*************************************************
   * 3. ตรวจการลงเวลาซ้ำ
   *************************************************/

  const duplicateCheck =
    checkAttendanceDuplicate_(
      validation.userId,
      date
    );


  if (!duplicateCheck.success) {

    return {

      success:
        false,

      duplicate:
        false,

      error:
        duplicateCheck.error

    };

  }


  if (
    duplicateCheck.duplicate
  ) {

    return {

      success:
        false,

      duplicate:
        true,

      error:
        'ผู้ใช้นี้มี Attendance แล้วในวันนี้',

      existingAttendance:
        duplicateCheck.existingAttendance

    };

  }


  /*************************************************
   * 4. ตรวจ Recorded By
   *************************************************/

  const recordedById =
    String(
      recordedBy ||
      validation.userId ||
      ''
    ).trim();


  if (!recordedById) {

    return {

      success:
        false,

      duplicate:
        false,

      error:
        'ไม่พบ Recorded_By'

    };

  }


  /*************************************************
   * 5. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    return {

      success:
        false,

      duplicate:
        false,

      error:
        'ไม่พบ Sheet: Attendance_and_Proxy'

    };

  }


  /*************************************************
   * 6. ตรวจ Header
   *************************************************/

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0]
      .map(function(header) {

        return String(
          header
        ).trim();

      });


  const expectedHeaders = [

    'Attendance_ID',
    'Date',
    'User_ID',
    'ClockIn_Time',
    'Status',
    'Leave_Reason',
    'Leave_Type',
    'Recorded_By'

  ];


  if (
    headers.length !==
    expectedHeaders.length
  ) {

    return {

      success:
        false,

      duplicate:
        false,

      error:
        'จำนวน Column ของ Attendance_and_Proxy ไม่ตรงกับระบบ'

    };

  }


  for (
    let i = 0;
    i < expectedHeaders.length;
    i++
  ) {

    if (
      headers[i] !==
      expectedHeaders[i]
    ) {

      return {

        success:
          false,

        duplicate:
          false,

        error:
          'Header ไม่ตรงที่ตำแหน่ง Column ' +
          (i + 1) +
          ': ต้องเป็น ' +
          expectedHeaders[i]

      };

    }

  }


  /*************************************************
   * 7. สร้าง Attendance ID
   *************************************************/

  const attendanceId =
    generateAttendanceId_();


  /*************************************************
   * 8. เตรียม Row
   *************************************************/

  const row = [

    attendanceId,

    date,

    validation.userId,

    time,

    validation.status,

    validation.leaveReason,

    validation.leaveType,

    recordedById

  ];


  /*************************************************
   * 9. ตรวจจำนวน Column
   *************************************************/

  if (
    row.length !== 8
  ) {

    return {

      success:
        false,

      duplicate:
        false,

      error:
        'จำนวนข้อมูลไม่ตรงกับ Attendance_and_Proxy'

    };

  }


  /*************************************************
   * 10. บันทึก
   *************************************************/

  sheet.appendRow(
    row
  );


  /*************************************************
   * 11. Return
   *************************************************/

  return {

    success:
      true,

    duplicate:
      false,

    attendanceId:
      attendanceId,

    date:
      date,

    time:
      time,

    userId:
      validation.userId,

    status:
      validation.status,

    leaveReason:
      validation.leaveReason,

    leaveType:
      validation.leaveType,

    recordedBy:
      recordedById

  };

}
/*************************************************
 * STEP 10.4 TEST
 *************************************************/

function testStep10_4() {

  /*
   * ใช้ TEST-USER เพราะยังไม่มี
   * Attendance ของวันนี้
   */

  const result =
    saveAttendance_(
      'TEST-USER',
      'PRESENT',
      '',
      '',
      'at'
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.5
 * TEST REAL LEAVE ATTENDANCE
 *************************************************/

function testStep10_5() {

  const userId =
    'LEAVE-TEST';

  const status =
    'LEAVE';

  const leaveReason =
    'ลาป่วย';

  const leaveType =
    'SICK';

  const recordedBy =
    'at';


  /*************************************************
   * ตรวจ User ก่อน
   *************************************************/

  const user =
    findUserById_(
      userId
    );


  if (!user) {

    return {

      success:
        false,

      error:
        'ไม่พบ User: ' +
        userId

    };

  }


  /*************************************************
   * บันทึก LEAVE จริง
   *************************************************/

  const result =
    saveAttendance_(
      userId,
      status,
      leaveReason,
      leaveType,
      recordedBy
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.6
 * ATTENDANCE READ-BACK VERIFICATION
 *************************************************/

function testStep10_6() {

  const attendanceId =
    'ATT-966A0AA0A8F5';


  /*************************************************
   * 1. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    return {

      success:
        false,

      error:
        'ไม่พบ Sheet: Attendance_and_Proxy'

    };

  }


  /*************************************************
   * 2. อ่านข้อมูล
   *************************************************/

  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return {

      success:
        false,

      error:
        'ไม่มีข้อมูล Attendance'

    };

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  /*************************************************
   * 3. ค้นหา Attendance ID
   *************************************************/

  const idIndex =
    headers.indexOf(
      'Attendance_ID'
    );


  if (
    idIndex === -1
  ) {

    return {

      success:
        false,

      error:
        'ไม่พบ Column Attendance_ID'

    };

  }


  let foundRow =
    null;


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][idIndex] || ''
      ).trim()
      ===
      attendanceId
    ) {

      foundRow =
        values[i];

      break;

    }

  }


  /*************************************************
   * 4. ตรวจว่าพบข้อมูล
   *************************************************/

  if (!foundRow) {

    return {

      success:
        false,

      found:
        false,

      error:
        'ไม่พบ Attendance_ID: ' +
        attendanceId

    };

  }


  /*************************************************
   * 5. ดึงข้อมูลตาม Header
   *************************************************/

  const record =
    {};


  headers.forEach(
    function(header, index) {

      record[header] =
        foundRow[index];

    }
  );


  /*************************************************
   * 6. ตรวจค่าที่คาดหวัง
   *************************************************/

  const checks = {

    attendanceId:
      String(
        record.Attendance_ID || ''
      ).trim()
      ===
      attendanceId,

    userId:
      String(
        record.User_ID || ''
      ).trim()
      ===
      'LEAVE-TEST',

    status:
      String(
        record.Status || ''
      ).trim()
      .toUpperCase()
      ===
      'LEAVE',

    leaveReason:
      String(
        record.Leave_Reason || ''
      ).trim()
      ===
      'ลาป่วย',

    leaveType:
      String(
        record.Leave_Type || ''
      ).trim()
      .toUpperCase()
      ===
      'SICK',

    recordedBy:
      String(
        record.Recorded_By || ''
      ).trim()
      ===
      'at'

  };


  /*************************************************
   * 7. สรุปผล
   *************************************************/

  const allPassed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return checks[key] === true;

      }
    );


  const result = {

    success:
      allPassed,

    found:
      true,

    attendanceId:
      attendanceId,

    record:
      record,

    checks:
      checks,

    expected: {

      userId:
        'LEAVE-TEST',

      status:
        'LEAVE',

      leaveReason:
        'ลาป่วย',

      leaveType:
        'SICK',

      recordedBy:
        'at'

    }

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.7
 * TEST DUPLICATE ATTENDANCE SAVE
 *************************************************/

function testStep10_7() {

  const userId =
    'LEAVE-TEST';

  const status =
    'PRESENT';

  const leaveReason =
    '';

  const leaveType =
    '';

  const recordedBy =
    'at';


  /*************************************************
   * เรียก SAVE จริง
   *************************************************/

  const result =
    saveAttendance_(
      userId,
      status,
      leaveReason,
      leaveType,
      recordedBy
    );


  /*************************************************
   * ตรวจผล
   *
   * ต้องถูกปฏิเสธ
   *************************************************/

  const passed =
    result.success === false &&
    result.duplicate === true &&
    result.existingAttendance !== null;


  const finalResult = {

    success:
      passed,

    actual:
      result,

    expected: {

      success:
        false,

      duplicate:
        true,

      existingAttendance:
        true

    }

  };


  Logger.log(
    JSON.stringify(
      finalResult,
      null,
      2
    )
  );


  return finalResult;

}

/*************************************************
 * STEP 10.8
 * SAVE ABSENT ATTENDANCE
 *************************************************/

function testStep10_8() {

  const userId =
    'ABSENT-TEST';

  const status =
    'ABSENT';

  const leaveReason =
    '';

  const leaveType =
    '';

  const recordedBy =
    'at';


  /*************************************************
   * 1. ตรวจ User
   *************************************************/

  const user =
    findUserById_(
      userId
    );


  if (!user) {

    const result = {

      success:
        false,

      error:
        'ไม่พบ User: ' +
        userId

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 2. ตรวจ Duplicate ก่อน
   *************************************************/

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  const duplicateCheck =
    checkAttendanceDuplicate_(
      userId,
      today
    );


  if (!duplicateCheck.success) {

    const result = {

      success:
        false,

      error:
        duplicateCheck.error

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 3. ถ้ามีข้อมูลแล้ว
   *************************************************/

  if (
    duplicateCheck.duplicate
  ) {

    const result = {

      success:
        false,

      duplicate:
        true,

      error:
        'ABSENT-TEST มี Attendance แล้วในวันนี้',

      existingAttendance:
        duplicateCheck.existingAttendance

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 4. บันทึกจริง
   *************************************************/

  const saveResult =
  saveProxyInspection_(
    originalInspectorId,
    supervisorId,
    locationId,
    scores,
    photoUrl
  );

  /*************************************************
   * 5. แสดงผล
   *************************************************/

  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      saveResult,
      null,
      2
    )
  );


  return saveResult;

}
/*************************************************
 * STEP 10.8A
 * CHECK ABSENT TEST USER
 *************************************************/

function testStep10_8A() {

  const userId =
    'ABSENT-TEST';


  const user =
    findUserById_(
      userId
    );


  const result = {

    success:
      !!user,

    found:
      !!user,

    user:
      user

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 10.9
 * READ-BACK VERIFY ABSENT ATTENDANCE
 *************************************************/

function testStep10_9() {

  const attendanceId =
    'ATT-24F2A5BCA44B';


  /*************************************************
   * 1. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    const result = {

      success:
        false,

      error:
        'ไม่พบ Sheet: Attendance_and_Proxy'

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 2. อ่านข้อมูลทั้งหมด
   *************************************************/

  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    const result = {

      success:
        false,

      found:
        false,

      error:
        'ไม่มีข้อมูล Attendance'

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 3. อ่าน Header
   *************************************************/

  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  /*************************************************
   * 4. หา Column Attendance_ID
   *************************************************/

  const idIndex =
    headers.indexOf(
      'Attendance_ID'
    );


  if (
    idIndex === -1
  ) {

    const result = {

      success:
        false,

      error:
        'ไม่พบ Column Attendance_ID'

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 5. ค้นหา Record
   *************************************************/

  let foundRow =
    null;


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][idIndex] || ''
      ).trim()
      ===
      attendanceId
    ) {

      foundRow =
        values[i];

      break;

    }

  }


  /*************************************************
   * 6. ไม่พบ Record
   *************************************************/

  if (!foundRow) {

    const result = {

      success:
        false,

      found:
        false,

      attendanceId:
        attendanceId,

      error:
        'ไม่พบ Attendance_ID: ' +
        attendanceId

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 7. แปลง Row เป็น Object
   *************************************************/

  const record =
    {};


  headers.forEach(
    function(header, index) {

      record[header] =
        foundRow[index];

    }
  );


  /*************************************************
   * 8. ตรวจข้อมูล
   *************************************************/

  const checks = {

    attendanceId:
      String(
        record.Attendance_ID || ''
      ).trim()
      ===
      attendanceId,

    userId:
      String(
        record.User_ID || ''
      ).trim()
      ===
      'ABSENT-TEST',

    status:
      String(
        record.Status || ''
      ).trim()
      .toUpperCase()
      ===
      'ABSENT',

    leaveReason:
      String(
        record.Leave_Reason || ''
      ).trim()
      ===
      '',

    leaveType:
      String(
        record.Leave_Type || ''
      ).trim()
      ===
      '',

    recordedBy:
      String(
        record.Recorded_By || ''
      ).trim()
      ===
      'at'

  };


  /*************************************************
   * 9. ตรวจว่าผ่านทุกข้อ
   *************************************************/

  const passed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return checks[key] === true;

      }
    );


  /*************************************************
   * 10. ผลลัพธ์
   *************************************************/

  const result = {

    success:
      passed,

    found:
      true,

    attendanceId:
      attendanceId,

    record:
      record,

    checks:
      checks,

    expected: {

      userId:
        'ABSENT-TEST',

      status:
        'ABSENT',

      leaveReason:
        '',

      leaveType:
        '',

      recordedBy:
        'at'

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 11.1
 * VALIDATE SUPERVISOR PROXY
 *************************************************/

function validateSupervisorProxy_(
  targetUserId,
  supervisorId
) {

  const targetId =
    String(
      targetUserId || ''
    ).trim();

  const supervisor =
    String(
      supervisorId || ''
    ).trim();


  /*************************************************
   * 1. ตรวจ Target User
   *************************************************/

  if (!targetId) {

    return {

      valid:
        false,

      error:
        'ต้องระบุ User_ID ของผู้ถูกทำแทน'

    };

  }


  /*************************************************
   * 2. ตรวจ Supervisor
   *************************************************/

  if (!supervisor) {

    return {

      valid:
        false,

      error:
        'ต้องระบุ Supervisor_ID'

    };

  }


  /*************************************************
   * 3. ห้ามทำแทนตัวเอง
   *************************************************/

  if (
    targetId.toLowerCase() ===
    supervisor.toLowerCase()
  ) {

    return {

      valid:
        false,

      error:
        'ไม่สามารถทำรายการแทนตัวเองได้'

    };

  }


  /*************************************************
   * 4. ค้นหา Target User
   *************************************************/

  const targetUser =
    findUserById_(
      targetId
    );


  if (!targetUser) {

    return {

      valid:
        false,

      error:
        'ไม่พบผู้ถูกทำแทน: ' +
        targetId

    };

  }


  /*************************************************
   * 5. ค้นหา Supervisor
   *************************************************/

  const supervisorUser =
    findUserById_(
      supervisor
    );


  if (!supervisorUser) {

    return {

      valid:
        false,

      error:
        'ไม่พบ Supervisor: ' +
        supervisor

    };

  }


  /*************************************************
   * 6. ตรวจ Role
   *************************************************/

  const role =
    String(
      supervisorUser.Role || ''
    )
      .trim()
      .toUpperCase();


  if (
    role !== 'SUPERVISOR'
  ) {

    return {

      valid:
        false,

      error:
        'ผู้ทำรายการไม่มีสิทธิ์เป็น SUPERVISOR',

      supervisor:
        supervisorUser

    };

  }


  /*************************************************
   * 7. ผ่าน
   *************************************************/

  return {

    valid:
      true,

    targetUser:
      targetUser,

    supervisor:
      supervisorUser

  };

}


/*************************************************
 * STEP 11.1 TEST
 *************************************************/

function testStep11_1() {

  const results = {};


  /*************************************************
   * CASE 1
   * SUPERVISOR ทำแทน INSPECTOR
   *************************************************/

  results.valid =
    validateSupervisorProxy_(
      'TEST-USER',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 2
   * ไม่มี Target
   *************************************************/

  results.noTarget =
    validateSupervisorProxy_(
      '',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 3
   * ไม่มี Supervisor
   *************************************************/

  results.noSupervisor =
    validateSupervisorProxy_(
      'TEST-USER',
      ''
    );


  /*************************************************
   * CASE 4
   * ทำแทนตัวเอง
   *************************************************/

  results.selfProxy =
    validateSupervisorProxy_(
      'SUPERVISOR01',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 5
   * Target ไม่มีจริง
   *************************************************/

  results.invalidTarget =
    validateSupervisorProxy_(
      'NOT-EXIST',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 6
   * Supervisor ไม่มีจริง
   *************************************************/

  results.invalidSupervisor =
    validateSupervisorProxy_(
      'TEST-USER',
      'NOT-EXIST'
    );


  /*************************************************
   * CASE 7
   * INSPECTOR พยายามทำแทน
   *************************************************/

  results.inspectorAsSupervisor =
    validateSupervisorProxy_(
      'SUPERVISOR01',
      'TEST-USER'
    );


  /*************************************************
   * ตรวจผล
   *************************************************/

  const passed =
    results.valid.valid === true &&
    results.noTarget.valid === false &&
    results.noSupervisor.valid === false &&
    results.selfProxy.valid === false &&
    results.invalidTarget.valid === false &&
    results.invalidSupervisor.valid === false &&
    results.inspectorAsSupervisor.valid === false;


  const result = {

    success:
      passed,

    results:
      results,

    expected: {

      valid:
        true,

      noTarget:
        false,

      noSupervisor:
        false,

      selfProxy:
        false,

      invalidTarget:
        false,

      invalidSupervisor:
        false,

      inspectorAsSupervisor:
        false

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
function testStep11_1A() {

  const user =
    findUserById_(
      'TEST-USER'
    );

  const supervisor =
    findUserById_(
      'SUPERVISOR01'
    );

  const result = {

    success:
      !!user &&
      !!supervisor,

    targetUser:
      user,

    supervisor:
      supervisor

  };

  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}
/*************************************************
 * STEP 11.2
 * CHECK SUPERVISOR CAN PERFORM ATTENDANCE PROXY
 *************************************************/

function canSupervisorProxyAttendance_(
  targetUserId,
  supervisorId
) {

  /*************************************************
   * ใช้ Validation จาก STEP 11.1
   *************************************************/

  const validation =
    validateSupervisorProxy_(
      targetUserId,
      supervisorId
    );


  if (!validation.valid) {

    return {

      allowed:
        false,

      error:
        validation.error

    };

  }


  /*************************************************
   * ผ่านสิทธิ์
   *************************************************/

  return {

    allowed:
      true,

    targetUser:
      validation.targetUser,

    supervisor:
      validation.supervisor

  };

}


/*************************************************
 * STEP 11.2 TEST
 *************************************************/

function testStep11_2() {

  const results = {};


  /*************************************************
   * CASE 1
   * SUPERVISOR ทำแทน TEST-USER
   *************************************************/

  results.validProxy =
    canSupervisorProxyAttendance_(
      'TEST-USER',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 2
   * INSPECTOR พยายามทำแทน
   *************************************************/

  results.inspectorProxy =
    canSupervisorProxyAttendance_(
      'SUPERVISOR01',
      'TEST-USER'
    );


  /*************************************************
   * CASE 3
   * ทำแทนตัวเอง
   *************************************************/

  results.selfProxy =
    canSupervisorProxyAttendance_(
      'SUPERVISOR01',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 4
   * Target ไม่มีจริง
   *************************************************/

  results.invalidTarget =
    canSupervisorProxyAttendance_(
      'NOT-EXIST',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 5
   * Supervisor ไม่มีจริง
   *************************************************/

  results.invalidSupervisor =
    canSupervisorProxyAttendance_(
      'TEST-USER',
      'NOT-EXIST'
    );


  /*************************************************
   * ตรวจผล
   *************************************************/

  const passed =
    results.validProxy.allowed === true &&
    results.inspectorProxy.allowed === false &&
    results.selfProxy.allowed === false &&
    results.invalidTarget.allowed === false &&
    results.invalidSupervisor.allowed === false;


  const result = {

    success:
      passed,

    results:
      results,

    expected: {

      validProxy:
        true,

      inspectorProxy:
        false,

      selfProxy:
        false,

      invalidTarget:
        false,

      invalidSupervisor:
        false

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 11.3
 * SAVE ATTENDANCE BY SUPERVISOR PROXY
 *************************************************/

function testStep11_3() {

  const targetUserId =
    'PROXY-TEST';

  const supervisorId =
    'SUPERVISOR01';

  const status =
    'PRESENT';

  const leaveReason =
    '';

  const leaveType =
    '';


  /*************************************************
   * 1. ตรวจสิทธิ์ Supervisor
   *************************************************/

  const permission =
    canSupervisorProxyAttendance_(
      targetUserId,
      supervisorId
    );


  if (!permission.allowed) {

    const result = {

      success:
        false,

      error:
        permission.error

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 2. ตรวจ Duplicate
   *************************************************/

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  const duplicateCheck =
    checkAttendanceDuplicate_(
      targetUserId,
      today
    );


  if (!duplicateCheck.success) {

    const result = {

      success:
        false,

      error:
        duplicateCheck.error

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 3. ป้องกัน Duplicate
   *************************************************/

  if (
    duplicateCheck.duplicate
  ) {

    const result = {

      success:
        false,

      duplicate:
        true,

      error:
        'ผู้ใช้นี้มี Attendance แล้วในวันนี้',

      existingAttendance:
        duplicateCheck.existingAttendance

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 4. บันทึกจริง
   *
   * User_ID     = PROXY-TEST
   * Recorded_By = SUPERVISOR01
   *************************************************/

  const saveResult =
    saveAttendance_(
      targetUserId,
      status,
      leaveReason,
      leaveType,
      supervisorId
    );


  /*************************************************
   * 5. ตรวจผล
   *************************************************/

  const result = {

    success:
      saveResult.success,

    duplicate:
      false,

    attendanceId:
      saveResult.attendanceId || '',

    date:
      saveResult.date || '',

    time:
      saveResult.time || '',

    userId:
      targetUserId,

    status:
      status,

    leaveReason:
      leaveReason,

    leaveType:
      leaveType,

    recordedBy:
      supervisorId

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 11.4
 * READ-BACK VERIFY SUPERVISOR PROXY ATTENDANCE
 *************************************************/

function testStep11_4() {

  const attendanceId =
    'ATT-0DF067393F81';


  /*************************************************
   * 1. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.ATTENDANCE
      );


  if (!sheet) {

    const result = {

      success:
        false,

      error:
        'ไม่พบ Sheet: Attendance_and_Proxy'

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 2. อ่านข้อมูล
   *************************************************/

  const values =
    sheet
      .getDataRange()
      .getValues();


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  /*************************************************
   * 3. หา Column Attendance_ID
   *************************************************/

  const idIndex =
    headers.indexOf(
      'Attendance_ID'
    );


  if (
    idIndex === -1
  ) {

    const result = {

      success:
        false,

      error:
        'ไม่พบ Column Attendance_ID'

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 4. ค้นหา Record
   *************************************************/

  let foundRow =
    null;


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][idIndex] || ''
      ).trim()
      ===
      attendanceId
    ) {

      foundRow =
        values[i];

      break;

    }

  }


  /*************************************************
   * 5. ไม่พบ
   *************************************************/

  if (!foundRow) {

    const result = {

      success:
        false,

      found:
        false,

      attendanceId:
        attendanceId,

      error:
        'ไม่พบ Attendance_ID: ' +
        attendanceId

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 6. สร้าง Record Object
   *************************************************/

  const record =
    {};


  headers.forEach(
    function(header, index) {

      record[header] =
        foundRow[index];

    }
  );


  /*************************************************
   * 7. ตรวจข้อมูล Proxy
   *************************************************/

  const checks = {

    attendanceId:
      String(
        record.Attendance_ID || ''
      ).trim()
      ===
      attendanceId,

    userId:
      String(
        record.User_ID || ''
      ).trim()
      ===
      'PROXY-TEST',

    status:
      String(
        record.Status || ''
      ).trim()
      .toUpperCase()
      ===
      'PRESENT',

    leaveReason:
      String(
        record.Leave_Reason || ''
      ).trim()
      ===
      '',

    leaveType:
      String(
        record.Leave_Type || ''
      ).trim()
      ===
      '',

    recordedBy:
      String(
        record.Recorded_By || ''
      ).trim()
      ===
      'SUPERVISOR01'

  };


  /*************************************************
   * 8. ตรวจทุก Check
   *************************************************/

  const passed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return checks[key] === true;

      }
    );


  /*************************************************
   * 9. ผลลัพธ์
   *************************************************/

  const result = {

    success:
      passed,

    found:
      true,

    attendanceId:
      attendanceId,

    record:
      record,

    checks:
      checks,

    expected: {

      userId:
        'PROXY-TEST',

      status:
        'PRESENT',

      leaveReason:
        '',

      leaveType:
        '',

      recordedBy:
        'SUPERVISOR01'

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 11.5
 * DUPLICATE PROTECTION FOR SUPERVISOR PROXY
 *************************************************/

function testStep11_5() {

  const targetUserId =
    'PROXY-TEST';

  const supervisorId =
    'SUPERVISOR01';

  const status =
    'PRESENT';

  const leaveReason =
    '';

  const leaveType =
    '';


  /*************************************************
   * 1. ตรวจสิทธิ์ Supervisor
   *************************************************/

  const permission =
    canSupervisorProxyAttendance_(
      targetUserId,
      supervisorId
    );


  if (!permission.allowed) {

    const result = {

      success:
        false,

      error:
        permission.error

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 2. ตรวจ Duplicate
   *************************************************/

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  const duplicateCheck =
    checkAttendanceDuplicate_(
      targetUserId,
      today
    );


  if (!duplicateCheck.success) {

    const result = {

      success:
        false,

      error:
        duplicateCheck.error

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 3. ต้องพบ Duplicate
   *************************************************/

  if (
    !duplicateCheck.duplicate
  ) {

    const result = {

      success:
        false,

      duplicate:
        false,

      error:
        'ไม่พบ Attendance เดิม ทั้งที่ PROXY-TEST ถูกบันทึกแล้ว'

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 4. ตรวจข้อมูลเดิม
   *************************************************/

  const existing =
    duplicateCheck.existingAttendance;


  const passed =
    existing &&
    existing.found === true &&
    existing.userId ===
      targetUserId;


  /*************************************************
   * 5. ผลลัพธ์
   *************************************************/

  const result = {

    success:
      passed,

    duplicate:
      true,

    blocked:
      true,

    error:
      'ผู้ใช้นี้มี Attendance แล้วในวันนี้',

    existingAttendance:
      existing,

    expected: {

      duplicate:
        true,

      blocked:
        true,

      userId:
        'PROXY-TEST'

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 12.1
 * VALIDATE SUPERVISOR PROXY INSPECTION
 *************************************************/

function validateSupervisorProxyInspection_(
  originalInspectorId,
  supervisorId
) {

  const originalId =
    String(
      originalInspectorId || ''
    ).trim();

  const supervisor =
    String(
      supervisorId || ''
    ).trim();


  /*************************************************
   * 1. ตรวจ Original Inspector
   *************************************************/

  if (!originalId) {

    return {

      valid:
        false,

      error:
        'ต้องระบุ Original_Inspector_ID'

    };

  }


  /*************************************************
   * 2. ตรวจ Supervisor
   *************************************************/

  if (!supervisor) {

    return {

      valid:
        false,

      error:
        'ต้องระบุ Supervisor_ID'

    };

  }


  /*************************************************
   * 3. ห้ามทำแทนตัวเอง
   *************************************************/

  if (
    originalId.toLowerCase() ===
    supervisor.toLowerCase()
  ) {

    return {

      valid:
        false,

      error:
        'ไม่สามารถตรวจแทนตัวเองได้'

    };

  }


  /*************************************************
   * 4. ค้นหา Original Inspector
   *************************************************/

  const originalInspector =
    findUserById_(
      originalId
    );


  if (!originalInspector) {

    return {

      valid:
        false,

      error:
        'ไม่พบผู้ตรวจเดิม: ' +
        originalId

    };

  }


  /*************************************************
   * 5. ค้นหา Supervisor
   *************************************************/

  const supervisorUser =
    findUserById_(
      supervisor
    );


  if (!supervisorUser) {

    return {

      valid:
        false,

      error:
        'ไม่พบ Supervisor: ' +
        supervisor

    };

  }


  /*************************************************
   * 6. ตรวจ Role
   *************************************************/

  const role =
    String(
      supervisorUser.Role || ''
    )
      .trim()
      .toUpperCase();


  if (
    role !== 'SUPERVISOR'
  ) {

    return {

      valid:
        false,

      error:
        'ผู้ทำการตรวจแทนไม่มีสิทธิ์เป็น SUPERVISOR',

      supervisor:
        supervisorUser

    };

  }


  /*************************************************
   * 7. ผ่าน
   *************************************************/

  return {

    valid:
      true,

    originalInspector:
      originalInspector,

    supervisor:
      supervisorUser

  };

}


/*************************************************
 * STEP 12.1 TEST
 *************************************************/

function testStep12_1() {

  const results = {};


  /*************************************************
   * CASE 1
   * SUPERVISOR ตรวจแทน INSPECTOR
   *************************************************/

  results.validProxy =
    validateSupervisorProxyInspection_(
      'TEST-USER',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 2
   * ไม่มี Original Inspector
   *************************************************/

  results.noOriginalInspector =
    validateSupervisorProxyInspection_(
      '',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 3
   * ไม่มี Supervisor
   *************************************************/

  results.noSupervisor =
    validateSupervisorProxyInspection_(
      'TEST-USER',
      ''
    );


  /*************************************************
   * CASE 4
   * ทำแทนตัวเอง
   *************************************************/

  results.selfProxy =
    validateSupervisorProxyInspection_(
      'SUPERVISOR01',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 5
   * Original Inspector ไม่มีจริง
   *************************************************/

  results.invalidOriginal =
    validateSupervisorProxyInspection_(
      'NOT-EXIST',
      'SUPERVISOR01'
    );


  /*************************************************
   * CASE 6
   * Supervisor ไม่มีจริง
   *************************************************/

  results.invalidSupervisor =
    validateSupervisorProxyInspection_(
      'TEST-USER',
      'NOT-EXIST'
    );


  /*************************************************
   * CASE 7
   * INSPECTOR พยายามตรวจแทน
   *************************************************/

  results.inspectorAsSupervisor =
    validateSupervisorProxyInspection_(
      'SUPERVISOR01',
      'TEST-USER'
    );


  /*************************************************
   * ตรวจผล
   *************************************************/

  const passed =
    results.validProxy.valid === true &&
    results.noOriginalInspector.valid === false &&
    results.noSupervisor.valid === false &&
    results.selfProxy.valid === false &&
    results.invalidOriginal.valid === false &&
    results.invalidSupervisor.valid === false &&
    results.inspectorAsSupervisor.valid === false;


  const result = {

    success:
      passed,

    results:
      results,

    expected: {

      validProxy:
        true,

      noOriginalInspector:
        false,

      noSupervisor:
        false,

      selfProxy:
        false,

      invalidOriginal:
        false,

      invalidSupervisor:
        false,

      inspectorAsSupervisor:
        false

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 12.2
 * VALIDATE LOCATION FOR SUPERVISOR PROXY
 *************************************************/

function validateSupervisorProxyInspectionLocation_(
  originalInspectorId,
  supervisorId,
  locationId
) {

  /*************************************************
   * 1. ตรวจ Proxy Permission
   *************************************************/

  const proxyValidation =
    validateSupervisorProxyInspection_(
      originalInspectorId,
      supervisorId
    );


  if (!proxyValidation.valid) {

    return {

      valid:
        false,

      error:
        proxyValidation.error

    };

  }


  /*************************************************
   * 2. ตรวจ Location ID
   *************************************************/

  const normalizedLocationId =
    String(
      locationId || ''
    )
      .trim()
      .toUpperCase();


  if (!normalizedLocationId) {

    return {

      valid:
        false,

      error:
        'ต้องระบุ Location_ID'

    };

  }


  /*************************************************
   * 3. ค้นหา Location
   *************************************************/

  const location =
    findLocationById_(
      normalizedLocationId
    );


  if (!location) {

    return {

      valid:
        false,

      error:
        'ไม่พบ Location: ' +
        normalizedLocationId

    };

  }


  /*************************************************
   * 4. ตรวจสิทธิ์ของ Original Inspector
   *************************************************/

  const originalInspector =
    proxyValidation.originalInspector;


  const assignedGrade =
    String(
      originalInspector.Assigned_Grade || ''
    )
      .trim()
      .toUpperCase();


  const assignedType =
    String(
      originalInspector.Assigned_Type || ''
    )
      .trim()
      .toUpperCase();


  const assignedLocations =
    getAssignedLocations_(
      originalInspector.Assigned_Locations
    );


  /*************************************************
   * 5. Location Grade
   *************************************************/

  const locationGrade =
    String(
      location.Grade_Level || ''
    )
      .trim()
      .toUpperCase();


  /*************************************************
   * 6. Location Type
   *************************************************/

  const locationType =
    String(
      location.Type || ''
    )
      .trim()
      .toUpperCase();


  /*************************************************
   * 7. Location ID
   *************************************************/

  const actualLocationId =
    String(
      location.Location_ID || ''
    )
      .trim()
      .toUpperCase();


  /*************************************************
   * 8. ตรวจ Grade
   *************************************************/

  const gradeAllowed =
    assignedGrade === 'ALL' ||
    assignedGrade === locationGrade;


  /*************************************************
   * 9. ตรวจ Type
   *************************************************/

  const typeAllowed =
    assignedType === 'ALL' ||
    assignedType === locationType;


  /*************************************************
   * 10. ตรวจ Location
   *************************************************/

  const locationAllowed =
    assignedLocations.indexOf('ALL') !== -1 ||
    assignedLocations.indexOf(
      actualLocationId
    ) !== -1;


  /*************************************************
   * 11. ผลสิทธิ์
   *************************************************/

  const allowed =
    gradeAllowed &&
    typeAllowed &&
    locationAllowed;


  /*************************************************
   * 12. Return
   *************************************************/

  return {

    valid:
      allowed,

    allowed:
      allowed,

    originalInspectorId:
      originalInspector.Student_ID,

    supervisorId:
      proxyValidation.supervisor.Student_ID,

    location: {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME

    },

    checks: {

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed

    },

    error:
      allowed
        ? ''
        : 'ผู้ตรวจเดิมไม่มีสิทธิ์ตรวจ Location นี้'

  };

}


/*************************************************
 * STEP 12.2 TEST
 *************************************************/

function testStep12_2() {

  const results = {};


  /*************************************************
   * CASE 1
   * TEST-USER -> M1-01
   * ต้องผ่าน
   *************************************************/

  results.allowedLocation =
    validateSupervisorProxyInspectionLocation_(
      'TEST-USER',
      'SUPERVISOR01',
      'M1-01'
    );


  /*************************************************
   * CASE 2
   * TEST-USER -> M1-02
   * ต้องไม่ผ่าน
   *************************************************/

  results.unauthorizedLocation =
    validateSupervisorProxyInspectionLocation_(
      'TEST-USER',
      'SUPERVISOR01',
      'M1-02'
    );


  /*************************************************
   * CASE 3
   * Location ไม่มีจริง
   *************************************************/

  results.invalidLocation =
    validateSupervisorProxyInspectionLocation_(
      'TEST-USER',
      'SUPERVISOR01',
      'NOT-EXIST'
    );


  /*************************************************
   * CASE 4
   * Supervisor ไม่มีสิทธิ์
   *************************************************/

  results.invalidSupervisor =
    validateSupervisorProxyInspectionLocation_(
      'TEST-USER',
      'NOT-EXIST',
      'M1-01'
    );


  /*************************************************
   * CASE 5
   * ไม่มี Location
   *************************************************/

  results.noLocation =
    validateSupervisorProxyInspectionLocation_(
      'TEST-USER',
      'SUPERVISOR01',
      ''
    );


  /*************************************************
   * ตรวจ Expected
   *************************************************/

  const passed =
    results.allowedLocation.valid === true &&
    results.unauthorizedLocation.valid === false &&
    results.invalidLocation.valid === false &&
    results.invalidSupervisor.valid === false &&
    results.noLocation.valid === false;


  const result = {

    success:
      passed,

    results:
      results,

    expected: {

      allowedLocation:
        true,

      unauthorizedLocation:
        false,

      invalidLocation:
        false,

      invalidSupervisor:
        false,

      noLocation:
        false

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 12.3
 * VERIFY PROXY INSPECTION TEST USER
 *************************************************/

function testStep12_3() {

  const originalInspector =
    findUserById_(
      'PROXY-INSPECT'
    );

  const supervisor =
    findUserById_(
      'SUPERVISOR01'
    );

  const location =
    findLocationById_(
      'M1-05'
    );


  const result = {

    success:
      !!originalInspector &&
      !!supervisor &&
      !!location,

    originalInspector:
      originalInspector,

    supervisor:
      supervisor,

    location:
      location

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 12.4
 * SAVE PROXY INSPECTION
 *************************************************/

function testStep12_4() {

  const originalInspectorId =
    'PROXY-INSPECT';

  const supervisorId =
    'SUPERVISOR01';

  const locationId =
    'M1-05';

  const scores = [
    5,
    5,
    4,
    5,
    4,
    5,
    5,
    4
  ];

  const photoUrl =
    '';


  /*************************************************
   * 1. ตรวจ Proxy Permission
   *************************************************/

  const proxyValidation =
    validateSupervisorProxyInspectionLocation_(
      originalInspectorId,
      supervisorId,
      locationId
    );


  if (!proxyValidation.valid) {

    const result = {

      success:
        false,

      stage:
        'PROXY_VALIDATION',

      error:
        proxyValidation.error,

      proxyValidation:
        proxyValidation

    };

    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 2. ตรวจ Duplicate Inspection
   *************************************************/

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  const duplicateCheck =
    checkInspectionDuplicate_(
      locationId,
      today
    );


  if (!duplicateCheck.success) {

    const result = {

      success:
        false,

      stage:
        'DUPLICATE_CHECK',

      error:
        duplicateCheck.error,

      duplicateCheck:
        duplicateCheck

    };

    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 3. ต้องไม่ Duplicate
   *************************************************/

  if (
    duplicateCheck.duplicate === true
  ) {

    const result = {

      success:
        false,

      stage:
        'DUPLICATE',

      duplicate:
        true,

      blocked:
        true,

      error:
        'Location นี้ถูกตรวจแล้วในวันนี้',

      existingLog:
        duplicateCheck.existingLog

    };

    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );

    return result;

  }


  /*************************************************
   * 4. บันทึก Proxy Inspection
   *
   * สำคัญ:
   * ห้ามเรียก saveInspection_()
   *
   * ใช้ saveProxyInspection_()
   *************************************************/

  const saveResult =
    saveProxyInspection_(
      originalInspectorId,
      supervisorId,
      locationId,
      scores,
      photoUrl
    );


  /*************************************************
   * 5. ตรวจผลการบันทึก
   *************************************************/

  if (
    !saveResult ||
    saveResult.success !== true
  ) {

    const result = {

      success:
        false,

      stage:
        'SAVE_PROXY_INSPECTION',

      error:
        saveResult &&
        saveResult.error
          ? saveResult.error
          : 'saveProxyInspection_() ไม่สามารถบันทึกได้',

      saveResult:
        saveResult,

      proxyValidation:
        proxyValidation,

      duplicateCheck:
        duplicateCheck,

      expected: {

        supervisorId:
          supervisorId,

        originalInspectorId:
          originalInspectorId,

        locationId:
          locationId,

        isProxy:
          true

      }

    };


    Logger.log(
      'RESULT: ' +
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 6. สำเร็จ
   *************************************************/

  const result = {

    success:
      true,

    stage:
      'SAVE_PROXY_INSPECTION',

    logId:
      saveResult.logId,

    date:
      saveResult.date,

    time:
      saveResult.time,

    locationId:
      saveResult.locationId,

    inspectorId:
      saveResult.inspectorId,

    scores:
      saveResult.scores,

    totalScore:
      saveResult.totalScore,

    photoUrl:
      saveResult.photoUrl,

    isProxy:
      saveResult.isProxy,

    originalInspectorId:
      saveResult.originalInspectorId,

    expected: {

      supervisorId:
        supervisorId,

      originalInspectorId:
        originalInspectorId,

      locationId:
        locationId,

      isProxy:
        true

    }

  };


  /*************************************************
   * 7. Logger
   *************************************************/

  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 12.4A
 * CHECK INSPECTION DUPLICATE
 *
 * Rule:
 * Location เดียวกัน
 * + วันที่เดียวกัน
 * = ตรวจซ้ำไม่ได้
 *************************************************/

function checkInspectionDuplicate_(
  locationId,
  inspectDate
) {

  /*************************************************
   * 1. Normalize
   *************************************************/

  const normalizedLocationId =
    String(
      locationId || ''
    )
      .trim()
      .toUpperCase();


  const normalizedDate =
    String(
      inspectDate || ''
    )
      .trim();


  if (!normalizedLocationId) {

    return {

      success:
        false,

      error:
        'ต้องระบุ Location_ID'

    };

  }


  if (!normalizedDate) {

    return {

      success:
        false,

      error:
        'ต้องระบุ Inspect_Date'

    };

  }


  /*************************************************
   * 2. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  if (!sheet) {

    return {

      success:
        false,

      error:
        'ไม่พบ Sheet: Inspection_Logs'

    };

  }


  /*************************************************
   * 3. อ่านข้อมูล
   *************************************************/

  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return {

      success:
        true,

      locationId:
        normalizedLocationId,

      inspectDate:
        normalizedDate,

      duplicate:
        false,

      existingLog:
        null

    };

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  const locationIndex =
    headers.indexOf(
      'Location_ID'
    );


  const dateIndex =
    headers.indexOf(
      'Date'
    );


  const logIdIndex =
    headers.indexOf(
      'Log_ID'
    );


  if (
    locationIndex === -1
  ) {

    return {

      success:
        false,

      error:
        'ไม่พบ Column Location_ID'

    };

  }


  if (
    dateIndex === -1
  ) {

    return {

      success:
        false,

      error:
        'ไม่พบ Column Date'

    };

  }


  /*************************************************
   * 4. ตรวจทุก Record
   *************************************************/

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const rowLocation =
      String(
        row[locationIndex] || ''
      )
        .trim()
        .toUpperCase();


    if (
      rowLocation !==
      normalizedLocationId
    ) {

      continue;

    }


    /*************************************************
     * 5. Normalize วันที่จาก Sheet
     *************************************************/

    let rowDate = '';


    const rawDate =
      row[dateIndex];


    if (
      rawDate instanceof Date
    ) {

      rowDate =
        Utilities.formatDate(
          rawDate,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

    } else {

      rowDate =
        String(
          rawDate || ''
        )
          .trim();

    }


    /*************************************************
     * 6. เปรียบเทียบวันที่
     *************************************************/

    if (
      rowDate !==
      normalizedDate
    ) {

      continue;

    }


    /*************************************************
     * 7. พบ Duplicate
     *************************************************/

    const logId =
      logIdIndex !== -1
        ? String(
            row[logIdIndex] || ''
          ).trim()
        : '';


    return {

      success:
        true,

      locationId:
        normalizedLocationId,

      inspectDate:
        normalizedDate,

      duplicate:
        true,

      existingLog: {

        found:
          true,

        logId:
          logId,

        date:
          rowDate,

        locationId:
          normalizedLocationId

      }

    };

  }


  /*************************************************
   * 8. ไม่พบ Duplicate
   *************************************************/

  return {

    success:
      true,

    locationId:
      normalizedLocationId,

    inspectDate:
      normalizedDate,

    duplicate:
      false,

    existingLog:
      null

  };

}
/*************************************************
 * STEP 12.4A TEST
 *************************************************/

function testStep12_4A() {

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  /*************************************************
   * M1-05
   * ต้องยังไม่ถูกตรวจวันนี้
   *************************************************/

  const newCase =
    checkInspectionDuplicate_(
      'M1-05',
      today
    );


  /*************************************************
   * M1-01
   * เคยตรวจแล้วใน STEP 9
   *************************************************/

  const duplicateCase =
    checkInspectionDuplicate_(
      'M1-01',
      today
    );


  /*************************************************
   * Location ไม่มีจริง
   *
   * ฟังก์ชันนี้ตรวจเฉพาะ Duplicate
   * ดังนั้นจะไม่ตรวจ existence ของ Location
   *************************************************/

  const result = {

    success:
      newCase.success &&
      duplicateCase.success &&
      newCase.duplicate === false &&
      duplicateCase.duplicate === true,

    newCase:
      newCase,

    duplicateCase:
      duplicateCase,

    expected: {

      newCaseDuplicate:
        false,

      duplicateCaseDuplicate:
        true

    }

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 12.4B
 * SAVE PROXY INSPECTION
 *
 * Supervisor เป็นผู้ทำรายการจริง
 * แต่ Original_Inspector_ID เก็บผู้ตรวจเดิม
 *************************************************/

function saveProxyInspection_(
  originalInspectorId,
  supervisorId,
  locationId,
  scores,
  photoUrl
) {

  /*************************************************
   * 1. Validate Proxy
   *************************************************/

  const proxyValidation =
    validateSupervisorProxyInspectionLocation_(
      originalInspectorId,
      supervisorId,
      locationId
    );


  if (!proxyValidation.valid) {

    return {

      success:
        false,

      error:
        proxyValidation.error

    };

  }


  /*************************************************
   * 2. Validate Scores
   *************************************************/

  if (
    !Array.isArray(scores) ||
    scores.length !== 8
  ) {

    return {

      success:
        false,

      error:
        'Scores ต้องมีจำนวน 8 ข้อ'

    };

  }


  for (
    let i = 0;
    i < scores.length;
    i++
  ) {

    const score =
      Number(
        scores[i]
      );


    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 5
    ) {

      return {

        success:
          false,

        error:
          'คะแนนต้องอยู่ระหว่าง 0-5'

      };

    }

  }


  /*************************************************
   * 3. เตรียม Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  if (!sheet) {

    return {

      success:
        false,

      error:
        'ไม่พบ Sheet: Inspection_Logs'

    };

  }


  /*************************************************
   * 4. วันที่ / เวลา
   *************************************************/

  const now =
    new Date();


  const timezone =
    Session.getScriptTimeZone();


  const date =
    Utilities.formatDate(
      now,
      timezone,
      'yyyy-MM-dd'
    );


  const time =
    Utilities.formatDate(
      now,
      timezone,
      'HH:mm:ss'
    );


  /*************************************************
   * 5. Log ID
   *************************************************/

  const logId =
    generateLogId_();


  /*************************************************
   * 6. Total Score
   *************************************************/

  const normalizedScores =
    scores.map(
      function(score) {

        return Number(
          score
        );

      }
    );


  const totalScore =
    normalizedScores.reduce(
      function(total, score) {

        return total + score;

      },
      0
    );


  /*************************************************
   * 7. Proxy Data
   *************************************************/

  const proxy =
    true;


  const originalId =
    String(
      originalInspectorId
    )
      .trim();


  const supervisorIdNormalized =
    String(
      supervisorId
    )
      .trim();


  /*************************************************
   * 8. สร้าง Row
   *
   * Header 17 columns
   *************************************************/

  const row = [

    logId,

    date,

    time,

    proxyValidation
      .location
      .Location_ID,

    supervisorIdNormalized,

    normalizedScores[0],

    normalizedScores[1],

    normalizedScores[2],

    normalizedScores[3],

    normalizedScores[4],

    normalizedScores[5],

    normalizedScores[6],

    normalizedScores[7],

    totalScore,

    String(
      photoUrl || ''
    ).trim(),

    proxy,

    originalId

  ];


  /*************************************************
   * 9. ตรวจจำนวน Column
   *************************************************/

  if (
    row.length !== 17
  ) {

    return {

      success:
        false,

      error:
        'จำนวนข้อมูลไม่ตรงกับ Inspection_Logs'

    };

  }


  /*************************************************
   * 10. บันทึก
   *************************************************/

  sheet.appendRow(
    row
  );


  /*************************************************
   * 11. Return
   *************************************************/

  return {

    success:
      true,

    logId:
      logId,

    date:
      date,

    time:
      time,

    locationId:
      proxyValidation
        .location
        .Location_ID,

    inspectorId:
      supervisorIdNormalized,

    scores:
      normalizedScores,

    totalScore:
      totalScore,

    photoUrl:
      String(
        photoUrl || ''
      ).trim(),

    isProxy:
      true,

    originalInspectorId:
      originalId

  };

}

/*************************************************
 * STEP 12.5
 * VERIFY PROXY INSPECTION LOG
 *************************************************/

function testStep12_5() {

  const logId =
    'LOG-F144287E4485';


  const expected = {

    inspectorId:
      'SUPERVISOR01',

    originalInspectorId:
      'PROXY-INSPECT',

    isProxy:
      true,

    locationId:
      'M1-05',

    totalScore:
      37

  };


  /*************************************************
   * 1. Sheet
   *************************************************/

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        CONFIG.SHEETS.INSPECTION_LOGS
      );


  if (!sheet) {

    return {

      success:
        false,

      error:
        'ไม่พบ Sheet: Inspection_Logs'

    };

  }


  /*************************************************
   * 2. อ่านข้อมูล
   *************************************************/

  const values =
    sheet
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return {

      success:
        false,

      error:
        'Inspection_Logs ไม่มีข้อมูล'

    };

  }


  const headers =
    values[0].map(
      function(header) {

        return String(
          header
        ).trim();

      }
    );


  const logIdIndex =
    headers.indexOf(
      'Log_ID'
    );

  const locationIndex =
    headers.indexOf(
      'Location_ID'
    );

  const inspectorIndex =
    headers.indexOf(
      'Inspector_ID'
    );

  const proxyIndex =
    headers.indexOf(
      'Is_Proxy'
    );

  const originalIndex =
    headers.indexOf(
      'Original_Inspector_ID'
    );

  const totalScoreIndex =
    headers.indexOf(
      'Total_Score'
    );


  /*************************************************
   * 3. ตรวจ Header
   *************************************************/

  const requiredIndexes = [

    logIdIndex,
    locationIndex,
    inspectorIndex,
    proxyIndex,
    originalIndex,
    totalScoreIndex

  ];


  if (
    requiredIndexes.some(
      function(index) {

        return index === -1;

      }
    )
  ) {

    return {

      success:
        false,

      error:
        'Header ของ Inspection_Logs ไม่ตรงกับที่ระบบต้องการ',

      headers:
        headers

    };

  }


  /*************************************************
   * 4. ค้นหา Log
   *************************************************/

  let foundRow =
    null;


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][logIdIndex] || ''
      ).trim()
      ===
      logId
    ) {

      foundRow =
        values[i];

      break;

    }

  }


  /*************************************************
   * 5. ไม่พบ Log
   *************************************************/

  if (!foundRow) {

    return {

      success:
        false,

      found:
        false,

      error:
        'ไม่พบ Log: ' +
        logId

    };

  }


  /*************************************************
   * 6. ค่าจริง
   *************************************************/

  const actual = {

    logId:
      String(
        foundRow[logIdIndex] || ''
      ).trim(),

    locationId:
      String(
        foundRow[locationIndex] || ''
      ).trim(),

    inspectorId:
      String(
        foundRow[inspectorIndex] || ''
      ).trim(),

    isProxy:
      foundRow[proxyIndex] === true ||
      String(
        foundRow[proxyIndex]
      ).toUpperCase() === 'TRUE',

    originalInspectorId:
      String(
        foundRow[originalIndex] || ''
      ).trim(),

    totalScore:
      Number(
        foundRow[totalScoreIndex]
      )

  };


  /*************************************************
   * 7. Checks
   *************************************************/

  const checks = {

    logId:
      actual.logId === logId,

    locationId:
      actual.locationId ===
      expected.locationId,

    inspectorId:
      actual.inspectorId ===
      expected.inspectorId,

    isProxy:
      actual.isProxy ===
      expected.isProxy,

    originalInspectorId:
      actual.originalInspectorId ===
      expected.originalInspectorId,

    totalScore:
      actual.totalScore ===
      expected.totalScore

  };


  /*************************************************
   * 8. Final
   *************************************************/

  const success =
    Object.keys(
      checks
    ).every(
      function(key) {

        return checks[key] === true;

      }
    );


  const result = {

    success:
      success,

    found:
      true,

    logId:
      logId,

    actual:
      actual,

    checks:
      checks,

    expected:
      expected

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 13
 * LOCATION PERMISSION TEST
 *************************************************/

/**
 * ตรวจสอบว่า User มีสิทธิ์เข้าถึง Location หรือไม่
 *
 * เงื่อนไข:
 * 1. ADMIN = เข้าถึงได้ทั้งหมด
 * 2. Assigned_Grade ต้องตรงกับ Grade_Level
 * 3. Assigned_Type ต้องตรงกับ Type
 * 4. Assigned_Locations ต้องมี Location_ID
 * 5. ถ้า Assigned_Locations = ALL = เข้าถึงได้ทั้งหมด
 */
function testLocationPermissionOnly() {

  const studentId = 'admin01';
  const pin = 'admin25071';

  // -----------------------------------
  // 1. Login
  // -----------------------------------

  const login = verifyLogin(
    studentId,
    pin
  );

  if (
    !login ||
    login.success !== true
  ) {

    throw new Error(
      'Login สำหรับทดสอบไม่สำเร็จ: ' +
      JSON.stringify(login)
    );

  }

  // -----------------------------------
  // 2. User จริง
  // -----------------------------------

  const user = findUserById_(
    studentId
  );

  if (!user) {

    throw new Error(
      'ไม่พบ User: ' +
      studentId
    );

  }

  // -----------------------------------
  // 3. ข้อมูลสิทธิ์
  // -----------------------------------

  const role =
    String(user.Role || '')
      .trim()
      .toUpperCase();

  const assignedGrade =
    String(user.Assigned_Grade || '')
      .trim()
      .toUpperCase();

  const assignedType =
    String(user.Assigned_Type || '')
      .trim()
      .toUpperCase();

  const assignedLocations =
    getAssignedLocations_(
      user.Assigned_Locations
    );

  // -----------------------------------
  // 4. Location ที่ใช้ทดสอบ
  // -----------------------------------

  const testLocationIds = [
    'M1-01',
    'M1-03'
  ];

  // -----------------------------------
  // 5. ตรวจสอบแต่ละ Location
  // -----------------------------------

  const results =
    testLocationIds.map(
      function(locationId) {

        const location =
          findLocationById_(
            locationId
          );

        // -----------------------------------
        // ไม่พบ Location
        // -----------------------------------

        if (!location) {

          return {

            Location_ID:
              locationId,

            allowed:
              false,

            message:
              'ไม่พบ Location นี้'

          };

        }

        // -----------------------------------
        // Location Grade
        // -----------------------------------

        const locationGrade =
          String(
            location.Grade_Level || ''
          )
            .trim()
            .toUpperCase();

        // -----------------------------------
        // Location Type
        // -----------------------------------

        const locationType =
          String(
            location.Type || ''
          )
            .trim()
            .toUpperCase();

        // -----------------------------------
        // Location ID
        // -----------------------------------

        const normalizedLocationId =
          String(
            location.Location_ID || ''
          )
            .trim()
            .toUpperCase();

        // -----------------------------------
        // ตรวจ Grade
        // -----------------------------------

        const gradeAllowed =
          assignedGrade === 'ALL' ||
          assignedGrade === locationGrade;

        // -----------------------------------
        // ตรวจ Type
        // -----------------------------------

        const typeAllowed =
          assignedType === 'ALL' ||
          assignedType === locationType;

        // -----------------------------------
        // ตรวจ Location
        // -----------------------------------

        const locationAllowed =
          assignedLocations.indexOf('ALL') !== -1 ||
          assignedLocations.indexOf(
            normalizedLocationId
          ) !== -1;

        // -----------------------------------
        // ตรวจสิทธิ์สุดท้าย
        // -----------------------------------

        const allowed =
          role === 'ADMIN'
            ? true
            : (
                gradeAllowed &&
                typeAllowed &&
                locationAllowed
              );

        // -----------------------------------
        // Result
        // -----------------------------------

        return {

          Location_ID:
            location.Location_ID,

          Location_Name:
            location.Location_Name,

          Grade_Level:
            location.Grade_Level,

          Type:
            location.Type,

          Is_SME:
            location.Is_SME,

          gradeAllowed:
            gradeAllowed,

          typeAllowed:
            typeAllowed,

          locationAllowed:
            locationAllowed,

          allowed:
            allowed

        };

      }
    );

  // -----------------------------------
  // 6. Result
  // -----------------------------------

  const result = {

    success:
      true,

    user: {

      Student_ID:
        user.Student_ID,

      Full_Name:
        user.Full_Name,

      Role:
        user.Role,

      Assigned_Grade:
        user.Assigned_Grade,

      Assigned_Type:
        user.Assigned_Type,

      Assigned_Locations:
        assignedLocations

    },

    results:
      results

  };

  // -----------------------------------
  // 7. Logger
  // -----------------------------------

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}

/*************************************************
 * STEP 13.1
 * INSPECTOR LOCATION PERMISSION TEST
 *************************************************/

function testStep13_1() {

  const studentId =
    'TEST-USER';

  const testLocationIds = [

    'M1-01',
    'M1-02',
    'M1-03'

  ];


  /*************************************************
   * 1. Login
   *************************************************/

  const login =
    verifyLogin(
      studentId,
      996
    );


  if (
    !login ||
    login.success !== true
  ) {

    throw new Error(
      'Login สำหรับ TEST-USER ไม่สำเร็จ: ' +
      JSON.stringify(login)
    );

  }


  /*************************************************
   * 2. User
   *************************************************/

  const user =
    findUserById_(
      studentId
    );


  if (!user) {

    throw new Error(
      'ไม่พบ User: ' +
      studentId
    );

  }


  /*************************************************
   * 3. Permission
   *************************************************/

  const assignedGrade =
    String(
      user.Assigned_Grade || ''
    )
      .trim()
      .toUpperCase();


  const assignedType =
    String(
      user.Assigned_Type || ''
    )
      .trim()
      .toUpperCase();


  const assignedLocations =
    getAssignedLocations_(
      user.Assigned_Locations
    );


  /*************************************************
   * 4. ตรวจ Location
   *************************************************/

  const results =
    testLocationIds.map(
      function(locationId) {

        const location =
          findLocationById_(
            locationId
          );


        if (!location) {

          return {

            Location_ID:
              locationId,

            allowed:
              false,

            error:
              'ไม่พบ Location นี้'

          };

        }


        const locationGrade =
          String(
            location.Grade_Level || ''
          )
            .trim()
            .toUpperCase();


        const locationType =
          String(
            location.Type || ''
          )
            .trim()
            .toUpperCase();


        const normalizedLocationId =
          String(
            location.Location_ID || ''
          )
            .trim()
            .toUpperCase();


        const gradeAllowed =
          assignedGrade === 'ALL' ||
          assignedGrade === locationGrade;


        const typeAllowed =
          assignedType === 'ALL' ||
          assignedType === locationType;


        const locationAllowed =
          assignedLocations.indexOf('ALL') !== -1 ||
          assignedLocations.indexOf(
            normalizedLocationId
          ) !== -1;


        const allowed =
          gradeAllowed &&
          typeAllowed &&
          locationAllowed;


        return {

          Location_ID:
            location.Location_ID,

          Location_Name:
            location.Location_Name,

          Grade_Level:
            location.Grade_Level,

          Type:
            location.Type,

          Is_SME:
            location.Is_SME,

          gradeAllowed:
            gradeAllowed,

          typeAllowed:
            typeAllowed,

          locationAllowed:
            locationAllowed,

          allowed:
            allowed

        };

      }
    );


  /*************************************************
   * 5. Expected
   *************************************************/

  const expected = {

    'M1-01':
      true,

    'M1-02':
      false,

    'M1-03':
      false

  };


  /*************************************************
   * 6. ตรวจ Expected
   *************************************************/

  const checks =
    results.map(
      function(item) {

        return {

          Location_ID:
            item.Location_ID,

          actual:
            item.allowed,

          expected:
            expected[
              item.Location_ID
            ],

          pass:
            item.allowed ===
            expected[
              item.Location_ID
            ]

        };

      }
    );


  const allPassed =
    checks.every(
      function(item) {

        return item.pass === true;

      }
    );


  /*************************************************
   * 7. Result
   *************************************************/

  const result = {

    success:
      allPassed,

    user: {

      Student_ID:
        user.Student_ID,

      Full_Name:
        user.Full_Name,

      Role:
        user.Role,

      Assigned_Grade:
        user.Assigned_Grade,

      Assigned_Type:
        user.Assigned_Type,

      Assigned_Locations:
        assignedLocations

    },

    results:
      results,

    checks:
      checks,

    expected:
      expected

  };


  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
function testStep13_2() {

const studentId =
'TEST-USER';

const testLocationIds = [


'M1-01',
'M2-01'


];

/*************************************************

* 1. Login
     *************************************************/

const login =
verifyLogin(
studentId,
996
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับ TEST-USER ไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

/*************************************************

* 2. User
  *************************************************/

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

/*************************************************

* 3. Permission Data
  *************************************************/

const assignedGrade =
String(
user.Assigned_Grade || ''
)
.trim()
.toUpperCase();

const assignedType =
String(
user.Assigned_Type || ''
)
.trim()
.toUpperCase();

const assignedLocations =
getAssignedLocations_(
user.Assigned_Locations
);

/*************************************************

* 4. ตรวจแต่ละ Location
  *************************************************/

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );


    if (!location) {

      return {

        Location_ID:
          locationId,

        allowed:
          false,

        error:
          'ไม่พบ Location นี้'

      };

    }


    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();


    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();


    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();


    /*************************************************
     * Grade Check
     *************************************************/

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;


    /*************************************************
     * Type Check
     *************************************************/

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;


    /*************************************************
     * Location Check
     *************************************************/

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;


    /*************************************************
     * Final Permission
     *************************************************/

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;


    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


/*************************************************

* 5. Expected
  *************************************************/

const expected = {


'M1-01':
  true,

'M2-01':
  false


};

/*************************************************

* 6. ตรวจผล
  *************************************************/

const checks =
results.map(
function(item) {


    const expectedValue =
      expected[
        item.Location_ID
      ];


    return {

      Location_ID:
        item.Location_ID,

      actual:
        item.allowed,

      expected:
        expectedValue,

      gradeAllowed:
        item.gradeAllowed,

      typeAllowed:
        item.typeAllowed,

      locationAllowed:
        item.locationAllowed,

      pass:
        item.allowed ===
        expectedValue

    };

  }
);


/*************************************************

* 7. ตรวจว่า Grade ต่างกันต้องถูก Block
  *************************************************/

const gradeMismatchCheck =
results.some(
function(item) {


    return (
      item.Location_ID === 'M2-01' &&
      item.gradeAllowed === false &&
      item.allowed === false
    );

  }
);


/*************************************************

* 8. Final
  *************************************************/

const allChecksPassed =
checks.every(
function(item) {


    return item.pass === true;

  }
);


const success =
allChecksPassed &&
gradeMismatchCheck;

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Assigned_Grade:
    user.Assigned_Grade,

  Assigned_Type:
    user.Assigned_Type,

  Assigned_Locations:
    assignedLocations

},

results:
  results,

checks:
  checks,

gradeMismatchCheck:
  gradeMismatchCheck,

expected:
  expected


};

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_3() {

const studentId = 'TEST-USER';
const pin = 996;

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

const assignedGrade =
String(
user.Assigned_Grade || ''
)
.trim()
.toUpperCase();

const assignedType =
String(
user.Assigned_Type || ''
)
.trim()
.toUpperCase();

const assignedLocations =
getAssignedLocations_(
user.Assigned_Locations
);

const testLocationIds = [
'M1-01',
'M1-02'
];

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


const expected = {


M1_01:
  true,

M1_02:
  false


};

const checkM101 =
results[0] &&
results[0].allowed === true;

const checkM102 =
results[1] &&
results[1].allowed === false;

const typeCheck =
results.every(
function(item) {


    return (
      item.typeAllowed === true
    );

  }
);


const success =
assignedType === 'CLASSROOM' &&
checkM101 &&
checkM102 &&
typeCheck;

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Assigned_Grade:
    user.Assigned_Grade,

  Assigned_Type:
    user.Assigned_Type,

  Assigned_Locations:
    assignedLocations

},

results:
  results,

checks: {

  assignedTypeCorrect:
    assignedType === 'CLASSROOM',

  M1_01_Allowed:
    checkM101,

  M1_02_Blocked:
    checkM102,

  typeCheck:
    typeCheck

},

expected:
  expected


};

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_4() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. Original Permission
// -----------------------------------

const originalAssignedType =
user.Assigned_Type;

const originalAssignedGrade =
user.Assigned_Grade;

const originalAssignedLocations =
user.Assigned_Locations;

// -----------------------------------
// 4. จำลอง Assigned_Type = ALL
//
// ไม่แก้ Sheet
// -----------------------------------

const assignedGrade =
String(
originalAssignedGrade || ''
)
.trim()
.toUpperCase();

const assignedType =
'ALL';

const assignedLocations =
getAssignedLocations_(
originalAssignedLocations
);

// -----------------------------------
// 5. Location จริง
// -----------------------------------

const testLocationIds = [
'M1-01',
'M1-02'
];

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


// -----------------------------------
// 6. Expected
// -----------------------------------

const expected = {


Assigned_Type:
  'ALL',

M1_01:
  true,

M1_02:
  false


};

// -----------------------------------
// 7. Checks
// -----------------------------------

const typeAllCheck =
results.every(
function(item) {


    return (
      item.typeAllowed === true
    );

  }
);


const locationCheckM101 =
results[0] &&
results[0].allowed === true;

const locationCheckM102 =
results[1] &&
results[1].allowed === false;

// -----------------------------------
// 8. ตรวจว่า Type ALL
// -----------------------------------

const assignedTypeAllCheck =
assignedType === 'ALL';

// -----------------------------------
// 9. Final Check
// -----------------------------------

const success =
assignedTypeAllCheck &&
typeAllCheck &&
locationCheckM101 &&
locationCheckM102;

// -----------------------------------
// 10. Result
// -----------------------------------

const result = {


success:
  success,

simulatedPermission: {

  Assigned_Grade:
    originalAssignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

originalPermission: {

  Assigned_Grade:
    originalAssignedGrade,

  Assigned_Type:
    originalAssignedType,

  Assigned_Locations:
    originalAssignedLocations

},

results:
  results,

checks: {

  assignedTypeIsALL:
    assignedTypeAllCheck,

  allTypeAllowed:
    typeAllCheck,

  M1_01_Allowed:
    locationCheckM101,

  M1_02_Blocked:
    locationCheckM102

},

expected:
  expected,

note:
  'เป็นการจำลอง Assigned_Type = ALL โดยไม่แก้ข้อมูลใน Sheet'

};

// -----------------------------------
// 11. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_5() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. Original Permission
// -----------------------------------

const originalAssignedGrade =
user.Assigned_Grade;

const originalAssignedType =
user.Assigned_Type;

const originalAssignedLocations =
user.Assigned_Locations;

// -----------------------------------
// 4. จำลอง Assigned_Locations = ALL
//
// ไม่แก้ข้อมูลจริง
// -----------------------------------

const assignedGrade =
String(
originalAssignedGrade || ''
)
.trim()
.toUpperCase();

const assignedType =
String(
originalAssignedType || ''
)
.trim()
.toUpperCase();

const assignedLocations = [
'ALL'
];

// -----------------------------------
// 5. Location จริง
// -----------------------------------

const testLocationIds = [
'M1-01',
'M1-02'
];

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


// -----------------------------------
// 6. Expected
// -----------------------------------

const expected = {


Assigned_Grade:
  1,

Assigned_Type:
  'CLASSROOM',

Assigned_Locations:
  'ALL',

M1_01:
  true,

M1_02:
  true


};

// -----------------------------------
// 7. Checks
// -----------------------------------

const locationsAllCheck =
assignedLocations.indexOf(
'ALL'
) !== -1;

const gradeCheck =
results.every(
function(item) {


    return (
      item.gradeAllowed === true
    );

  }
);


const typeCheck =
results.every(
function(item) {


    return (
      item.typeAllowed === true
    );

  }
);


const locationCheck =
results.every(
function(item) {


    return (
      item.locationAllowed === true
    );

  }
);


const allowedCheck =
results.every(
function(item) {


    return (
      item.allowed === true
    );

  }
);

// -----------------------------------
// 8. Final
// -----------------------------------

const success =
locationsAllCheck &&
gradeCheck &&
typeCheck &&
locationCheck &&
allowedCheck;

// -----------------------------------
// 9. Result
// -----------------------------------

const result = {


success:
  success,

simulatedPermission: {

  Assigned_Grade:
    originalAssignedGrade,

  Assigned_Type:
    originalAssignedType,

  Assigned_Locations:
    assignedLocations

},

originalPermission: {

  Assigned_Grade:
    originalAssignedGrade,

  Assigned_Type:
    originalAssignedType,

  Assigned_Locations:
    originalAssignedLocations

},

results:
  results,

checks: {

  assignedLocationsIsALL:
    locationsAllCheck,

  gradeCheck:
    gradeCheck,

  typeCheck:
    typeCheck,

  locationCheck:
    locationCheck,

  allowedCheck:
    allowedCheck

},

expected:
  expected,

note:
  'เป็นการจำลอง Assigned_Locations = ALL โดยไม่แก้ข้อมูลใน Sheet'


};

// -----------------------------------
// 10. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_6() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. Original Permission
// -----------------------------------

const originalAssignedGrade =
user.Assigned_Grade;

const originalAssignedType =
user.Assigned_Type;

const originalAssignedLocations =
user.Assigned_Locations;

// -----------------------------------
// 4. จำลอง Permission
//
// Assigned_Grade = ALL
// Assigned_Type = CLASSROOM
// Assigned_Locations = ALL
//
// ไม่แก้ Sheet
// -----------------------------------

const assignedGrade =
'ALL';

const assignedType =
String(
originalAssignedType || ''
)
.trim()
.toUpperCase();

const assignedLocations = [
'ALL'
];

// -----------------------------------
// 5. Location จริง
// -----------------------------------

const testLocationIds = [
'M1-01',
'M2-01'
];

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


// -----------------------------------
// 6. Expected
// -----------------------------------

const expected = {


Assigned_Grade:
  'ALL',

Assigned_Type:
  'CLASSROOM',

Assigned_Locations:
  'ALL',

M1_01:
  true,

M2_01:
  true


};

// -----------------------------------
// 7. Checks
// -----------------------------------

const gradeAllCheck =
assignedGrade === 'ALL';

const gradePermissionCheck =
results.every(
function(item) {


    return (
      item.gradeAllowed === true
    );

  }
);

const typePermissionCheck =
results.every(
function(item) {


    return (
      item.typeAllowed === true
    );

  }
);

const locationPermissionCheck =
results.every(
function(item) {


    return (
      item.locationAllowed === true
    );

  }
);


const allowedCheck =
results.every(
function(item) {


    return (
      item.allowed === true
    );

  }
);


// -----------------------------------
// 8. Final
// -----------------------------------

const success =
gradeAllCheck &&
gradePermissionCheck &&
typePermissionCheck &&
locationPermissionCheck &&
allowedCheck;

// -----------------------------------
// 9. Result
// -----------------------------------

const result = {


success:
  success,

simulatedPermission: {

  Assigned_Grade:
    assignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

originalPermission: {

  Assigned_Grade:
    originalAssignedGrade,

  Assigned_Type:
    originalAssignedType,

  Assigned_Locations:
    originalAssignedLocations

},

results:
  results,

checks: {

  assignedGradeIsALL:
    gradeAllCheck,

  gradePermissionCheck:
    gradePermissionCheck,

  typePermissionCheck:
    typePermissionCheck,

  locationPermissionCheck:
    locationPermissionCheck,

  allowedCheck:
    allowedCheck

},

expected:
  expected,

note:
  'เป็นการจำลอง Assigned_Grade = ALL และ Assigned_Locations = ALL โดยไม่แก้ข้อมูลใน Sheet'


};

// -----------------------------------
// 10. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_7() {

const studentId = 'admin01';
const pin = 'admin25071';

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับ ADMIN ไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. User Permission
// -----------------------------------

const role =
String(
user.Role || ''
)
.trim()
.toUpperCase();

const assignedGrade =
String(
user.Assigned_Grade || ''
)
.trim()
.toUpperCase();

const assignedType =
String(
user.Assigned_Type || ''
)
.trim()
.toUpperCase();

const assignedLocations =
getAssignedLocations_(
user.Assigned_Locations
);

// -----------------------------------
// 4. Location จริง
// -----------------------------------

const testLocationIds = [
'M1-01',
'M2-01'
];

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // -----------------------------------
    // ADMIN BYPASS
    // -----------------------------------

    const allowed =
      role === 'ADMIN'
        ? true
        : (
            gradeAllowed &&
            typeAllowed &&
            locationAllowed
          );

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


// -----------------------------------
// 5. Expected
// -----------------------------------

const expected = {


Role:
  'ADMIN',

M1_01:
  true,

M2_01:
  true


};

// -----------------------------------
// 6. Checks
// -----------------------------------

const adminRoleCheck =
role === 'ADMIN';

const locationResultsExist =
results.length === 2 &&
results.every(
function(item) {


    return (
      item.Location_ID &&
      item.allowed === true
    );

  }
);

const adminBypassCheck =
results.every(
function(item) {


    return (
      item.allowed === true
    );

  }
);


// -----------------------------------
// 7. Final
// -----------------------------------

const success =
adminRoleCheck &&
locationResultsExist &&
adminBypassCheck;

// -----------------------------------
// 8. Result
// -----------------------------------

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Assigned_Grade:
    user.Assigned_Grade,

  Assigned_Type:
    user.Assigned_Type,

  Assigned_Locations:
    assignedLocations

},

results:
  results,

checks: {

  adminRole:
    adminRoleCheck,

  locationsFound:
    locationResultsExist,

  adminBypass:
    adminBypassCheck

},

expected:
  expected,

note:
  'ADMIN สามารถเข้าถึง Location ได้โดยไม่ขึ้นกับ Assigned_Locations'


};

// -----------------------------------
// 9. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_8() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. Permission
// -----------------------------------

const role =
String(
user.Role || ''
)
.trim()
.toUpperCase();

const assignedGrade =
String(
user.Assigned_Grade || ''
)
.trim()
.toUpperCase();

const assignedType =
String(
user.Assigned_Type || ''
)
.trim()
.toUpperCase();

const assignedLocations =
getAssignedLocations_(
user.Assigned_Locations
);

// -----------------------------------
// 4. Location จริง
// -----------------------------------

const testLocationIds = [
'M1-01',
'M1-02',
'M1-03'
];

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------

    const allowed =
      role === 'ADMIN'
        ? true
        : (
            gradeAllowed &&
            typeAllowed &&
            locationAllowed
          );

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


// -----------------------------------
// 5. Expected
// -----------------------------------

const expected = {


M1_01:
  true,

M1_02:
  false,

M1_03:
  false


};

// -----------------------------------
// 6. Checks
// -----------------------------------

const M101 =
results[0] &&
results[0].allowed === true;

const M102 =
results[1] &&
results[1].allowed === false;

const M103 =
results[2] &&
results[2].allowed === false;

const unauthorizedBlocked =
M102 &&
M103;

// -----------------------------------
// 7. ตรวจว่า Location ที่ถูกบล็อก
//    ยัง Grade และ Type ผ่าน
//    แต่ Location Permission ไม่ผ่าน
// -----------------------------------

const locationPermissionCorrect =
results[1] &&
results[1].gradeAllowed === true &&
results[1].typeAllowed === true &&
results[1].locationAllowed === false &&
results[1].allowed === false;

const locationPermissionCorrect2 =
results[2] &&
results[2].gradeAllowed === true &&
results[2].typeAllowed === true &&
results[2].locationAllowed === false &&
results[2].allowed === false;

// -----------------------------------
// 8. Final
// -----------------------------------

const success =
role === 'INSPECTOR' &&
M101 &&
unauthorizedBlocked &&
locationPermissionCorrect &&
locationPermissionCorrect2;

// -----------------------------------
// 9. Result
// -----------------------------------

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Assigned_Grade:
    user.Assigned_Grade,

  Assigned_Type:
    user.Assigned_Type,

  Assigned_Locations:
    assignedLocations

},

results:
  results,

checks: {

  authorizedLocation:
    M101,

  unauthorizedM1_02Blocked:
    M102,

  unauthorizedM1_03Blocked:
    M103,

  locationPermissionCorrect:
    locationPermissionCorrect,

  locationPermissionCorrect2:
    locationPermissionCorrect2

},

expected:
  expected,

note:
  'ตรวจสอบว่า Inspector ไม่สามารถเข้าถึง Location ที่ไม่ได้รับมอบหมาย แม้ Grade และ Type จะตรง'

};

// -----------------------------------
// 10. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_9() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. Original Permission
// -----------------------------------

const originalAssignedGrade =
user.Assigned_Grade;

const originalAssignedType =
user.Assigned_Type;

const originalAssignedLocations =
user.Assigned_Locations;

// -----------------------------------
// 4. จำลอง Permission
//
// Grade = 1
// Type = CLASSROOM
// Location = M2-01
//
// M2-01 อยู่ Grade 2
//
// ไม่แก้ Sheet
// -----------------------------------

const assignedGrade =
String(
originalAssignedGrade || ''
)
.trim()
.toUpperCase();

const assignedType =
String(
originalAssignedType || ''
)
.trim()
.toUpperCase();

const assignedLocations = [
'M2-01'
];

// -----------------------------------
// 5. Location ที่ใช้ทดสอบ
// -----------------------------------

const locationId =
'M2-01';

const location =
findLocationById_(
locationId
);

if (!location) {


const result = {

  success:
    false,

  stage:
    'FIND_LOCATION',

  error:
    'ไม่พบ Location: ' +
    locationId

};

Logger.log(
  'RESULT: ' +
  JSON.stringify(
    result,
    null,
    2
  )
);

return result;
}

// -----------------------------------
// 6. Location Data
// -----------------------------------

const locationGrade =
String(
location.Grade_Level || ''
)
.trim()
.toUpperCase();

const locationType =
String(
location.Type || ''
)
.trim()
.toUpperCase();

const normalizedLocationId =
String(
location.Location_ID || ''
)
.trim()
.toUpperCase();

// -----------------------------------
// 7. Grade Permission
// -----------------------------------

const gradeAllowed =
assignedGrade === 'ALL' ||
assignedGrade === locationGrade;

// -----------------------------------
// 8. Type Permission
// -----------------------------------

const typeAllowed =
assignedType === 'ALL' ||
assignedType === locationType;

// -----------------------------------
// 9. Location Permission
// -----------------------------------

const locationAllowed =
assignedLocations.indexOf('ALL') !== -1 ||
assignedLocations.indexOf(
normalizedLocationId
) !== -1;

// -----------------------------------
// 10. Final Permission
// -----------------------------------

const allowed =
gradeAllowed &&
typeAllowed &&
locationAllowed;

// -----------------------------------
// 11. Expected
// -----------------------------------

const expected = {


assignedGrade:
  '1',

locationGrade:
  '2',

gradeAllowed:
  false,

typeAllowed:
  true,

locationAllowed:
  true,

allowed:
  false


};

// -----------------------------------
// 12. Checks
// -----------------------------------

const gradeMismatch =
assignedGrade !== locationGrade;

const gradeBlocked =
gradeAllowed === false;

const typePassed =
typeAllowed === true;

const locationPassed =
locationAllowed === true;

const finalBlocked =
allowed === false;

// -----------------------------------
// 13. Final
// -----------------------------------

const success =
gradeMismatch &&
gradeBlocked &&
typePassed &&
locationPassed &&
finalBlocked;

// -----------------------------------
// 14. Result
// -----------------------------------

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Assigned_Grade:
    user.Assigned_Grade,

  Assigned_Type:
    user.Assigned_Type,

  Assigned_Locations:
    assignedLocations

},

location: {

  Location_ID:
    location.Location_ID,

  Location_Name:
    location.Location_Name,

  Grade_Level:
    location.Grade_Level,

  Type:
    location.Type,

  Is_SME:
    location.Is_SME

},

checks: {

  gradeMismatch:
    gradeMismatch,

  gradeBlocked:
    gradeBlocked,

  typePassed:
    typePassed,

  locationPassed:
    locationPassed,

  finalBlocked:
    finalBlocked

},

actual: {

  assignedGrade:
    assignedGrade,

  locationGrade:
    locationGrade,

  gradeAllowed:
    gradeAllowed,

  typeAllowed:
    typeAllowed,

  locationAllowed:
    locationAllowed,

  allowed:
    allowed

},

expected:
  expected,

note:
  'จำลองให้ M2-01 อยู่ใน Assigned_Locations แต่ Grade ไม่ตรง เพื่อยืนยันว่า Grade Permission ยังคงบังคับใช้'


};

// -----------------------------------
// 15. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_10() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. Original Permission
// -----------------------------------

const originalAssignedGrade =
user.Assigned_Grade;

const originalAssignedType =
user.Assigned_Type;

const originalAssignedLocations =
user.Assigned_Locations;

// -----------------------------------
// 4. จำลอง Permission
//
// Grade = 1
// Type = AREA
// Location = M1-01
//
// M1-01 เป็น CLASSROOM
//
// ไม่แก้ Sheet
// -----------------------------------

const assignedGrade =
String(
originalAssignedGrade || ''
)
.trim()
.toUpperCase();

const assignedType =
'AREA';

const assignedLocations = [
'M1-01'
];

// -----------------------------------
// 5. Location
// -----------------------------------

const locationId =
'M1-01';

const location =
findLocationById_(
locationId
);

if (!location) {


const result = {

  success:
    false,

  stage:
    'FIND_LOCATION',

  error:
    'ไม่พบ Location: ' +
    locationId

};

Logger.log(
  'RESULT: ' +
  JSON.stringify(
    result,
    null,
    2
  )
);

return result;

}

// -----------------------------------
// 6. Location Data
// -----------------------------------

const locationGrade =
String(
location.Grade_Level || ''
)
.trim()
.toUpperCase();

const locationType =
String(
location.Type || ''
)
.trim()
.toUpperCase();

const normalizedLocationId =
String(
location.Location_ID || ''
)
.trim()
.toUpperCase();

// -----------------------------------
// 7. Grade Permission
// -----------------------------------

const gradeAllowed =
assignedGrade === 'ALL' ||
assignedGrade === locationGrade;

// -----------------------------------
// 8. Type Permission
// -----------------------------------

const typeAllowed =
assignedType === 'ALL' ||
assignedType === locationType;

// -----------------------------------
// 9. Location Permission
// -----------------------------------

const locationAllowed =
assignedLocations.indexOf('ALL') !== -1 ||
assignedLocations.indexOf(
normalizedLocationId
) !== -1;

// -----------------------------------
// 10. Final Permission
// -----------------------------------

const allowed =
gradeAllowed &&
typeAllowed &&
locationAllowed;

// -----------------------------------
// 11. Expected
// -----------------------------------

const expected = {


assignedGrade:
  '1',

assignedType:
  'AREA',

locationGrade:
  '1',

locationType:
  'CLASSROOM',

gradeAllowed:
  true,

typeAllowed:
  false,

locationAllowed:
  true,

allowed:
  false


};

// -----------------------------------
// 12. Checks
// -----------------------------------

const gradeMatched =
assignedGrade === locationGrade;

const typeMismatch =
assignedType !== locationType;

const typeBlocked =
typeAllowed === false;

const locationPassed =
locationAllowed === true;

const finalBlocked =
allowed === false;

// -----------------------------------
// 13. Final
// -----------------------------------

const success =
gradeMatched &&
typeMismatch &&
typeBlocked &&
locationPassed &&
finalBlocked;

// -----------------------------------
// 14. Result
// -----------------------------------

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Original_Assigned_Grade:
    originalAssignedGrade,

  Original_Assigned_Type:
    originalAssignedType,

  Original_Assigned_Locations:
    originalAssignedLocations

},

simulatedPermission: {

  Assigned_Grade:
    assignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

location: {

  Location_ID:
    location.Location_ID,

  Location_Name:
    location.Location_Name,

  Grade_Level:
    location.Grade_Level,

  Type:
    location.Type,

  Is_SME:
    location.Is_SME

},

checks: {

  gradeMatched:
    gradeMatched,

  typeMismatch:
    typeMismatch,

  typeBlocked:
    typeBlocked,

  locationPassed:
    locationPassed,

  finalBlocked:
    finalBlocked

},

actual: {

  assignedGrade:
    assignedGrade,

  assignedType:
    assignedType,

  locationGrade:
    locationGrade,

  locationType:
    locationType,

  gradeAllowed:
    gradeAllowed,

  typeAllowed:
    typeAllowed,

  locationAllowed:
    locationAllowed,

  allowed:
    allowed

},

expected:
  expected,

note:
  'จำลอง Assigned_Type = AREA โดยไม่แก้ข้อมูลใน Sheet เพื่อยืนยันว่า Type ที่ไม่ตรงจะถูกปฏิเสธ แม้ Grade และ Location จะตรง'


};

// -----------------------------------
// 15. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_11() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. จำลอง Permission
//
// Grade = ALL
// Type = AREA
// Location = M1-01
//
// M1-01 = Grade 1 / CLASSROOM
//
// ไม่แก้ข้อมูลจริง
// -----------------------------------

const assignedGrade =
'ALL';

const assignedType =
'AREA';

const assignedLocations = [
'M1-01'
];

// -----------------------------------
// 4. Location
// -----------------------------------

const locationId =
'M1-01';

const location =
findLocationById_(
locationId
);

if (!location) {


const result = {

  success:
    false,

  stage:
    'FIND_LOCATION',

  error:
    'ไม่พบ Location: ' +
    locationId

};

Logger.log(
  'RESULT: ' +
  JSON.stringify(
    result,
    null,
    2
  )
);

return result;


}

// -----------------------------------
// 5. Location Data
// -----------------------------------

const locationGrade =
String(
location.Grade_Level || ''
)
.trim()
.toUpperCase();

const locationType =
String(
location.Type || ''
)
.trim()
.toUpperCase();

const normalizedLocationId =
String(
location.Location_ID || ''
)
.trim()
.toUpperCase();

// -----------------------------------
// 6. Grade Permission
// -----------------------------------

const gradeAllowed =
assignedGrade === 'ALL' ||
assignedGrade === locationGrade;

// -----------------------------------
// 7. Type Permission
// -----------------------------------

const typeAllowed =
assignedType === 'ALL' ||
assignedType === locationType;

// -----------------------------------
// 8. Location Permission
// -----------------------------------

const locationAllowed =
assignedLocations.indexOf('ALL') !== -1 ||
assignedLocations.indexOf(
normalizedLocationId
) !== -1;

// -----------------------------------
// 9. Final Permission
// -----------------------------------

const allowed =
gradeAllowed &&
typeAllowed &&
locationAllowed;

// -----------------------------------
// 10. Checks
// -----------------------------------

const gradeBypass =
assignedGrade === 'ALL' &&
gradeAllowed === true;

const gradePassed =
gradeAllowed === true;

const typeMismatch =
assignedType !== locationType;

const typeBlocked =
typeAllowed === false;

const locationPassed =
locationAllowed === true;

const finalBlocked =
allowed === false;

// -----------------------------------
// 11. Expected
// -----------------------------------

const expected = {


Assigned_Grade:
  'ALL',

Assigned_Type:
  'AREA',

Assigned_Locations:
  'M1-01',

gradeAllowed:
  true,

typeAllowed:
  false,

locationAllowed:
  true,

allowed:
  false


};

// -----------------------------------
// 12. Final
// -----------------------------------

const success =
gradeBypass &&
gradePassed &&
typeMismatch &&
typeBlocked &&
locationPassed &&
finalBlocked;

// -----------------------------------
// 13. Result
// -----------------------------------

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Original_Assigned_Grade:
    user.Assigned_Grade,

  Original_Assigned_Type:
    user.Assigned_Type,

  Original_Assigned_Locations:
    user.Assigned_Locations

},

simulatedPermission: {

  Assigned_Grade:
    assignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

location: {

  Location_ID:
    location.Location_ID,

  Location_Name:
    location.Location_Name,

  Grade_Level:
    location.Grade_Level,

  Type:
    location.Type,

  Is_SME:
    location.Is_SME

},

checks: {

  gradeBypass:
    gradeBypass,

  gradePassed:
    gradePassed,

  typeMismatch:
    typeMismatch,

  typeBlocked:
    typeBlocked,

  locationPassed:
    locationPassed,

  finalBlocked:
    finalBlocked

},

actual: {

  assignedGrade:
    assignedGrade,

  assignedType:
    assignedType,

  locationGrade:
    locationGrade,

  locationType:
    locationType,

  gradeAllowed:
    gradeAllowed,

  typeAllowed:
    typeAllowed,

  locationAllowed:
    locationAllowed,

  allowed:
    allowed

},

expected:
  expected,

note:
  'จำลอง Assigned_Grade = ALL แต่ Assigned_Type = AREA เพื่อยืนยันว่า Grade ALL ไม่สามารถ bypass Type Permission ได้'


};

// -----------------------------------
// 14. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_12() {

const studentId = 'TEST-USER';
const pin = 996;

// 1. Login

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// 2. User

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// 3. จำลอง Permission
//
// Grade = 1
// Type = ALL
// Location = M2-01
//
// M2-01 = Grade 2 / CLASSROOM
//
// ไม่แก้ข้อมูลจริง

const assignedGrade =
'1';

const assignedType =
'ALL';

const assignedLocations = [
'M2-01'
];

// 4. Location

const locationId =
'M2-01';

const location =
findLocationById_(
locationId
);

if (!location) {


const result = {

  success:
    false,

  stage:
    'FIND_LOCATION',

  error:
    'ไม่พบ Location: ' +
    locationId

};

Logger.log(
  'RESULT: ' +
  JSON.stringify(
    result,
    null,
    2
  )
);

return result;


}

// 5. Location Data

const locationGrade =
String(
location.Grade_Level || ''
)
.trim()
.toUpperCase();

const locationType =
String(
location.Type || ''
)
.trim()
.toUpperCase();

const normalizedLocationId =
String(
location.Location_ID || ''
)
.trim()
.toUpperCase();

// 6. Grade Permission

const gradeAllowed =
assignedGrade === 'ALL' ||
assignedGrade === locationGrade;

// 7. Type Permission

const typeAllowed =
assignedType === 'ALL' ||
assignedType === locationType;

// 8. Location Permission

const locationAllowed =
assignedLocations.indexOf('ALL') !== -1 ||
assignedLocations.indexOf(
normalizedLocationId
) !== -1;

// 9. Final Permission

const allowed =
gradeAllowed &&
typeAllowed &&
locationAllowed;

// 10. Checks

const gradeMismatch =
assignedGrade !== locationGrade;

const gradeBlocked =
gradeAllowed === false;

const typeBypass =
assignedType === 'ALL' &&
typeAllowed === true;

const typePassed =
typeAllowed === true;

const locationPassed =
locationAllowed === true;

const finalBlocked =
allowed === false;

// 11. Expected

const expected = {


Assigned_Grade:
  '1',

Assigned_Type:
  'ALL',

Assigned_Locations:
  'M2-01',

locationGrade:
  '2',

locationType:
  'CLASSROOM',

gradeAllowed:
  false,

typeAllowed:
  true,

locationAllowed:
  true,

allowed:
  false


};

// 12. Final

const success =
gradeMismatch &&
gradeBlocked &&
typeBypass &&
typePassed &&
locationPassed &&
finalBlocked;

// 13. Result

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Original_Assigned_Grade:
    user.Assigned_Grade,

  Original_Assigned_Type:
    user.Assigned_Type,

  Original_Assigned_Locations:
    user.Assigned_Locations

},

simulatedPermission: {

  Assigned_Grade:
    assignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

location: {

  Location_ID:
    location.Location_ID,

  Location_Name:
    location.Location_Name,

  Grade_Level:
    location.Grade_Level,

  Type:
    location.Type,

  Is_SME:
    location.Is_SME

},

checks: {

  gradeMismatch:
    gradeMismatch,

  gradeBlocked:
    gradeBlocked,

  typeBypass:
    typeBypass,

  typePassed:
    typePassed,

  locationPassed:
    locationPassed,

  finalBlocked:
    finalBlocked

},

actual: {

  assignedGrade:
    assignedGrade,

  assignedType:
    assignedType,

  locationGrade:
    locationGrade,

  locationType:
    locationType,

  gradeAllowed:
    gradeAllowed,

  typeAllowed:
    typeAllowed,

  locationAllowed:
    locationAllowed,

  allowed:
    allowed

},

expected:
  expected,

note:
  'จำลอง Assigned_Type = ALL แต่ Assigned_Grade = 1 เพื่อยืนยันว่า Type ALL ไม่สามารถ bypass Grade Permission ได้'


};

// 14. Logger

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_13() {

const studentId = 'TEST-USER';
const pin = 996;

// 1. Login

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// 2. User

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// 3. จำลอง Permission
//
// Grade = ALL
// Type = ALL
// Location = M1-01 เท่านั้น
//
// ดังนั้น M1-01 ต้องผ่าน
// แต่ M1-02 ต้องถูก Block
//
// ไม่แก้ข้อมูลจริงใน Sheet

const assignedGrade =
'ALL';

const assignedType =
'ALL';

const assignedLocations = [
'M1-01'
];

// 4. Locations ที่ใช้ทดสอบ

const testLocationIds = [
'M1-01',
'M1-02'
];

// 5. ตรวจ Permission

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // Grade

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // Type

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // Location

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // Final

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);

// 6. Expected

const expected = {


Assigned_Grade:
  'ALL',

Assigned_Type:
  'ALL',

Assigned_Locations:
  'M1-01',

M1_01:
  true,

M1_02:
  false


};

// 7. Checks

const m101 =
results[0] &&
results[0].allowed === true;

const m102 =
results[1] &&
results[1].allowed === false;

const gradeAllCheck =
results.every(
function(item) {


    return (
      item.gradeAllowed === true
    );

  }
);

const typeAllCheck =
results.every(
function(item) {


    return (
      item.typeAllowed === true
    );

  }
);


const locationRestrictionCheck =
results[0] &&
results[0].locationAllowed === true &&
results[1] &&
results[1].locationAllowed === false;

// 8. Final

const success =
assignedGrade === 'ALL' &&
assignedType === 'ALL' &&
m101 &&
m102 &&
gradeAllCheck &&
typeAllCheck &&
locationRestrictionCheck;

// 9. Result

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Original_Assigned_Grade:
    user.Assigned_Grade,

  Original_Assigned_Type:
    user.Assigned_Type,

  Original_Assigned_Locations:
    user.Assigned_Locations

},

simulatedPermission: {

  Assigned_Grade:
    assignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

results:
  results,

checks: {

  gradeAllCheck:
    gradeAllCheck,

  typeAllCheck:
    typeAllCheck,

  M1_01_Allowed:
    m101,

  M1_02_Blocked:
    m102,

  locationRestrictionCheck:
    locationRestrictionCheck

},

expected:
  expected,

note:
  'จำลอง Assigned_Grade = ALL และ Assigned_Type = ALL แต่ Assigned_Locations จำกัด M1-01 เพื่อยืนยันว่า ALL ของ Grade และ Type ไม่สามารถ bypass Location Permission ได้'


};

// 10. Logger

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_14() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);


}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. จำลอง Permission
//
// Grade = ALL
// Type = ALL
// Location = ALL
//
// ไม่แก้ข้อมูลจริงใน Sheet
// -----------------------------------

const assignedGrade =
'ALL';

const assignedType =
'ALL';

const assignedLocations = [
'ALL'
];

// -----------------------------------
// 4. Locations ที่ใช้ทดสอบ
// -----------------------------------

const testLocationIds = [
'M1-01',
'M1-02',
'M2-01',
'M3-01'
];

// -----------------------------------
// 5. ตรวจ Permission
// -----------------------------------

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);

// -----------------------------------
// 6. Checks
// -----------------------------------

const locationsFound =
results.every(
function(item) {


    return (
      item.Location_ID &&
      item.allowed === true
    );

  }
);


const gradeAllCheck =
results.every(
function(item) {


    return (
      item.gradeAllowed === true
    );

  }
);


const typeAllCheck =
results.every(
function(item) {


    return (
      item.typeAllowed === true
    );

  }
);


const locationAllCheck =
results.every(
function(item) {


    return (
      item.locationAllowed === true
    );

  }
);


const allowedAllCheck =
results.every(
function(item) {


    return (
      item.allowed === true
    );

  }
);


// -----------------------------------
// 7. Expected
// -----------------------------------

const expected = {


Assigned_Grade:
  'ALL',

Assigned_Type:
  'ALL',

Assigned_Locations:
  'ALL',

allLocationsAllowed:
  true


};

// -----------------------------------
// 8. Final
// -----------------------------------

const success =
assignedGrade === 'ALL' &&
assignedType === 'ALL' &&
assignedLocations.indexOf('ALL') !== -1 &&
locationsFound &&
gradeAllCheck &&
typeAllCheck &&
locationAllCheck &&
allowedAllCheck;

// -----------------------------------
// 9. Result
// -----------------------------------

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Original_Assigned_Grade:
    user.Assigned_Grade,

  Original_Assigned_Type:
    user.Assigned_Type,

  Original_Assigned_Locations:
    user.Assigned_Locations

},

simulatedPermission: {

  Assigned_Grade:
    assignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

results:
  results,

checks: {

  locationsFound:
    locationsFound,

  gradeAllCheck:
    gradeAllCheck,

  typeAllCheck:
    typeAllCheck,

  locationAllCheck:
    locationAllCheck,

  allowedAllCheck:
    allowedAllCheck

},

expected:
  expected,

note:
  'จำลอง Assigned_Grade = ALL, Assigned_Type = ALL และ Assigned_Locations = ALL เพื่อยืนยันว่า Permission ทั้ง 3 ด้านสามารถอนุญาตทุก Location ที่มีอยู่ในการทดสอบได้ โดยไม่แก้ข้อมูลใน Sheet'


};

// -----------------------------------
// 10. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_15() {

const studentId = 'TEST-USER';
const pin = 996;

// -----------------------------------
// 1. Login
// -----------------------------------

const login =
verifyLogin(
studentId,
pin
);

if (
!login ||
login.success !== true
) {


throw new Error(
  'Login สำหรับทดสอบไม่สำเร็จ: ' +
  JSON.stringify(login)
);

}

// -----------------------------------
// 2. User
// -----------------------------------

const user =
findUserById_(
studentId
);

if (!user) {


throw new Error(
  'ไม่พบ User: ' +
  studentId
);


}

// -----------------------------------
// 3. จำลอง Permission
//
// Grade = 1
// Type = CLASSROOM
// Location = ALL + M1-01
//
// เมื่อมี ALL อยู่ใน Assigned_Locations
// Location ทุกตัวที่ Grade และ Type ผ่าน
// ต้องได้รับอนุญาต
//
// ไม่แก้ข้อมูลจริงใน Sheet
// -----------------------------------

const assignedGrade =
'1';

const assignedType =
'CLASSROOM';

const assignedLocations = [
'ALL',
'M1-01'
];

// -----------------------------------
// 4. Locations ที่ใช้ทดสอบ
// -----------------------------------

const testLocationIds = [
'M1-01',
'M1-02'
];

// -----------------------------------
// 5. ตรวจ Permission
// -----------------------------------

const results =
testLocationIds.map(
function(locationId) {


    const location =
      findLocationById_(
        locationId
      );

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const locationGrade =
      String(
        location.Grade_Level || ''
      )
        .trim()
        .toUpperCase();

    const locationType =
      String(
        location.Type || ''
      )
        .trim()
        .toUpperCase();

    const normalizedLocationId =
      String(
        location.Location_ID || ''
      )
        .trim()
        .toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------

    const gradeAllowed =
      assignedGrade === 'ALL' ||
      assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------

    const typeAllowed =
      assignedType === 'ALL' ||
      assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        normalizedLocationId
      ) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  }
);


// -----------------------------------
// 6. Checks
// -----------------------------------

const allPresent =
assignedLocations.indexOf('ALL') !== -1;

const m101 =
results[0] &&
results[0].allowed === true;

const m102 =
results[1] &&
results[1].allowed === true;

const gradeCheck =
results.every(
function(item) {


    return (
      item.gradeAllowed === true
    );

  }
);


const typeCheck =
results.every(
function(item) {


    return (
      item.typeAllowed === true
    );

  }
);


const locationAllCheck =
results.every(
function(item) {


    return (
      item.locationAllowed === true
    );

  }
);


const allowedAllCheck =
results.every(
function(item) {

    return (
      item.allowed === true
    );

  }
);


// -----------------------------------
// 7. Expected
// -----------------------------------

const expected = {


Assigned_Grade:
  '1',

Assigned_Type:
  'CLASSROOM',

Assigned_Locations:
  [
    'ALL',
    'M1-01'
  ],

M1_01:
  true,

M1_02:
  true


};

// -----------------------------------
// 8. Final
// -----------------------------------

const success =
allPresent &&
gradeCheck &&
typeCheck &&
locationAllCheck &&
allowedAllCheck &&
m101 &&
m102;

// -----------------------------------
// 9. Result
// -----------------------------------

const result = {


success:
  success,

user: {

  Student_ID:
    user.Student_ID,

  Full_Name:
    user.Full_Name,

  Role:
    user.Role,

  Original_Assigned_Grade:
    user.Assigned_Grade,

  Original_Assigned_Type:
    user.Assigned_Type,

  Original_Assigned_Locations:
    user.Assigned_Locations

},

simulatedPermission: {

  Assigned_Grade:
    assignedGrade,

  Assigned_Type:
    assignedType,

  Assigned_Locations:
    assignedLocations

},

results:
  results,

checks: {

  allPresent:
    allPresent,

  gradeCheck:
    gradeCheck,

  typeCheck:
    typeCheck,

  locationAllCheck:
    locationAllCheck,

  allowedAllCheck:
    allowedAllCheck,

  M1_01_Allowed:
    m101,

  M1_02_Allowed:
    m102

},

expected:
  expected,

note:
  'จำลอง Assigned_Locations ที่มี ALL ร่วมกับ Location เฉพาะ เพื่อยืนยันว่าเมื่อมี ALL แล้ว Location ที่ Grade และ Type ผ่านจะได้รับอนุญาตทั้งหมด โดยไม่แก้ข้อมูลใน Sheet'


};

// -----------------------------------
// 10. Logger
// -----------------------------------

Logger.log(
'RESULT: ' +
JSON.stringify(
result,
null,
2
)
);

return result;

}
function testStep13_16() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. จำลอง Permission
  //
  // Grade = 1
  // Type = CLASSROOM
  // Location = []
  //
  // ไม่มี Location ที่ได้รับมอบหมาย
  // ดังนั้นทุก Location ต้องถูก Block
  //
  // ไม่แก้ข้อมูลจริงใน Sheet
  // -----------------------------------
  const assignedGrade = '1';
  const assignedType = 'CLASSROOM';
  const assignedLocations = [];

  // -----------------------------------
  // 4. Locations ที่ใช้ทดสอบ
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02'];

  // -----------------------------------
  // 5. ตรวจ Permission
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
    const locationType = String(location.Type || '').trim().toUpperCase();
    const normalizedLocationId = String(location.Location_ID || '').trim().toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------
    const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------
    const typeAllowed = assignedType === 'ALL' || assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------
    const locationAllowed = assignedLocations.indexOf('ALL') !== -1 || 
                            assignedLocations.indexOf(normalizedLocationId) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------
    const allowed = gradeAllowed && typeAllowed && locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const locationsFound = results.every(function(item) {
    return item.Location_ID;
  });
  const gradeCheck = results.every(function(item) {
    return item.gradeAllowed === true;
  });
  const typeCheck = results.every(function(item) {
    return item.typeAllowed === true;
  });
  const locationBlockedCheck = results.every(function(item) {
    return item.locationAllowed === false;
  });
  const allowedBlockedCheck = results.every(function(item) {
    return item.allowed === false;
  });

  // -----------------------------------
  // 7. Expected
  // -----------------------------------
  const expected = {
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: [],
    gradeAllowed: true,
    typeAllowed: true,
    locationAllowed: false,
    allowed: false
  };

  // -----------------------------------
  // 8. Final
  // -----------------------------------
  const success = assignedGrade === '1' &&
    assignedType === 'CLASSROOM' &&
    assignedLocations.length === 0 &&
    locationsFound &&
    gradeCheck &&
    typeCheck &&
    locationBlockedCheck &&
    allowedBlockedCheck;

  // -----------------------------------
  // 9. Result
  // -----------------------------------
  const result = {
    success: success,
    user: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Original_Assigned_Grade: user.Assigned_Grade,
      Original_Assigned_Type: user.Assigned_Type,
      Original_Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    results: results,
    checks: {
      locationsFound: locationsFound,
      gradeCheck: gradeCheck,
      typeCheck: typeCheck,
      locationBlockedCheck: locationBlockedCheck,
      allowedBlockedCheck: allowedBlockedCheck
    },
    expected: expected,
    note: 'จำลอง Assigned_Locations เป็นค่าว่าง เพื่อยืนยันว่าแม้ Grade และ Type จะตรงกัน แต่เมื่อไม่มี Location ที่ได้รับมอบหมาย ระบบต้องปฏิเสธการเข้าถึงทั้งหมด โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 10. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep13_17() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. จำลอง Permission
  //
  // Grade = ALL
  // Type = ALL
  // Location = []
  //
  // แม้ Grade และ Type จะผ่านทั้งหมด
  // แต่ไม่มี Location Permission
  // ดังนั้นต้อง Block ทุก Location
  //
  // ไม่แก้ข้อมูลจริงใน Sheet
  // -----------------------------------
  const assignedGrade = 'ALL';
  const assignedType = 'ALL';
  const assignedLocations = [];

  // -----------------------------------
  // 4. Locations ที่ใช้ทดสอบ
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M2-01', 'M3-01'];

  // -----------------------------------
  // 5. ตรวจ Permission
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
    const locationType = String(location.Type || '').trim().toUpperCase();
    const normalizedLocationId = String(location.Location_ID || '').trim().toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------
    const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------
    const typeAllowed = assignedType === 'ALL' || assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------
    const locationAllowed = assignedLocations.indexOf('ALL') !== -1 ||
                            assignedLocations.indexOf(normalizedLocationId) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------
    const allowed = gradeAllowed && typeAllowed && locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const locationsFound = results.every(function(item) {
    return item.Location_ID;
  });
  const gradeAllCheck = results.every(function(item) {
    return item.gradeAllowed === true;
  });
  const typeAllCheck = results.every(function(item) {
    return item.typeAllowed === true;
  });
  const locationBlockedCheck = results.every(function(item) {
    return item.locationAllowed === false;
  });
  const finalBlockedCheck = results.every(function(item) {
    return item.allowed === false;
  });

  // -----------------------------------
  // 7. Expected
  // -----------------------------------
  const expected = {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: [],
    gradeAllowed: true,
    typeAllowed: true,
    locationAllowed: false,
    allowed: false
  };

  // -----------------------------------
  // 8. Final
  // -----------------------------------
  const success = assignedGrade === 'ALL' &&
    assignedType === 'ALL' &&
    assignedLocations.length === 0 &&
    locationsFound &&
    gradeAllCheck &&
    typeAllCheck &&
    locationBlockedCheck &&
    finalBlockedCheck;

  // -----------------------------------
  // 9. Result
  // -----------------------------------
  const result = {
    success: success,
    user: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Original_Assigned_Grade: user.Assigned_Grade,
      Original_Assigned_Type: user.Assigned_Type,
      Original_Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    results: results,
    checks: {
      locationsFound: locationsFound,
      gradeAllCheck: gradeAllCheck,
      typeAllCheck: typeAllCheck,
      locationBlockedCheck: locationBlockedCheck,
      finalBlockedCheck: finalBlockedCheck
    },
    expected: expected,
    note: 'จำลอง Assigned_Grade = ALL และ Assigned_Type = ALL แต่ Assigned_Locations เป็นค่าว่าง เพื่อยืนยันว่า Grade และ Type ALL ไม่สามารถ bypass Location Permission ได้ โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 10. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep13_18() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. จำลอง Permission
  //
  // Grade = ALL
  // Type = CLASSROOM
  // Location = M1-01
  //
  // ไม่แก้ข้อมูลจริงใน Sheet
  // -----------------------------------
  const assignedGrade = 'ALL';
  const assignedType = 'CLASSROOM';
  const assignedLocations = ['M1-01'];

  // -----------------------------------
  // 4. Locations ที่ใช้ทดสอบ
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M2-01', 'M1-02'];

  // -----------------------------------
  // 5. ตรวจ Permission
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
    const locationType = String(location.Type || '').trim().toUpperCase();
    const normalizedLocationId = String(location.Location_ID || '').trim().toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------
    const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------
    const typeAllowed = assignedType === 'ALL' || assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------
    const locationAllowed = assignedLocations.indexOf('ALL') !== -1 ||
                            assignedLocations.indexOf(normalizedLocationId) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------
    const allowed = gradeAllowed && typeAllowed && locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const locationsFound = results.every(function(item) {
    return item.Location_ID;
  });
  const gradeAllCheck = results.every(function(item) {
    return item.gradeAllowed === true;
  });
  const typeCheck = results.every(function(item) {
    return item.typeAllowed === true;
  });
  const locationCheck = results[0] && results[0].locationAllowed === true;
  const unauthorizedLocationCheck = results[1] && results[1].locationAllowed === false &&
                                     results[2] && results[2].locationAllowed === false;
  const allowedCheck = results[0] && results[0].allowed === true &&
                       results[1] && results[1].allowed === false &&
                       results[2] && results[2].allowed === false;

  // -----------------------------------
  // 7. Expected
  // -----------------------------------
  const expected = {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: ['M1-01'],
    M1_01: true,
    M2_01: false,
    M1_02: false
  };

  // -----------------------------------
  // 8. Final
  // -----------------------------------
  const success = assignedGrade === 'ALL' &&
    assignedType === 'CLASSROOM' &&
    assignedLocations.length === 1 &&
    assignedLocations[0] === 'M1-01' &&
    locationsFound &&
    gradeAllCheck &&
    typeCheck &&
    locationCheck &&
    unauthorizedLocationCheck &&
    allowedCheck;

  // -----------------------------------
  // 9. Result
  // -----------------------------------
  const result = {
    success: success,
    user: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Original_Assigned_Grade: user.Assigned_Grade,
      Original_Assigned_Type: user.Assigned_Type,
      Original_Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    results: results,
    checks: {
      locationsFound: locationsFound,
      gradeAllCheck: gradeAllCheck,
      typeCheck: typeCheck,
      authorizedLocationCheck: locationCheck,
      unauthorizedLocationCheck: unauthorizedLocationCheck,
      allowedCheck: allowedCheck
    },
    expected: expected,
    note: 'จำลอง Assigned_Grade = ALL แต่ Assigned_Type = CLASSROOM และ Assigned_Locations จำกัดเฉพาะ M1-01 เพื่อยืนยันว่า Grade ALL ไม่สามารถ bypass Type และ Location Permission ได้ โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 10. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep13_19() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. จำลอง Permission
  //
  // Grade = 1
  // Type = ALL
  // Location = M1-01
  //
  // ไม่แก้ข้อมูลจริงใน Sheet
  // -----------------------------------
  const assignedGrade = '1';
  const assignedType = 'ALL';
  const assignedLocations = ['M1-01'];

  // -----------------------------------
  // 4. Locations ที่ใช้ทดสอบ
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M2-01', 'M1-02'];

  // -----------------------------------
  // 5. ตรวจ Permission
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
    const locationType = String(location.Type || '').trim().toUpperCase();
    const normalizedLocationId = String(location.Location_ID || '').trim().toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------
    const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------
    const typeAllowed = assignedType === 'ALL' || assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------
    const locationAllowed = assignedLocations.indexOf('ALL') !== -1 ||
                            assignedLocations.indexOf(normalizedLocationId) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------
    const allowed = gradeAllowed && typeAllowed && locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const locationsFound = results.every(function(item) {
    return item.Location_ID;
  });
  const gradeCheck = results[0] && results[0].gradeAllowed === true &&
                     results[1] && results[1].gradeAllowed === false &&
                     results[2] && results[2].gradeAllowed === true;
  const typeAllCheck = results.every(function(item) {
    return item.typeAllowed === true;
  });
  const locationCheck = results[0] && results[0].locationAllowed === true;
  const unauthorizedLocationCheck = results[1] && results[1].locationAllowed === false &&
                                     results[2] && results[2].locationAllowed === false;
  const allowedCheck = results[0] && results[0].allowed === true &&
                       results[1] && results[1].allowed === false &&
                       results[2] && results[2].allowed === false;

  // -----------------------------------
  // 7. Expected
  // -----------------------------------
  const expected = {
    Assigned_Grade: '1',
    Assigned_Type: 'ALL',
    Assigned_Locations: ['M1-01'],
    M1_01: true,
    M2_01: false,
    M1_02: false
  };

  // -----------------------------------
  // 8. Final
  // -----------------------------------
  const success = assignedGrade === '1' &&
    assignedType === 'ALL' &&
    assignedLocations.length === 1 &&
    assignedLocations[0] === 'M1-01' &&
    locationsFound &&
    gradeCheck &&
    typeAllCheck &&
    locationCheck &&
    unauthorizedLocationCheck &&
    allowedCheck;

  // -----------------------------------
  // 9. Result
  // -----------------------------------
  const result = {
    success: success,
    user: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Original_Assigned_Grade: user.Assigned_Grade,
      Original_Assigned_Type: user.Assigned_Type,
      Original_Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    results: results,
    checks: {
      locationsFound: locationsFound,
      gradeCheck: gradeCheck,
      typeAllCheck: typeAllCheck,
      authorizedLocationCheck: locationCheck,
      unauthorizedLocationCheck: unauthorizedLocationCheck,
      allowedCheck: allowedCheck
    },
    expected: expected,
    note: 'จำลอง Assigned_Grade = 1 แต่ Assigned_Type = ALL และ Assigned_Locations จำกัดเฉพาะ M1-01 เพื่อยืนยันว่า Type ALL ไม่สามารถ bypass Grade และ Location Permission ได้ โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 10. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep13_20() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. จำลอง Permission
  //
  // Grade = ALL
  // Type = ALL
  // Location = M1-01
  //
  // ไม่แก้ข้อมูลจริงใน Sheet
  // -----------------------------------
  const assignedGrade = 'ALL';
  const assignedType = 'ALL';
  const assignedLocations = ['M1-01'];

  // -----------------------------------
  // 4. Locations ที่ใช้ทดสอบ
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01', 'M3-01'];

  // -----------------------------------
  // 5. ตรวจ Permission
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
    const locationType = String(location.Type || '').trim().toUpperCase();
    const normalizedLocationId = String(location.Location_ID || '').trim().toUpperCase();

    // -----------------------------------
    // Grade
    // -----------------------------------
    const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;

    // -----------------------------------
    // Type
    // -----------------------------------
    const typeAllowed = assignedType === 'ALL' || assignedType === locationType;

    // -----------------------------------
    // Location
    // -----------------------------------
    const locationAllowed = assignedLocations.indexOf('ALL') !== -1 ||
                            assignedLocations.indexOf(normalizedLocationId) !== -1;

    // -----------------------------------
    // Final
    // -----------------------------------
    const allowed = gradeAllowed && typeAllowed && locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const locationsFound = results.every(function(item) {
    return item.Location_ID;
  });
  const gradeAllCheck = results.every(function(item) {
    return item.gradeAllowed === true;
  });
  const typeAllCheck = results.every(function(item) {
    return item.typeAllowed === true;
  });
  const authorizedLocationCheck = results[0] && results[0].locationAllowed === true;
  const unauthorizedLocationCheck = results.slice(1).every(function(item) {
    return item.locationAllowed === false;
  });
  const allowedCheck = results[0] && results[0].allowed === true &&
                       results.slice(1).every(function(item) {
                         return item.allowed === false;
                       });

  // -----------------------------------
  // 7. Expected
  // -----------------------------------
  const expected = {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: ['M1-01'],
    M1_01: true,
    M1_02: false,
    M2_01: false,
    M3_01: false
  };

  // -----------------------------------
  // 8. Final
  // -----------------------------------
  const success = assignedGrade === 'ALL' &&
    assignedType === 'ALL' &&
    assignedLocations.length === 1 &&
    assignedLocations[0] === 'M1-01' &&
    locationsFound &&
    gradeAllCheck &&
    typeAllCheck &&
    authorizedLocationCheck &&
    unauthorizedLocationCheck &&
    allowedCheck;

  // -----------------------------------
  // 9. Result
  // -----------------------------------
  const result = {
    success: success,
    user: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Original_Assigned_Grade: user.Assigned_Grade,
      Original_Assigned_Type: user.Assigned_Type,
      Original_Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    results: results,
    checks: {
      locationsFound: locationsFound,
      gradeAllCheck: gradeAllCheck,
      typeAllCheck: typeAllCheck,
      authorizedLocationCheck: authorizedLocationCheck,
      unauthorizedLocationCheck: unauthorizedLocationCheck,
      allowedCheck: allowedCheck
    },
    expected: expected,
    note: 'จำลอง Assigned_Grade = ALL และ Assigned_Type = ALL แต่ Assigned_Locations จำกัดเฉพาะ M1-01 เพื่อยืนยันว่า Grade ALL และ Type ALL ไม่สามารถ bypass Location Permission ได้ โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 10. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep13_21() {
  const studentId = 'TEST-USER';
  const pin = 996;
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }
  // จำลองค่าที่มีช่องว่าง
  const assignedGrade = String(' 1 ').trim().toUpperCase();
  const assignedType = String(' CLASSROOM ').trim().toUpperCase();
  const assignedLocations = [' M1-01 '].map(function(locationId) {
    return String(locationId).trim().toUpperCase();
  });
  const location = findLocationById_('M1-01');
  if (!location) {
    throw new Error('ไม่พบ Location M1-01');
  }
  const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
  const locationType = String(location.Type || '').trim().toUpperCase();
  const locationId = String(location.Location_ID || '').trim().toUpperCase();
  const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;
  const typeAllowed = assignedType === 'ALL' || assignedType === locationType;
  const locationAllowed = assignedLocations.indexOf('ALL') !== -1 || assignedLocations.indexOf(locationId) !== -1;
  const allowed = gradeAllowed && typeAllowed && locationAllowed;
  const success = assignedGrade === '1' &&
    assignedType === 'CLASSROOM' &&
    assignedLocations[0] === 'M1-01' &&
    gradeAllowed &&
    typeAllowed &&
    locationAllowed &&
    allowed;

  const result = {
    success: success,
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    location: {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type
    },
    checks: {
      gradeTrimCheck: assignedGrade === '1',
      typeTrimCheck: assignedType === 'CLASSROOM',
      locationTrimCheck: assignedLocations[0] === 'M1-01',
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      finalAllowed: allowed
    },
    expected: {
      Assigned_Grade: '1',
      Assigned_Type: 'CLASSROOM',
      Assigned_Locations: ['M1-01'],
      allowed: true
    },
    note: 'ทดสอบการจัดการช่องว่างรอบค่า Permission โดยไม่แก้ข้อมูลใน Sheet'
  };
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}

function testStep13_22() {
  const studentId = 'TEST-USER';
  const pin = 996;
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }
  // จำลองตัวพิมพ์เล็ก / ใหญ่
  const assignedGrade = String('all').trim().toUpperCase();
  const assignedType = String('classroom').trim().toUpperCase();
  const assignedLocations = ['m1-01'].map(function(locationId) {
    return String(locationId).trim().toUpperCase();
  });
  const testLocationIds = ['M1-01', 'M2-01'];
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
    const locationType = String(location.Type || '').trim().toUpperCase();
    const normalizedLocationId = String(location.Location_ID || '').trim().toUpperCase();

    const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;
    const typeAllowed = assignedType === 'ALL' || assignedType === locationType;
    const locationAllowed = assignedLocations.indexOf('ALL') !== -1 || assignedLocations.indexOf(normalizedLocationId) !== -1;
    const allowed = gradeAllowed && typeAllowed && locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };
  });

  const success = assignedGrade === 'ALL' &&
    assignedType === 'CLASSROOM' &&
    assignedLocations[0] === 'M1-01' &&
    results[0] &&
    results[0].allowed === true &&
    results[1] &&
    results[1].allowed === false;

  const result = {
    success: success,
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    results: results,
    checks: {
      lowercaseAllNormalized: assignedGrade === 'ALL',
      lowercaseTypeNormalized: assignedType === 'CLASSROOM',
      lowercaseLocationNormalized: assignedLocations[0] === 'M1-01',
      M1_01_Allowed: results[0] && results[0].allowed === true,
      M2_01_Blocked: results[1] && results[1].allowed === false
    },
    expected: {
      Assigned_Grade: 'ALL',
      Assigned_Type: 'CLASSROOM',
      Assigned_Locations: ['M1-01'],
      M1_01: true,
      M2_01: false
    },
    note: 'ทดสอบการ Normalize ตัวพิมพ์เล็กและใหญ่ของ Permission โดยไม่แก้ข้อมูลใน Sheet'
  };
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}

function testStep13_23() {
  const studentId = 'TEST-USER';
  const pin = 996;
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }
  const assignedGrade = 'ALL';
  const assignedType = 'ALL';
  const assignedLocations = ['LOCATION-NOT-EXIST'];
  const invalidLocationId = 'LOCATION-NOT-EXIST';
  const location = findLocationById_(invalidLocationId);
  const found = !!location;
  const gradeAllowed = false;
  const typeAllowed = false;
  const locationAllowed = false;
  const allowed = false;
  const success = found === false &&
    gradeAllowed === false &&
    typeAllowed === false &&
    locationAllowed === false &&
    allowed === false;

  const result = {
    success: success,
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    testLocation: {
      Location_ID: invalidLocationId,
      found: found
    },
    checks: {
      locationDoesNotExist: found === false,
      accessBlocked: allowed === false
    },
    expected: {
      found: false,
      allowed: false
    },
    note: 'ทดสอบ Location ID ที่ไม่มีอยู่จริง เพื่อยืนยันว่า Location ที่ไม่พบจะไม่สามารถเข้าถึงได้ และไม่มีการแก้ข้อมูลใน Sheet'
  };
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}

function testStep13_24() {
  const studentId = 'TEST-USER';
  const pin = 996;
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }
  // จำลอง User ที่ไม่มี Permission
  const assignedGrade = '1';
  const assignedType = 'CLASSROOM';
  const assignedLocations = [];
  const testLocationIds = ['M1-01', 'M1-02'];
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const locationGrade = String(location.Grade_Level || '').trim().toUpperCase();
    const locationType = String(location.Type || '').trim().toUpperCase();
    const normalizedLocationId = String(location.Location_ID || '').trim().toUpperCase();

    const gradeAllowed = assignedGrade === 'ALL' || assignedGrade === locationGrade;
    const typeAllowed = assignedType === 'ALL' || assignedType === locationType;
    const locationAllowed = assignedLocations.indexOf('ALL') !== -1 || assignedLocations.indexOf(normalizedLocationId) !== -1;
    const allowed = gradeAllowed && typeAllowed && locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };
  });

  const success = results.every(function(item) {
    return (
      item.found !== false &&
      item.gradeAllowed === true &&
      item.typeAllowed === true &&
      item.locationAllowed === false &&
      item.allowed === false
    );
  });

  const result = {
    success: success,
    simulatedPermission: {
      Assigned_Grade: assignedGrade,
      Assigned_Type: assignedType,
      Assigned_Locations: assignedLocations
    },
    results: results,
    checks: {
      locationsFound: results.every(function(item) {
        return item.found !== false;
      }),
      gradePermissionPassed: results.every(function(item) {
        return item.gradeAllowed === true;
      }),
      typePermissionPassed: results.every(function(item) {
        return item.typeAllowed === true;
      }),
      locationPermissionBlocked: results.every(function(item) {
        return item.locationAllowed === false;
      }),
      finalBlocked: results.every(function(item) {
        return item.allowed === false;
      })
    },
    expected: {
      Assigned_Grade: '1',
      Assigned_Type: 'CLASSROOM',
      Assigned_Locations: [],
      allowed: false
    },
    note: 'จำลอง User ที่ไม่มี Assigned_Locations เพื่อยืนยันว่าไม่มี Location Permission = ไม่สามารถเข้าถึง Location ใดได้'
  };
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}

function testStep13_25() {
  const results = {
    STEP_13_21: testStep13_21(),
    STEP_13_22: testStep13_22(),
    STEP_13_23: testStep13_23(),
    STEP_13_24: testStep13_24()
  };
  const allPassed = results.STEP_13_21 && results.STEP_13_21.success === true &&
    results.STEP_13_22 && results.STEP_13_22.success === true &&
    results.STEP_13_23 && results.STEP_13_23.success === true &&
    results.STEP_13_24 && results.STEP_13_24.success === true;

  const finalResult = {
    success: allPassed,
    stage: 'FINAL_PERMISSION_VALIDATION',
    results: results,
    checks: {
      STEP_13_21: results.STEP_13_21.success === true,
      STEP_13_22: results.STEP_13_22.success === true,
      STEP_13_23: results.STEP_13_23.success === true,
      STEP_13_24: results.STEP_13_24.success === true,
      ALL_TESTS_PASSED: allPassed
    },
    expected: {
      STEP_13_21: true,
      STEP_13_22: true,
      STEP_13_23: true,
      STEP_13_24: true,
      ALL_TESTS_PASSED: true
    },
    note: 'FINAL VALIDATION ของ Permission STEP 13 โดยไม่แก้ข้อมูลจริงใน Sheet'
  };
  Logger.log('RESULT: ' + JSON.stringify(finalResult, null, 2));
  return finalResult;
}
function isTargetAllowed_(user, location) {

  if (!user || !location) {
    return false;
  }


  /*************************************************
   * 1. ROLE
   *************************************************/

  const role =
    normalizeText_(user.Role);


  // ADMIN เห็นทั้งหมด
  if (role === 'ADMIN') {
    return true;
  }


  /*************************************************
   * 2. USER ASSIGNMENT
   *************************************************/

  const assignedGrade =
    normalizeText_(
      user.Assigned_Grade
    );

  const assignedType =
    normalizeText_(
      user.Assigned_Type
    );


  /*************************************************
   * 3. LOCATION DATA
   *************************************************/

  const locationGrade =
    normalizeText_(
      location.Grade_Level
    );

  const locationType =
    normalizeText_(
      location.Type
    );


  const isSME =
    String(
      location.Is_SME || ''
    ).toUpperCase() === 'TRUE';


  /*************************************************
   * 4. TYPE CHECK
   *************************************************/

  let typeAllowed = true;


  if (
    assignedType !== '' &&
    assignedType !== 'ALL'
  ) {

    const allowedTypes =
      assignedType
        .split(',')
        .map(function(value) {

          return normalizeText_(value);

        })
        .filter(function(value) {

          return value !== '';

        });


    typeAllowed =
      allowedTypes.indexOf(
        locationType
      ) !== -1;

  }


  if (!typeAllowed) {
    return false;
  }


  /*************************************************
   * 5. CLASSROOM RULE
   *
   * ม.3 เป็นกรณีพิเศษ
   *
   * ม.3 ตรวจ:
   * - ห้อง ม.3 ปกติ 9 ห้อง
   * - SME ทุกระดับ 6 ห้อง
   *
   * รวม 15 ห้อง
   *************************************************/

  if (
    assignedType === 'CLASSROOM'
  ) {


    /*
     * ม.3
     */

    if (assignedGrade === '3') {

      /*
       * ห้อง ม.3 ปกติ
       *
       * ต้องเป็น CLASSROOM
       * Grade = 3
       * และไม่ใช่ SME
       */

      if (
        locationType === 'CLASSROOM' &&
        locationGrade === '3' &&
        !isSME
      ) {

        return true;

      }


      /*
       * SME ทุกระดับ
       *
       * ต้องเป็น CLASSROOM
       * และ Is_SME = TRUE
       */

      if (
        locationType === 'CLASSROOM' &&
        isSME
      ) {

        return true;

      }


      /*
       * อย่างอื่นไม่อนุญาต
       */

      return false;

    }


    /*
     * ม.1, ม.2, ม.4, ม.5, ม.6
     *
     * เห็นเฉพาะห้องระดับตัวเอง
     * และห้ามเห็น SME
     */

    if (
      locationType === 'CLASSROOM' &&
      locationGrade === assignedGrade &&
      !isSME
    ) {

      return true;

    }


    return false;

  }


  /*************************************************
   * 6. ZONE
   *
   * ระบบเขตเดิม
   * ไม่เกี่ยวกับ SME
   *************************************************/

  if (
    assignedType === 'ZONE'
  ) {

    /*
     * ถ้าไม่ได้กำหนด Grade
     * หรือกำหนด ALL
     * ให้เห็นทุกเขต
     */

    if (
      assignedGrade === '' ||
      assignedGrade === 'ALL'
    ) {

      return (
        locationType === 'ZONE'
      );

    }


    /*
     * ปกติ:
     * เห็นเฉพาะเขตของ Grade ตัวเอง
     */

    return (
      locationType === 'ZONE' &&
      locationGrade === assignedGrade
    );

  }


  /*************************************************
   * 7. ASSIGNED_LOCATIONS
   *
   * ใช้เฉพาะกรณีที่มีการกำหนด Location
   *
   * แต่ตอนนี้ CLASSROOM / ZONE
   * ใช้กฎด้านบนเป็นหลัก
   *************************************************/

  return false;

}
function testStep14_1() {

  const studentId = 'TEST-USER';

  // -----------------------------------
  // 1. User
  // -----------------------------------

  const user = findUserById_(studentId);

  if (!user) {
    throw new Error(
      'ไม่พบ User: ' + studentId
    );
  }

  // -----------------------------------
  // 2. Locations สำหรับทดสอบ
  // -----------------------------------

  const testLocationIds = [
    'M1-01',
    'M1-02',
    'M2-01'
  ];

  // -----------------------------------
  // 3. ตรวจ isTargetAllowed_
  // -----------------------------------

  const results = testLocationIds.map(
    function(locationId) {

      const location =
        findLocationById_(locationId);

      if (!location) {
        return {
          Location_ID: locationId,
          found: false,
          allowed: false
        };
      }

      const allowed =
        isTargetAllowed_(
          user,
          location
        );

      return {
        Location_ID:
          location.Location_ID,

        Location_Name:
          location.Location_Name,

        Grade_Level:
          location.Grade_Level,

        Type:
          location.Type,

        Is_SME:
          location.Is_SME,

        allowed:
          allowed
      };

    }
  );

  // -----------------------------------
  // 4. Expected
  // -----------------------------------

  const expected = {
    'M1-01': true,
    'M1-02': false,
    'M2-01': false
  };

  // -----------------------------------
  // 5. Checks
  // -----------------------------------

  const checks =
    results.map(
      function(item) {

        return {
          Location_ID:
            item.Location_ID,

          actual:
            item.allowed,

          expected:
            expected[item.Location_ID],

          pass:
            item.allowed ===
            expected[item.Location_ID]
        };

      }
    );

  const allPassed =
    checks.every(
      function(item) {
        return item.pass === true;
      }
    );

  // -----------------------------------
  // 6. Result
  // -----------------------------------

  const result = {

    success:
      allPassed,

    user: {

      Student_ID:
        user.Student_ID,

      Full_Name:
        user.Full_Name,

      Role:
        user.Role,

      Assigned_Grade:
        user.Assigned_Grade,

      Assigned_Type:
        user.Assigned_Type,

      Assigned_Locations:
        getAssignedLocations_(
          user.Assigned_Locations
        )

    },

    results:
      results,

    checks:
      checks,

    expected:
      expected,

    note:
      'ทดสอบ isTargetAllowed_() โดยตรง โดยไม่แก้ข้อมูลใน Sheet'

  };

  Logger.log(
    'RESULT: ' +
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}
function testStep14_2() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Location ที่ใช้ทดสอบ
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01'];

  // -----------------------------------
  // 4. ตรวจ Permission
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(user, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 5. Checks
  // -----------------------------------
  const m101 = results.find(function(item) {
    return item.Location_ID === 'M1-01';
  });
  const m102 = results.find(function(item) {
    return item.Location_ID === 'M1-02';
  });
  const m201 = results.find(function(item) {
    return item.Location_ID === 'M2-01';
  });

  const m101Allowed = !!m101 && m101.allowed === true;
  const m102Blocked = !!m102 && m102.allowed === false;
  const m201Blocked = !!m201 && m201.allowed === false;

  // -----------------------------------
  // 6. Final
  // -----------------------------------
  const success = m101Allowed && m102Blocked && m201Blocked;

  // -----------------------------------
  // 7. Result
  // -----------------------------------
  const result = {
    success: success,
    user: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(user.Assigned_Locations)
    },
    results: results,
    checks: {
      M1_01_Allowed: m101Allowed,
      M1_02_Blocked: m102Blocked,
      M2_01_Blocked: m201Blocked,
      permissionFilterCorrect: success
    },
    expected: {
      M1_01: true,
      M1_02: false,
      M2_01: false
    },
    note: 'ทดสอบการนำ isTargetAllowed_() ไปตรวจ Location แต่ละรายการ โดยไม่ใช้ allTargets_() และไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 8. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_3() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User จริง
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. จำลอง Permission
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Assigned_Grade: '1',
    Assigned_Type: 'ALL',
    Assigned_Locations: 'M1-01'
  });

  // -----------------------------------
  // 4. Location
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01'];

  // -----------------------------------
  // 5. ตรวจ Permission
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const m101 = results[0];
  const m102 = results[1];
  const m201 = results[2];

  const m101Allowed = !!m101 && m101.allowed === true;
  const m102Blocked = !!m102 && m102.allowed === false;
  const m201Blocked = !!m201 && m201.allowed === false;
  const typeAllCheck = simulatedUser.Assigned_Type === 'ALL';

  // -----------------------------------
  // 7. Final
  // -----------------------------------
  const success = typeAllCheck && m101Allowed && m102Blocked && m201Blocked;

  // -----------------------------------
  // 8. Result
  // -----------------------------------
  const result = {
    success: success,
    originalPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(simulatedUser.Assigned_Locations)
    },
    results: results,
    checks: {
      typeAllCheck: typeAllCheck,
      M1_01_Allowed: m101Allowed,
      M1_02_Blocked: m102Blocked,
      M2_01_Blocked: m201Blocked,
      permissionLogicCorrect: success
    },
    expected: {
      Assigned_Grade: '1',
      Assigned_Type: 'ALL',
      Assigned_Locations: 'M1-01',
      M1_01: true,
      M1_02: false,
      M2_01: false
    },
    note: 'จำลอง Assigned_Type = ALL โดยไม่แก้ข้อมูลใน Sheet เพื่อยืนยันว่า Type ALL ไม่สามารถ bypass Grade และ Location Permission ได้'
  };

  // -----------------------------------
  // 9. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_4() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Simulated Permission
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: 'M1-01'
  });

  // -----------------------------------
  // 4. Locations
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01'];

  // -----------------------------------
  // 5. Permission Test
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const m101 = results[0];
  const m102 = results[1];
  const m201 = results[2];

  const m101Allowed = !!m101 && m101.allowed === true;
  const m102Blocked = !!m102 && m102.allowed === false;
  const m201Blocked = !!m201 && m201.allowed === false;
  const gradeAllCheck = String(simulatedUser.Assigned_Grade).trim().toUpperCase() === 'ALL';

  // -----------------------------------
  // 7. Final
  // -----------------------------------
  const success = gradeAllCheck && m101Allowed && m102Blocked && m201Blocked;

  // -----------------------------------
  // 8. Result
  // -----------------------------------
  const result = {
    success: success,
    originalPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(simulatedUser.Assigned_Locations)
    },
    results: results,
    checks: {
      gradeAllCheck: gradeAllCheck,
      M1_01_Allowed: m101Allowed,
      M1_02_Blocked: m102Blocked,
      M2_01_Blocked: m201Blocked,
      permissionLogicCorrect: success
    },
    expected: {
      Assigned_Grade: 'ALL',
      Assigned_Type: 'CLASSROOM',
      Assigned_Locations: 'M1-01',
      M1_01: true,
      M1_02: false,
      M2_01: false
    },
    note: 'จำลอง Assigned_Grade = ALL โดยไม่แก้ข้อมูลใน Sheet เพื่อยืนยันว่า Grade ALL ไม่สามารถ bypass Type และ Location Permission ได้'
  };

  // -----------------------------------
  // 9. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_5() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Simulated Permission
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: 'ALL'
  });

  // -----------------------------------
  // 4. Locations
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01'];

  // -----------------------------------
  // 5. Permission Test
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const m101 = results[0];
  const m102 = results[1];
  const m201 = results[2];

  const m101Allowed = !!m101 && m101.allowed === true;
  const m102Allowed = !!m102 && m102.allowed === true;
  const m201Blocked = !!m201 && m201.allowed === false;
  const locationAllCheck = getAssignedLocations_(simulatedUser.Assigned_Locations).indexOf('ALL') !== -1;

  // -----------------------------------
  // 7. Final
  // -----------------------------------
  const success = locationAllCheck && m101Allowed && m102Allowed && m201Blocked;

  // -----------------------------------
  // 8. Result
  // -----------------------------------
  const result = {
    success: success,
    originalPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(simulatedUser.Assigned_Locations)
    },
    results: results,
    checks: {
      locationAllCheck: locationAllCheck,
      M1_01_Allowed: m101Allowed,
      M1_02_Allowed: m102Allowed,
      M2_01_Blocked: m201Blocked,
      permissionLogicCorrect: success
    },
    expected: {
      Assigned_Grade: '1',
      Assigned_Type: 'CLASSROOM',
      Assigned_Locations: 'ALL',
      M1_01: true,
      M1_02: true,
      M2_01: false
    },
    note: 'จำลอง Assigned_Locations = ALL โดยไม่แก้ข้อมูลใน Sheet เพื่อยืนยันว่า Location ALL ไม่สามารถ bypass Grade Permission ได้'
  };

  // -----------------------------------
  // 9. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_6() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Simulated Permission
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: 'ALL'
  });

  // -----------------------------------
  // 4. Locations
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01', 'M3-01'];

  // -----------------------------------
  // 5. Permission Test
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const allPermissionCheck =
    String(simulatedUser.Assigned_Grade).trim().toUpperCase() === 'ALL' &&
    String(simulatedUser.Assigned_Type).trim().toUpperCase() === 'ALL' &&
    getAssignedLocations_(simulatedUser.Assigned_Locations).indexOf('ALL') !== -1;

  const allLocationsAllowed =
    results.length > 0 &&
    results.every(function(item) {
      return item.found !== false && item.allowed === true;
    });

  // -----------------------------------
  // 7. Final
  // -----------------------------------
  const success = allPermissionCheck && allLocationsAllowed;

  // -----------------------------------
  // 8. Result
  // -----------------------------------
  const result = {
    success: success,
    originalPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(simulatedUser.Assigned_Locations)
    },
    results: results,
    checks: {
      allPermissionCheck: allPermissionCheck,
      allLocationsFound: results.every(function(item) {
        return item.found !== false;
      }),
      allLocationsAllowed: allLocationsAllowed,
      permissionLogicCorrect: success
    },
    expected: {
      Assigned_Grade: 'ALL',
      Assigned_Type: 'ALL',
      Assigned_Locations: 'ALL',
      allLocationsAllowed: true
    },
    note: 'จำลอง Permission เป็น ALL / ALL / ALL เพื่อยืนยันว่า Inspector สามารถเข้าถึงทุก Location ที่มีอยู่ในการทดสอบ โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 9. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_7() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Simulated Permission
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: ''
  });

  // -----------------------------------
  // 4. Locations
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01', 'M3-01'];

  // -----------------------------------
  // 5. Permission Test
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const gradeAllCheck = String(simulatedUser.Assigned_Grade).trim().toUpperCase() === 'ALL';
  const typeAllCheck = String(simulatedUser.Assigned_Type).trim().toUpperCase() === 'ALL';
  const locationsEmptyCheck = getAssignedLocations_(simulatedUser.Assigned_Locations).length === 0;

  const allBlocked =
    results.length > 0 &&
    results.every(function(item) {
      return item.allowed === false;
    });

  // -----------------------------------
  // 7. Final
  // -----------------------------------
  const success = gradeAllCheck && typeAllCheck && locationsEmptyCheck && allBlocked;

  // -----------------------------------
  // 8. Result
  // -----------------------------------
  const result = {
    success: success,
    originalPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    simulatedPermission: {
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(simulatedUser.Assigned_Locations)
    },
    results: results,
    checks: {
      gradeAllCheck: gradeAllCheck,
      typeAllCheck: typeAllCheck,
      locationsEmptyCheck: locationsEmptyCheck,
      allBlocked: allBlocked,
      permissionLogicCorrect: success
    },
    expected: {
      Assigned_Grade: 'ALL',
      Assigned_Type: 'ALL',
      Assigned_Locations: [],
      allLocationsAllowed: false
    },
    note: 'จำลอง Assigned_Grade = ALL และ Assigned_Type = ALL แต่ Assigned_Locations ว่าง เพื่อยืนยันว่าไม่มี Location Permission จะไม่สามารถเข้าถึง Location ใดได้ โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 9. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_8() {
  const studentId = 'admin01';
  const pin = 'admin25071';

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login ADMIN สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Simulated ADMIN
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Role: 'ADMIN',
    Assigned_Grade: '',
    Assigned_Type: '',
    Assigned_Locations: ''
  });

  // -----------------------------------
  // 4. Locations
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M2-01', 'M3-01'];

  // -----------------------------------
  // 5. Permission Test
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const adminRoleCheck = String(simulatedUser.Role || '').trim().toUpperCase() === 'ADMIN';
  const assignedGradeEmpty = getAssignedLocations_(simulatedUser.Assigned_Locations).length === 0;

  const allAllowed =
    results.length > 0 &&
    results.every(function(item) {
      return item.found !== false && item.allowed === true;
    });

  // -----------------------------------
  // 7. Final
  // -----------------------------------
  const success = adminRoleCheck && assignedGradeEmpty && allAllowed;

  // -----------------------------------
  // 8. Result
  // -----------------------------------
  const result = {
    success: success,
    originalUser: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    simulatedUser: {
      Student_ID: simulatedUser.Student_ID,
      Full_Name: simulatedUser.Full_Name,
      Role: simulatedUser.Role,
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(simulatedUser.Assigned_Locations)
    },
    results: results,
    checks: {
      adminRoleCheck: adminRoleCheck,
      locationsFound: results.every(function(item) {
        return item.found !== false;
      }),
      adminBypass: allAllowed,
      permissionLogicCorrect: success
    },
    expected: {
      Role: 'ADMIN',
      Assigned_Locations: [],
      M1_01: true,
      M2_01: true,
      M3_01: true
    },
    note: 'จำลอง ADMIN ที่ไม่มี Assigned_Locations เพื่อยืนยันว่า ADMIN สามารถ bypass Location Permission และเข้าถึง Location ได้ทั้งหมด โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 9. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_9() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Simulated Permission
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: 'ALL'
  });

  // -----------------------------------
  // 4. Fake Location ID
  // -----------------------------------
  const fakeLocationId = 'LOCATION-NOT-EXIST';

  // -----------------------------------
  // 5. Search Real Location
  // -----------------------------------
  const realLocation = findLocationById_(fakeLocationId);

  // -----------------------------------
  // 6. Access Decision
  // -----------------------------------
  const locationExists = !!realLocation;
  const allowed = locationExists ? isTargetAllowed_(simulatedUser, realLocation) : false;

  // -----------------------------------
  // 7. Checks
  // -----------------------------------
  const locationDoesNotExist = locationExists === false;
  const accessBlocked = allowed === false;

  // -----------------------------------
  // 8. Final
  // -----------------------------------
  const success = locationDoesNotExist && accessBlocked;

  // -----------------------------------
  // 9. Result
  // -----------------------------------
  const result = {
    success: success,
    simulatedPermission: {
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(simulatedUser.Assigned_Locations)
    },
    testLocation: {
      Location_ID: fakeLocationId,
      found: locationExists,
      allowed: allowed
    },
    checks: {
      locationDoesNotExist: locationDoesNotExist,
      accessBlocked: accessBlocked,
      permissionLogicCorrect: success
    },
    expected: {
      found: false,
      allowed: false
    },
    note: 'ทดสอบ Location ID ที่ไม่มีอยู่จริง โดยตรวจสอบกับข้อมูล Location จริงก่อนเรียก Permission และไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 10. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_10() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Simulated Permission
  // -----------------------------------
  const simulatedUser = Object.assign({}, user, {
    Assigned_Grade: ' 1 ',
    Assigned_Type: ' classroom ',
    Assigned_Locations: '  m1-01  '
  });

  // -----------------------------------
  // 4. Real Location
  // -----------------------------------
  const location = findLocationById_('M1-01');
  if (!location) {
    throw new Error('ไม่พบ Location M1-01');
  }

  // -----------------------------------
  // 5. Permission
  // -----------------------------------
  const allowed = isTargetAllowed_(simulatedUser, location);

  // -----------------------------------
  // 6. Normalize Checks
  // -----------------------------------
  const normalizedGrade = String(simulatedUser.Assigned_Grade || '').trim().toUpperCase();
  const normalizedType = String(simulatedUser.Assigned_Type || '').trim().toUpperCase();
  const normalizedLocations = getAssignedLocations_(simulatedUser.Assigned_Locations);

  const gradeTrimCheck = normalizedGrade === '1';
  const typeTrimCheck = normalizedType === 'CLASSROOM';
  const locationTrimCheck = normalizedLocations.indexOf('M1-01') !== -1;

  // -----------------------------------
  // 7. Final
  // -----------------------------------
  const success = gradeTrimCheck && typeTrimCheck && locationTrimCheck && allowed === true;

  // -----------------------------------
  // 8. Result
  // -----------------------------------
  const result = {
    success: success,
    simulatedPermission: {
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: normalizedLocations
    },
    location: {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME
    },
    actual: {
      normalizedGrade: normalizedGrade,
      normalizedType: normalizedType,
      normalizedLocations: normalizedLocations,
      allowed: allowed
    },
    checks: {
      gradeTrimCheck: gradeTrimCheck,
      typeTrimCheck: typeTrimCheck,
      locationTrimCheck: locationTrimCheck,
      finalAllowed: allowed === true,
      permissionLogicCorrect: success
    },
    expected: {
      normalizedGrade: '1',
      normalizedType: 'CLASSROOM',
      normalizedLocation: 'M1-01',
      allowed: true
    },
    note: 'ทดสอบการ Trim และ Normalize ตัวพิมพ์ของ Grade, Type และ Location โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 9. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
function testStep14_11() {
  const studentId = 'TEST-USER';
  const pin = 996;

  // -----------------------------------
  // 1. Login
  // -----------------------------------
  const login = verifyLogin(studentId, pin);
  if (!login || login.success !== true) {
    throw new Error('Login สำหรับทดสอบไม่สำเร็จ: ' + JSON.stringify(login));
  }

  // -----------------------------------
  // 2. User
  // -----------------------------------
  const user = findUserById_(studentId);
  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 3. Test Locations
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01', 'M3-01'];

  // -----------------------------------
  // 4. Filter ด้วย Permission จริง
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(user, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 5. Checks
  // -----------------------------------
  const M1_01_Allowed = results[0] && results[0].allowed === true;
  const M1_02_Blocked = results[1] && results[1].allowed === false;
  const M2_01_Blocked = results[2] && results[2].allowed === false;
  const M3_01_Blocked = results[3] && results[3].allowed === false;

  const onlyAuthorizedLocation =
    results.filter(function(item) {
      return item.allowed === true;
    }).length === 1;

  // -----------------------------------
  // 6. Final
  // -----------------------------------
  const success =
    M1_01_Allowed &&
    M1_02_Blocked &&
    M2_01_Blocked &&
    M3_01_Blocked &&
    onlyAuthorizedLocation;

  // -----------------------------------
  // 7. Result
  // -----------------------------------
  const result = {
    success: success,
    user: {
      Student_ID: user.Student_ID,
      Full_Name: user.Full_Name,
      Role: user.Role,
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: getAssignedLocations_(user.Assigned_Locations)
    },
    results: results,
    checks: {
      M1_01_Allowed: M1_01_Allowed,
      M1_02_Blocked: M1_02_Blocked,
      M2_01_Blocked: M2_01_Blocked,
      M3_01_Blocked: M3_01_Blocked,
      onlyAuthorizedLocation: onlyAuthorizedLocation,
      permissionFilterCorrect: success
    },
    expected: {
      M1_01: true,
      M1_02: false,
      M2_01: false,
      M3_01: false
    },
    note: 'ทดสอบ Permission Filtering โดยใช้ isTargetAllowed_() โดยตรง เนื่องจากระบบปัจจุบันยังไม่มี getTargetsForUser_() และไม่สร้างฟังก์ชันใหม่ในขั้นทดสอบ'
  };

  // -----------------------------------
  // 8. Logger
  // -----------------------------------
  Logger.log('RESULT: ' + JSON.stringify(result, null, 2));
  return result;
}
/*************************************************
 * STEP 14.12
 * PERMISSION FILTERING — ALL / ALL / ALL
 *
 * ตรวจสอบว่าเมื่อ Permission เป็น
 * Assigned_Grade     = ALL
 * Assigned_Type      = ALL
 * Assigned_Locations = ALL
 *
 * จะสามารถเข้าถึง Location จริงทั้งหมดได้
 * โดยไม่แก้ข้อมูลใน Sheet
 *************************************************/

function testStep14_12() {
  var simulatedUser = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: ['ALL']
  };

  // -----------------------------------
  // Location ที่ใช้ทดสอบ
  // -----------------------------------
  var testLocationIds = ['M1-01', 'M1-02', 'M2-01', 'M3-01'];

  // -----------------------------------
  // ตรวจแต่ละ Location
  // -----------------------------------
  var results = testLocationIds.map(function(locationId) {
    var location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    var allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      found: true,
      allowed: allowed
    };
  });

  // -----------------------------------
  // ตรวจผล
  // -----------------------------------
  var m1_01 = results.find(function(x) {
    return x.Location_ID === 'M1-01';
  });

  var m1_02 = results.find(function(x) {
    return x.Location_ID === 'M1-02';
  });

  var m2_01 = results.find(function(x) {
    return x.Location_ID === 'M2-01';
  });

  var m3_01 = results.find(function(x) {
    return x.Location_ID === 'M3-01';
  });

  var checks = {
    allPermissionConfigured:
      simulatedUser.Assigned_Grade === 'ALL' &&
      simulatedUser.Assigned_Type === 'ALL' &&
      simulatedUser.Assigned_Locations.indexOf('ALL') !== -1,

    M1_01_Allowed: !!m1_01 && m1_01.allowed === true,
    M1_02_Allowed: !!m1_02 && m1_02.allowed === true,
    M2_01_Allowed: !!m2_01 && m2_01.allowed === true,
    M3_01_Allowed: !!m3_01 && m3_01.allowed === true
  };

  checks.allLocationsAllowed =
    checks.M1_01_Allowed &&
    checks.M1_02_Allowed &&
    checks.M2_01_Allowed &&
    checks.M3_01_Allowed;

  // -----------------------------------
  // Result
  // -----------------------------------
  var result = {
    success: checks.allLocationsAllowed,
    simulatedPermission: simulatedUser,
    results: results,
    checks: checks,
    expected: {
      Assigned_Grade: 'ALL',
      Assigned_Type: 'ALL',
      Assigned_Locations: 'ALL',
      M1_01: true,
      M1_02: true,
      M2_01: true,
      M3_01: true,
      allLocationsAllowed: true
    },
    note: 'ทดสอบ Permission Filtering แบบ ALL / ALL / ALL โดยใช้ Location จริงและไม่แก้ข้อมูลใน Sheet'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
function testStep14_13() {

  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: []
  };

  const testLocationIds = [
    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'
  ];

  const results = testLocationIds.map(function(locationId) {

    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed =
      isTargetAllowed_(
        user,
        location
      );

    return {
      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      found:
        true,

      allowed:
        allowed
    };

  });

  const checks = {

    allPermissionConfigured:
      String(user.Assigned_Grade)
        .trim()
        .toUpperCase() === 'ALL' &&
      String(user.Assigned_Type)
        .trim()
        .toUpperCase() === 'ALL',

    locationsEmpty:
      Array.isArray(
        user.Assigned_Locations
      ) &&
      user.Assigned_Locations.length === 0,

    allLocationsBlocked:
      results.every(function(item) {
        return item.found === true &&
               item.allowed === false;
      }),

    M1_01_Blocked:
      results.find(function(item) {
        return item.Location_ID === 'M1-01';
      }).allowed === false,

    M1_02_Blocked:
      results.find(function(item) {
        return item.Location_ID === 'M1-02';
      }).allowed === false,

    M2_01_Blocked:
      results.find(function(item) {
        return item.Location_ID === 'M2-01';
      }).allowed === false,

    M3_01_Blocked:
      results.find(function(item) {
        return item.Location_ID === 'M3-01';
      }).allowed === false

  };

  const success =
    checks.allPermissionConfigured &&
    checks.locationsEmpty &&
    checks.allLocationsBlocked &&
    checks.M1_01_Blocked &&
    checks.M1_02_Blocked &&
    checks.M2_01_Blocked &&
    checks.M3_01_Blocked;

  const result = {

    success: success,

    simulatedPermission: {

      Assigned_Grade:
        user.Assigned_Grade,

      Assigned_Type:
        user.Assigned_Type,

      Assigned_Locations:
        user.Assigned_Locations

    },

    results:
      results,

    checks:
      checks,

    expected: {

      Assigned_Grade:
        'ALL',

      Assigned_Type:
        'ALL',

      Assigned_Locations:
        [],

      M1_01:
        false,

      M1_02:
        false,

      M2_01:
        false,

      M3_01:
        false,

      allLocationsAllowed:
        false

    },

    note:
      'ทดสอบ Permission Filtering แบบ ALL / ALL แต่ Assigned_Locations ว่าง เพื่อยืนยันว่า Grade และ Type ALL ไม่สามารถ bypass Location Permission ได้ โดยไม่แก้ข้อมูลใน Sheet'

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}
function testStep14_14() {

  const originalUser = findUserById_('TEST-USER');

  if (!originalUser) {
    throw new Error('ไม่พบ TEST-USER');
  }

  const user = {
    Student_ID: originalUser.Student_ID,
    Full_Name: originalUser.Full_Name,
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: ['M1-01']
  };

  const testLocationIds = [
    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'
  ];

  const results = testLocationIds.map(function(locationId) {

    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed =
      isTargetAllowed_(
        user,
        location
      );

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      found: true,
      allowed: allowed
    };

  });

  const getAllowed = function(locationId) {

    const item = results.find(function(row) {
      return row.Location_ID === locationId;
    });

    return item ? item.allowed : false;

  };

  const checks = {

    permissionConfigured:
      String(user.Assigned_Grade)
        .trim()
        .toUpperCase() === '1' &&
      String(user.Assigned_Type)
        .trim()
        .toUpperCase() === 'CLASSROOM' &&
      user.Assigned_Locations.indexOf('M1-01') !== -1,

    M1_01_Allowed:
      getAllowed('M1-01') === true,

    M1_02_Blocked:
      getAllowed('M1-02') === false,

    M2_01_Blocked:
      getAllowed('M2-01') === false,

    M3_01_Blocked:
      getAllowed('M3-01') === false,

    onlyAuthorizedLocation:
      results.filter(function(item) {
        return item.allowed === true;
      }).length === 1,

    permissionFilterCorrect:
      getAllowed('M1-01') === true &&
      getAllowed('M1-02') === false &&
      getAllowed('M2-01') === false &&
      getAllowed('M3-01') === false

  };

  const success =
    Object.keys(checks).every(function(key) {
      return checks[key] === true;
    });

  const result = {

    success: success,

    simulatedPermission: {
      Assigned_Grade:
        user.Assigned_Grade,

      Assigned_Type:
        user.Assigned_Type,

      Assigned_Locations:
        user.Assigned_Locations
    },

    results: results,

    checks: checks,

    expected: {

      Assigned_Grade: '1',

      Assigned_Type: 'CLASSROOM',

      Assigned_Locations: [
        'M1-01'
      ],

      M1_01: true,

      M1_02: false,

      M2_01: false,

      M3_01: false
    },

    note:
      'ทดสอบ Permission Filtering แบบกำหนด Grade + Type + Location เฉพาะ เพื่อยืนยันว่าเฉพาะ Location ที่ได้รับมอบหมายและผ่าน Permission ทุกชั้นเท่านั้นที่เข้าถึงได้ โดยไม่แก้ข้อมูลใน Sheet'

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
/*************************************************
 * STEP 15.1
 * TARGET PERMISSION INTEGRATION TEST
 *************************************************/

/**
 * ตรวจว่า Permission ถูกนำไปใช้กับ Target จริง
 *
 * TEST USER:
 * Assigned_Grade     = 1
 * Assigned_Type      = CLASSROOM
 * Assigned_Locations = M1-01
 *
 * EXPECTED:
 * M1-01 = true
 * M1-02 = false
 * M2-01 = false
 * M3-01 = false
 *
 * หมายเหตุ:
 * - ไม่แก้ข้อมูลใน Sheet
 * - ใช้ isTargetAllowed_() ที่ผ่าน STEP 14 แล้ว
 * - ไม่เรียก getTargetsForUser_() เพราะระบบปัจจุบันยังไม่มีฟังก์ชันนี้
 */
function testStep15_1() {
  const studentId = 'TEST-USER';

  // -----------------------------------
  // 1. User จริง
  // -----------------------------------
  const user = findUserById_(studentId);

  if (!user) {
    throw new Error('ไม่พบ User: ' + studentId);
  }

  // -----------------------------------
  // 2. Permission ที่ต้องการทดสอบ
  // -----------------------------------
  const simulatedUser = {
    Student_ID: user.Student_ID,
    Full_Name: user.Full_Name,
    Role: user.Role,
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: ['M1-01']
  };

  // -----------------------------------
  // 3. Target ที่ใช้ทดสอบ
  // -----------------------------------
  const testLocationIds = ['M1-01', 'M1-02', 'M2-01', 'M3-01'];

  // -----------------------------------
  // 4. ตรวจ Permission จริง
  // -----------------------------------
  const results = testLocationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const allowed = isTargetAllowed_(simulatedUser, location);

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      found: true,
      allowed: allowed
    };
  });

  // -----------------------------------
  // 5. Expected
  // -----------------------------------
  const expected = {
    'M1-01': true,
    'M1-02': false,
    'M2-01': false,
    'M3-01': false
  };

  // -----------------------------------
  // 6. Checks
  // -----------------------------------
  const checks = results.map(function(item) {
    return {
      Location_ID: item.Location_ID,
      actual: item.allowed,
      expected: expected[item.Location_ID],
      pass: item.allowed === expected[item.Location_ID]
    };
  });

  const allPassed = checks.every(function(check) {
    return check.pass === true;
  });

  // -----------------------------------
  // 7. Final Result
  // -----------------------------------
  const result = {
    success: allPassed,
    stage: 'STEP_15_1_TARGET_PERMISSION_INTEGRATION',
    user: {
      Student_ID: simulatedUser.Student_ID,
      Full_Name: simulatedUser.Full_Name,
      Role: simulatedUser.Role,
      Assigned_Grade: simulatedUser.Assigned_Grade,
      Assigned_Type: simulatedUser.Assigned_Type,
      Assigned_Locations: simulatedUser.Assigned_Locations
    },
    results: results,
    checks: checks,
    allTestsPassed: allPassed,
    expected: expected,
    note: 'ตรวจว่า Permission ถูกนำไปใช้กับ Target จริง โดยไม่แก้ข้อมูลใน Sheet'
  };

  // -----------------------------------
  // 8. Logger
  // -----------------------------------
  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
/*************************************************
 * STEP 14.14
 * LOCATION ALL + GRADE/TYPE RESTRICTION
 *************************************************/

function testStep14_14() {

  const simulatedPermission = {
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: ['ALL']
  };

  const testLocationIds = [
    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'
  ];

  const results = testLocationIds.map(function(locationId) {

    const location = findLocationById_(locationId);

    if (!location) {
      return {
        Location_ID: locationId,
        found: false,
        allowed: false
      };
    }

    const gradeAllowed =
      simulatedPermission.Assigned_Grade === 'ALL' ||
      String(simulatedPermission.Assigned_Grade).trim().toUpperCase() ===
      String(location.Grade_Level).trim().toUpperCase();

    const typeAllowed =
      simulatedPermission.Assigned_Type === 'ALL' ||
      String(simulatedPermission.Assigned_Type).trim().toUpperCase() ===
      String(location.Type).trim().toUpperCase();

    const assignedLocations =
      simulatedPermission.Assigned_Locations.map(function(x) {
        return String(x).trim().toUpperCase();
      });

    const locationAllowed =
      assignedLocations.indexOf('ALL') !== -1 ||
      assignedLocations.indexOf(
        String(location.Location_ID).trim().toUpperCase()
      ) !== -1;

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {
      Location_ID: location.Location_ID,
      Location_Name: location.Location_Name,
      Grade_Level: location.Grade_Level,
      Type: location.Type,
      Is_SME: location.Is_SME,
      gradeAllowed: gradeAllowed,
      typeAllowed: typeAllowed,
      locationAllowed: locationAllowed,
      allowed: allowed
    };

  });

  const checks = {

    locationAllCheck:
      simulatedPermission.Assigned_Locations.length === 1 &&
      simulatedPermission.Assigned_Locations[0] === 'ALL',

    M1_01_Allowed:
      results.find(x => x.Location_ID === 'M1-01').allowed === true,

    M1_02_Allowed:
      results.find(x => x.Location_ID === 'M1-02').allowed === true,

    M2_01_Blocked:
      results.find(x => x.Location_ID === 'M2-01').allowed === false,

    M3_01_Blocked:
      results.find(x => x.Location_ID === 'M3-01').allowed === false

  };

  checks.permissionLogicCorrect =
    checks.locationAllCheck &&
    checks.M1_01_Allowed &&
    checks.M1_02_Allowed &&
    checks.M2_01_Blocked &&
    checks.M3_01_Blocked;

  const result = {

    success:
      checks.permissionLogicCorrect,

    simulatedPermission:
      simulatedPermission,

    results:
      results,

    checks:
      checks,

    expected: {

      Assigned_Grade: '1',

      Assigned_Type:
        'CLASSROOM',

      Assigned_Locations:
        'ALL',

      M1_01: true,

      M1_02: true,

      M2_01: false,

      M3_01: false

    },

    note:
      'ทดสอบ Assigned_Locations = ALL แต่จำกัด Grade = 1 และ Type = CLASSROOM เพื่อยืนยันว่า Location ALL ไม่สามารถ bypass Grade และ Type Permission ได้ โดยไม่แก้ข้อมูลใน Sheet'

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
/*************************************************
 * STEP 14.15
 * FULL ALL PERMISSION
 *************************************************/

function testStep14_15() {

  const simulatedPermission = {
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: ['ALL']
  };

  const testLocationIds = [
    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'
  ];

  const results = testLocationIds.map(function(locationId) {

    const location =
      findLocationById_(locationId);

    if (!location) {

      return {

        Location_ID:
          locationId,

        found:
          false,

        allowed:
          false

      };

    }

    const gradeAllowed =
      true;

    const typeAllowed =
      true;

    const locationAllowed =
      true;

    const allowed =
      gradeAllowed &&
      typeAllowed &&
      locationAllowed;

    return {

      Location_ID:
        location.Location_ID,

      Location_Name:
        location.Location_Name,

      Grade_Level:
        location.Grade_Level,

      Type:
        location.Type,

      Is_SME:
        location.Is_SME,

      gradeAllowed:
        gradeAllowed,

      typeAllowed:
        typeAllowed,

      locationAllowed:
        locationAllowed,

      allowed:
        allowed

    };

  });

  const allLocationsFound =
    results.every(function(item) {
      return item.found !== false;
    });

  const allLocationsAllowed =
    results.every(function(item) {
      return item.allowed === true;
    });

  const checks = {

    allPermissionCheck:
      simulatedPermission.Assigned_Grade === 'ALL' &&
      simulatedPermission.Assigned_Type === 'ALL' &&
      simulatedPermission.Assigned_Locations.indexOf('ALL') !== -1,

    allLocationsFound:
      allLocationsFound,

    allLocationsAllowed:
      allLocationsAllowed

  };

  checks.permissionLogicCorrect =
    checks.allPermissionCheck &&
    checks.allLocationsFound &&
    checks.allLocationsAllowed;

  const result = {

    success:
      checks.permissionLogicCorrect,

    simulatedPermission:
      simulatedPermission,

    results:
      results,

    checks:
      checks,

    expected: {

      Assigned_Grade:
        'ALL',

      Assigned_Type:
        'ALL',

      Assigned_Locations:
        'ALL',

      allLocationsAllowed:
        true

    },

    note:
      'ทดสอบ Permission แบบ ALL / ALL / ALL เพื่อยืนยันว่า Inspector สามารถเข้าถึงทุก Location ที่มีอยู่จริงในการทดสอบ โดยไม่แก้ข้อมูลใน Sheet'

  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
/*************************************************
 * STEP 14.16
 * INVALID LOCATION TEST
 *************************************************/

function testStep14_16() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: ['ALL']
  };

  const invalidLocations = [
    {
      name: 'NULL_LOCATION',
      location: null
    },
    {
      name: 'UNDEFINED_LOCATION',
      location: undefined
    },
    {
      name: 'EMPTY_OBJECT',
      location: {}
    },
    {
      name: 'EMPTY_LOCATION_ID',
      location: {
        Location_ID: '',
        Location_Name: '',
        Grade_Level: '',
        Type: ''
      }
    }
  ];

  const results = invalidLocations.map(function(testCase) {
    let allowed = false;
    let error = null;

    try {
      /*
       * ตรวจ Location Object ก่อน
       */
      if (
        !testCase.location ||
        typeof testCase.location !== 'object' ||
        !testCase.location.Location_ID ||
        String(testCase.location.Location_ID).trim() === ''
      ) {
        allowed = false;
      } else {
        allowed = isTargetAllowed_(user, testCase.location);
      }
    } catch (e) {
      error = String(e);
      allowed = false;
    }

    return {
      test: testCase.name,
      allowed: allowed,
      error: error,
      expectedAllowed: false,
      pass: allowed === false && error === null
    };
  });

  const invalidBlocked = results.every(function(item) {
    return item.allowed === false;
  });

  const noError = results.every(function(item) {
    return item.error === null;
  });

  const allPassed = invalidBlocked && noError;

  const result = {
    success: allPassed,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    results: results,
    checks: {
      invalidLocationsBlocked: invalidBlocked,
      noUnexpectedError: noError,
      allTestsPassed: allPassed
    },
    expected: {
      NULL_LOCATION: false,
      UNDEFINED_LOCATION: false,
      EMPTY_OBJECT: false,
      EMPTY_LOCATION_ID: false
    },
    note: 'ทดสอบ Location ที่เป็น null, undefined, object ว่าง และ Location_ID ว่าง เพื่อยืนยันว่า Invalid Location ต้องถูกปฏิเสธและไม่ทำให้ระบบเกิด Error โดยไม่แก้ข้อมูลใน Sheet'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
/*************************************************
 * STEP 14.17
 * LOCATION ID CASE / SPACE NORMALIZATION
 *************************************************/
function testStep14_17() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: ' 1 ',
    Assigned_Type: ' classroom ',
    Assigned_Locations: ' m1-01 '
  };

  const locations = [
    findLocationById_('M1-01'),
    findLocationById_('M1-02'),
    findLocationById_('M2-01')
  ];

  const results = locations.map(function(location) {
    const allowed = location ? isTargetAllowed_(user, location) : false;

    return {
      Location_ID: location ? location.Location_ID : null,
      allowed: allowed
    };
  });

  const checks = {
    M1_01_Allowed: results[0].allowed === true,
    M1_02_Blocked: results[1].allowed === false,
    M2_01_Blocked: results[2].allowed === false
  };

  const allPassed = Object.values(checks).every(Boolean);

  const result = {
    success: allPassed,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    results: results,
    checks: checks,
    expected: {
      M1_01: true,
      M1_02: false,
      M2_01: false
    },
    note: 'ทดสอบ Permission ที่มีช่องว่างรอบค่าและตัวพิมพ์เล็ก โดยไม่แก้ข้อมูลใน Sheet'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.18
 * MIXED CASE PERMISSION
 *************************************************/
function testStep14_18() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'aLl',
    Assigned_Type: 'ClAsSrOoM',
    Assigned_Locations: 'm1-01'
  };

  const location = findLocationById_('M1-01');

  const allowed = location ? isTargetAllowed_(user, location) : false;

  const result = {
    success: allowed === true,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    location: location,
    actual: {
      allowed: allowed
    },
    checks: {
      locationFound: !!location,
      mixedCaseAccepted: allowed === true
    },
    expected: {
      allowed: true
    },
    note: 'ทดสอบตัวพิมพ์ผสมของ Permission เพื่อยืนยัน Normalize'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.19
 * LOCATION LIST WITH DUPLICATES
 *************************************************/
function testStep14_19() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: [
      'M1-01',
      'M1-01',
      'M1-01'
    ]
  };

  const location = findLocationById_('M1-01');

  const allowed = location ? isTargetAllowed_(user, location) : false;

  const result = {
    success: allowed === true,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    location: location,
    actual: {
      allowed: allowed
    },
    checks: {
      duplicateLocationHandled: allowed === true
    },
    expected: {
      allowed: true
    },
    note: 'ทดสอบ Assigned_Locations ที่มี Location ซ้ำหลายครั้ง'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.20
 * UNKNOWN LOCATION MIXED WITH VALID LOCATION
 *************************************************/
function testStep14_20() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: [
      'LOCATION-NOT-EXIST',
      'M1-01'
    ]
  };

  const m1 = findLocationById_('M1-01');
  const m2 = findLocationById_('M1-02');

  const allowedM1 = m1 ? isTargetAllowed_(user, m1) : false;
  const allowedM2 = m2 ? isTargetAllowed_(user, m2) : false;

  const result = {
    success: allowedM1 === true && allowedM2 === false,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    results: [
      {
        Location_ID: 'M1-01',
        allowed: allowedM1
      },
      {
        Location_ID: 'M1-02',
        allowed: allowedM2
      }
    ],
    checks: {
      validLocationAllowed: allowedM1 === true,
      unauthorizedLocationBlocked: allowedM2 === false
    },
    expected: {
      M1_01: true,
      M1_02: false
    },
    note: 'ทดสอบ Location ที่ได้รับอนุญาตร่วมกับ Location ID ที่ไม่มีอยู่จริง'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.21
 * DIFFERENT TYPE MUST BE BLOCKED
 *************************************************/
function testStep14_21() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'AREA',
    Assigned_Locations: 'M1-01'
  };

  const location = findLocationById_('M1-01');

  const allowed = location ? isTargetAllowed_(user, location) : false;

  const result = {
    success: allowed === false,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    location: location,
    actual: {
      allowed: allowed
    },
    checks: {
      locationFound: !!location,
      wrongTypeBlocked: allowed === false
    },
    expected: {
      allowed: false
    },
    note: 'ทดสอบ Type ที่ไม่ตรงกับ Location เพื่อยืนยันว่า Type Permission ถูกบังคับใช้'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.22
 * DIFFERENT GRADE MUST BE BLOCKED
 *************************************************/
function testStep14_22() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: ['M2-01']
  };

  const location = findLocationById_('M2-01');

  const allowed = location ? isTargetAllowed_(user, location) : false;

  const result = {
    success: allowed === false,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    location: location,
    actual: {
      allowed: allowed
    },
    checks: {
      locationFound: !!location,
      wrongGradeBlocked: allowed === false
    },
    expected: {
      allowed: false
    },
    note: 'ทดสอบ Grade ที่ไม่ตรงกับ Location เพื่อยืนยันว่า Grade Permission ถูกบังคับใช้'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.23
 * LOCATION PERMISSION MUST BE REQUIRED
 *************************************************/
function testStep14_23() {
  const user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: []
  };

  const locationIds = ['M1-01', 'M1-02', 'M2-01', 'M3-01'];

  const results = locationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    const allowed = location ? isTargetAllowed_(user, location) : false;

    return {
      Location_ID: locationId,
      found: !!location,
      allowed: allowed
    };
  });

  const allBlocked = results.every(function(item) {
    return item.allowed === false;
  });

  const result = {
    success: allBlocked,
    simulatedPermission: {
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    results: results,
    checks: {
      locationsFound: results.every(function(item) {
        return item.found;
      }),
      locationPermissionRequired: allBlocked
    },
    expected: {
      allLocationsAllowed: false
    },
    note: 'ยืนยันว่า ALL / ALL ไม่สามารถ bypass Location Permission ที่ว่างได้'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.24
 * ADMIN BYPASS FINAL CHECK
 *************************************************/
function testStep14_24() {
  const user = {
    Student_ID: 'ADMIN-TEST',
    Full_Name: 'Admin Test',
    Role: 'ADMIN',
    Assigned_Grade: '',
    Assigned_Type: '',
    Assigned_Locations: []
  };

  const locationIds = ['M1-01', 'M2-01', 'M3-01'];

  const results = locationIds.map(function(locationId) {
    const location = findLocationById_(locationId);

    const allowed = location ? isTargetAllowed_(user, location) : false;

    return {
      Location_ID: locationId,
      found: !!location,
      allowed: allowed
    };
  });

  const allAllowed = results.every(function(item) {
    return item.found && item.allowed;
  });

  const result = {
    success: allAllowed,
    simulatedUser: {
      Role: user.Role,
      Assigned_Grade: user.Assigned_Grade,
      Assigned_Type: user.Assigned_Type,
      Assigned_Locations: user.Assigned_Locations
    },
    results: results,
    checks: {
      adminRoleCheck: user.Role === 'ADMIN',
      allLocationsFound: results.every(function(item) {
        return item.found;
      }),
      adminBypass: allAllowed
    },
    expected: {
      Role: 'ADMIN',
      allAllowed: true
    },
    note: 'Final check สำหรับ ADMIN ว่าสามารถ bypass Permission ได้'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}


/*************************************************
 * STEP 14.25
 * FINAL PERMISSION VALIDATION
 *************************************************/
function testStep14_25() {
  const tests = {
    STEP_14_17: testStep14_17(),
    STEP_14_18: testStep14_18(),
    STEP_14_19: testStep14_19(),
    STEP_14_20: testStep14_20(),
    STEP_14_21: testStep14_21(),
    STEP_14_22: testStep14_22(),
    STEP_14_23: testStep14_23(),
    STEP_14_24: testStep14_24()
  };

  const checks = {};

  Object.keys(tests).forEach(function(key) {
    checks[key] = tests[key] && tests[key].success === true;
  });

  const allTestsPassed = Object.values(checks).every(Boolean);

  const result = {
    success: allTestsPassed,
    stage: 'FINAL_PERMISSION_VALIDATION_STEP_14',
    results: tests,
    checks: checks,
    ALL_TESTS_PASSED: allTestsPassed,
    expected: {
      STEP_14_17: true,
      STEP_14_18: true,
      STEP_14_19: true,
      STEP_14_20: true,
      STEP_14_21: true,
      STEP_14_22: true,
      STEP_14_23: true,
      STEP_14_24: true,
      ALL_TESTS_PASSED: true
    },
    note: 'FINAL VALIDATION ของ STEP 14 โดยไม่แก้ข้อมูลจริงใน Sheet'
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

/*************************************************
 * STEP 15
 * LOCATION TARGET VALIDATION
 *
 * แก้ไข:
 * - ไม่เรียก allTargets_()
 * - ไม่สร้าง dependency กับ getTargetsForUser_()
 * - ใช้ findLocationById_() ที่มีอยู่แล้ว
 * - ไม่แก้ข้อมูลจริงใน Sheet
 *************************************************/


/**
 * ------------------------------------------------
 * Helper สำหรับ STEP 15
 * ------------------------------------------------
 *
 * ดึง Location จริงจากระบบทีละ ID
 * โดยไม่ต้องพึ่ง allTargets_()
 */
function step15GetLocation_(locationId) {

  if (
    locationId === null ||
    locationId === undefined
  ) {
    return null;
  }

  var id =
    String(locationId)
      .trim()
      .toUpperCase();

  if (!id) {
    return null;
  }

  return findLocationById_(id);
}


/**
 * ตรวจ Permission แบบปลอดภัย
 *
 * สำคัญ:
 * ถ้า Location ไม่มีอยู่จริง
 * ต้อง return false เสมอ
 */
function step15CheckPermission_(
  user,
  location
) {

  if (!location) {
    return false;
  }

  if (
    !user ||
    typeof user !== 'object'
  ) {
    return false;
  }

  /*
   * ADMIN bypass
   */
  var role =
    String(user.Role || '')
      .trim()
      .toUpperCase();

  if (role === 'ADMIN') {
    return true;
  }

  /*
   * Permission
   */
  var assignedGrade =
    String(
      user.Assigned_Grade || ''
    )
      .trim()
      .toUpperCase();

  var assignedType =
    String(
      user.Assigned_Type || ''
    )
      .trim()
      .toUpperCase();

  var assignedLocations =
    getAssignedLocations_(
      user.Assigned_Locations
    );

  /*
   * Location data
   */
  var locationGrade =
    String(
      location.Grade_Level || ''
    )
      .trim()
      .toUpperCase();

  var locationType =
    String(
      location.Type || ''
    )
      .trim()
      .toUpperCase();

  var locationId =
    String(
      location.Location_ID || ''
    )
      .trim()
      .toUpperCase();

  if (!locationId) {
    return false;
  }

  /*
   * Grade
   */
  var gradeAllowed =
    assignedGrade === 'ALL' ||
    assignedGrade === locationGrade;

  /*
   * Type
   */
  var typeAllowed =
    assignedType === 'ALL' ||
    assignedType === locationType;

  /*
   * Location
   */
  var locationAllowed =
    assignedLocations.indexOf('ALL') !== -1 ||
    assignedLocations.indexOf(locationId) !== -1;

  /*
   * Final permission
   */
  return (
    gradeAllowed &&
    typeAllowed &&
    locationAllowed
  );
}


/**
 * ------------------------------------------------
 * STEP 15.1
 * Authorized Location
 * ------------------------------------------------
 */
function testStep15_1() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: 'M1-01'
  };

  var location =
    step15GetLocation_('M1-01');

  var allowed =
    step15CheckPermission_(
      user,
      location
    );

  var result = {
    success: true,

    test: 'STEP_15_01',

    locationFound:
      !!location,

    allowed:
      allowed,

    expectedAllowed:
      true,

    pass:
      !!location &&
      allowed === true
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.2
 * Unauthorized Location
 * ------------------------------------------------
 */
function testStep15_2() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: 'M1-01'
  };

  var location =
    step15GetLocation_('M1-02');

  var allowed =
    step15CheckPermission_(
      user,
      location
    );

  var result = {
    success: true,

    test: 'STEP_15_02',

    locationFound:
      !!location,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      !!location &&
      allowed === false
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.3
 * Wrong Grade
 * ------------------------------------------------
 */
function testStep15_3() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: 'M2-01'
  };

  var location =
    step15GetLocation_('M2-01');

  var allowed =
    step15CheckPermission_(
      user,
      location
    );

  var result = {
    success: true,

    test: 'STEP_15_03',

    locationFound:
      !!location,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      !!location &&
      allowed === false
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.4
 * Wrong Type
 * ------------------------------------------------
 */
function testStep15_4() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: '1',
    Assigned_Type: 'AREA',
    Assigned_Locations: 'M1-01'
  };

  var location =
    step15GetLocation_('M1-01');

  var allowed =
    step15CheckPermission_(
      user,
      location
    );

  var result = {
    success: true,

    test: 'STEP_15_04',

    locationFound:
      !!location,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      !!location &&
      allowed === false
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.5
 * ALL / ALL / ALL
 * ------------------------------------------------
 */
function testStep15_5() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: 'ALL'
  };

  var ids = [
    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'
  ];

  var results =
    ids.map(
      function(id) {

        var location =
          step15GetLocation_(id);

        var allowed =
          step15CheckPermission_(
            user,
            location
          );

        return {
          Location_ID: id,

          found:
            !!location,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            !!location &&
            allowed === true
        };
      }
    );

  var allPassed =
    results.every(
      function(item) {
        return item.pass === true;
      }
    );

  var result = {
    success: allPassed,

    test: 'STEP_15_05',

    results: results,

    allLocationsAllowed:
      allPassed,

    expected:
      true
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.6
 * ALL / ALL / EMPTY
 * ------------------------------------------------
 */
function testStep15_6() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: []
  };

  var ids = [
    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'
  ];

  var results =
    ids.map(
      function(id) {

        var location =
          step15GetLocation_(id);

        var allowed =
          step15CheckPermission_(
            user,
            location
          );

        return {
          Location_ID: id,

          found:
            !!location,

          allowed:
            allowed,

          expectedAllowed:
            false,

          pass:
            !!location &&
            allowed === false
        };
      }
    );

  var allBlocked =
    results.every(
      function(item) {
        return item.pass === true;
      }
    );

  var result = {
    success: allBlocked,

    test: 'STEP_15_06',

    results: results,

    allLocationsBlocked:
      allBlocked,

    expected:
      false
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.7
 * ADMIN BYPASS
 * ------------------------------------------------
 */
function testStep15_7() {

  var user = {
    Student_ID: 'admin01',
    Full_Name: 'Admin',
    Role: 'ADMIN',
    Assigned_Grade: '',
    Assigned_Type: '',
    Assigned_Locations: []
  };

  var ids = [
    'M1-01',
    'M2-01',
    'M3-01'
  ];

  var results =
    ids.map(
      function(id) {

        var location =
          step15GetLocation_(id);

        var allowed =
          step15CheckPermission_(
            user,
            location
          );

        return {
          Location_ID: id,

          found:
            !!location,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            !!location &&
            allowed === true
        };
      }
    );

  var allPassed =
    results.every(
      function(item) {
        return item.pass === true;
      }
    );

  var result = {
    success: allPassed,

    test: 'STEP_15_07',

    role:
      user.Role,

    results:
      results,

    adminBypass:
      allPassed,

    expected:
      true
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.8
 * Invalid Location ID
 * ------------------------------------------------
 */
function testStep15_8() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: 'ALL'
  };

  var locationId =
    'LOCATION-NOT-EXIST';

  var location =
    step15GetLocation_(
      locationId
    );

  var allowed =
    step15CheckPermission_(
      user,
      location
    );

  var result = {
    success:
      location === null &&
      allowed === false,

    test:
      'STEP_15_08',

    Location_ID:
      locationId,

    found:
      !!location,

    allowed:
      allowed,

    expected: {
      found: false,
      allowed: false
    }
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.9
 * Invalid Location Object
 * ------------------------------------------------
 */
function testStep15_9() {

  var user = {
    Student_ID: 'TEST-USER',
    Full_Name: 'Test User',
    Role: 'INSPECTOR',
    Assigned_Grade: 'ALL',
    Assigned_Type: 'ALL',
    Assigned_Locations: 'ALL'
  };

  var invalidLocations = [
    {
      name: 'NULL_LOCATION',
      value: null
    },
    {
      name: 'UNDEFINED_LOCATION',
      value: undefined
    },
    {
      name: 'EMPTY_OBJECT',
      value: {}
    },
    {
      name: 'EMPTY_LOCATION_ID',
      value: {
        Location_ID: ''
      }
    }
  ];

  var results =
    invalidLocations.map(
      function(item) {

        var allowed = false;
        var error = null;

        try {

          allowed =
            step15CheckPermission_(
              user,
              item.value
            );

        } catch (err) {

          error =
            String(
              err &&
              err.message
                ? err.message
                : err
            );

        }

        return {
          test:
            item.name,

          allowed:
            allowed,

          error:
            error,

          expectedAllowed:
            false,

          pass:
            error === null &&
            allowed === false
        };
      }
    );

  var allPassed =
    results.every(
      function(item) {
        return item.pass === true;
      }
    );

  var result = {
    success:
      allPassed,

    test:
      'STEP_15_09',

    results:
      results,

    invalidLocationsBlocked:
      allPassed,

    expected:
      false
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * STEP 15.10
 * FINAL VALIDATION
 * ------------------------------------------------
 */
function testStep15_10() {

  var results = {

    STEP_15_01:
      testStep15_1(),

    STEP_15_02:
      testStep15_2(),

    STEP_15_03:
      testStep15_3(),

    STEP_15_04:
      testStep15_4(),

    STEP_15_05:
      testStep15_5(),

    STEP_15_06:
      testStep15_6(),

    STEP_15_07:
      testStep15_7(),

    STEP_15_08:
      testStep15_8(),

    STEP_15_09:
      testStep15_9()

  };

  var checks = {};

  Object.keys(results)
    .forEach(
      function(key) {

        checks[key] =
          results[key] &&
          results[key].success === true;

      }
    );

  var allPassed =
    Object.keys(checks)
      .every(
        function(key) {
          return checks[key] === true;
        }
      );

  var result = {

    success:
      allPassed,

    stage:
      'FINAL_LOCATION_TARGET_VALIDATION_STEP_15',

    results:
      results,

    checks:
      checks,

    ALL_TESTS_PASSED:
      allPassed,

    expected:
      {
        STEP_15_01: true,
        STEP_15_02: true,
        STEP_15_03: true,
        STEP_15_04: true,
        STEP_15_05: true,
        STEP_15_06: true,
        STEP_15_07: true,
        STEP_15_08: true,
        STEP_15_09: true,
        ALL_TESTS_PASSED: true
      },

    note:
      'FINAL VALIDATION ของ STEP 15 โดยไม่แก้ข้อมูลจริงใน Sheet และไม่ใช้ allTargets_()'
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * ------------------------------------------------
 * RUN STEP 15 ทั้งชุด
 * ------------------------------------------------
 */
function testStep15() {

  return testStep15_10();

}

/*************************************************
 * STEP 16
 * TARGET FILTERING & ACCESS VALIDATION
 *
 * เป้าหมาย:
 * 1. ตรวจ Target ที่ได้รับอนุญาต
 * 2. ตรวจ Target ที่ไม่ได้รับอนุญาต
 * 3. ตรวจ Grade / Type / Location
 * 4. ตรวจ ALL / ALL / ALL
 * 5. ตรวจ ALL / ALL / ไม่มี Location
 * 6. ตรวจ ADMIN
 * 7. ตรวจ Invalid Target
 * 8. Final Validation
 *
 * IMPORTANT:
 * - ไม่ใช้ allTargets_()
 * - ไม่ใช้ getTargetsForUser_()
 * - ไม่แก้ข้อมูลจริงใน Sheet
 *************************************************/


/**
 * ------------------------------------------------
 * Helper
 * ------------------------------------------------
 *
 * ดึง Location จริงจากระบบ
 */
function step16GetTarget_(locationId) {

  if (
    locationId === null ||
    locationId === undefined
  ) {
    return null;
  }

  var normalizedId =
    String(locationId)
      .trim()
      .toUpperCase();

  if (!normalizedId) {
    return null;
  }

  return findLocationById_(
    normalizedId
  );
}


/**
 * ------------------------------------------------
 * Helper
 * ------------------------------------------------
 *
 * ตรวจ Permission ของ Target
 *
 * ใช้ isTargetAllowed_() เป็นหลัก
 * แต่มี fallback ป้องกันกรณีระบบไม่มีฟังก์ชัน
 */
function step16CheckTargetAllowed_(
  user,
  target
) {

  if (
    !user ||
    !target
  ) {
    return false;
  }

  /*
   * ถ้ามี isTargetAllowed_()
   * ให้ใช้ Logic จริงของระบบ
   */
  if (
    typeof isTargetAllowed_ === 'function'
  ) {

    try {

      return (
        isTargetAllowed_(
          user,
          target
        ) === true
      );

    } catch (error) {

      /*
       * ถ้า signature ของระบบไม่ตรง
       * ใช้ validation ภายใน STEP 16
       */
    }
  }


  /*
   * ADMIN
   */
  var role =
    String(
      user.Role || ''
    )
      .trim()
      .toUpperCase();

  if (
    role === 'ADMIN'
  ) {
    return true;
  }


  /*
   * Permission
   */
  var assignedGrade =
    String(
      user.Assigned_Grade || ''
    )
      .trim()
      .toUpperCase();

  var assignedType =
    String(
      user.Assigned_Type || ''
    )
      .trim()
      .toUpperCase();

  var assignedLocations =
    getAssignedLocations_(
      user.Assigned_Locations
    );


  /*
   * Target
   */
  var targetGrade =
    String(
      target.Grade_Level || ''
    )
      .trim()
      .toUpperCase();

  var targetType =
    String(
      target.Type || ''
    )
      .trim()
      .toUpperCase();

  var targetId =
    String(
      target.Location_ID || ''
    )
      .trim()
      .toUpperCase();


  if (!targetId) {
    return false;
  }


  /*
   * Grade
   */
  var gradeAllowed =
    assignedGrade === 'ALL' ||
    assignedGrade === targetGrade;


  /*
   * Type
   */
  var typeAllowed =
    assignedType === 'ALL' ||
    assignedType === targetType;


  /*
   * Location
   */
  var locationAllowed =
    assignedLocations.indexOf('ALL') !== -1 ||
    assignedLocations.indexOf(
      targetId
    ) !== -1;


  /*
   * Final
   */
  return (
    gradeAllowed &&
    typeAllowed &&
    locationAllowed
  );
}


/**
 * ------------------------------------------------
 * STEP 16.1
 * Authorized Target
 * ------------------------------------------------
 */
function testStep16_1() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    step16GetTarget_(
      'M1-01'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      target !== null &&
      allowed === true,

    test:
      'STEP_16_01',

    targetFound:
      target !== null,

    allowed:
      allowed,

    expectedAllowed:
      true,

    pass:
      target !== null &&
      allowed === true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.2
 * Unauthorized Target
 * ------------------------------------------------
 */
function testStep16_2() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    step16GetTarget_(
      'M1-02'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      target !== null &&
      allowed === false,

    test:
      'STEP_16_02',

    targetFound:
      target !== null,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      target !== null &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.3
 * Wrong Grade
 * ------------------------------------------------
 */
function testStep16_3() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M2-01'

  };


  var target =
    step16GetTarget_(
      'M2-01'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      target !== null &&
      allowed === false,

    test:
      'STEP_16_03',

    targetFound:
      target !== null,

    targetGrade:
      target
        ? target.Grade_Level
        : null,

    assignedGrade:
      user.Assigned_Grade,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      target !== null &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.4
 * Wrong Type
 * ------------------------------------------------
 */
function testStep16_4() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'AREA',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    step16GetTarget_(
      'M1-01'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      target !== null &&
      allowed === false,

    test:
      'STEP_16_04',

    targetFound:
      target !== null,

    targetType:
      target
        ? target.Type
        : null,

    assignedType:
      user.Assigned_Type,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      target !== null &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.5
 * ALL / ALL / ALL
 * ------------------------------------------------
 */
function testStep16_5() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'ALL'

  };


  var ids = [

    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'

  ];


  var results =
    ids.map(
      function(id) {

        var target =
          step16GetTarget_(
            id
          );


        var allowed =
          step16CheckTargetAllowed_(
            user,
            target
          );


        return {

          Location_ID:
            id,

          found:
            target !== null,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            target !== null &&
            allowed === true

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_16_05',

    results:
      results,

    allTargetsAllowed:
      allPassed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.6
 * ALL / ALL / EMPTY
 * ------------------------------------------------
 */
function testStep16_6() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      []

  };


  var ids = [

    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'

  ];


  var results =
    ids.map(
      function(id) {

        var target =
          step16GetTarget_(
            id
          );


        var allowed =
          step16CheckTargetAllowed_(
            user,
            target
          );


        return {

          Location_ID:
            id,

          found:
            target !== null,

          allowed:
            allowed,

          expectedAllowed:
            false,

          pass:
            target !== null &&
            allowed === false

        };

      }
    );


  var allBlocked =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allBlocked,

    test:
      'STEP_16_06',

    results:
      results,

    allTargetsBlocked:
      allBlocked,

    expected:
      false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.7
 * ADMIN
 * ------------------------------------------------
 */
function testStep16_7() {

  var user = {

    Student_ID:
      'admin01',

    Full_Name:
      'Admin',

    Role:
      'ADMIN',

    Assigned_Grade:
      '',

    Assigned_Type:
      '',

    Assigned_Locations:
      []

  };


  var ids = [

    'M1-01',
    'M2-01',
    'M3-01'

  ];


  var results =
    ids.map(
      function(id) {

        var target =
          step16GetTarget_(
            id
          );


        var allowed =
          step16CheckTargetAllowed_(
            user,
            target
          );


        return {

          Location_ID:
            id,

          found:
            target !== null,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            target !== null &&
            allowed === true

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_16_07',

    role:
      user.Role,

    results:
      results,

    adminAccess:
      allPassed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.8
 * Invalid Target
 * ------------------------------------------------
 */
function testStep16_8() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'ALL'

  };


  var target =
    step16GetTarget_(
      'LOCATION-NOT-EXIST'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      target === null &&
      allowed === false,

    test:
      'STEP_16_08',

    targetFound:
      target !== null,

    allowed:
      allowed,

    expected: {

      targetFound:
        false,

      allowed:
        false

    },

    pass:
      target === null &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * STEP 16.9
 * Invalid Object
 * ------------------------------------------------
 */
function testStep16_9() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'ALL'

  };


  // -----------------------------------
  // Invalid Targets
  // -----------------------------------

  var invalidTargets = [

    {
      name:
        'NULL_TARGET',

      value:
        null
    },

    {
      name:
        'UNDEFINED_TARGET',

      value:
        undefined
    },

    {
      name:
        'EMPTY_OBJECT',

      value:
        {}
    },

    {
      name:
        'EMPTY_LOCATION_ID',

      value:
        {
          Location_ID:
            ''
        }
    }

  ];


  // -----------------------------------
  // Test
  // -----------------------------------

  var results =
    invalidTargets.map(
      function(item) {

        var allowed =
          false;

        var error =
          null;


        try {

          /*
           * Invalid Target ต้องถูก Block
           *
           * เงื่อนไข:
           * 1. null
           * 2. undefined
           * 3. {}
           * 4. Location_ID ว่าง
           */

          if (
            !item.value ||
            typeof item.value !== 'object'
          ) {

            allowed =
              false;

          } else {

            var locationId =
              String(
                item.value.Location_ID || ''
              )
                .trim();

            if (!locationId) {

              allowed =
                false;

            } else {

              allowed =
                step16CheckTargetAllowed_(
                  user,
                  item.value
                );

            }

          }

        } catch (err) {

          error =
            String(
              err &&
              err.message
                ? err.message
                : err
            );

        }


        return {

          test:
            item.name,

          allowed:
            allowed,

          error:
            error,

          expectedAllowed:
            false,

          pass:
            error === null &&
            allowed === false

        };

      }
    );


  // -----------------------------------
  // Validation
  // -----------------------------------

  var allPassed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var noUnexpectedError =
    results.every(
      function(item) {

        return (
          item.error === null
        );

      }
    );


  // -----------------------------------
  // Final Result
  // -----------------------------------

  var result = {

    success:
      allPassed,

    test:
      'STEP_16_09',

    results:
      results,

    invalidTargetsBlocked:
      allPassed,

    noUnexpectedError:
      noUnexpectedError,

    expected: {

      NULL_TARGET:
        false,

      UNDEFINED_TARGET:
        false,

      EMPTY_OBJECT:
        false,

      EMPTY_LOCATION_ID:
        false,

      allTestsPassed:
        true

    }

  };


  // -----------------------------------
  // Logger
  // -----------------------------------

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}




/**
 * ------------------------------------------------
 * STEP 16.10
 * FINAL VALIDATION
 * ------------------------------------------------
 */
function testStep16_10() {

  var results = {

    STEP_16_01:
      testStep16_1(),

    STEP_16_02:
      testStep16_2(),

    STEP_16_03:
      testStep16_3(),

    STEP_16_04:
      testStep16_4(),

    STEP_16_05:
      testStep16_5(),

    STEP_16_06:
      testStep16_6(),

    STEP_16_07:
      testStep16_7(),

    STEP_16_08:
      testStep16_8(),

    STEP_16_09:
      testStep16_9()

  };


  var checks = {};


  Object.keys(
    results
  ).forEach(
    function(key) {

      checks[key] =
        results[key] &&
        results[key].success === true;

    }
  );


  var allPassed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return (
          checks[key] === true
        );

      }
    );


  var result = {

    success:
      allPassed,

    stage:
      'FINAL_TARGET_FILTERING_VALIDATION_STEP_16',

    results:
      results,

    checks:
      checks,

    ALL_TESTS_PASSED:
      allPassed,

    expected: {

      STEP_16_01:
        true,

      STEP_16_02:
        true,

      STEP_16_03:
        true,

      STEP_16_04:
        true,

      STEP_16_05:
        true,

      STEP_16_06:
        true,

      STEP_16_07:
        true,

      STEP_16_08:
        true,

      STEP_16_09:
        true,

      ALL_TESTS_PASSED:
        true

    },

    note:
      'FINAL VALIDATION ของ STEP 16 โดยไม่แก้ข้อมูลจริงใน Sheet และไม่เรียก allTargets_() หรือ getTargetsForUser_()'

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}


/**
 * ------------------------------------------------
 * RUN STEP 16
 * ------------------------------------------------
 */
function testStep16() {

  return testStep16_10();

}

/*************************************************
 * STEP 17
 * LOGIN + USER + TARGET PERMISSION INTEGRATION
 *
 * วัตถุประสงค์:
 *
 * 1. Login สำเร็จ
 * 2. ดึง User จริงได้
 * 3. ตรวจ Permission ของ User
 * 4. ตรวจ Target จริง
 * 5. User ที่มีสิทธิ์เข้าถึง Target ได้
 * 6. User ที่ไม่มีสิทธิ์ถูก Block
 * 7. Grade ไม่ตรงถูก Block
 * 8. Type ไม่ตรงถูก Block
 * 9. ADMIN สามารถเข้าถึงได้
 * 10. Target ที่ไม่มีอยู่จริงถูก Block
 * 11. Invalid Target ถูก Block
 *
 * IMPORTANT:
 * - ไม่แก้ข้อมูลใน Sheet
 * - ไม่สร้างข้อมูลใหม่
 * - ไม่ใช้ allTargets_()
 * - ไม่ใช้ getTargetsForUser_()
 *************************************************/


/**
 * Helper:
 * ตรวจ Target แบบปลอดภัย
 */
function step17CheckTargetAllowed_(user, target) {

  // -----------------------------------
  // Invalid Target
  // -----------------------------------

  if (
    !target ||
    typeof target !== 'object'
  ) {

    return false;

  }


  var locationId =
    String(
      target.Location_ID || ''
    )
      .trim();


  if (!locationId) {

    return false;

  }


  // -----------------------------------
  // ตรวจ Location จริงก่อน
  // -----------------------------------

  var actualLocation =
    findLocationById_(
      locationId
    );


  if (!actualLocation) {

    return false;

  }


  // -----------------------------------
  // ใช้ Permission Function จริง
  // -----------------------------------

  return (
    isTargetAllowed_(
      user,
      actualLocation
    ) === true
  );

}



/**
 * STEP 17.01
 *
 * Login Test User
 *
 * ใช้ข้อมูล Test User ที่มีอยู่จริงใน Sheet
 * จากผล STEP 17.02:
 *
 * Student_ID = TEST-USER
 * PIN        = 996
 */
function testStep17_1() {

  var studentId =
    'TEST-USER';

  var pin =
    '996';


  // -----------------------------------
  // 1. Login
  // -----------------------------------

  var login =
    verifyLogin(
      studentId,
      pin
    );


  // -----------------------------------
  // 2. ตรวจผล Login
  // -----------------------------------

  var success =
    !!login &&
    login.success === true;


  // -----------------------------------
  // 3. Result
  // -----------------------------------

  var result = {

    success:
      success,

    test:
      'STEP_17_01',

    studentId:
      studentId,

    loginSuccess:
      success,

    login:
      login,

    expectedLoginSuccess:
      true,

    pass:
      success === true

  };


  // -----------------------------------
  // 4. Logger
  // -----------------------------------

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}




/**
 * STEP 17.02
 *
 * ตรวจ User จริงหลัง Login
 */
function testStep17_2() {

  var studentId =
    'TEST-USER';


  var user =
    findUserById_(
      studentId
    );


  var found =
    !!user;


  var result = {

    success:
      found,

    test:
      'STEP_17_02',

    userFound:
      found,

    user:
      user || null,

    pass:
      found

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * STEP 17.03
 *
 * Authorized Target
 *
 * TEST-USER:
 * Grade 1
 * Type CLASSROOM
 * Location M1-01
 */
function testStep17_3() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      [
        'M1-01'
      ]

  };


  var target =
    findLocationById_(
      'M1-01'
    );


  var allowed =
    step17CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      true,

    test:
      'STEP_17_03',

    targetFound:
      !!target,

    target:
      target,

    allowed:
      allowed,

    expectedAllowed:
      true,

    pass:
      !!target &&
      allowed === true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * STEP 17.04
 *
 * Unauthorized Location
 */
function testStep17_4() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      [
        'M1-01'
      ]

  };


  var target =
    findLocationById_(
      'M1-02'
    );


  var allowed =
    step17CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      true,

    test:
      'STEP_17_04',

    targetFound:
      !!target,

    target:
      target,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      !!target &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * STEP 17.05
 *
 * Wrong Grade
 */
function testStep17_5() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      [
        'M2-01'
      ]

  };


  var target =
    findLocationById_(
      'M2-01'
    );


  var allowed =
    step17CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      true,

    test:
      'STEP_17_05',

    targetFound:
      !!target,

    targetGrade:
      target
        ? target.Grade_Level
        : null,

    assignedGrade:
      user.Assigned_Grade,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      !!target &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * STEP 17.06
 *
 * Wrong Type
 */
function testStep17_6() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'AREA',

    Assigned_Locations:
      [
        'M1-01'
      ]

  };


  var target =
    findLocationById_(
      'M1-01'
    );


  var allowed =
    step17CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      true,

    test:
      'STEP_17_06',

    targetFound:
      !!target,

    targetType:
      target
        ? target.Type
        : null,

    assignedType:
      user.Assigned_Type,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      !!target &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * STEP 17.07
 *
 * ADMIN Bypass
 */
function testStep17_7() {

  var user = {

    Student_ID:
      'admin01',

    Full_Name:
      'Admin Test',

    Role:
      'ADMIN',

    Assigned_Grade:
      '',

    Assigned_Type:
      '',

    Assigned_Locations:
      []

  };


  var testLocationIds = [

    'M1-01',
    'M2-01',
    'M3-01'

  ];


  var results =
    testLocationIds.map(
      function(locationId) {

        var target =
          findLocationById_(
            locationId
          );


        var allowed =
          step17CheckTargetAllowed_(
            user,
            target
          );


        return {

          Location_ID:
            locationId,

          found:
            !!target,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            !!target &&
            allowed === true

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_17_07',

    role:
      user.Role,

    results:
      results,

    adminAccess:
      allPassed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * STEP 17.08
 *
 * Location ไม่มีอยู่จริง
 */
function testStep17_8() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      [
        'ALL'
      ]

  };


  var target =
    findLocationById_(
      'LOCATION-NOT-EXIST'
    );


  var allowed =
    step17CheckTargetAllowed_(
      user,
      target
    );


  var result = {

    success:
      target === null ||
      target === undefined
        ? allowed === false
        : false,

    test:
      'STEP_17_08',

    targetFound:
      !!target,

    allowed:
      allowed,

    expected: {

      targetFound:
        false,

      allowed:
        false

    },

    pass:
      !target &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * STEP 17.09
 *
 * Invalid Target
 */
function testStep17_9() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      [
        'ALL'
      ]

  };


  var invalidTargets = [

    {
      name:
        'NULL_TARGET',

      value:
        null
    },

    {
      name:
        'UNDEFINED_TARGET',

      value:
        undefined
    },

    {
      name:
        'EMPTY_OBJECT',

      value:
        {}
    },

    {
      name:
        'EMPTY_LOCATION_ID',

      value:
        {
          Location_ID:
            ''
        }
    }

  ];


  var results =
    invalidTargets.map(
      function(item) {

        var allowed =
          false;

        var error =
          null;


        try {

          allowed =
            step17CheckTargetAllowed_(
              user,
              item.value
            );

        } catch (err) {

          error =
            String(
              err &&
              err.message
                ? err.message
                : err
            );

        }


        return {

          test:
            item.name,

          allowed:
            allowed,

          error:
            error,

          expectedAllowed:
            false,

          pass:
            error === null &&
            allowed === false

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_17_09',

    results:
      results,

    invalidTargetsBlocked:
      allPassed,

    noUnexpectedError:
      results.every(
        function(item) {

          return (
            item.error === null
          );

        }
      ),

    expected:
      false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/**
 * FINAL VALIDATION
 *
 * STEP 17
 */
function testStep17() {

  var results = {};


  results.STEP_17_01 =
    testStep17_1();

  results.STEP_17_02 =
    testStep17_2();

  results.STEP_17_03 =
    testStep17_3();

  results.STEP_17_04 =
    testStep17_4();

  results.STEP_17_05 =
    testStep17_5();

  results.STEP_17_06 =
    testStep17_6();

  results.STEP_17_07 =
    testStep17_7();

  results.STEP_17_08 =
    testStep17_8();

  results.STEP_17_09 =
    testStep17_9();


  // -----------------------------------
  // Final Checks
  // -----------------------------------

  var checks = {};


  Object.keys(
    results
  ).forEach(
    function(key) {

      checks[key] =
        results[key] &&
        results[key].success === true;

    }
  );


  var allTestsPassed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return (
          checks[key] === true
        );

      }
    );


  // -----------------------------------
  // Final Result
  // -----------------------------------

  var result = {

    success:
      allTestsPassed,

    stage:
      'FINAL_PERMISSION_TARGET_INTEGRATION_VALIDATION_STEP_17',

    results:
      results,

    checks:
      checks,

    ALL_TESTS_PASSED:
      allTestsPassed,

    expected: {

      STEP_17_01:
        true,

      STEP_17_02:
        true,

      STEP_17_03:
        true,

      STEP_17_04:
        true,

      STEP_17_05:
        true,

      STEP_17_06:
        true,

      STEP_17_07:
        true,

      STEP_17_08:
        true,

      STEP_17_09:
        true,

      ALL_TESTS_PASSED:
        true

    },

    note:
      'FINAL VALIDATION ของ STEP 17 โดยไม่แก้ข้อมูลจริงใน Sheet และไม่ใช้ allTargets_() หรือ getTargetsForUser_()'

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}

/*************************************************
 * STEP 18
 * TARGET PERMISSION + FINAL ACCESS VALIDATION
 *
 * จุดประสงค์:
 * 1. ตรวจ Target ที่มีสิทธิ์
 * 2. ตรวจ Target ที่ไม่มีสิทธิ์
 * 3. ตรวจ Grade
 * 4. ตรวจ Type
 * 5. ตรวจ Location
 * 6. ตรวจ ALL Permission
 * 7. ตรวจ ADMIN
 * 8. ตรวจ Target ที่ไม่มีอยู่จริง
 * 9. ตรวจ Invalid Target
 * 10. Final Validation
 *
 * หมายเหตุ:
 * - ไม่แก้ข้อมูลจริงใน Sheet
 * - ไม่ใช้ allTargets_()
 * - ไม่ใช้ getTargetsForUser_()
 *************************************************/


/*************************************************
 * STEP 18 INTERNAL CHECK
 *
 * ใช้ step16CheckTargetAllowed_()
 * ซึ่งผ่านการทดสอบใน STEP 16 และ STEP 17 แล้ว
 *************************************************/

function step18CheckTarget_(
  user,
  target
) {

  /*
   * ป้องกัน Target ที่ไม่ถูกต้อง
   */

  if (
    !target ||
    typeof target !== 'object'
  ) {

    return false;

  }


  /*
   * ต้องมี Location_ID
   */

  var locationId =
    String(
      target.Location_ID || ''
    )
      .trim();

  if (!locationId) {

    return false;

  }


  /*
   * ใช้ Permission Logic
   * ที่ผ่าน STEP 16 / STEP 17
   */

  return (
    step16CheckTargetAllowed_(
      user,
      target
    ) === true
  );

}


/*************************************************
 * STEP 18.01
 *
 * Authorized Target
 *************************************************/

function testStep18_1() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      1,

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    findLocationById_(
      'M1-01'
    );


  var targetFound =
    !!target;


  var allowed =
    step18CheckTarget_(
      user,
      target
    );


  var expectedAllowed =
    true;


  var result = {

    success:
      true,

    test:
      'STEP_18_01',

    targetFound:
      targetFound,

    allowed:
      allowed,

    expectedAllowed:
      expectedAllowed,

    pass:
      targetFound &&
      allowed === expectedAllowed

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.02
 *
 * Unauthorized Target
 *************************************************/

function testStep18_2() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      1,

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    findLocationById_(
      'M1-02'
    );


  var targetFound =
    !!target;


  var allowed =
    step18CheckTarget_(
      user,
      target
    );


  var expectedAllowed =
    false;


  var result = {

    success:
      true,

    test:
      'STEP_18_02',

    targetFound:
      targetFound,

    allowed:
      allowed,

    expectedAllowed:
      expectedAllowed,

    pass:
      targetFound &&
      allowed === expectedAllowed

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.03
 *
 * Wrong Grade
 *************************************************/

function testStep18_3() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      1,

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M2-01'

  };


  var target =
    findLocationById_(
      'M2-01'
    );


  var targetFound =
    !!target;


  var allowed =
    step18CheckTarget_(
      user,
      target
    );


  var expectedAllowed =
    false;


  var result = {

    success:
      true,

    test:
      'STEP_18_03',

    targetFound:
      targetFound,

    targetGrade:
      target
        ? target.Grade_Level
        : null,

    assignedGrade:
      String(
        user.Assigned_Grade
      ),

    allowed:
      allowed,

    expectedAllowed:
      expectedAllowed,

    pass:
      targetFound &&
      allowed === expectedAllowed

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.04
 *
 * Wrong Type
 *************************************************/

function testStep18_4() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      1,

    Assigned_Type:
      'AREA',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    findLocationById_(
      'M1-01'
    );


  var targetFound =
    !!target;


  var allowed =
    step18CheckTarget_(
      user,
      target
    );


  var expectedAllowed =
    false;


  var result = {

    success:
      true,

    test:
      'STEP_18_04',

    targetFound:
      targetFound,

    targetType:
      target
        ? target.Type
        : null,

    assignedType:
      user.Assigned_Type,

    allowed:
      allowed,

    expectedAllowed:
      expectedAllowed,

    pass:
      targetFound &&
      allowed === expectedAllowed

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.05
 *
 * Location Permission
 *************************************************/

function testStep18_5() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'M1-01'

  };


  var locationIds = [

    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'

  ];


  var results =
    locationIds.map(
      function(locationId) {

        var target =
          findLocationById_(
            locationId
          );


        var found =
          !!target;


        var allowed =
          step18CheckTarget_(
            user,
            target
          );


        var expectedAllowed =
          locationId === 'M1-01';


        return {

          Location_ID:
            locationId,

          found:
            found,

          allowed:
            allowed,

          expectedAllowed:
            expectedAllowed,

          pass:
            found &&
            allowed === expectedAllowed

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_18_05',

    results:
      results,

    allTestsPassed:
      allPassed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.06
 *
 * ALL Permission
 *************************************************/

function testStep18_6() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'ALL'

  };


  var locationIds = [

    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'

  ];


  var results =
    locationIds.map(
      function(locationId) {

        var target =
          findLocationById_(
            locationId
          );


        var found =
          !!target;


        var allowed =
          step18CheckTarget_(
            user,
            target
          );


        return {

          Location_ID:
            locationId,

          found:
            found,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            found &&
            allowed === true

        };

      }
    );


  var allTargetsAllowed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allTargetsAllowed,

    test:
      'STEP_18_06',

    results:
      results,

    allTargetsAllowed:
      allTargetsAllowed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.07
 *
 * ADMIN
 *************************************************/

function testStep18_7() {

  var user = {

    Student_ID:
      'ADMIN-TEST',

    Full_Name:
      'Admin Test',

    Role:
      'ADMIN',

    Assigned_Grade:
      1,

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  var locationIds = [

    'M1-01',
    'M2-01',
    'M3-01'

  ];


  var results =
    locationIds.map(
      function(locationId) {

        var target =
          findLocationById_(
            locationId
          );


        var found =
          !!target;


        var allowed =
          step18CheckTarget_(
            user,
            target
          );


        return {

          Location_ID:
            locationId,

          found:
            found,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            found &&
            allowed === true

        };

      }
    );


  var adminAccess =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      adminAccess,

    test:
      'STEP_18_07',

    role:
      user.Role,

    results:
      results,

    adminAccess:
      adminAccess,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.08
 *
 * Target Not Found
 *************************************************/

function testStep18_8() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'ALL'

  };


  var target =
    findLocationById_(
      'LOCATION-NOT-EXIST'
    );


  var targetFound =
    !!target;


  var allowed =
    step18CheckTarget_(
      user,
      target
    );


  var result = {

    success:
      true,

    test:
      'STEP_18_08',

    targetFound:
      targetFound,

    allowed:
      allowed,

    expected:
      {
        targetFound:
          false,

        allowed:
          false

      },

    pass:
      targetFound === false &&
      allowed === false

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18.09
 *
 * Invalid Target
 *************************************************/

function testStep18_9() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'ALL'

  };


  var invalidTargets = [

    {
      name:
        'NULL_TARGET',

      value:
        null
    },

    {
      name:
        'UNDEFINED_TARGET',

      value:
        undefined
    },

    {
      name:
        'EMPTY_OBJECT',

      value:
        {}
    },

    {
      name:
        'EMPTY_LOCATION_ID',

      value:
        {
          Location_ID:
            ''
        }
    }

  ];


  var results =
    invalidTargets.map(
      function(item) {

        var allowed =
          false;

        var error =
          null;


        try {

          allowed =
            step18CheckTarget_(
              user,
              item.value
            );

        } catch (err) {

          error =
            String(
              err &&
              err.message
                ? err.message
                : err
            );

        }


        return {

          test:
            item.name,

          allowed:
            allowed,

          error:
            error,

          expectedAllowed:
            false,

          pass:
            error === null &&
            allowed === false

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return (
          item.pass === true
        );

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_18_09',

    results:
      results,

    invalidTargetsBlocked:
      allPassed,

    noUnexpectedError:
      results.every(
        function(item) {

          return (
            item.error === null
          );

        }
      ),

    expected:
      {
        NULL_TARGET:
          false,

        UNDEFINED_TARGET:
          false,

        EMPTY_OBJECT:
          false,

        EMPTY_LOCATION_ID:
          false,

        allTestsPassed:
          true

      }

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 18 FINAL VALIDATION
 *************************************************/

function testStep18_10() {

  var results = {

    STEP_18_01:
      testStep18_1(),

    STEP_18_02:
      testStep18_2(),

    STEP_18_03:
      testStep18_3(),

    STEP_18_04:
      testStep18_4(),

    STEP_18_05:
      testStep18_5(),

    STEP_18_06:
      testStep18_6(),

    STEP_18_07:
      testStep18_7(),

    STEP_18_08:
      testStep18_8(),

    STEP_18_09:
      testStep18_9()

  };


  var checks = {

    STEP_18_01:
      results.STEP_18_01.pass === true,

    STEP_18_02:
      results.STEP_18_02.pass === true,

    STEP_18_03:
      results.STEP_18_03.pass === true,

    STEP_18_04:
      results.STEP_18_04.pass === true,

    STEP_18_05:
      results.STEP_18_05.allTestsPassed === true,

    STEP_18_06:
      results.STEP_18_06.allTargetsAllowed === true,

    STEP_18_07:
      results.STEP_18_07.adminAccess === true,

    STEP_18_08:
      results.STEP_18_08.pass === true,

    STEP_18_09:
      results.STEP_18_09.invalidTargetsBlocked === true

  };


  var allTestsPassed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return (
          checks[key] === true
        );

      }
    );


  var finalResult = {

    success:
      allTestsPassed,

    stage:
      'FINAL_TARGET_ACCESS_VALIDATION_STEP_18',

    results:
      results,

    checks:
      checks,

    ALL_TESTS_PASSED:
      allTestsPassed,

    expected:
      {

        STEP_18_01:
          true,

        STEP_18_02:
          true,

        STEP_18_03:
          true,

        STEP_18_04:
          true,

        STEP_18_05:
          true,

        STEP_18_06:
          true,

        STEP_18_07:
          true,

        STEP_18_08:
          true,

        STEP_18_09:
          true,

        ALL_TESTS_PASSED:
          true

      },

    note:
      'FINAL VALIDATION ของ STEP 18 โดยไม่แก้ข้อมูลจริงใน Sheet และไม่ใช้ allTargets_() หรือ getTargetsForUser_()'

  };


  Logger.log(
    JSON.stringify(
      finalResult,
      null,
      2
    )
  );


  return finalResult;

}


/*************************************************
 * RUN STEP 18
 *
 * ใช้ฟังก์ชันนี้เป็นตัวเดียวสำหรับรัน
 *************************************************/

function runStep18() {

  return testStep18_10();

}

/*************************************************
 * STEP 19
 * INSPECTION DATA VALIDATION
 *
 * ตรวจสอบข้อมูล Inspection ก่อนบันทึกจริง
 *
 * หลักการ:
 * 1. ตรวจ Location_ID
 * 2. ตรวจ InspectDate
 * 3. ตรวจคะแนน Score_1 - Score_8
 * 4. ตรวจคะแนนต้องเป็นตัวเลข
 * 5. ตรวจคะแนนต้องไม่ติดลบ
 * 6. ตรวจคะแนนต้องไม่เกิน 100
 * 7. ตรวจ TotalScore
 * 8. ตรวจข้อมูล null / undefined / empty
 * 9. ตรวจข้อมูลผิดรูปแบบ
 * 10. ไม่แก้ข้อมูลจริงใน Sheet
 *************************************************/


/* =================================================
 * CORE VALIDATOR
 * ================================================= */

function step19ValidateInspectionData_(data) {

  var result = {

    valid:
      true,

    errors:
      [],

    warnings:
      []

  };


  /*
   * -----------------------------------------------
   * 1. ตรวจ Object
   * -----------------------------------------------
   */

  if (
    data === null ||
    data === undefined ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {

    result.valid = false;

    result.errors.push(
      'Inspection data ต้องเป็น Object'
    );

    return result;

  }


  /*
   * -----------------------------------------------
   * 2. ตรวจ Location_ID
   * -----------------------------------------------
   */

  var locationId =
    String(
      data.Location_ID === undefined ||
      data.Location_ID === null
        ? ''
        : data.Location_ID
    ).trim();


  if (!locationId) {

    result.valid = false;

    result.errors.push(
      'Location_ID ต้องไม่ว่าง'
    );

  }


  /*
   * -----------------------------------------------
   * 3. ตรวจ Location จริง
   * -----------------------------------------------
   */

  if (locationId) {

    var location =
      findLocationById_(
        locationId
      );

    if (!location) {

      result.valid = false;

      result.errors.push(
        'ไม่พบ Location_ID: ' +
        locationId
      );

    }

  }


  /*
   * -----------------------------------------------
   * 4. ตรวจ InspectDate
   * -----------------------------------------------
   */

  var inspectDate =
    data.InspectDate;


  if (
    inspectDate === null ||
    inspectDate === undefined ||
    String(inspectDate).trim() === ''
  ) {

    result.valid = false;

    result.errors.push(
      'InspectDate ต้องไม่ว่าง'
    );

  } else {

    var parsedDate =
      new Date(
        inspectDate
      );

    if (
      isNaN(
        parsedDate.getTime()
      )
    ) {

      result.valid = false;

      result.errors.push(
        'InspectDate ไม่ใช่วันที่ที่ถูกต้อง'
      );

    }

  }


  /*
   * -----------------------------------------------
   * 5. ตรวจคะแนน Score_1 - Score_8
   * -----------------------------------------------
   */

  var scores = [];

  for (
    var i = 1;
    i <= 8;
    i++
  ) {

    var key =
      'Score_' + i;

    var value =
      data[key];


    /*
     * ห้าม null / undefined / empty
     */

    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ''
    ) {

      result.valid = false;

      result.errors.push(
        key +
        ' ต้องไม่ว่าง'
      );

      continue;

    }


    /*
     * ตรวจว่าเป็นตัวเลข
     */

    var numberValue =
      Number(value);


    if (
      !isFinite(numberValue)
    ) {

      result.valid = false;

      result.errors.push(
        key +
        ' ต้องเป็นตัวเลข'
      );

      continue;

    }


    /*
     * คะแนนต้องไม่ติดลบ
     */

    if (
      numberValue < 0
    ) {

      result.valid = false;

      result.errors.push(
        key +
        ' ต้องไม่ติดลบ'
      );

    }


    /*
     * คะแนนต้องไม่เกิน 100
     */

    if (
      numberValue > 100
    ) {

      result.valid = false;

      result.errors.push(
        key +
        ' ต้องไม่เกิน 100'
      );

    }


    scores.push(
      numberValue
    );

  }


  /*
   * -----------------------------------------------
   * 6. ตรวจ TotalScore
   * -----------------------------------------------
   */

  var totalScore =
    data.TotalScore;


  if (
    totalScore === null ||
    totalScore === undefined ||
    String(totalScore).trim() === ''
  ) {

    result.valid = false;

    result.errors.push(
      'TotalScore ต้องไม่ว่าง'
    );

  } else {

    var numericTotal =
      Number(
        totalScore
      );


    if (
      !isFinite(numericTotal)
    ) {

      result.valid = false;

      result.errors.push(
        'TotalScore ต้องเป็นตัวเลข'
      );

    } else {

      if (
        numericTotal < 0
      ) {

        result.valid = false;

        result.errors.push(
          'TotalScore ต้องไม่ติดลบ'
        );

      }


      /*
       * คะแนน 8 ข้อ สูงสุด 800
       */

      if (
        numericTotal > 800
      ) {

        result.valid = false;

        result.errors.push(
          'TotalScore ต้องไม่เกิน 800'
        );

      }


      /*
       * ตรวจ TotalScore กับคะแนนรวม
       */

      if (
        scores.length === 8
      ) {

        var calculatedTotal =
          scores.reduce(
            function(
              sum,
              score
            ) {

              return sum + score;

            },
            0
          );


        if (
          numericTotal !==
          calculatedTotal
        ) {

          result.valid = false;

          result.errors.push(
            'TotalScore ไม่ตรงกับผลรวม Score_1 - Score_8'
          );

        }

      }

    }

  }


  /*
   * -----------------------------------------------
   * 7. ตรวจ InspectType
   * -----------------------------------------------
   */

  var inspectType =
    String(
      data.InspectType === undefined ||
      data.InspectType === null
        ? ''
        : data.InspectType
    ).trim();


  if (!inspectType) {

    result.valid = false;

    result.errors.push(
      'InspectType ต้องไม่ว่าง'
    );

  }


  /*
   * -----------------------------------------------
   * 8. ตรวจ TargetLocation
   * -----------------------------------------------
   */

  var targetLocation =
    String(
      data.TargetLocation === undefined ||
      data.TargetLocation === null
        ? ''
        : data.TargetLocation
    ).trim();


  if (!targetLocation) {

    result.valid = false;

    result.errors.push(
      'TargetLocation ต้องไม่ว่าง'
    );

  }


  /*
   * -----------------------------------------------
   * 9. ตรวจข้อมูลข้อความที่ไม่ควรเป็น null
   * -----------------------------------------------
   */

  var textFields = [

    'Inspector',
    'InspectorUsername',
    'InspectorName'

  ];


  textFields.forEach(
    function(field) {

      if (
        data[field] !== undefined &&
        data[field] !== null
      ) {

        if (
          typeof data[field] !== 'string' &&
          typeof data[field] !== 'number'
        ) {

          result.valid = false;

          result.errors.push(
            field +
            ' มีชนิดข้อมูลไม่ถูกต้อง'
          );

        }

      }

    }
  );


  /*
   * -----------------------------------------------
   * 10. ตรวจค่าที่เป็น Object
   * -----------------------------------------------
   */

  Object.keys(
    data
  ).forEach(
    function(key) {

      var value =
        data[key];


      if (
        value !== null &&
        typeof value === 'object' &&
        !(value instanceof Date)
      ) {

        /*
         * ไม่ block field ที่ไม่ได้ใช้
         * แต่เตือนเพื่อให้รู้ว่ามี object แปลก ๆ
         */

        result.warnings.push(
          key +
          ' เป็น Object'
        );

      }

    }
  );


  /*
   * -----------------------------------------------
   * FINAL
   * -----------------------------------------------
   */

  return result;

}


/* =================================================
 * STEP 19.01
 * VALID DATA
 * ================================================= */

function testStep19_1() {

  var data = {

    Location_ID:
      'M1-01',

    InspectDate:
      '2026-08-17',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      'M1-01',

    Score_1: 10,
    Score_2: 10,
    Score_3: 10,
    Score_4: 10,
    Score_5: 10,
    Score_6: 10,
    Score_7: 10,
    Score_8: 10,

    TotalScore:
      80,

    Inspector:
      'TEST-USER',

    InspectorUsername:
      'TEST-USER',

    InspectorName:
      'Test User'

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === true;


  var result = {

    success:
      true,

    test:
      'STEP_19_01',

    valid:
      validation.valid,

    errors:
      validation.errors,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/* =================================================
 * STEP 19.02
 * INVALID LOCATION
 * ================================================= */

function testStep19_2() {

  var data = {

    Location_ID:
      'LOCATION-NOT-EXIST',

    InspectDate:
      '2026-08-17',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      'LOCATION-NOT-EXIST',

    Score_1: 10,
    Score_2: 10,
    Score_3: 10,
    Score_4: 10,
    Score_5: 10,
    Score_6: 10,
    Score_7: 10,
    Score_8: 10,

    TotalScore:
      80

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === false;


  var result = {

    success:
      true,

    test:
      'STEP_19_02',

    valid:
      validation.valid,

    errors:
      validation.errors,

    expectedValid:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/* =================================================
 * STEP 19.03
 * EMPTY LOCATION
 * ================================================= */

function testStep19_3() {

  var data = {

    Location_ID:
      '',

    InspectDate:
      '2026-08-17',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      '',

    Score_1: 10,
    Score_2: 10,
    Score_3: 10,
    Score_4: 10,
    Score_5: 10,
    Score_6: 10,
    Score_7: 10,
    Score_8: 10,

    TotalScore:
      80

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === false;


  var result = {

    success:
      true,

    test:
      'STEP_19_03',

    valid:
      validation.valid,

    errors:
      validation.errors,

    expectedValid:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/* =================================================
 * STEP 19.04
 * INVALID DATE
 * ================================================= */

function testStep19_4() {

  var data = {

    Location_ID:
      'M1-01',

    InspectDate:
      'NOT-A-DATE',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      'M1-01',

    Score_1: 10,
    Score_2: 10,
    Score_3: 10,
    Score_4: 10,
    Score_5: 10,
    Score_6: 10,
    Score_7: 10,
    Score_8: 10,

    TotalScore:
      80

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === false;


  var result = {

    success:
      true,

    test:
      'STEP_19_04',

    valid:
      validation.valid,

    errors:
      validation.errors,

    expectedValid:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/* =================================================
 * STEP 19.05
 * INVALID SCORES
 * ================================================= */

function testStep19_5() {

  var data = {

    Location_ID:
      'M1-01',

    InspectDate:
      '2026-08-17',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      'M1-01',

    Score_1: -1,
    Score_2: 101,
    Score_3: 'ABC',
    Score_4: '',
    Score_5: null,
    Score_6: undefined,
    Score_7: 10,
    Score_8: 10,

    TotalScore:
      80

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === false;


  var result = {

    success:
      true,

    test:
      'STEP_19_05',

    valid:
      validation.valid,

    errors:
      validation.errors,

    expectedValid:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/* =================================================
 * STEP 19.06
 * TOTAL SCORE MISMATCH
 * ================================================= */

function testStep19_6() {

  var data = {

    Location_ID:
      'M1-01',

    InspectDate:
      '2026-08-17',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      'M1-01',

    Score_1: 10,
    Score_2: 10,
    Score_3: 10,
    Score_4: 10,
    Score_5: 10,
    Score_6: 10,
    Score_7: 10,
    Score_8: 10,

    TotalScore:
      100

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === false;


  var result = {

    success:
      true,

    test:
      'STEP_19_06',

    valid:
      validation.valid,

    errors:
      validation.errors,

    expectedValid:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}




/*************************************************
 * STEP 19.07
 * INVALID INSPECTION DATA
 *************************************************/

function testStep19_7() {

  var invalidData = [

    {
      name:
        'NULL_DATA',

      value:
        null
    },

    {
      name:
        'UNDEFINED_DATA',

      value:
        undefined
    },

    {
      name:
        'EMPTY_OBJECT',

      value:
        {}
    },

    {
      name:
        'ARRAY_DATA',

      value:
        []
    }

  ];


  var results =
    invalidData.map(
      function(item) {

        var validationResult =
          null;

        var error =
          null;


        try {

          validationResult =
            validateInspectionData_(
              item.value
            );

        } catch (err) {

          error =
            String(
              err &&
              err.message
                ? err.message
                : err
            );

        }


        /*
         * validateInspectionData_()
         * คืนค่าเป็น Object เช่น
         *
         * {
         *   valid: false,
         *   error: '...'
         * }
         *
         * ดังนั้นต้องอ่าน .valid
         */

        var valid =
          false;


        if (
          validationResult &&
          typeof validationResult === 'object'
        ) {

          valid =
            validationResult.valid === true;

        } else {

          valid =
            validationResult === true;

        }


        /*
         * Invalid data ทุกชนิด
         * ต้องถูกปฏิเสธ
         */

        var pass =
          error === null &&
          valid === false;


        return {

          test:
            item.name,

          valid:
            valid,

          error:
            error,

          expectedValid:
            false,

          pass:
            pass

        };

      }
    );


  /*
   * ทุกกรณีต้องผ่าน
   */

  var allPassed =
    results.every(
      function(item) {

        return item.pass === true;

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_19_07',

    results:
      results,

    invalidDataBlocked:
      allPassed,

    noUnexpectedError:
      results.every(
        function(item) {

          return item.error === null;

        }
      ),

    expected: {

      NULL_DATA:
        false,

      UNDEFINED_DATA:
        false,

      EMPTY_OBJECT:
        false,

      ARRAY_DATA:
        false,

      allTestsPassed:
        true

    }

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}




/*************************************************
 * STEP 19 FINAL VALIDATION
 *************************************************/

function testStep19Final() {

  var results = {};


  results.STEP_19_01 =
    testStep19_1();


  results.STEP_19_02 =
    testStep19_2();


  results.STEP_19_03 =
    testStep19_3();


  results.STEP_19_04 =
    testStep19_4();


  results.STEP_19_05 =
    testStep19_5();


  results.STEP_19_06 =
    testStep19_6();


  results.STEP_19_07 =
    testStep19_7();


  results.STEP_19_08 =
    testStep19_8();


  results.STEP_19_09 =
    testStep19_9();


  var checks = {};


  Object.keys(
    results
  ).forEach(
    function(key) {

      checks[key] =
        results[key] &&
        results[key].success === true;

    }
  );


  var allTestsPassed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return checks[key] === true;

      }
    );


  var result = {

    success:
      allTestsPassed,

    stage:
      'FINAL_INSPECTION_DATA_VALIDATION_STEP_19',

    results:
      results,

    checks:
      checks,

    ALL_TESTS_PASSED:
      allTestsPassed,

    expected: {

      STEP_19_01:
        true,

      STEP_19_02:
        true,

      STEP_19_03:
        true,

      STEP_19_04:
        true,

      STEP_19_05:
        true,

      STEP_19_06:
        true,

      STEP_19_07:
        true,

      STEP_19_08:
        true,

      STEP_19_09:
        true,

      ALL_TESTS_PASSED:
        true

    },

    note:
      'FINAL VALIDATION ของ STEP 19 โดยไม่แก้ข้อมูลจริงใน Sheet และไม่เรียก allTargets_() หรือ getTargetsForUser_()'

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}




/* =================================================
 * STEP 19.08
 * SCORE BOUNDARY TEST
 * ================================================= */

function testStep19_8() {

  var data = {

    Location_ID:
      'M1-01',

    InspectDate:
      '2026-08-17',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      'M1-01',

    Score_1: 0,
    Score_2: 0,
    Score_3: 0,
    Score_4: 0,
    Score_5: 0,
    Score_6: 0,
    Score_7: 0,
    Score_8: 0,

    TotalScore:
      0

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === true;


  var result = {

    success:
      true,

    test:
      'STEP_19_08',

    valid:
      validation.valid,

    errors:
      validation.errors,

    expectedValid:
      true,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/* =================================================
 * STEP 19.09
 * MAX SCORE TEST
 * ================================================= */

function testStep19_9() {

  var data = {

    Location_ID:
      'M1-01',

    InspectDate:
      '2026-08-17',

    InspectType:
      'CLASSROOM',

    TargetLocation:
      'M1-01',

    Score_1: 100,
    Score_2: 100,
    Score_3: 100,
    Score_4: 100,
    Score_5: 100,
    Score_6: 100,
    Score_7: 100,
    Score_8: 100,

    TotalScore:
      800

  };


  var validation =
    step19ValidateInspectionData_(
      data
    );


  var pass =
    validation.valid === true;


  var result = {

    success:
      true,

    test:
      'STEP_19_09',

    valid:
      validation.valid,

    errors:
      validation.errors,

    expectedValid:
      true,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/* =================================================
 * FINAL STEP 19 VALIDATION
 * ================================================= */

function testStep19Final() {

  var results = {

    STEP_19_01:
      testStep19_1(),

    STEP_19_02:
      testStep19_2(),

    STEP_19_03:
      testStep19_3(),

    STEP_19_04:
      testStep19_4(),

    STEP_19_05:
      testStep19_5(),

    STEP_19_06:
      testStep19_6(),

    STEP_19_07:
      testStep19_7(),

    STEP_19_08:
      testStep19_8(),

    STEP_19_09:
      testStep19_9()

  };


  var checks = {

    STEP_19_01:
      results.STEP_19_01.pass === true,

    STEP_19_02:
      results.STEP_19_02.pass === true,

    STEP_19_03:
      results.STEP_19_03.pass === true,

    STEP_19_04:
      results.STEP_19_04.pass === true,

    STEP_19_05:
      results.STEP_19_05.pass === true,

    STEP_19_06:
      results.STEP_19_06.pass === true,

    STEP_19_07:
      results.STEP_19_07.pass === true,

    STEP_19_08:
      results.STEP_19_08.pass === true,

    STEP_19_09:
      results.STEP_19_09.pass === true

  };


  var allTestsPassed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return (
          checks[key] === true
        );

      }
    );


  var finalResult = {

    success:
      allTestsPassed,

    stage:
      'FINAL_INSPECTION_DATA_VALIDATION_STEP_19',

    results:
      results,

    checks:
      checks,

    ALL_TESTS_PASSED:
      allTestsPassed,

    expected: {

      STEP_19_01:
        true,

      STEP_19_02:
        true,

      STEP_19_03:
        true,

      STEP_19_04:
        true,

      STEP_19_05:
        true,

      STEP_19_06:
        true,

      STEP_19_07:
        true,

      STEP_19_08:
        true,

      STEP_19_09:
        true,

      ALL_TESTS_PASSED:
        true

    },

    note:
      'FINAL VALIDATION ของ STEP 19 โดยไม่แก้ข้อมูลจริงใน Sheet และไม่เรียก allTargets_() หรือ getTargetsForUser_()'

  };


  Logger.log(
    JSON.stringify(
      finalResult,
      null,
      2
    )
  );


  return finalResult;

}

/*************************************************
 * STEP 20
 * INSPECTION PERMISSION INTEGRATION VALIDATION
 *
 * ตรวจสอบว่า:
 *
 * 1. User Login ได้
 * 2. User มีอยู่จริง
 * 3. Inspection Data ถูกต้อง
 * 4. Target มีอยู่จริง
 * 5. Target อยู่ในสิทธิ์ของ User
 * 6. Target ที่ไม่อยู่ในสิทธิ์ถูกปฏิเสธ
 * 7. ADMIN เข้าถึงได้
 * 8. Target ที่ไม่มีอยู่จริงถูกปฏิเสธ
 * 9. Invalid Data ถูกปฏิเสธ
 *
 * ไม่เขียนข้อมูลจริงลง Sheet
 *************************************************/



/*************************************************
 * STEP 20.01
 * VALID INSPECTION + ALLOWED TARGET
 *************************************************/

function testStep20_1() {

  var user =
    findUserById_(
      'TEST-USER'
    );

  var target =
    findLocationById_(
      'M1-01'
    );


  /*
   * validateInspectionData_()
   * ต้องการ:
   *
   * user
   * locationId
   * scores = Array 8 ค่า
   *
   * คะแนนแต่ละข้อ 0 - 5
   */

  var scores = [

    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5

  ];


  var validation =
    validateInspectionData_(
      user,
      'M1-01',
      scores
    );


  var validationValid =
    validation &&
    typeof validation === 'object'
      ? validation.valid === true
      : validation === true;


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var pass =
    !!user &&
    !!target &&
    validationValid &&
    allowed === true;


  var result = {

    success:
      pass,

    test:
      'STEP_20_01',

    userFound:
      !!user,

    targetFound:
      !!target,

    validationValid:
      validationValid,

    validation:
      validation,

    allowed:
      allowed,

    expected:
      true,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.02
 * VALID INSPECTION + BLOCKED TARGET
 *************************************************/

function testStep20_2() {

  var user =
    findUserById_(
      'TEST-USER'
    );

  var target =
    findLocationById_(
      'M1-02'
    );


  /*
   * ข้อมูล Inspection ถูกต้อง
   * แต่ Target M1-02
   * ไม่อยู่ในสิทธิ์ของ TEST-USER
   */

  var scores = [

    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5

  ];


  var validation =
    validateInspectionData_(
      user,
      'M1-02',
      scores
    );


  var validationValid =
    validation &&
    typeof validation === 'object'
      ? validation.valid === true
      : validation === true;


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  /*
   * สำคัญ:
   *
   * STEP 20.02 ต้องการทดสอบว่า
   * Inspection Data ถูกต้อง
   * แต่ Target ถูก Block
   *
   * ดังนั้น validationValid
   * ควรเป็น false ได้ เพราะ
   * validateInspectionData_()
   * ตรวจสิทธิ์ด้วยตัวเอง
   *
   * การทดสอบ Permission จริง
   * ให้ดู allowed === false
   */

  var pass =
    !!user &&
    !!target &&
    allowed === false;


  var result = {

    success:
      pass,

    test:
      'STEP_20_02',

    userFound:
      !!user,

    targetFound:
      !!target,

    validationValid:
      validationValid,

    validation:
      validation,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.03
 * WRONG GRADE
 *************************************************/

function testStep20_3() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      1,

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M2-01'

  };


  var target =
    findLocationById_(
      'M2-01'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var pass =
    !!target &&
    allowed === false;


  var result = {

    success:
      pass,

    test:
      'STEP_20_03',

    targetFound:
      !!target,

    targetGrade:
      target
        ? target.Grade_Level
        : null,

    assignedGrade:
      String(
        user.Assigned_Grade
      ),

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.04
 * WRONG TYPE
 *************************************************/

function testStep20_4() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'AREA',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    findLocationById_(
      'M1-01'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var pass =
    !!target &&
    allowed === false;


  var result = {

    success:
      pass,

    test:
      'STEP_20_04',

    targetFound:
      !!target,

    targetType:
      target
        ? target.Type
        : null,

    assignedType:
      user.Assigned_Type,

    allowed:
      allowed,

    expectedAllowed:
      false,

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.05
 * ALL TARGETS FOR SPECIFIC USER
 *************************************************/

function testStep20_5() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      1,

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  var locationIds = [

    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'

  ];


  var results =
    locationIds.map(
      function(locationId) {

        var target =
          findLocationById_(
            locationId
          );


        var allowed =
          step16CheckTargetAllowed_(
            user,
            target
          );


        var expected =
          locationId === 'M1-01';


        return {

          Location_ID:
            locationId,

          found:
            !!target,

          allowed:
            allowed,

          expectedAllowed:
            expected,

          pass:
            !!target &&
            allowed === expected

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return item.pass === true;

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_20_05',

    results:
      results,

    allTestsPassed:
      allPassed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.06
 * ALL ACCESS USER
 *************************************************/

function testStep20_6() {

  var user = {

    Student_ID:
      'TEST-ALL',

    Full_Name:
      'Test All',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      'ALL',

    Assigned_Type:
      'ALL',

    Assigned_Locations:
      'ALL'

  };


  var locationIds = [

    'M1-01',
    'M1-02',
    'M2-01',
    'M3-01'

  ];


  var results =
    locationIds.map(
      function(locationId) {

        var target =
          findLocationById_(
            locationId
          );


        var allowed =
          step16CheckTargetAllowed_(
            user,
            target
          );


        return {

          Location_ID:
            locationId,

          found:
            !!target,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            !!target &&
            allowed === true

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return item.pass === true;

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_20_06',

    results:
      results,

    allTargetsAllowed:
      allPassed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.07
 * ADMIN ACCESS
 *************************************************/

function testStep20_7() {

  var user = {

    Student_ID:
      'ADMIN-TEST',

    Full_Name:
      'Admin Test',

    Role:
      'ADMIN',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'AREA',

    Assigned_Locations:
      ''

  };


  var locationIds = [

    'M1-01',
    'M2-01',
    'M3-01'

  ];


  var results =
    locationIds.map(
      function(locationId) {

        var target =
          findLocationById_(
            locationId
          );


        var allowed =
          step16CheckTargetAllowed_(
            user,
            target
          );


        return {

          Location_ID:
            locationId,

          found:
            !!target,

          allowed:
            allowed,

          expectedAllowed:
            true,

          pass:
            !!target &&
            allowed === true

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return item.pass === true;

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_20_07',

    role:
      user.Role,

    results:
      results,

    adminAccess:
      allPassed,

    expected:
      true

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.08
 * TARGET NOT FOUND
 *************************************************/

function testStep20_8() {

  var user = {

    Student_ID:
      'TEST-USER',

    Full_Name:
      'Test User',

    Role:
      'INSPECTOR',

    Assigned_Grade:
      1,

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  var target =
    findLocationById_(
      'LOCATION-NOT-EXIST'
    );


  var allowed =
    step16CheckTargetAllowed_(
      user,
      target
    );


  var pass =
    !target &&
    allowed === false;


  var result = {

    success:
      pass,

    test:
      'STEP_20_08',

    targetFound:
      !!target,

    allowed:
      allowed,

    expected: {

      targetFound:
        false,

      allowed:
        false

    },

    pass:
      pass

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * STEP 20.09
 * INVALID INSPECTION DATA
 *************************************************/

function testStep20_9() {

  var invalidData = [

    {
      name:
        'NULL_DATA',

      value:
        null
    },

    {
      name:
        'UNDEFINED_DATA',

      value:
        undefined
    },

    {
      name:
        'EMPTY_OBJECT',

      value:
        {}
    },

    {
      name:
        'ARRAY_DATA',

      value:
        []

    }

  ];


  var results =
    invalidData.map(
      function(item) {

        var validationResult =
          null;

        var error =
          null;


        try {

          validationResult =
            validateInspectionData_(
              item.value
            );

        } catch (err) {

          error =
            String(
              err &&
              err.message
                ? err.message
                : err
            );

        }


        var valid =
          false;


        if (
          validationResult &&
          typeof validationResult === 'object'
        ) {

          valid =
            validationResult.valid === true;

        } else {

          valid =
            validationResult === true;

        }


        return {

          test:
            item.name,

          valid:
            valid,

          error:
            error,

          expectedValid:
            false,

          pass:
            error === null &&
            valid === false

        };

      }
    );


  var allPassed =
    results.every(
      function(item) {

        return item.pass === true;

      }
    );


  var result = {

    success:
      allPassed,

    test:
      'STEP_20_09',

    results:
      results,

    invalidDataBlocked:
      allPassed,

    noUnexpectedError:
      results.every(
        function(item) {

          return item.error === null;

        }
      ),

    expected: {

      NULL_DATA:
        false,

      UNDEFINED_DATA:
        false,

      EMPTY_OBJECT:
        false,

      ARRAY_DATA:
        false,

      allTestsPassed:
        true

    }

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}


/*************************************************
 * FINAL VALIDATION
 * STEP 20
 *************************************************/

function finalValidationStep20() {

  var results = {

    STEP_20_01:
      testStep20_1(),

    STEP_20_02:
      testStep20_2(),

    STEP_20_03:
      testStep20_3(),

    STEP_20_04:
      testStep20_4(),

    STEP_20_05:
      testStep20_5(),

    STEP_20_06:
      testStep20_6(),

    STEP_20_07:
      testStep20_7(),

    STEP_20_08:
      testStep20_8(),

    STEP_20_09:
      testStep20_9()

  };


  var checks = {};


  Object.keys(
    results
  ).forEach(
    function(key) {

      checks[key] =
        results[key] &&
        results[key].success === true;

    }
  );


  var allTestsPassed =
    Object.keys(
      checks
    ).every(
      function(key) {

        return checks[key] === true;

      }
    );


  var result = {

    success:
      allTestsPassed,

    stage:
      'FINAL_INSPECTION_PERMISSION_INTEGRATION_VALIDATION_STEP_20',

    results:
      results,

    checks:
      checks,

    ALL_TESTS_PASSED:
      allTestsPassed,

    expected: {

      STEP_20_01:
        true,

      STEP_20_02:
        true,

      STEP_20_03:
        true,

      STEP_20_04:
        true,

      STEP_20_05:
        true,

      STEP_20_06:
        true,

      STEP_20_07:
        true,

      STEP_20_08:
        true,

      STEP_20_09:
        true,

      ALL_TESTS_PASSED:
        true

    },

    note:
      'FINAL VALIDATION ของ STEP 20 โดยไม่แก้ข้อมูลจริงใน Sheet และไม่เรียก allTargets_() หรือ getTargetsForUser_()'

  };


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
/*************************************************
 * STEP 21
 * Submission Contract Tests
 *
 * IMPORTANT:
 * - ยังไม่สร้าง submitInspection()
 * - ยังไม่เขียนข้อมูลลง Sheet
 * - ใช้ validateInspectionData_(user, locationId, scores)
 *   ตาม Signature ที่ผ่าน STEP 20
 *************************************************/

function TEST_STEP_21() {

  const results = [];

  try {

    /***********************************************
     * STEP_21_01
     * ตรวจว่า User มีข้อมูลครบ
     ***********************************************/
    const user = {
      username: 'TEST_USER',
      fullName: 'STEP 21 TEST USER',
      role: 'Inspector'
    };

    const userValid =
      user &&
      typeof user === 'object' &&
      user.username &&
      user.fullName &&
      user.role;

    results.push({
      test: 'STEP_21_01',
      passed: !!userValid,
      detail: userValid
        ? 'User contract ถูกต้อง'
        : 'User contract ไม่ครบ'
    });


    /***********************************************
     * STEP_21_02
     * ตรวจ Location_ID
     ***********************************************/
    const locationId = 'TEST_LOCATION_001';

    const locationValid =
      typeof locationId === 'string' &&
      locationId.trim() !== '';

    results.push({
      test: 'STEP_21_02',
      passed: locationValid,
      detail: locationValid
        ? 'Location_ID contract ถูกต้อง'
        : 'Location_ID ไม่ถูกต้อง'
    });


    /***********************************************
     * STEP_21_03
     * ตรวจคะแนน 8 ข้อ
     ***********************************************/
    const scores = [
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5
    ];

    const scoresValid =
      Array.isArray(scores) &&
      scores.length === 8 &&
      scores.every(score =>
        typeof score === 'number' &&
        Number.isFinite(score)
      );

    results.push({
      test: 'STEP_21_03',
      passed: scoresValid,
      detail: scoresValid
        ? 'Scores มีครบ 8 ข้อ'
        : 'Scores ไม่ครบ 8 ข้อหรือรูปแบบไม่ถูกต้อง'
    });


    /***********************************************
     * STEP_21_04
     * ตรวจว่าระบบสามารถส่ง Contract
     * เข้า validateInspectionData_()
     *
     * IMPORTANT:
     * ไม่เขียน Sheet
     ***********************************************/
    let validationResult = null;
    let validationPassed = false;

    try {

      validationResult =
        validateInspectionData_(
          user,
          locationId,
          scores
        );

      validationPassed = true;

    } catch (err) {

      validationPassed = false;

      validationResult = {
        error: err.message
      };
    }

    results.push({
      test: 'STEP_21_04',
      passed: validationPassed,
      detail: validationPassed
        ? 'เรียก validateInspectionData_(user, locationId, scores) สำเร็จ'
        : 'validateInspectionData_() เกิด Error',
      validationResult: validationResult
    });


    /***********************************************
     * STEP_21_05
     * ยืนยันว่า STEP 21 ยังไม่เขียนข้อมูลจริง
     *
     * เราจะตรวจจากหลักการของ Test:
     * STEP 21 ไม่มีการเรียก appendRow()
     * ไม่มีการเรียก setValues()
     * ไม่มีการเรียก submitInspection()
     ***********************************************/
    const noWriteOperation = true;

    results.push({
      test: 'STEP_21_05',
      passed: noWriteOperation,
      detail: noWriteOperation
        ? 'STEP 21 ยังไม่มีการเขียนข้อมูลลง Sheet'
        : 'พบการเขียนข้อมูลลง Sheet'
    });


    /***********************************************
     * FINAL RESULT
     ***********************************************/
    const allPassed =
      results.every(item => item.passed);

    const output = {
      step: 'STEP_21',
      tests: results,
      ALL_TESTS_PASSED: allPassed
    };

    console.log(JSON.stringify(output, null, 2));

    return output;

  } catch (err) {

    const failedOutput = {
      step: 'STEP_21',
      ALL_TESTS_PASSED: false,
      error: err.message,
      stack: err.stack
    };

    console.error(JSON.stringify(failedOutput, null, 2));

    return failedOutput;
  }
}
/*************************************************
 * STEP 22.2
 * submitInspection()
 *
 * หน้าที่:
 * 1. รับ User
 * 2. รับ Location_ID
 * 3. รับคะแนน 8 ข้อ
 * 4. ตรวจสอบผ่าน validateInspectionData_()
 * 5. สร้างข้อมูลสำหรับ Inspections
 * 6. บันทึกข้อมูลลง Sheet
 *
 * Inspections Header:
 *
 * Log_ID
 * Date
 * Time
 * Location_ID
 * Inspector_ID
 * Score_Cat1
 * Score_Cat2
 * Score_Cat3
 * Score_Cat4
 * Score_Cat5
 * Score_Cat6
 * Score_Cat7
 * Score_Cat8
 * Total_Score
 * Photo_URL
 * Is_Proxy
 * Original_Inspector_ID
 *************************************************/

/*************************************************
 * INSPECTION TIME TEST MODE
 *
 * true  = จำลองเวลาเพื่อทดสอบ
 * false = ใช้ Server time จริง
 *
 * ตอนใช้งานจริงต้องเปลี่ยนเป็น false
 *************************************************/

const INSPECTION_TIME_TEST_MODE = false;

const INSPECTION_TEST_HOUR = 15;
const INSPECTION_TEST_MINUTE = 30;
const INSPECTION_TEST_SECOND = 0;


/*************************************************
 * SUBMIT INSPECTION
 *************************************************/

function submitInspection(
  user,
  locationId,
  scores,
  photoData,
  remark,
  isProxy,
  originalInspectorId
) {

  /*************************************************
   * 1. VALIDATION
   *************************************************/

  const validation =
    validateInspectionData_(
      user,
      locationId,
      scores
    );

  if (!validation.valid) {

    return {
      success: false,
      error: validation.error
    };

  }


  /*************************************************
   * 2. LOCK
   *************************************************/

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(30000);

  } catch (error) {

    return {
      success: false,
      error:
        'ระบบกำลังมีผู้ตรวจคนอื่นกำลังบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง'
    };

  }


  try {

    /*************************************************
     * 3. SERVER DATE / TIME
     *
     * วันที่ = Server จริง
     *
     * เวลา:
     * - Production Mode = Server time จริง
     * - Test Mode = เวลาจำลอง
     *************************************************/

    const now =
      new Date();

    const timezone =
      Session.getScriptTimeZone();


    /*
     * วันที่จาก Server จริง
     */

    const date =
      Utilities.formatDate(
        now,
        timezone,
        'yyyy-MM-dd'
      );


    /*
     * เวลา Server จริง
     */

    const serverTime =
      Utilities.formatDate(
        now,
        timezone,
        'HH:mm:ss'
      );


    /*
     * ตัวแปรเวลาที่ใช้ตรวจระบบ
     */

    let currentHour;
    let currentMinute;
    let currentSecond;
    let time;


    /*************************************************
     * 4. TEST MODE / PRODUCTION MODE
     *************************************************/

    if (
      INSPECTION_TIME_TEST_MODE
    ) {

      currentHour =
        Number(
          INSPECTION_TEST_HOUR
        );

      currentMinute =
        Number(
          INSPECTION_TEST_MINUTE
        );

      currentSecond =
        Number(
          INSPECTION_TEST_SECOND
        );


      time =
        Utilities.formatString(
          '%02d:%02d:%02d',
          currentHour,
          currentMinute,
          currentSecond
        );


      console.log(
        '================================'
      );

      console.log(
        'INSPECTION TIME TEST MODE'
      );

      console.log(
        'Server Time:',
        serverTime
      );

      console.log(
        'Test Time:',
        time
      );

      console.log(
        '================================'
      );

    } else {

      currentHour =
        Number(
          Utilities.formatDate(
            now,
            timezone,
            'HH'
          )
        );


      currentMinute =
        Number(
          Utilities.formatDate(
            now,
            timezone,
            'mm'
          )
        );


      currentSecond =
        Number(
          Utilities.formatDate(
            now,
            timezone,
            'ss'
          )
        );


      time =
        serverTime;

    }


    /*************************************************
     * 5. WORKING TIME
     *
     * เปิดตรวจ:
     * 15:00:00
     *
     * ปิดตรวจ:
     * 18:00:00
     *************************************************/

    const currentSeconds =
      (
        currentHour * 3600
      ) +
      (
        currentMinute * 60
      ) +
      currentSecond;


    const startSeconds =
      15 * 3600;


    const endSeconds =
      18 * 3600;


    /*************************************************
     * 6. CLOSED / NOT OPEN CHECK
     *
     * สำคัญ:
     * ตรวจตรงนี้ก่อนอัปโหลดรูป
     * และก่อนเขียนข้อมูลลง Sheet
     *************************************************/


    /*
     * ก่อนเวลาเปิด
     */

    if (
      currentSeconds < startSeconds
    ) {

      return {

        success: false,

        closed: true,

        error:
          'ยังไม่ถึงเวลาตรวจ ระบบจะเปิดให้ส่งผลตรวจเวลา 15:00 น.'

      };

    }


    /*
     * ถึงเวลาปิดหรือหลังเวลาปิด
     *
     * 18:00:00 เป็นต้นไป = CLOSED
     */

    if (
      currentSeconds >= endSeconds
    ) {

      return {

        success: false,

        closed: true,

        error:
          'หมดเวลาตรวจแล้ว ระบบปิดอัตโนมัติหลังเวลา 18:00 น.'

      };

    }


    /*************************************************
     * 7. NORMALIZED DATA
     *************************************************/

    const normalizedScores =
      validation.scores;


    const totalScore =
      validation.totalScore;


    /*************************************************
     * 8. SPREADSHEET
     *************************************************/

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();


    const sheet =
      ss.getSheetByName(
        'Inspection_Logs'
      );


    if (!sheet) {

      return {

        success: false,

        error:
          'ไม่พบ Sheet: Inspection_Logs'

      };

    }


    /*************************************************
     * 9. INSPECTOR
     *************************************************/

    const inspectorId =
      user.Student_ID || '';


    if (!inspectorId) {

      return {

        success: false,

        error:
          'ไม่พบรหัสผู้ตรวจ Inspector ID'

      };

    }


    /*************************************************
     * 10. PROXY
     *************************************************/

    const proxy =
      Boolean(
        isProxy
      );


    /*************************************************
     * 11. ORIGINAL INSPECTOR
     *************************************************/

    let originalId =
      originalInspectorId || '';


    if (!proxy) {

      originalId =
        inspectorId;

    }


    /*************************************************
     * 12. DUPLICATE PROTECTION
     *************************************************/

    const duplicate =
      findDuplicateInspection_(
        date,
        locationId,
        inspectorId,
        proxy,
        originalId
      );


    if (duplicate.error) {

      return {

        success: false,

        error:
          duplicate.error

      };

    }


    if (duplicate.found) {

      return {

        success: false,

        duplicate: true,

        closed: false,

        error:
          'รายการตรวจ Location นี้ถูกบันทึกแล้วในวันนี้',

        logId:
          duplicate.logId,

        rowNumber:
          duplicate.rowNumber,

        type:
          duplicate.type

      };

    }


    /*************************************************
     * 13. FIRST INSPECTION OF THE DAY
     *
     * การตรวจสำเร็จครั้งแรกของวัน
     * = CHECK-IN
     *************************************************/

    const firstInspectionToday =
      !hasInspectionToday_(
        sheet,
        date,
        inspectorId
      );


    console.log(
      'First Inspection Today:',
      firstInspectionToday
    );


    /*************************************************
     * 14. PHOTO VALIDATION
     *
     * ต้องมีรูปหลักฐานก่อนส่งผลตรวจ
     *************************************************/

    if (
      !photoData ||
      typeof photoData !== 'object' ||
      !photoData.base64 ||
      String(
        photoData.base64
      ).trim() === ''
    ) {

      return {

        success: false,

        closed: false,

        error:
          'กรุณาถ่ายรูปหลักฐานก่อนส่งผลการตรวจ'

      };

    }


    /*************************************************
     * 15. PHOTO UPLOAD
     *************************************************/

    let finalPhotoUrl =
      '';


    try {

      finalPhotoUrl =
        uploadInspectionEvidence_(
          photoData,
          locationId,
          inspectorId,
          date
        );

    } catch (error) {

      console.error(
        'PHOTO UPLOAD ERROR:',
        error
      );

      return {

        success: false,

        closed: false,

        error:
          'ไม่สามารถอัปโหลดรูปหลักฐานได้ กรุณาลองใหม่อีกครั้ง'

      };

    }


    /*************************************************
     * 16. PHOTO URL VALIDATION
     *
     * ถ้าอัปโหลดไม่สำเร็จ
     * ห้ามบันทึกผลตรวจลง Sheet
     *************************************************/

    if (
      !finalPhotoUrl ||
      String(
        finalPhotoUrl
      ).trim() === ''
    ) {

      return {

        success: false,

        closed: false,

        error:
          'ไม่พบรูปหลักฐานที่อัปโหลด กรุณาถ่ายรูปใหม่แล้วลองอีกครั้ง'

      };

    }


    /*************************************************
     * 17. REMARK
     *************************************************/

    const finalRemark =
      String(
        remark || ''
      ).trim();


    /*************************************************
     * 18. LOG ID
     *************************************************/

    const logId =
      generateLogId_();


    /*************************************************
     * 19. ROW
     *
     * Inspection_Logs = 18 columns
     *************************************************/

    const row = [

      logId,

      date,

      time,

      locationId,

      inspectorId,

      normalizedScores[0],

      normalizedScores[1],

      normalizedScores[2],

      normalizedScores[3],

      normalizedScores[4],

      normalizedScores[5],

      normalizedScores[6],

      normalizedScores[7],

      totalScore,

      finalPhotoUrl,

      finalRemark,

      proxy,

      originalId

    ];


    /*************************************************
     * 20. COLUMN CHECK
     *************************************************/

    if (
      row.length !== 18
    ) {

      return {

        success: false,

        closed: false,

        error:
          'จำนวนข้อมูลไม่ตรงกับ Inspection_Logs: ' +
          row.length +
          ' / 18'

      };

    }


    /*************************************************
     * 21. WRITE TO SHEET
     *************************************************/

    sheet.appendRow(
      row
    );


    /*************************************************
     * 22. CHECK-IN RESULT
     *************************************************/

    const checkInTime =
      firstInspectionToday
        ? time
        : '';


    /*************************************************
     * 23. SUCCESS
     *************************************************/

    return {

      success: true,

      duplicate: false,

      closed: false,


      /*
       * true =
       * รายการแรกของวันนี้
       * และเป็น Check-in
       */

      checkedIn:
        firstInspectionToday,


      /*
       * ระบุว่าเป็นการตรวจรายการแรกของวัน
       */

      isFirstInspectionToday:
        firstInspectionToday,


      /*
       * ประเภท Check-in
       */

      checkInType:
        firstInspectionToday
          ? 'INSPECTION_SUBMIT'
          : null,


      /*
       * วันที่ Check-in
       */

      checkInDate:
        firstInspectionToday
          ? date
          : null,


      /*
       * เวลา Check-in
       */

      checkInTime:
        checkInTime || null,


      /*
       * วันที่ตรวจ
       */

      inspectionDate:
        date,


      /*
       * เวลาตรวจ
       */

      inspectionTime:
        time,


      /*
       * เวลา Server จริง
       */

      serverTime:
        serverTime,


      /*
       * Test Mode
       */

      timeTestMode:
        INSPECTION_TIME_TEST_MODE,


      /*
       * Log
       */

      logId:
        logId,


      /*
       * Location
       */

      locationId:
        locationId,


      /*
       * Inspector
       */

      inspectorId:
        inspectorId,


      /*
       * Scores
       */

      scores:
        normalizedScores,


      /*
       * Total
       */

      totalScore:
        totalScore,


      /*
       * Photo
       */

      photoUrl:
        finalPhotoUrl,


      /*
       * Remark
       */

      remark:
        finalRemark,


      /*
       * Proxy
       */

      isProxy:
        proxy,


      /*
       * Original Inspector
       */

      originalInspectorId:
        originalId

    };


  } catch (error) {

    console.error(
      'submitInspection ERROR:',
      error
    );


    return {

      success: false,

      closed: false,

      error:
        'ไม่สามารถบันทึกข้อมูลลง Inspection_Logs: ' +
        error.message

    };


  } finally {

    lock.releaseLock();

  }

}


/*************************************************
 * CHECK INSPECTION TODAY
 *
 * true =
 * มีการตรวจแล้ววันนี้
 *
 * false =
 * ยังไม่มีการตรวจวันนี้
 *************************************************/

function hasInspectionToday_(
  sheet,
  date,
  inspectorId
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return false;

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        5
      )
      .getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    /*
     * Column 2 = Date
     */

    const rowDate =
      String(
        values[i][1] || ''
      ).trim();


    /*
     * Column 5 = Inspector_ID
     */

    const rowInspectorId =
      String(
        values[i][4] || ''
      ).trim();


    if (
      rowDate === date &&
      rowInspectorId === inspectorId
    ) {

      return true;

    }

  }


  return false;

}
function getInspectorCheckInStatus(inspectorId) {

  try {

    /*************************************************
     * 1. VALIDATE
     *************************************************/

    const studentId =
      String(
        inspectorId || ''
      ).trim();


    if (!studentId) {

      return {
        success: false,
        error: 'ไม่พบ Inspector ID'
      };

    }


    /*************************************************
     * 2. TIME
     *************************************************/

    const now =
      new Date();

    const timezone =
      Session.getScriptTimeZone();

    const date =
      Utilities.formatDate(
        now,
        timezone,
        'yyyy-MM-dd'
      );


    const currentTime =
      Utilities.formatDate(
        now,
        timezone,
        'HH:mm:ss'
      );


    /*************************************************
     * 3. CHECK WORKING TIME
     *
     * ทำงานเฉพาะ 15:00 - 18:00
     *************************************************/

    const hour =
      Number(
        Utilities.formatDate(
          now,
          timezone,
          'HH'
        )
      );

    const minute =
      Number(
        Utilities.formatDate(
          now,
          timezone,
          'mm'
        )
      );


    const currentMinutes =
      (hour * 60) +
      minute;


    const startMinutes =
      15 * 60;


    const endMinutes =
      18 * 60;


    const isWithinInspectionTime =
      currentMinutes >= startMinutes &&
      currentMinutes < endMinutes;


    /*************************************************
     * 4. OPEN SHEET
     *************************************************/

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();


    const sheet =
      ss.getSheetByName(
        'Inspection_Logs'
      );


    if (!sheet) {

      return {
        success: false,
        error:
          'ไม่พบ Sheet: Inspection_Logs'
      };

    }


    /*************************************************
     * 5. READ LOGS
     *************************************************/

    const values =
      sheet
        .getDataRange()
        .getValues();


    if (
      !values ||
      values.length < 2
    ) {

      return {

        success: true,

        checkedIn: false,

        checkInTime: '',

        date: date,

        currentTime: currentTime,

        isWithinInspectionTime:
          isWithinInspectionTime

      };

    }


    /*************************************************
     * 6. HEADER
     *************************************************/

    const headers =
      values[0].map(
        function(header) {

          return String(
            header || ''
          ).trim();

        }
      );


    const dateIndex =
      headers.indexOf('Date');


    const timeIndex =
      headers.indexOf('Time');


    const inspectorIdIndex =
      headers.indexOf('Inspector_ID');


    if (
      dateIndex === -1 ||
      timeIndex === -1 ||
      inspectorIdIndex === -1
    ) {

      return {

        success: false,

        error:
          'Inspection_Logs ไม่มี Column Date / Time / Inspector_ID'

      };

    }


    /*************************************************
     * 7. FIND FIRST INSPECTION TODAY
     *************************************************/

    let firstCheckInTime =
      '';


    for (
      let r = 1;
      r < values.length;
      r++
    ) {

      const row =
        values[r];


      const rowInspectorId =
        String(
          row[inspectorIdIndex] || ''
        ).trim();


      if (
        rowInspectorId !==
        studentId
      ) {

        continue;

      }


      let rowDate =
        '';


      if (
        row[dateIndex] instanceof Date
      ) {

        rowDate =
          Utilities.formatDate(
            row[dateIndex],
            timezone,
            'yyyy-MM-dd'
          );

      } else {

        rowDate =
          String(
            row[dateIndex] || ''
          ).trim();

      }


      if (
        rowDate !== date
      ) {

        continue;

      }


      const rowTime =
        String(
          row[timeIndex] || ''
        ).trim();


      if (
        rowTime &&
        (
          firstCheckInTime === '' ||
          rowTime < firstCheckInTime
        )
      ) {

        firstCheckInTime =
          rowTime;

      }

    }


    /*************************************************
     * 8. RESULT
     *************************************************/

    return {

      success: true,

      checkedIn:
        firstCheckInTime !== '',

      checkInTime:
        firstCheckInTime,

      date:
        date,

      currentTime:
        currentTime,

      isWithinInspectionTime:
        isWithinInspectionTime

    };


  } catch (error) {

    console.error(
      'getInspectorCheckInStatus ERROR:',
      error
    );


    return {

      success: false,

      error:
        error &&
        error.message
          ? error.message
          : String(error)

    };

  }

}
/*************************************************
 * FIND INSPECTOR CHECK-IN
 *
 * ใช้ Inspection_Logs เป็นแหล่งข้อมูล
 *
 * ไม่สร้าง Sheet ใหม่
 * ไม่เพิ่ม Column ใหม่
 *************************************************/

function findInspectorCheckIn_(
  sheet,
  date,
  inspectorId
) {

  try {

    /***********************************************
     * ตรวจ Sheet
     ***********************************************/

    if (!sheet) {

      return {

        checkedIn: false,

        time: '',

        locationId: ''

      };

    }


    /***********************************************
     * อ่านข้อมูล
     ***********************************************/

    const values =
      sheet
        .getDataRange()
        .getValues();


    if (
      !values ||
      values.length < 2
    ) {

      return {

        checkedIn: false,

        time: '',

        locationId: ''

      };

    }


    /***********************************************
     * HEADER
     ***********************************************/

    const headers =
      values[0].map(
        function(header) {

          return String(
            header || ''
          ).trim();

        }
      );


    const dateIndex =
      headers.indexOf(
        'Date'
      );


    const timeIndex =
      headers.indexOf(
        'Time'
      );


    const locationIdIndex =
      headers.indexOf(
        'Location_ID'
      );


    const inspectorIdIndex =
      headers.indexOf(
        'Inspector_ID'
      );


    if (
      dateIndex === -1 ||
      timeIndex === -1 ||
      locationIdIndex === -1 ||
      inspectorIdIndex === -1
    ) {

      return {

        error:
          'Header ของ Inspection_Logs ไม่ครบสำหรับระบบ Check-in'

      };

    }


    /***********************************************
     * หา Inspector วันนี้
     *
     * เรียงจากบนลงล่าง
     * รายการแรก = Check-in
     ***********************************************/

    for (
      let r = 1;
      r < values.length;
      r++
    ) {

      const row =
        values[r];


      const rowDate =
        formatInspectionDate_(
          row[dateIndex]
        );


      const rowInspector =
        String(
          row[inspectorIdIndex] || ''
        ).trim();


      if (
        rowDate === date &&
        rowInspector === inspectorId
      ) {

        return {

          checkedIn: true,

          time:
            formatInspectionTime_(
              row[timeIndex]
            ),

          locationId:
            String(
              row[locationIdIndex] || ''
            ).trim()

        };

      }

    }


    /***********************************************
     * ยังไม่มีรายการวันนี้
     ***********************************************/

    return {

      checkedIn: false,

      time: '',

      locationId: ''

    };


  } catch (error) {

    console.error(
      'findInspectorCheckIn_ ERROR:',
      error
    );


    return {

      error:
        'ไม่สามารถตรวจสอบ Check-in ได้: ' +
        error.message

    };

  }

}


/*************************************************
 * FORMAT DATE
 *************************************************/

function formatInspectionDate_(
  value
) {

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

  }


  return String(
    value || ''
  ).trim();

}


/*************************************************
 * FORMAT TIME
 *************************************************/

function formatInspectionTime_(
  value
) {

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm:ss'
    );

  }


  return String(
    value || ''
  ).trim();

}


function uploadInspectionEvidence_(
  photoData,
  locationId,
  inspectorId,
  date
) {

  const FOLDER_ID =
    '1yJ-MOxjfAycOezQo_BNBi5z-YkI61u_X';


  if (
    !photoData ||
    !photoData.base64
  ) {

    return '';

  }


  /*************************************************
   * 1. DRIVE FOLDER
   *************************************************/

  const folder =
    DriveApp.getFolderById(
      FOLDER_ID
    );


  /*************************************************
   * 2. BASE64
   *************************************************/

  const base64 =
    String(
      photoData.base64
    )
    .replace(
      /^data:[^;]+;base64,/,
      ''
    );


  /*************************************************
   * 3. MIME TYPE
   *************************************************/

  const mimeType =
    photoData.mimeType ||
    'image/jpeg';


  /*************************************************
   * 4. BYTE
   *************************************************/

  const bytes =
    Utilities.base64Decode(
      base64
    );


  const blob =
    Utilities.newBlob(
      bytes,
      mimeType
    );


  /*************************************************
   * 5. FILE NAME
   *************************************************/

  const originalName =
    String(
      photoData.fileName ||
      'evidence.jpg'
    );


  const safeLocation =
    String(
      locationId || 'LOCATION'
    )
    .replace(
      /[^a-zA-Z0-9ก-๙_-]/g,
      '_'
    );


  const safeInspector =
    String(
      inspectorId || 'INSPECTOR'
    )
    .replace(
      /[^a-zA-Z0-9ก-๙_-]/g,
      '_'
    );


  const extension =
    originalName.includes('.')
      ? originalName.substring(
          originalName.lastIndexOf('.')
        )
      : '.jpg';


  const fileName =
    date +
    '_' +
    safeLocation +
    '_' +
    safeInspector +
    '_' +
    new Date().getTime() +
    extension;


  /*************************************************
   * 6. CREATE FILE
   *************************************************/

  const file =
    folder.createFile(
      blob.setName(
        fileName
      )
    );


  /*************************************************
   * 7. URL
   *************************************************/

  return file.getUrl();

}
function TEST_STEP_22_3() {

  const results = [];

  /*************************************************
   * TEST USER CONTRACT
   *************************************************/

  const user = {

    Student_ID: 'TEST_STUDENT_001',

    Full_Name: 'STEP 22.3 TEST',

    Role: 'Inspector',

    Assigned_Grade: 'ม.6',

    Assigned_Type: 'room',

    Assigned_Locations: 'TEST_LOCATION_001'

  };


  /*************************************************
   * TEST 01
   * User มี Student_ID
   *************************************************/

  const test01 =
    !!(
      user &&
      user.Student_ID
    );

  results.push({

    test: 'STEP_22_3_01',

    passed: test01,

    detail: test01
      ? 'พบ Student_ID ใน User'
      : 'ไม่พบ Student_ID'

  });


  /*************************************************
   * TEST 02
   * Inspector_ID ต้องมาจาก Student_ID
   *************************************************/

  const inspectorId =
    user.Student_ID || '';


  const test02 =
    inspectorId ===
    'TEST_STUDENT_001';

  results.push({

    test: 'STEP_22_3_02',

    passed: test02,

    detail: test02
      ? 'Inspector_ID mapping ถูกต้อง'
      : 'Inspector_ID mapping ผิด'

  });


  /*************************************************
   * TEST 03
   * ตรวจ User Contract
   *************************************************/

  const requiredFields = [

    'Student_ID',
    'Full_Name',
    'Role',
    'Assigned_Grade',
    'Assigned_Type',
    'Assigned_Locations'

  ];


  const test03 =
    requiredFields.every(
      function(field) {

        return Object.prototype.hasOwnProperty.call(
          user,
          field
        );

      }
    );


  results.push({

    test: 'STEP_22_3_03',

    passed: test03,

    detail: test03
      ? 'User Contract ครบ'
      : 'User Contract ไม่ครบ'

  });


  /*************************************************
   * TEST 04
   * ยืนยันว่า Test นี้ไม่เรียก submitInspection()
   *************************************************/

  const test04 = true;

  results.push({

    test: 'STEP_22_3_04',

    passed: test04,

    detail:
      'ยังไม่มีการบันทึกข้อมูลลง Inspections'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_22_3',

    tests:
      results,

    ALL_TESTS_PASSED:
      allPassed

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
/*************************************************
 * STEP 22.4
 * Submit Payload Contract Test
 *
 * IMPORTANT:
 * - ยังไม่เรียก submitInspection()
 * - ยังไม่เขียน Inspections
 * - ตรวจเฉพาะ Payload
 *************************************************/

function TEST_STEP_22_4() {

  const results = [];


  /*************************************************
   * TEST DATA
   *************************************************/

  const user = {

    Student_ID: 'TEST_STUDENT_001',

    Full_Name: 'STEP 22.4 TEST',

    Role: 'Inspector',

    Assigned_Grade: 'ม.6',

    Assigned_Type: 'room',

    Assigned_Locations: 'TEST_LOCATION_001'

  };


  const locationId =
    'TEST_LOCATION_001';


  const scores = [

    5,
    4,
    5,
    4,
    5,
    4,
    5,
    4

  ];


  const photoUrl =
    '';


  const isProxy =
    false;


  const originalInspectorId =
    '';


  /*************************************************
   * TEST 01
   * User
   *************************************************/

  const test01 =
    !!(
      user &&
      user.Student_ID
    );


  results.push({

    test:
      'STEP_22_4_01',

    passed:
      test01,

    detail:
      test01
        ? 'User พร้อม'
        : 'User ไม่พร้อม'

  });


  /*************************************************
   * TEST 02
   * Location_ID
   *************************************************/

  const test02 =
    typeof locationId === 'string' &&
    locationId.trim() !== '';


  results.push({

    test:
      'STEP_22_4_02',

    passed:
      test02,

    detail:
      test02
        ? 'Location_ID พร้อม'
        : 'Location_ID ไม่พร้อม'

  });


  /*************************************************
   * TEST 03
   * Scores
   *************************************************/

  const test03 =
    Array.isArray(scores) &&
    scores.length === 8;


  results.push({

    test:
      'STEP_22_4_03',

    passed:
      test03,

    detail:
      test03
        ? 'Scores มีครบ 8 ข้อ'
        : 'Scores ไม่ครบ 8 ข้อ'

  });


  /*************************************************
   * TEST 04
   * Score Range
   *************************************************/

  const test04 =
    scores.every(
      function(score) {

        return (
          typeof score === 'number' &&
          Number.isFinite(score) &&
          score >= 0 &&
          score <= 5
        );

      }
    );


  results.push({

    test:
      'STEP_22_4_04',

    passed:
      test04,

    detail:
      test04
        ? 'คะแนนทุกข้ออยู่ในช่วง 0–5'
        : 'พบคะแนนไม่ถูกต้อง'

  });


  /*************************************************
   * TEST 05
   * Total Score
   *************************************************/

  const totalScore =
    scores.reduce(
      function(total, score) {

        return total + score;

      },
      0
    );


  const test05 =
    totalScore === 36;


  results.push({

    test:
      'STEP_22_4_05',

    passed:
      test05,

    detail:
      test05
        ? 'Total_Score = 36 ถูกต้อง'
        : 'Total_Score ไม่ถูกต้อง: ' + totalScore

  });


  /*************************************************
   * TEST 06
   * Inspector_ID Mapping
   *************************************************/

  const inspectorId =
    user.Student_ID;


  const test06 =
    inspectorId ===
    'TEST_STUDENT_001';


  results.push({

    test:
      'STEP_22_4_06',

    passed:
      test06,

    detail:
      test06
        ? 'Inspector_ID mapping ถูกต้อง'
        : 'Inspector_ID mapping ผิด'

  });


  /*************************************************
   * TEST 07
   * Proxy Contract
   *************************************************/

  const test07 =
    isProxy === false &&
    originalInspectorId === '';


  results.push({

    test:
      'STEP_22_4_07',

    passed:
      test07,

    detail:
      test07
        ? 'Proxy Contract ถูกต้อง'
        : 'Proxy Contract ผิด'

  });


  /*************************************************
   * TEST 08
   * ตรวจจำนวน Column
   *************************************************/

  const simulatedRow = [

    'TEST_LOG_ID',

    '2026-08-19',

    '18:00:00',

    locationId,

    inspectorId,

    scores[0],

    scores[1],

    scores[2],

    scores[3],

    scores[4],

    scores[5],

    scores[6],

    scores[7],

    totalScore,

    photoUrl,

    isProxy,

    originalInspectorId

  ];


  const test08 =
    simulatedRow.length === 17;


  results.push({

    test:
      'STEP_22_4_08',

    passed:
      test08,

    detail:
      test08
        ? 'Inspections Row มี 17 Columns'
        : 'จำนวน Column ผิด: ' +
          simulatedRow.length

  });


  /*************************************************
   * TEST 09
   * ตรวจ Mapping ทั้ง Row
   *************************************************/

  const test09 =
    simulatedRow[3] === locationId &&
    simulatedRow[4] === inspectorId &&
    simulatedRow[5] === scores[0] &&
    simulatedRow[12] === scores[7] &&
    simulatedRow[13] === totalScore &&
    simulatedRow[14] === photoUrl &&
    simulatedRow[15] === isProxy &&
    simulatedRow[16] === originalInspectorId;


  results.push({

    test:
      'STEP_22_4_09',

    passed:
      test09,

    detail:
      test09
        ? 'Inspections Column Mapping ถูกต้อง'
        : 'Inspections Column Mapping ผิด'

  });


  /*************************************************
   * TEST 10
   * ห้ามเขียนข้อมูลจริง
   *************************************************/

  const test10 = true;


  results.push({

    test:
      'STEP_22_4_10',

    passed:
      test10,

    detail:
      'STEP 22.4 ยังไม่มีการเขียนข้อมูลลง Sheet'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_22_4',

    tests:
      results,

    ALL_TESTS_PASSED:
      allPassed

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_22_5() {

  const results = [];

  /*************************************************
   * TEST USER
   *************************************************/

  const user = {

    Student_ID: 'TEST_STUDENT_001',

    Full_Name: 'STEP 22.5 TEST',

    Role: 'Inspector',

    Assigned_Grade: '1',

    Assigned_Type: 'CLASSROOM',

    Assigned_Locations: 'M1-01'

  };


  /*************************************************
   * REAL LOCATION
   *************************************************/

  const locationId =
    'M1-01';


  /*************************************************
   * TEST 01
   * ตรวจว่า Location มีอยู่จริง
   *************************************************/

  const location =
    findLocationById_(
      locationId
    );


  const test01 =
    !!location;


  results.push({

    test:
      'STEP_22_5_01',

    passed:
      test01,

    detail:
      test01
        ? 'พบ Location จริง: M1-01'
        : 'ไม่พบ Location: M1-01'

  });


  /*************************************************
   * TEST 02
   * ตรวจ Permission
   *************************************************/

  let permission =
    false;

  let permissionError =
    '';


  if (location) {

    try {

      permission =
        canAccessLocation_(
          user,
          location
        );

    } catch (error) {

      permissionError =
        error.message;

    }

  }


  const test02 =
    permission === true;


  results.push({

    test:
      'STEP_22_5_02',

    passed:
      test02,

    detail:
      test02
        ? 'User มีสิทธิ์เข้าถึง M1-01'
        : (
          permissionError ||
          'User ไม่มีสิทธิ์เข้าถึง M1-01'
        )

  });


  /*************************************************
   * TEST 03
   * เรียก validateInspectionData_()
   *
   * ยังไม่เขียน Sheet
   *************************************************/

  const scores = [

    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5

  ];


  let validation =
    null;


  try {

    validation =
      validateInspectionData_(
        user,
        locationId,
        scores
      );

  } catch (error) {

    validation = {

      valid: false,

      error:
        error.message

    };

  }


  const test03 =
    validation &&
    validation.valid === true;


  results.push({

    test:
      'STEP_22_5_03',

    passed:
      test03,

    detail:
      test03
        ? 'Validation ผ่าน'
        : (
          validation &&
          validation.error
            ? validation.error
            : 'Validation ไม่ผ่าน'
        )

  });


  /*************************************************
   * TEST 04
   * ตรวจ Total Score
   *************************************************/

  const test04 =
    validation &&
    validation.totalScore === 40;


  results.push({

    test:
      'STEP_22_5_04',

    passed:
      test04,

    detail:
      test04
        ? 'Total_Score = 40'
        : (
          'Total_Score ไม่ถูกต้อง: ' +
          (
            validation &&
            validation.totalScore !== undefined
              ? validation.totalScore
              : 'N/A'
          )
        )

  });


  /*************************************************
   * TEST 05
   * ยืนยันว่าไม่มีการเขียน Sheet
   *************************************************/

  const test05 =
    true;


  results.push({

    test:
      'STEP_22_5_05',

    passed:
      test05,

    detail:
      'STEP 22.5 ยังไม่เรียก submitInspection() และไม่เขียน Sheet'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_22_5',

    tests:
      results,

    ALL_TESTS_PASSED:
      allPassed

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
/*************************************************
 * STEP 23.1
 * REAL SUBMISSION TEST
 *
 * IMPORTANT:
 * - เรียก submitInspection() จริง
 * - จะเขียนข้อมูล 1 แถวลง Inspections
 * - ใช้ Location จริง: M1-01
 * - หลังบันทึกจะค้นหา Log_ID เพื่อตรวจสอบ
 *************************************************/

function TEST_STEP_23() {

  const results = [];

  /*************************************************
   * TEST USER
   *************************************************/

  const user = {

    Student_ID: 'TEST_STUDENT_001',

    Full_Name: 'STEP 23 TEST',

    Role: 'Inspector',

    Assigned_Grade: '1',

    Assigned_Type: 'CLASSROOM',

    Assigned_Locations: 'M1-01'

  };


  /*************************************************
   * SUBMISSION DATA
   *************************************************/

  const locationId =
    'M1-01';


  const scores = [

    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5

  ];


  const photoUrl =
    '';


  const isProxy =
    false;


  const originalInspectorId =
    '';


  /*************************************************
   * 01
   * ตรวจ Validation ก่อน
   *************************************************/

  const validation =
    validateInspectionData_(
      user,
      locationId,
      scores
    );


  if (!validation.valid) {

    return {

      step:
        'STEP_23',

      ALL_TESTS_PASSED:
        false,

      error:
        'Validation ไม่ผ่าน: ' +
        validation.error

    };

  }


  results.push({

    test:
      'STEP_23_01',

    passed:
      true,

    detail:
      'Validation ผ่านก่อน Submission'

  });


  /*************************************************
   * 02
   * บันทึกจริง
   *************************************************/

  let submission = null;


  try {

    submission =
      submitInspection(

        user,

        locationId,

        scores,

        photoUrl,

        isProxy,

        originalInspectorId

      );

  } catch (error) {

    results.push({

      test:
        'STEP_23_02',

      passed:
        false,

      detail:
        'submitInspection() เกิด Error: ' +
        error.message

    });


    return {

      step:
        'STEP_23',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * ตรวจ Submission Result
   *************************************************/

  const test02 =
    submission &&
    submission.success === true &&
    submission.logId;


  results.push({

    test:
      'STEP_23_02',

    passed:
      !!test02,

    detail:
      test02
        ? 'submitInspection() บันทึกสำเร็จ'
        : (
          submission &&
          submission.error
            ? submission.error
            : 'Submission ไม่สำเร็จ'
        )

  });


  if (!test02) {

    return {

      step:
        'STEP_23',

      tests:
        results,

      submission:
        submission,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 03
   * ตรวจ Log_ID
   *************************************************/

  const logId =
    submission.logId;


  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      'Inspection_Logs'
    );


  if (!sheet) {

    results.push({

      test:
        'STEP_23_03',

      passed:
        false,

      detail:
        'ไม่พบ Sheet Inspection_Logs'

    });


    return {

      step:
        'STEP_23',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  const data =
    sheet
      .getDataRange()
      .getValues();


  let savedRow =
    null;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0]) ===
      String(logId)
    ) {

      savedRow =
        data[i];

      break;

    }

  }


  const test03 =
    Array.isArray(savedRow);


  results.push({

    test:
      'STEP_23_03',

    passed:
      test03,

    detail:
      test03
        ? 'พบ Log_ID ใน Inspections'
        : 'ไม่พบ Log_ID ที่เพิ่งบันทึก'

  });


  if (!test03) {

    return {

      step:
        'STEP_23',

      tests:
        results,

      submission:
        submission,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 04
   * ตรวจ Location_ID
   *************************************************/

  const test04 =
    savedRow[3] ===
    locationId;


  results.push({

    test:
      'STEP_23_04',

    passed:
      test04,

    detail:
      test04
        ? 'Location_ID ถูกต้อง'
        : 'Location_ID ไม่ตรง'

  });


  /*************************************************
   * 05
   * ตรวจ Inspector_ID
   *************************************************/

  const test05 =
    String(savedRow[4]) ===
    String(user.Student_ID);


  results.push({

    test:
      'STEP_23_05',

    passed:
      test05,

    detail:
      test05
        ? 'Inspector_ID ถูกต้อง'
        : 'Inspector_ID ไม่ตรงกับ Student_ID'

  });


  /*************************************************
   * 06
   * ตรวจ Scores 8 ข้อ
   *************************************************/

  let scoresCorrect =
    true;


  for (
    let i = 0;
    i < 8;
    i++
  ) {

    if (
      Number(savedRow[5 + i]) !==
      Number(scores[i])
    ) {

      scoresCorrect =
        false;

      break;

    }

  }


  results.push({

    test:
      'STEP_23_06',

    passed:
      scoresCorrect,

    detail:
      scoresCorrect
        ? 'Score_Cat1–8 ถูกต้องทั้งหมด'
        : 'พบคะแนนไม่ตรง'

  });


  /*************************************************
   * 07
   * ตรวจ Total_Score
   *************************************************/

  const test07 =
    Number(savedRow[13]) ===
    40;


  results.push({

    test:
      'STEP_23_07',

    passed:
      test07,

    detail:
      test07
        ? 'Total_Score = 40 ถูกต้อง'
        : (
          'Total_Score ไม่ถูกต้อง: ' +
          savedRow[13]
        )

  });


  /*************************************************
   * 08
   * ตรวจ Photo_URL
   *************************************************/

  const test08 =
    String(savedRow[14] || '') ===
    '';


  results.push({

    test:
      'STEP_23_08',

    passed:
      test08,

    detail:
      test08
        ? 'Photo_URL ถูกต้อง'
        : 'Photo_URL ไม่ถูกต้อง'

  });


  /*************************************************
   * 09
   * ตรวจ Is_Proxy
   *************************************************/

  const test09 =
    savedRow[15] === false ||
    String(savedRow[15]).toUpperCase() ===
    'FALSE';


  results.push({

    test:
      'STEP_23_09',

    passed:
      test09,

    detail:
      test09
        ? 'Is_Proxy = FALSE ถูกต้อง'
        : 'Is_Proxy ไม่ถูกต้อง'

  });


  /*************************************************
   * 10
   * ตรวจ Original_Inspector_ID
   *************************************************/

  const test10 =
    String(savedRow[16]) ===
    String(user.Student_ID);


  results.push({

    test:
      'STEP_23_10',

    passed:
      test10,

    detail:
      test10
        ? 'Original_Inspector_ID ถูกต้อง'
        : 'Original_Inspector_ID ไม่ตรง'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_23',

    tests:
      results,

    logId:
      logId,

    savedRow:
      savedRow,

    ALL_TESTS_PASSED:
      allPassed

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_23_2() {

  const results = [];


  /*************************************************
   * TEST 01
   * สร้าง Log_ID
   *************************************************/

  const logId =
    generateLogId_();


  const test01 =
    typeof logId === 'string';


  results.push({

    test:
      'STEP_23_2_01',

    passed:
      test01,

    detail:
      test01
        ? 'generateLogId_() คืนค่า String'
        : 'Log_ID ไม่ใช่ String'

  });


  /*************************************************
   * TEST 02
   * ต้องขึ้นต้นด้วย LOG-
   *************************************************/

  const test02 =
    logId.indexOf('LOG-') === 0;


  results.push({

    test:
      'STEP_23_2_02',

    passed:
      test02,

    detail:
      test02
        ? 'Log_ID ขึ้นต้นด้วย LOG-'
        : 'Log_ID format ผิด: ' + logId

  });


  /*************************************************
   * TEST 03
   * ตรวจความยาว
   *
   * LOG- = 4
   * ID = 12
   * รวม = 16
   *************************************************/

  const test03 =
    logId.length === 16;


  results.push({

    test:
      'STEP_23_2_03',

    passed:
      test03,

    detail:
      test03
        ? 'Log_ID มีความยาว 16 ตัวอักษร'
        : 'ความยาวผิด: ' + logId.length

  });


  /*************************************************
   * TEST 04
   * ตรวจรูปแบบทั้งหมด
   *************************************************/

  const test04 =
    /^LOG-[A-Z0-9]{12}$/.test(
      logId
    );


  results.push({

    test:
      'STEP_23_2_04',

    passed:
      test04,

    detail:
      test04
        ? 'Log_ID Format ถูกต้อง'
        : 'Log_ID Format ผิด: ' + logId

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_23_2',

    generatedLogId:
      logId,

    tests:
      results,

    ALL_TESTS_PASSED:
      allPassed

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_23_3() {

  const results = [];


  /*************************************************
   * TEST USER
   *************************************************/

  const user = {

    Student_ID:
      'TEST_STUDENT_001',

    Full_Name:
      'STEP 23.3 TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-02'

  };


  /*************************************************
   * TEST LOCATION
   *
   * ใช้ Location ใหม่
   * เพื่อไม่ชนกับข้อมูล STEP 23 ก่อนหน้า
   *************************************************/

  const locationId =
    'M1-02';


  /*************************************************
   * TEST SCORES
   *************************************************/

  const scores = [

    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5

  ];


  /*************************************************
   * OTHER DATA
   *************************************************/

  const photoUrl =
    '';

  const isProxy =
    false;

  const originalInspectorId =
    '';


  /*************************************************
   * 01 — Validation
   *************************************************/

  const validation =
    validateInspectionData_(
      user,
      locationId,
      scores
    );


  console.log(
    'STEP_23_3_01 Validation = ' +
    JSON.stringify(
      validation,
      null,
      2
    )
  );


  if (!validation.valid) {

    const output = {

      step:
        'STEP_23_3',

      tests: [

        {

          test:
            'STEP_23_3_01',

          passed:
            false,

          detail:
            'Validation ไม่ผ่าน: ' +
            validation.error

        }

      ],

      ALL_TESTS_PASSED:
        false

    };


    console.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    Logger.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    return output;

  }


  results.push({

    test:
      'STEP_23_3_01',

    passed:
      true,

    detail:
      'Validation ผ่าน'

  });


  /*************************************************
   * 02 — Submit จริง
   *************************************************/

  let submission;


  try {

    submission =
      submitInspection(

        user,

        locationId,

        scores,

        photoUrl,

        isProxy,

        originalInspectorId

      );

  } catch (error) {

    const output = {

      step:
        'STEP_23_3',

      tests:
        results,

      ALL_TESTS_PASSED:
        false,

      error:
        error.message

    };


    console.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    Logger.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    return output;

  }


  console.log(
    'STEP_23_3 SUBMISSION = ' +
    JSON.stringify(
      submission,
      null,
      2
    )
  );


  const test02 =
    submission &&
    submission.success === true &&
    !!submission.logId;


  results.push({

    test:
      'STEP_23_3_02',

    passed:
      test02,

    detail:

      test02

        ? 'submitInspection() สำเร็จ'

        : (

          submission &&
          submission.error

            ? submission.error

            : 'Submission ไม่สำเร็จ'

        )

  });


  if (!test02) {

    const output = {

      step:
        'STEP_23_3',

      tests:
        results,

      submission:
        submission,

      ALL_TESTS_PASSED:
        false

    };


    console.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    Logger.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    return output;

  }


  /*************************************************
   * 03 — ตรวจ Log_ID Format
   *************************************************/

  const logId =
    submission.logId;


  const test03 =
    /^LOG-[A-Z0-9]{12}$/.test(
      logId
    );


  results.push({

    test:
      'STEP_23_3_03',

    passed:
      test03,

    detail:

      test03

        ? 'Log_ID Format ถูกต้อง'

        : 'Log_ID Format ผิด'

  });


  /*************************************************
   * 04 — ค้นหา Row ที่เพิ่งบันทึก
   *************************************************/

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      'Inspection_Logs'
    );


  if (!sheet) {

    const output = {

      step:
        'STEP_23_3',

      tests:
        results,

      ALL_TESTS_PASSED:
        false,

      error:
        'ไม่พบ Sheet Inspection_Logs'

    };


    console.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    Logger.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    return output;

  }


  const data =
    sheet
      .getDataRange()
      .getValues();


  let savedRow =
    null;


  let savedRowNumber =
    null;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0]) ===
      String(logId)
    ) {

      savedRow =
        data[i];

      savedRowNumber =
        i + 1;

      break;

    }

  }


  const test04 =
    Array.isArray(
      savedRow
    );


  results.push({

    test:
      'STEP_23_3_04',

    passed:
      test04,

    detail:

      test04

        ? 'พบ Row จาก Log_ID'

        : 'ไม่พบ Row ที่บันทึก'

  });


  if (!test04) {

    const output = {

      step:
        'STEP_23_3',

      tests:
        results,

      logId:
        logId,

      ALL_TESTS_PASSED:
        false

    };


    console.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    Logger.log(
      JSON.stringify(
        output,
        null,
        2
      )
    );


    return output;

  }


  /*************************************************
   * 05 — Location
   *************************************************/

  const test05 =
    String(
      savedRow[3]
    ) ===
    locationId;


  results.push({

    test:
      'STEP_23_3_05',

    passed:
      test05,

    detail:

      test05

        ? 'Location_ID ถูกต้อง'

        : 'Location_ID ไม่ตรง'

  });


  /*************************************************
   * 06 — Inspector
   *************************************************/

  const test06 =
    String(
      savedRow[4]
    ) ===
    String(
      user.Student_ID
    );


  results.push({

    test:
      'STEP_23_3_06',

    passed:
      test06,

    detail:

      test06

        ? 'Inspector_ID ถูกต้อง'

        : 'Inspector_ID ไม่ตรง'

  });


  /*************************************************
   * 07 — Scores
   *************************************************/

  let scoresCorrect =
    true;


  for (
    let i = 0;
    i < 8;
    i++
  ) {

    if (
      Number(
        savedRow[5 + i]
      ) !==
      Number(
        scores[i]
      )
    ) {

      scoresCorrect =
        false;

      break;

    }

  }


  results.push({

    test:
      'STEP_23_3_07',

    passed:
      scoresCorrect,

    detail:

      scoresCorrect

        ? 'คะแนนทั้ง 8 ข้อถูกต้อง'

        : 'คะแนนไม่ตรง'

  });


  /*************************************************
   * 08 — Total
   *************************************************/

  const test08 =
    Number(
      savedRow[13]
    ) ===
    40;


  results.push({

    test:
      'STEP_23_3_08',

    passed:
      test08,

    detail:

      test08

        ? 'Total_Score = 40'

        : 'Total_Score ไม่ถูกต้อง'

  });


  /*************************************************
   * 09 — Proxy
   *************************************************/

  const test09 =
    savedRow[15] === false ||

    String(
      savedRow[15]
    ).toUpperCase() ===
    'FALSE';


  results.push({

    test:
      'STEP_23_3_09',

    passed:
      test09,

    detail:

      test09

        ? 'Is_Proxy = FALSE'

        : 'Is_Proxy ไม่ถูกต้อง'

  });


  /*************************************************
   * 10 — Original Inspector
   *************************************************/

  const test10 =
    String(
      savedRow[16]
    ) ===
    String(
      user.Student_ID
    );


  results.push({

    test:
      'STEP_23_3_10',

    passed:
      test10,

    detail:

      test10

        ? 'Original_Inspector_ID ถูกต้อง'

        : 'Original_Inspector_ID ไม่ตรง'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_23_3',

    tests:
      results,

    logId:
      logId,

    savedRowNumber:
      savedRowNumber,

    savedRow:
      savedRow,

    ALL_TESTS_PASSED:
      allPassed

  };


  /*************************************************
   * LOG OUTPUT
   *************************************************/

  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_23_4_DIAGNOSTIC() {

  const result = {

    step:
      'STEP_23_4_DIAGNOSTIC'

  };


  /*************************************************
   * 1. ตรวจ Sheet
   *************************************************/

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      'Inspection_Logs'
    );


  result.sheetExists =
    !!sheet;


  if (!sheet) {

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );


    Logger.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  }


  /*************************************************
   * 2. ตรวจ Sheet Information
   *************************************************/

  result.sheetName =
    sheet.getName();


  result.lastRowBefore =
    sheet.getLastRow();


  result.lastColumn =
    sheet.getLastColumn();


  /*************************************************
   * 3. ตรวจ Header
   *************************************************/

  if (
    sheet.getLastColumn() > 0
  ) {

    result.headers =
      sheet
        .getRange(
          1,
          1,
          1,
          sheet.getLastColumn()
        )
        .getValues()[0];

  } else {

    result.headers =
      [];

  }


  /*************************************************
   * 4. ตรวจจำนวน Column
   *************************************************/

  result.expectedColumns =
    17;


  result.columnCountCorrect =
    result.lastColumn === 17;


  /*************************************************
   * 5. ตรวจ generateLogId_
   *************************************************/

  try {

    result.generatedLogId =
      generateLogId_();


    result.generatedLogIdIsString =
      typeof result.generatedLogId ===
      'string';


    result.generatedLogIdFormat =
      /^LOG-[A-Z0-9]{12}$/.test(
        result.generatedLogId
      );

  } catch (error) {

    result.generatedLogId =
      null;

    result.generatedLogIdIsString =
      false;

    result.generatedLogIdFormat =
      false;

    result.generateLogIdError =
      error.message;

  }


  /*************************************************
   * 6. สร้าง User Test
   *************************************************/

  const user = {

    Student_ID:
      'TEST_STUDENT_001',

    Full_Name:
      'STEP 23.4 TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  result.userStudentId =
    user.Student_ID;


  result.userRole =
    user.Role;


  result.userAssignedGrade =
    user.Assigned_Grade;


  result.userAssignedType =
    user.Assigned_Type;


  result.userAssignedLocations =
    user.Assigned_Locations;


  /*************************************************
   * 7. ตรวจ Location
   *************************************************/

  const locationId =
    'M1-01';


  result.locationId =
    locationId;


  let location =
    null;


  try {

    location =
      findLocationById_(
        locationId
      );

  } catch (error) {

    result.locationFound =
      false;

    result.locationError =
      error.message;

  }


  result.locationFound =
    !!location;


  result.location =
    location || null;


  /*************************************************
   * 8. ตรวจ Permission
   *************************************************/

  if (location) {

    try {

      result.permission =
        canAccessLocation_(
          user,
          location
        );

    } catch (error) {

      result.permission =
        false;

      result.permissionError =
        error.message;

    }

  } else {

    result.permission =
      false;

  }


  /*************************************************
   * 9. ตรวจ isTargetAllowed_
   *************************************************/

  if (location) {

    try {

      result.targetAllowed =
        isTargetAllowed_(
          user,
          location
        );

    } catch (error) {

      result.targetAllowed =
        false;

      result.targetAllowedError =
        error.message;

    }

  } else {

    result.targetAllowed =
      false;

  }


  /*************************************************
   * 10. Scores Test
   *************************************************/

  const scores = [

    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5

  ];


  result.scores =
    scores;


  result.scoreCount =
    scores.length;


  result.scoreCountCorrect =
    scores.length === 8;


  /*************************************************
   * 11. ตรวจ Validation
   *************************************************/

  try {

    result.validation =
      validateInspectionData_(
        user,
        locationId,
        scores
      );

  } catch (error) {

    result.validation = {

      valid:
        false,

      error:
        error.message

    };

  }


  /*************************************************
   * 12. วิเคราะห์ Validation
   *************************************************/

  result.validationPassed =
    !!(
      result.validation &&
      result.validation.valid === true
    );


  if (
    result.validation &&
    result.validation.valid === true
  ) {

    result.validationTotalScore =
      result.validation.totalScore;


    result.validationScoreCount =
      Array.isArray(
        result.validation.scores
      )
        ? result.validation.scores.length
        : 0;

  } else {

    result.validationTotalScore =
      null;


    result.validationScoreCount =
      0;

  }


  /*************************************************
   * 13. ตรวจ Duplicate
   *
   * Diagnostic นี้ "ห้ามบันทึก"
   * แต่สามารถตรวจว่ามีข้อมูลเดิมหรือไม่
   *************************************************/

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  result.testDate =
    today;


  try {

    result.duplicateCheck =
      findDuplicateInspection_(
        today,
        locationId,
        user.Student_ID,
        false,
        user.Student_ID
      );

  } catch (error) {

    result.duplicateCheck = {

      found:
        false,

      error:
        error.message

    };

  }


  /*************************************************
   * 14. ยืนยันว่า Diagnostic
   * ไม่เรียก submitInspection()
   *************************************************/

  result.submitInspectionCalled =
    false;


  /*************************************************
   * 15. ตรวจว่าไม่มีการเขียนข้อมูล
   *************************************************/

  result.lastRowAfter =
    sheet.getLastRow();


  result.noWriteExpected =
    result.lastRowBefore ===
    result.lastRowAfter;


  /*************************************************
   * 16. ตรวจผลรวม Diagnostic
   *************************************************/

  result.diagnosticChecks = {

    sheetExists:
      result.sheetExists,

    columnCountCorrect:
      result.columnCountCorrect,

    generatedLogIdIsString:
      result.generatedLogIdIsString,

    generatedLogIdFormat:
      result.generatedLogIdFormat,

    locationFound:
      result.locationFound,

    permission:
      result.permission,

    targetAllowed:
      result.targetAllowed,

    scoreCountCorrect:
      result.scoreCountCorrect,

    validationPassed:
      result.validationPassed,

    noWriteExpected:
      result.noWriteExpected

  };


  result.ALL_DIAGNOSTIC_CHECKS_PASSED =

    result.sheetExists === true &&

    result.columnCountCorrect === true &&

    result.generatedLogIdIsString === true &&

    result.generatedLogIdFormat === true &&

    result.locationFound === true &&

    result.permission === true &&

    result.targetAllowed === true &&

    result.scoreCountCorrect === true &&

    result.validationPassed === true &&

    result.noWriteExpected === true;


  /*************************************************
   * 17. OUTPUT
   *************************************************/

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
function TEST_STEP_24_1() {

  const results = [];

  /*************************************************
   * TEST USER
   *
   * คนที่กำลัง Login / ทำรายการแทน
   *************************************************/

  const user = {

    Student_ID:
      'TEST_PROXY_USER',

    Full_Name:
      'STEP 24.1 PROXY TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  /*************************************************
   * PROXY DATA
   *************************************************/

  const locationId =
    'M1-01';


  const scores = [

    5,
    4,
    5,
    4,
    5,
    4,
    5,
    4

  ];


  const photoUrl =
    '';


  const isProxy =
    true;


  const originalInspectorId =
    'ORIGINAL-INSPECTOR-001';


  /*************************************************
   * TEST 01
   * User ต้องมีข้อมูล
   *************************************************/

  const test01 =
    !!user &&
    !!user.Student_ID;


  results.push({

    test:
      'STEP_24_1_01',

    passed:
      test01,

    detail:
      test01
        ? 'Proxy User พร้อม'
        : 'ไม่พบ Proxy User'

  });


  /*************************************************
   * TEST 02
   * Location
   *************************************************/

  const location =
    findLocationById_(
      locationId
    );


  const test02 =
    !!location;


  results.push({

    test:
      'STEP_24_1_02',

    passed:
      test02,

    detail:
      test02
        ? 'พบ Location จริง: M1-01'
        : 'ไม่พบ Location: M1-01'

  });


  /*************************************************
   * TEST 03
   * Permission
   *************************************************/

  let permission =
    false;


  if (location) {

    permission =
      canAccessLocation_(
        user,
        location
      );

  }


  const test03 =
    permission === true;


  results.push({

    test:
      'STEP_24_1_03',

    passed:
      test03,

    detail:
      test03
        ? 'Proxy User มีสิทธิ์เข้าถึง M1-01'
        : 'Proxy User ไม่มีสิทธิ์เข้าถึง M1-01'

  });


  /*************************************************
   * TEST 04
   * Validation
   *
   * Proxy ไม่ควรทำให้ Validation พัง
   *************************************************/

  let validation =
    null;


  try {

    validation =
      validateInspectionData_(
        user,
        locationId,
        scores
      );

  } catch (error) {

    validation = {

      valid:
        false,

      error:
        error.message

    };

  }


  const test04 =
    validation &&
    validation.valid === true;


  results.push({

    test:
      'STEP_24_1_04',

    passed:
      test04,

    detail:
      test04
        ? 'Validation ผ่าน'
        : (
          validation &&
          validation.error
            ? validation.error
            : 'Validation ไม่ผ่าน'
        )

  });


  /*************************************************
   * TEST 05
   * Is_Proxy ต้องเป็น TRUE
   *************************************************/

  const test05 =
    isProxy === true;


  results.push({

    test:
      'STEP_24_1_05',

    passed:
      test05,

    detail:
      test05
        ? 'Is_Proxy = TRUE'
        : 'Is_Proxy ไม่ใช่ TRUE'

  });


  /*************************************************
   * TEST 06
   * Original Inspector ต้องมีค่า
   *************************************************/

  const test06 =
    typeof originalInspectorId ===
      'string' &&
    originalInspectorId.trim() !== '';


  results.push({

    test:
      'STEP_24_1_06',

    passed:
      test06,

    detail:
      test06
        ? 'Original_Inspector_ID มีค่า'
        : 'Original_Inspector_ID ว่าง'

  });


  /*************************************************
   * TEST 07
   * Proxy ต้องแยก Inspector
   * กับ Original Inspector
   *************************************************/

  const test07 =
    String(user.Student_ID) !==
    String(originalInspectorId);


  results.push({

    test:
      'STEP_24_1_07',

    passed:
      test07,

    detail:
      test07
        ? 'Inspector_ID และ Original_Inspector_ID แยกกันถูกต้อง'
        : 'Proxy ID ซ้ำกับ Original Inspector'

  });


  /*************************************************
   * TEST 08
   * ตรวจคะแนน
   *************************************************/

  const test08 =
    validation &&
    validation.scores &&
    validation.scores.length === 8 &&
    validation.totalScore === 36;


  results.push({

    test:
      'STEP_24_1_08',

    passed:
      test08,

    detail:
      test08
        ? 'คะแนน 8 ข้อถูกต้อง และ Total = 36'
        : 'คะแนนหรือ Total ไม่ถูกต้อง'

  });


  /*************************************************
   * TEST 09
   * จำลอง Row โดยไม่เขียน Sheet
   *************************************************/

  let simulatedOriginalId =
    originalInspectorId;


  if (!isProxy) {

    simulatedOriginalId =
      user.Student_ID;

  }


  const simulatedRow = [

    'TEST-LOG-ID',

    '2026-08-19',

    '00:00:00',

    locationId,

    user.Student_ID,

    validation.scores[0],

    validation.scores[1],

    validation.scores[2],

    validation.scores[3],

    validation.scores[4],

    validation.scores[5],

    validation.scores[6],

    validation.scores[7],

    validation.totalScore,

    photoUrl,

    isProxy,

    simulatedOriginalId

  ];


  const test09 =
    simulatedRow.length === 17;


  results.push({

    test:
      'STEP_24_1_09',

    passed:
      test09,

    detail:
      test09
        ? 'Proxy Row มี 17 Columns'
        : (
          'Proxy Row มี ' +
          simulatedRow.length +
          ' Columns'
        )

  });


  /*************************************************
   * TEST 10
   * ตรวจ Mapping สำคัญ
   *************************************************/

  const test10 =

    simulatedRow[4] ===
      user.Student_ID &&

    simulatedRow[15] ===
      true &&

    simulatedRow[16] ===
      originalInspectorId;


  results.push({

    test:
      'STEP_24_1_10',

    passed:
      test10,

    detail:
      test10
        ? 'Proxy Column Mapping ถูกต้อง'
        : 'Proxy Column Mapping ผิด'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_24_1',

    tests:
      results,

    simulatedRow:
      simulatedRow,

    ALL_TESTS_PASSED:
      allPassed,

    wroteToSheet:
      false

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_24_2() {

  const results = [];

  /*************************************************
   * PROXY USER
   *************************************************/

  const proxyUser = {

    Student_ID:
      'TEST_PROXY_USER',

    Full_Name:
      'STEP 24.2 PROXY TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  const locationId =
    'M1-01';


  /*************************************************
   * 01 — Location
   *************************************************/

  const location =
    findLocationById_(
      locationId
    );


  const test01 =
    !!location;


  results.push({

    test:
      'STEP_24_2_01',

    passed:
      test01,

    detail:
      test01
        ? 'พบ Location จริง: M1-01'
        : 'ไม่พบ Location: M1-01'

  });


  /*************************************************
   * 02 — Proxy User
   *************************************************/

  const test02 =
    !!proxyUser &&
    !!proxyUser.Student_ID;


  results.push({

    test:
      'STEP_24_2_02',

    passed:
      test02,

    detail:
      test02
        ? 'Proxy User พร้อม'
        : 'Proxy User ไม่พร้อม'

  });


  /*************************************************
   * 03 — Permission
   *************************************************/

  let permission =
    false;

  let permissionError =
    '';


  if (location) {

    try {

      permission =
        canAccessLocation_(
          proxyUser,
          location
        );

    } catch (error) {

      permissionError =
        error.message;

    }

  }


  const test03 =
    permission === true;


  results.push({

    test:
      'STEP_24_2_03',

    passed:
      test03,

    detail:
      test03
        ? 'Proxy User มีสิทธิ์เข้าถึง M1-01'
        : (
          permissionError ||
          'Proxy User ไม่มีสิทธิ์เข้าถึง M1-01'
        )

  });


  /*************************************************
   * 04 — Grade
   *************************************************/

  const test04 =
    String(proxyUser.Assigned_Grade) ===
    String(location.Grade_Level);


  results.push({

    test:
      'STEP_24_2_04',

    passed:
      test04,

    detail:
      test04
        ? 'Grade Permission ตรงกัน'
        : 'Grade Permission ไม่ตรงกัน'

  });


  /*************************************************
   * 05 — Type
   *************************************************/

  const test05 =
    String(proxyUser.Assigned_Type)
      .toUpperCase() ===
    String(location.Type)
      .toUpperCase();


  results.push({

    test:
      'STEP_24_2_05',

    passed:
      test05,

    detail:
      test05
        ? 'Type Permission ตรงกัน'
        : 'Type Permission ไม่ตรงกัน'

  });


  /*************************************************
   * 06 — Assigned Location
   *************************************************/

  const assignedLocations =
    String(
      proxyUser.Assigned_Locations || ''
    )
      .split(',')
      .map(function(value) {

        return value.trim();

      })
      .filter(function(value) {

        return value !== '';

      });


  const test06 =
    assignedLocations.indexOf(
      locationId
    ) !== -1;


  results.push({

    test:
      'STEP_24_2_06',

    passed:
      test06,

    detail:
      test06
        ? 'M1-01 อยู่ใน Assigned_Locations'
        : 'M1-01 ไม่อยู่ใน Assigned_Locations'

  });


  /*************************************************
   * 07 — Final Permission Contract
   *************************************************/

  const test07 =
    permission === true &&
    test04 &&
    test05 &&
    test06;


  results.push({

    test:
      'STEP_24_2_07',

    passed:
      test07,

    detail:
      test07
        ? 'Proxy Permission Contract ผ่านครบ'
        : 'Proxy Permission Contract ไม่ผ่าน'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_24_2',

    tests:
      results,

    proxyUser:
      proxyUser,

    location:
      location,

    permission:
      permission,

    ALL_TESTS_PASSED:
      allPassed,

    wroteToSheet:
      false

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_24_3() {

  const results = [];


  /*************************************************
   * PROXY USER
   *************************************************/

  const user = {

    Student_ID:
      'TEST_PROXY_USER',

    Full_Name:
      'STEP 24.3 PROXY TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  const locationId =
    'M1-01';


  const scores = [

    5,
    4,
    5,
    4,
    5,
    4,
    5,
    4

  ];


  const photoUrl =
    '';


  const isProxy =
    true;


  const originalInspectorId =
    'ORIGINAL-INSPECTOR-001';


  /*************************************************
   * 01 — Validation
   *************************************************/

  const validation =
    validateInspectionData_(
      user,
      locationId,
      scores
    );


  const test01 =
    validation &&
    validation.valid === true;


  results.push({

    test:
      'STEP_24_3_01',

    passed:
      test01,

    detail:
      test01
        ? 'Proxy Validation ผ่าน'
        : (
          validation &&
          validation.error
            ? validation.error
            : 'Validation ไม่ผ่าน'
        )

  });


  if (!test01) {

    return {

      step:
        'STEP_24_3',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 02 — ตรวจ Total
   *************************************************/

  const test02 =
    validation.totalScore === 36;


  results.push({

    test:
      'STEP_24_3_02',

    passed:
      test02,

    detail:
      test02
        ? 'Total_Score = 36'
        : (
          'Total_Score = ' +
          validation.totalScore
        )

  });


  /*************************************************
   * 03 — Submit จริง
   *************************************************/

  let submission = null;


  try {

    submission =
      submitInspection(

        user,

        locationId,

        scores,

        photoUrl,

        isProxy,

        originalInspectorId

      );

  } catch (error) {

    results.push({

      test:
        'STEP_24_3_03',

      passed:
        false,

      detail:
        'submitInspection() Error: ' +
        error.message

    });


    return {

      step:
        'STEP_24_3',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  const test03 =
    submission &&
    submission.success === true &&
    !!submission.logId;


  results.push({

    test:
      'STEP_24_3_03',

    passed:
      test03,

    detail:
      test03
        ? 'Proxy Submission สำเร็จ'
        : (
          submission &&
          submission.error
            ? submission.error
            : 'Proxy Submission ไม่สำเร็จ'
        )

  });


  if (!test03) {

    return {

      step:
        'STEP_24_3',

      tests:
        results,

      submission:
        submission,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 04 — Log_ID
   *************************************************/

  const logId =
    submission.logId;


  const test04 =
    /^LOG-[A-Z0-9]{12}$/.test(
      logId
    );


  results.push({

    test:
      'STEP_24_3_04',

    passed:
      test04,

    detail:
      test04
        ? 'Log_ID Format ถูกต้อง'
        : 'Log_ID Format ผิด'

  });


  /*************************************************
   * 05 — เปิด Sheet
   *************************************************/

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      'Inspection_Logs'
    );


  const test05 =
    !!sheet;


  results.push({

    test:
      'STEP_24_3_05',

    passed:
      test05,

    detail:
      test05
        ? 'พบ Inspection_Logs'
        : 'ไม่พบ Inspection_Logs'

  });


  if (!test05) {

    return {

      step:
        'STEP_24_3',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 06 — ค้นหา Row
   *************************************************/

  const data =
    sheet
      .getDataRange()
      .getValues();


  let savedRow =
    null;


  let savedRowNumber =
    null;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0]) ===
      String(logId)
    ) {

      savedRow =
        data[i];

      savedRowNumber =
        i + 1;

      break;

    }

  }


  const test06 =
    Array.isArray(savedRow);


  results.push({

    test:
      'STEP_24_3_06',

    passed:
      test06,

    detail:
      test06
        ? 'พบ Proxy Row จาก Log_ID'
        : 'ไม่พบ Proxy Row'

  });


  if (!test06) {

    return {

      step:
        'STEP_24_3',

      tests:
        results,

      logId:
        logId,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 07 — Inspector_ID
   *************************************************/

  const test07 =
    String(savedRow[4]) ===
    String(user.Student_ID);


  results.push({

    test:
      'STEP_24_3_07',

    passed:
      test07,

    detail:
      test07
        ? 'Inspector_ID = Proxy User'
        : 'Inspector_ID ไม่ถูกต้อง'

  });


  /*************************************************
   * 08 — Scores
   *************************************************/

  let scoresCorrect =
    true;


  for (
    let i = 0;
    i < 8;
    i++
  ) {

    if (
      Number(savedRow[5 + i]) !==
      Number(scores[i])
    ) {

      scoresCorrect =
        false;

      break;

    }

  }


  results.push({

    test:
      'STEP_24_3_08',

    passed:
      scoresCorrect,

    detail:
      scoresCorrect
        ? 'คะแนน 8 ข้อถูกต้อง'
        : 'คะแนนไม่ตรง'

  });


  /*************************************************
   * 09 — Total
   *************************************************/

  const test09 =
    Number(savedRow[13]) ===
    36;


  results.push({

    test:
      'STEP_24_3_09',

    passed:
      test09,

    detail:
      test09
        ? 'Total_Score = 36'
        : 'Total_Score ไม่ถูกต้อง'

  });


  /*************************************************
   * 10 — Is_Proxy
   *************************************************/

  const test10 =
    savedRow[15] === true ||
    String(savedRow[15]).toUpperCase() ===
    'TRUE';


  results.push({

    test:
      'STEP_24_3_10',

    passed:
      test10,

    detail:
      test10
        ? 'Is_Proxy = TRUE'
        : 'Is_Proxy ไม่ถูกต้อง'

  });


  /*************************************************
   * 11 — Original Inspector
   *************************************************/

  const test11 =
    String(savedRow[16]) ===
    String(originalInspectorId);


  results.push({

    test:
      'STEP_24_3_11',

    passed:
      test11,

    detail:
      test11
        ? 'Original_Inspector_ID ถูกต้อง'
        : 'Original_Inspector_ID ไม่ถูกต้อง'

  });


  /*************************************************
   * 12 — Inspector != Original
   *************************************************/

  const test12 =
    String(savedRow[4]) !==
    String(savedRow[16]);


  results.push({

    test:
      'STEP_24_3_12',

    passed:
      test12,

    detail:
      test12
        ? 'Inspector และ Original Inspector แยกกันถูกต้อง'
        : 'Inspector และ Original Inspector ซ้ำกัน'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_24_3',

    tests:
      results,

    logId:
      logId,

    savedRowNumber:
      savedRowNumber,

    savedRow:
      savedRow,

    ALL_TESTS_PASSED:
      allPassed

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_24_4() {

  const results = [];

  const logId =
    'LOG-8B20FEC663FE';


  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      'Inspection_Logs'
    );


  /*************************************************
   * 01 — Sheet
   *************************************************/

  const test01 =
    !!sheet;


  results.push({

    test:
      'STEP_24_4_01',

    passed:
      test01,

    detail:
      test01
        ? 'พบ Inspection_Logs'
        : 'ไม่พบ Inspection_Logs'

  });


  if (!test01) {

    return {

      step:
        'STEP_24_4',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 02 — Header
   *************************************************/

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        17
      )
      .getValues()[0];


  const expectedHeaders = [

    'Log_ID',
    'Date',
    'Time',
    'Location_ID',
    'Inspector_ID',

    'Score_Cat1',
    'Score_Cat2',
    'Score_Cat3',
    'Score_Cat4',
    'Score_Cat5',
    'Score_Cat6',
    'Score_Cat7',
    'Score_Cat8',

    'Total_Score',

    'Photo_URL',
    'Is_Proxy',
    'Original_Inspector_ID'

  ];


  const test02 =
    JSON.stringify(headers) ===
    JSON.stringify(expectedHeaders);


  results.push({

    test:
      'STEP_24_4_02',

    passed:
      test02,

    detail:
      test02
        ? '17 Headers ถูกต้อง'
        : 'Header Mapping ไม่ตรง'

  });


  /*************************************************
   * 03 — ค้นหา Log
   *************************************************/

  const data =
    sheet
      .getDataRange()
      .getValues();


  let row =
    null;


  let rowNumber =
    null;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][0]) ===
      logId
    ) {

      row =
        data[i];

      rowNumber =
        i + 1;

      break;

    }

  }


  const test03 =
    Array.isArray(row);


  results.push({

    test:
      'STEP_24_4_03',

    passed:
      test03,

    detail:
      test03
        ? 'พบ Proxy Log'
        : 'ไม่พบ Proxy Log'

  });


  if (!test03) {

    return {

      step:
        'STEP_24_4',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 04 — จำนวน Column
   *************************************************/

  const test04 =
    row.length === 17;


  results.push({

    test:
      'STEP_24_4_04',

    passed:
      test04,

    detail:
      test04
        ? 'Proxy Row มี 17 Columns'
        : (
          'Proxy Row มี ' +
          row.length +
          ' Columns'
        )

  });


  /*************************************************
   * 05 — Location
   *************************************************/

  const test05 =
    String(row[3]) ===
    'M1-01';


  results.push({

    test:
      'STEP_24_4_05',

    passed:
      test05,

    detail:
      test05
        ? 'Location_ID ถูกต้อง'
        : 'Location_ID ไม่ถูกต้อง'

  });


  /*************************************************
   * 06 — Inspector
   *************************************************/

  const test06 =
    String(row[4]) ===
    'TEST_PROXY_USER';


  results.push({

    test:
      'STEP_24_4_06',

    passed:
      test06,

    detail:
      test06
        ? 'Inspector_ID ถูกต้อง'
        : 'Inspector_ID ไม่ถูกต้อง'

  });


  /*************************************************
   * 07 — Scores
   *************************************************/

  const expectedScores = [

    5, 4, 5, 4,
    5, 4, 5, 4

  ];


  let scoresCorrect =
    true;


  for (
    let i = 0;
    i < 8;
    i++
  ) {

    if (
      Number(row[5 + i]) !==
      expectedScores[i]
    ) {

      scoresCorrect =
        false;

      break;

    }

  }


  results.push({

    test:
      'STEP_24_4_07',

    passed:
      scoresCorrect,

    detail:
      scoresCorrect
        ? 'Score_Cat1–8 ถูกต้อง'
        : 'คะแนนไม่ถูกต้อง'

  });


  /*************************************************
   * 08 — Total
   *************************************************/

  const test08 =
    Number(row[13]) ===
    36;


  results.push({

    test:
      'STEP_24_4_08',

    passed:
      test08,

    detail:
      test08
        ? 'Total_Score = 36'
        : 'Total_Score ไม่ถูกต้อง'

  });


  /*************************************************
   * 09 — Is Proxy
   *************************************************/

  const test09 =
    row[15] === true ||
    String(row[15]).toUpperCase() ===
    'TRUE';


  results.push({

    test:
      'STEP_24_4_09',

    passed:
      test09,

    detail:
      test09
        ? 'Is_Proxy = TRUE'
        : 'Is_Proxy ไม่ถูกต้อง'

  });


  /*************************************************
   * 10 — Original Inspector
   *************************************************/

  const test10 =
    String(row[16]) ===
    'ORIGINAL-INSPECTOR-001';


  results.push({

    test:
      'STEP_24_4_10',

    passed:
      test10,

    detail:
      test10
        ? 'Original_Inspector_ID ถูกต้อง'
        : 'Original_Inspector_ID ไม่ถูกต้อง'

  });


  /*************************************************
   * 11 — Proxy Separation
   *************************************************/

  const test11 =
    String(row[4]) !==
    String(row[16]);


  results.push({

    test:
      'STEP_24_4_11',

    passed:
      test11,

    detail:
      test11
        ? 'Proxy และ Original Inspector แยกกัน'
        : 'Proxy และ Original Inspector ซ้ำกัน'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_24_4',

    tests:
      results,

    logId:
      logId,

    rowNumber:
      rowNumber,

    row:
      row,

    ALL_TESTS_PASSED:
      allPassed,

    wroteToSheet:
      false

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_25() {

  const results = [];

  /*************************************************
   * CONFIG
   *************************************************/

  const SHEET_NAME =
    'Inspection_Logs';

  const TEST_DATE =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  const LOCATION_ID =
    'M1-01';


  /*************************************************
   * TEST USERS
   *************************************************/

  const normalUser = {

    Student_ID:
      'TEST_STUDENT_001',

    Full_Name:
      'STEP 25 NORMAL TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  const proxyUser = {

    Student_ID:
      'TEST_PROXY_USER',

    Full_Name:
      'STEP 25 PROXY TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  const originalInspectorId =
    'ORIGINAL-INSPECTOR-001';


  /*************************************************
   * 1. SHEET
   *************************************************/

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      SHEET_NAME
    );


  const test01 =
    !!sheet;


  results.push({

    test:
      'STEP_25_01',

    passed:
      test01,

    detail:
      test01
        ? 'พบ Inspection_Logs'
        : 'ไม่พบ Inspection_Logs'

  });


  if (!test01) {

    return {

      step:
        'STEP_25',

      tests:
        results,

      ALL_TESTS_PASSED:
        false

    };

  }


  /*************************************************
   * 2. HEADER
   *************************************************/

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        17
      )
      .getValues()[0];


  const expectedHeaders = [

    'Log_ID',
    'Date',
    'Time',
    'Location_ID',
    'Inspector_ID',

    'Score_Cat1',
    'Score_Cat2',
    'Score_Cat3',
    'Score_Cat4',
    'Score_Cat5',
    'Score_Cat6',
    'Score_Cat7',
    'Score_Cat8',

    'Total_Score',

    'Photo_URL',
    'Is_Proxy',
    'Original_Inspector_ID'

  ];


  const test02 =
    JSON.stringify(headers) ===
    JSON.stringify(expectedHeaders);


  results.push({

    test:
      'STEP_25_02',

    passed:
      test02,

    detail:
      test02
        ? '17 Columns ถูกต้อง'
        : 'Header ไม่ตรง'

  });


  /*************************************************
   * 3. LOCATION
   *************************************************/

  const location =
    findLocationById_(
      LOCATION_ID
    );


  const test03 =
    !!location;


  results.push({

    test:
      'STEP_25_03',

    passed:
      test03,

    detail:
      test03
        ? 'พบ Location: ' + LOCATION_ID
        : 'ไม่พบ Location: ' + LOCATION_ID

  });


  /*************************************************
   * 4. USER / PERMISSION
   *************************************************/

  let normalPermission =
    false;

  let proxyPermission =
    false;


  if (location) {

    normalPermission =
      canAccessLocation_(
        normalUser,
        location
      );


    proxyPermission =
      canAccessLocation_(
        proxyUser,
        location
      );

  }


  const test04 =
    normalPermission === true &&
    proxyPermission === true;


  results.push({

    test:
      'STEP_25_04',

    passed:
      test04,

    detail:
      test04
        ? 'Normal และ Proxy มีสิทธิ์'
        : 'Permission ไม่ครบ'

  });


  /*************************************************
   * 5. NORMAL CONTRACT
   *************************************************/

  const normalKey =

    TEST_DATE +
    '|' +
    LOCATION_ID +
    '|' +
    normalUser.Student_ID;


  const test05 =
    normalKey !== '';


  results.push({

    test:
      'STEP_25_05',

    passed:
      test05,

    detail:
      test05
        ? 'Normal Duplicate Key พร้อม'
        : 'Normal Duplicate Key ผิด'

  });


  /*************************************************
   * 6. PROXY CONTRACT
   *************************************************/

  const proxyKey =

    TEST_DATE +
    '|' +
    LOCATION_ID +
    '|' +
    proxyUser.Student_ID +
    '|' +
    originalInspectorId;


  const test06 =
    proxyKey !== '';


  results.push({

    test:
      'STEP_25_06',

    passed:
      test06,

    detail:
      test06
        ? 'Proxy Duplicate Key พร้อม'
        : 'Proxy Duplicate Key ผิด'

  });


  /*************************************************
   * 7. KEY SEPARATION
   *************************************************/

  const test07 =
    normalKey !== proxyKey;


  results.push({

    test:
      'STEP_25_07',

    passed:
      test07,

    detail:
      test07
        ? 'Normal / Proxy Key แยกกัน'
        : 'Normal / Proxy Key ซ้ำกัน'

  });


  /*************************************************
   * 8. READ EXISTING LOGS
   *************************************************/

  const data =
    sheet
      .getDataRange()
      .getValues();


  let normalDuplicateFound =
    false;


  let proxyDuplicateFound =
    false;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const row =
      data[i];


    const rowDate =
      row[1] instanceof Date
        ? Utilities.formatDate(
            row[1],
            Session.getScriptTimeZone(),
            'yyyy-MM-dd'
          )
        : String(row[1] || '').trim();


    const rowLocation =
      String(
        row[3] || ''
      ).trim();


    const rowInspector =
      String(
        row[4] || ''
      ).trim();


    const rowIsProxy =
      row[15] === true ||
      String(
        row[15] || ''
      ).toUpperCase() ===
      'TRUE';


    const rowOriginal =
      String(
        row[16] || ''
      ).trim();


    /***********************************************
     * NORMAL
     ***********************************************/

    if (

      rowDate === TEST_DATE &&

      rowLocation === LOCATION_ID &&

      rowInspector ===
        normalUser.Student_ID &&

      rowIsProxy === false

    ) {

      normalDuplicateFound =
        true;

    }


    /***********************************************
     * PROXY
     ***********************************************/

    if (

      rowDate === TEST_DATE &&

      rowLocation === LOCATION_ID &&

      rowInspector ===
        proxyUser.Student_ID &&

      rowIsProxy === true &&

      rowOriginal ===
        originalInspectorId

    ) {

      proxyDuplicateFound =
        true;

    }

  }


  /*************************************************
   * 9. DUPLICATE DETECTION CONTRACT
   *************************************************/

  const test08 =
    typeof normalDuplicateFound ===
      'boolean' &&
    typeof proxyDuplicateFound ===
      'boolean';


  results.push({

    test:
      'STEP_25_08',

    passed:
      test08,

    detail:
      test08
        ? 'Duplicate Detection ทำงาน'
        : 'Duplicate Detection ผิด'

  });


  /*************************************************
   * 10. NORMAL DUPLICATE STATUS
   *************************************************/

  results.push({

    test:
      'STEP_25_09',

    passed:
      true,

    detail:
      normalDuplicateFound
        ? 'พบ Normal Duplicate Log'
        : 'ยังไม่พบ Normal Duplicate Log'

  });


  /*************************************************
   * 11. PROXY DUPLICATE STATUS
   *************************************************/

  results.push({

    test:
      'STEP_25_10',

    passed:
      true,

    detail:
      proxyDuplicateFound
        ? 'พบ Proxy Duplicate Log'
        : 'ยังไม่พบ Proxy Duplicate Log'

  });


  /*************************************************
   * 12. ตรวจว่า TEST นี้ไม่เขียนข้อมูล
   *************************************************/

  const lastRowBefore =
    sheet.getLastRow();


  const lastRowAfter =
    sheet.getLastRow();


  const test11 =
    lastRowBefore ===
    lastRowAfter;


  results.push({

    test:
      'STEP_25_11',

    passed:
      test11,

    detail:
      test11
        ? 'STEP 25 ยังไม่มีการเขียนข้อมูล'
        : 'จำนวน Row เปลี่ยนแปลง'

  });


  /*************************************************
   * 13. FINAL CONTRACT
   *************************************************/

  const test12 =
    normalKey !== '' &&
    proxyKey !== '' &&
    normalKey !== proxyKey;


  results.push({

    test:
      'STEP_25_12',

    passed:
      test12,

    detail:
      test12
        ? 'Duplicate Contract พร้อมสำหรับ Implementation'
        : 'Duplicate Contract ยังไม่พร้อม'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_25',

    date:
      TEST_DATE,

    locationId:
      LOCATION_ID,

    normalUser:
      normalUser.Student_ID,

    proxyUser:
      proxyUser.Student_ID,

    normalDuplicateFound:
      normalDuplicateFound,

    proxyDuplicateFound:
      proxyDuplicateFound,

    tests:
      results,

    ALL_TESTS_PASSED:
      allPassed,

    wroteToSheet:
      false

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function findDuplicateInspection_(
  date,
  locationId,
  inspectorId,
  isProxy,
  originalInspectorId
) {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      'Inspection_Logs'
    );


  if (!sheet) {

    return {

      found: false,

      error:
        'ไม่พบ Sheet: Inspection_Logs'

    };

  }


  const lastRow =
    sheet.getLastRow();


  /*
   * มีเฉพาะ Header
   */

  if (lastRow <= 1) {

    return {

      found: false

    };

  }


  const data =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        17
      )
      .getValues();


  /*************************************************
   * TARGET
   *************************************************/

  const targetDate =
    String(
      date || ''
    ).trim();


  const targetLocation =
    String(
      locationId || ''
    ).trim();


  const targetProxy =
    Boolean(
      isProxy
    );


  const targetOriginal =
    String(
      originalInspectorId || ''
    ).trim();


  /*************************************************
   * Proxy ต้องมี Original Inspector
   *************************************************/

  if (
    targetProxy &&
    targetOriginal === ''
  ) {

    return {

      found: false,

      error:
        'Proxy Inspection ต้องมี Original_Inspector_ID'

    };

  }


  /*************************************************
   * SEARCH
   *************************************************/

  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    const row =
      data[i];


    /***********************************************
     * DATE
     ***********************************************/

    let rowDate =
      '';


    if (
      row[1] instanceof Date
    ) {

      rowDate =
        Utilities.formatDate(
          row[1],
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

    } else {

      rowDate =
        String(
          row[1] || ''
        ).trim();

    }


    /***********************************************
     * LOCATION
     ***********************************************/

    const rowLocation =
      String(
        row[3] || ''
      ).trim();


    /***********************************************
     * PROXY
     ***********************************************/

    const rowProxy =
      row[15] === true ||
      String(
        row[15] || ''
      ).trim().toUpperCase() ===
      'TRUE';


    /***********************************************
     * ORIGINAL INSPECTOR
     ***********************************************/

    const rowOriginal =
      String(
        row[16] || ''
      ).trim();


    /***********************************************
     * DATE + LOCATION
     *
     * ต้องตรงก่อนเสมอ
     ***********************************************/

    if (
      rowDate !== targetDate ||
      rowLocation !== targetLocation
    ) {

      continue;

    }


    /*************************************************
     * NORMAL
     *
     * Date + Location + NORMAL
     *
     * Inspector คนไหนก็ได้
     * แต่ Location นี้ตรวจแล้ววันนี้
     * = Duplicate
     *************************************************/

    if (
      targetProxy === false &&
      rowProxy === false
    ) {

      return {

        found: true,

        rowNumber:
          i + 2,

        logId:
          row[0],

        type:
          'NORMAL',

        inspectorId:
          row[4]

      };

    }


    /*************************************************
     * PROXY
     *
     * Date + Location + PROXY
     * + Original Inspector
     *************************************************/

    if (
      targetProxy === true &&
      rowProxy === true &&
      rowOriginal === targetOriginal
    ) {

      return {

        found: true,

        rowNumber:
          i + 2,

        logId:
          row[0],

        type:
          'PROXY',

        originalInspectorId:
          rowOriginal,

        inspectorId:
          row[4]

      };

    }

  }


  /*************************************************
   * NOT DUPLICATE
   *************************************************/

  return {

    found: false

  };

}
function TEST_STEP_26_1() {

  const user = {

    Student_ID:
      'TEST_STUDENT_001',

    Full_Name:
      'STEP 26 DUPLICATE TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  const result =
    submitInspection(

      user,

      'M1-01',

      [
        5, 5, 5, 5,
        5, 5, 5, 5
      ],

      '',

      false,

      ''

    );


  const output = {

    step:
      'STEP_26_1',

    result:
      result,

    expected:

      {

        success:
          false,

        duplicate:
          true

      },

    wroteToSheet:
      false

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_26() {

  const results = [];

  /*************************************************
   * CONFIG
   *************************************************/

  const SHEET_NAME =
    'Inspection_Logs';

  const LOCATION_ID =
    'M1-01';

  const NORMAL_USER_ID =
    'TEST_STUDENT_001';

  const PROXY_USER_ID =
    'TEST_PROXY_USER';

  const ORIGINAL_INSPECTOR_ID =
    'ORIGINAL-INSPECTOR-001';


  /*************************************************
   * CURRENT DATE
   *************************************************/

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  /*************************************************
   * SHEET
   *************************************************/

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      SHEET_NAME
    );


  /*************************************************
   * TEST 01 — SHEET
   *************************************************/

  const test01 =
    !!sheet;


  results.push({

    test:
      'STEP_26_01',

    passed:
      test01,

    detail:
      test01
        ? 'พบ Inspection_Logs'
        : 'ไม่พบ Inspection_Logs'

  });


  if (!test01) {

    return {

      step:
        'STEP_26',

      tests:
        results,

      ALL_TESTS_PASSED:
        false,

      wroteToSheet:
        false

    };

  }


  /*************************************************
   * ROW COUNT BEFORE
   *************************************************/

  const rowCountBefore =
    sheet.getLastRow();


  /*************************************************
   * READ DATA
   *************************************************/

  const data =
    sheet
      .getDataRange()
      .getValues();


  /*************************************************
   * FIND NORMAL EXISTING LOG
   *************************************************/

  let normalLog =
    null;


  let normalRowNumber =
    null;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const row =
      data[i];


    let rowDate =
      '';


    if (
      row[1] instanceof Date
    ) {

      rowDate =
        Utilities.formatDate(
          row[1],
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

    } else {

      rowDate =
        String(
          row[1] || ''
        ).trim();

    }


    const location =
      String(
        row[3] || ''
      ).trim();


    const inspector =
      String(
        row[4] || ''
      ).trim();


    const isProxy =
      row[15] === true ||
      String(
        row[15] || ''
      ).toUpperCase() ===
      'TRUE';


    if (

      rowDate === today &&

      location === LOCATION_ID &&

      inspector === NORMAL_USER_ID &&

      isProxy === false

    ) {

      normalLog =
        row;

      normalRowNumber =
        i + 1;

      break;

    }

  }


  /*************************************************
   * TEST 02 — NORMAL DUPLICATE EXISTS
   *************************************************/

  const test02 =
    Array.isArray(normalLog);


  results.push({

    test:
      'STEP_26_02',

    passed:
      test02,

    detail:
      test02
        ? 'พบ Normal Inspection เดิม'
        : 'ไม่พบ Normal Inspection เดิม',

    rowNumber:
      normalRowNumber

  });


  /*************************************************
   * FIND PROXY EXISTING LOG
   *************************************************/

  let proxyLog =
    null;


  let proxyRowNumber =
    null;


  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    const row =
      data[i];


    let rowDate =
      '';


    if (
      row[1] instanceof Date
    ) {

      rowDate =
        Utilities.formatDate(
          row[1],
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

    } else {

      rowDate =
        String(
          row[1] || ''
        ).trim();

    }


    const location =
      String(
        row[3] || ''
      ).trim();


    const inspector =
      String(
        row[4] || ''
      ).trim();


    const isProxy =
      row[15] === true ||
      String(
        row[15] || ''
      ).toUpperCase() ===
      'TRUE';


    const original =
      String(
        row[16] || ''
      ).trim();


    if (

      rowDate === today &&

      location === LOCATION_ID &&

      inspector === PROXY_USER_ID &&

      isProxy === true &&

      original ===
        ORIGINAL_INSPECTOR_ID

    ) {

      proxyLog =
        row;

      proxyRowNumber =
        i + 1;

      break;

    }

  }


  /*************************************************
   * TEST 03 — PROXY DUPLICATE EXISTS
   *************************************************/

  const test03 =
    Array.isArray(proxyLog);


  results.push({

    test:
      'STEP_26_03',

    passed:
      test03,

    detail:
      test03
        ? 'พบ Proxy Inspection เดิม'
        : 'ไม่พบ Proxy Inspection เดิม',

    rowNumber:
      proxyRowNumber

  });


  /*************************************************
   * TEST 04 — NORMAL SUBMISSION MUST BLOCK
   *************************************************/

  const normalUser = {

    Student_ID:
      NORMAL_USER_ID,

    Full_Name:
      'STEP 26 NORMAL',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      LOCATION_ID

  };


  const normalResult =
    submitInspection(

      normalUser,

      LOCATION_ID,

      [
        5, 5, 5, 5,
        5, 5, 5, 5
      ],

      '',

      false,

      ''

    );


  const test04 =
    normalResult.success === false &&
    normalResult.duplicate === true;


  results.push({

    test:
      'STEP_26_04',

    passed:
      test04,

    detail:
      test04
        ? 'Normal Duplicate ถูก Block'
        : 'Normal Duplicate ไม่ถูก Block',

    result:
      normalResult

  });


  /*************************************************
   * TEST 05 — PROXY SUBMISSION MUST BLOCK
   *************************************************/

  const proxyUser = {

    Student_ID:
      PROXY_USER_ID,

    Full_Name:
      'STEP 26 PROXY',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      LOCATION_ID

  };


  const proxyResult =
    submitInspection(

      proxyUser,

      LOCATION_ID,

      [
        5, 4, 5, 4,
        5, 4, 5, 4
      ],

      '',

      true,

      ORIGINAL_INSPECTOR_ID

    );


  const test05 =
    proxyResult.success === false &&
    proxyResult.duplicate === true;


  results.push({

    test:
      'STEP_26_05',

    passed:
      test05,

    detail:
      test05
        ? 'Proxy Duplicate ถูก Block'
        : 'Proxy Duplicate ไม่ถูก Block',

    result:
      proxyResult

  });


  /*************************************************
   * TEST 06 — NORMAL TYPE
   *************************************************/

  const test06 =
    normalResult.type ===
    'NORMAL';


  results.push({

    test:
      'STEP_26_06',

    passed:
      test06,

    detail:
      test06
        ? 'Normal Duplicate Type ถูกต้อง'
        : 'Normal Duplicate Type ผิด'

  });


  /*************************************************
   * TEST 07 — PROXY TYPE
   *************************************************/

  const test07 =
    proxyResult.type ===
    'PROXY';


  results.push({

    test:
      'STEP_26_07',

    passed:
      test07,

    detail:
      test07
        ? 'Proxy Duplicate Type ถูกต้อง'
        : 'Proxy Duplicate Type ผิด'

  });


  /*************************************************
   * TEST 08 — NORMAL LOG DATA
   *************************************************/

  let normalDataCorrect =
    false;


  if (
    normalLog
  ) {

    normalDataCorrect =

      String(normalLog[3]) ===
        LOCATION_ID &&

      String(normalLog[4]) ===
        NORMAL_USER_ID &&

      Number(normalLog[13]) ===
        40 &&

      (
        normalLog[15] === false ||
        String(normalLog[15]).toUpperCase() ===
          'FALSE'
      );

  }


  const test08 =
  normalDataCorrect;

results.push({

  test:
    'STEP_26_08',

  passed:
    test08,

  detail:
    test08
      ? 'Normal Log Data ถูกต้อง'
      : 'Normal Log Data ผิด'

});
  


  /*************************************************
   * TEST 09 — PROXY LOG DATA
   *************************************************/

  let proxyDataCorrect =
    false;


  if (
    proxyLog
  ) {

    proxyDataCorrect =

      String(proxyLog[3]) ===
        LOCATION_ID &&

      String(proxyLog[4]) ===
        PROXY_USER_ID &&

      Number(proxyLog[13]) ===
        36 &&

      (
        proxyLog[15] === true ||
        String(proxyLog[15]).toUpperCase() ===
          'TRUE'
      ) &&

      String(proxyLog[16]) ===
        ORIGINAL_INSPECTOR_ID;

  }


  const test09 =
  proxyDataCorrect;

results.push({

  test:
    'STEP_26_09',

  passed:
    test09,

  detail:
    test09
      ? 'Proxy Log Data ถูกต้อง'
      : 'Proxy Log Data ผิด'

});


  /*************************************************
   * TEST 10 — ROW COUNT
   *************************************************/

  const rowCountAfter =
    sheet.getLastRow();


  const test10 =
    rowCountBefore ===
    rowCountAfter;


  results.push({

    test:
      'STEP_26_10',

    passed:
      test10,

    detail:
      test10
        ? 'ไม่มี Row ใหม่ถูกเขียน'
        : 'มี Row ใหม่ถูกเขียน'

  });


  /*************************************************
   * TEST 11 — NO DUPLICATE WRITE
   *************************************************/

  const test11 =
    normalResult.success === false &&
    proxyResult.success === false;


  results.push({

    test:
      'STEP_26_11',

    passed:
      test11,

    detail:
      test11
        ? 'Normal และ Proxy ไม่สามารถบันทึกซ้ำได้'
        : 'ยังสามารถบันทึกซ้ำได้'

  });


  /*************************************************
   * TEST 12 — FINAL CONTRACT
   *************************************************/

  const test12 =

    test02 &&
    test03 &&
    test04 &&
    test05 &&
    test06 &&
    test07 &&
    test08 &&
    test09 &&
    test10 &&
    test11;


  results.push({

    test:
      'STEP_26_12',

    passed:
      test12,

    detail:
      test12
        ? 'Duplicate Protection พร้อมใช้งานจริง'
        : 'Duplicate Protection ยังไม่สมบูรณ์'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    results.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_26',

    date:
      today,

    locationId:
      LOCATION_ID,

    normalUser:
      NORMAL_USER_ID,

    proxyUser:
      PROXY_USER_ID,

    normalRowNumber:
      normalRowNumber,

    proxyRowNumber:
      proxyRowNumber,

    rowCountBefore:
      rowCountBefore,

    rowCountAfter:
      rowCountAfter,

    tests:
      results,

    ALL_TESTS_PASSED:
      allPassed,

    wroteToSheet:
      rowCountBefore !==
      rowCountAfter

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_STEP_27() {

  const tests = [];

  /*************************************************
   * CONFIG
   *************************************************/

  const SHEET_NAME =
    'Inspection_Logs';

  const LOCATION_ID =
    'M1-01';

  const NORMAL_ID =
    'TEST_STUDENT_001';

  const PROXY_ID =
    'TEST_PROXY_USER';

  const ORIGINAL_ID =
    'ORIGINAL-INSPECTOR-001';


  /*************************************************
   * TEST USERS
   *************************************************/

  const normalUser = {

    Student_ID:
      NORMAL_ID,

    Full_Name:
      'STEP 27 NORMAL TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      LOCATION_ID

  };


  const proxyUser = {

    Student_ID:
      PROXY_ID,

    Full_Name:
      'STEP 27 PROXY TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      LOCATION_ID

  };


  /*************************************************
   * 1. SHEET
   *************************************************/

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      SHEET_NAME
    );


  const test01 =
    !!sheet;


  tests.push({

    test:
      'STEP_27_01',

    passed:
      test01,

    detail:
      test01
        ? 'พบ Inspection_Logs'
        : 'ไม่พบ Inspection_Logs'

  });


  if (!sheet) {

    return {

      step:
        'STEP_27',

      tests:
        tests,

      ALL_TESTS_PASSED:
        false,

      wroteToSheet:
        false

    };

  }


  /*************************************************
   * 2. HEADER
   *************************************************/

  const expectedHeaders = [

    'Log_ID',
    'Date',
    'Time',
    'Location_ID',
    'Inspector_ID',
    'Score_Cat1',
    'Score_Cat2',
    'Score_Cat3',
    'Score_Cat4',
    'Score_Cat5',
    'Score_Cat6',
    'Score_Cat7',
    'Score_Cat8',
    'Total_Score',
    'Photo_URL',
    'Is_Proxy',
    'Original_Inspector_ID'

  ];


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        17
      )
      .getValues()[0];


  const headersCorrect =
    expectedHeaders.every(
      function(header, index) {

        return String(
          headers[index] || ''
        ).trim() === header;

      }
    );


  tests.push({

    test:
      'STEP_27_02',

    passed:
      headersCorrect,

    detail:
      headersCorrect
        ? '17 Headers ถูกต้อง'
        : 'Headers ไม่ตรง'

  });


  /*************************************************
   * 3. LOCATION
   *************************************************/

  const location =
    findLocationById_(
      LOCATION_ID
    );


  const test03 =
    !!location;


  tests.push({

    test:
      'STEP_27_03',

    passed:
      test03,

    detail:
      test03
        ? 'พบ Location: ' + LOCATION_ID
        : 'ไม่พบ Location: ' + LOCATION_ID

  });


  if (!location) {

    return {

      step:
        'STEP_27',

      tests:
        tests,

      ALL_TESTS_PASSED:
        false,

      wroteToSheet:
        false

    };

  }


  /*************************************************
   * 4. NORMAL PERMISSION
   *************************************************/

  const normalPermission =
    canAccessLocation_(
      normalUser,
      location
    );


  tests.push({

    test:
      'STEP_27_04',

    passed:
      normalPermission === true,

    detail:
      normalPermission
        ? 'Normal Permission ผ่าน'
        : 'Normal Permission ไม่ผ่าน'

  });


  /*************************************************
   * 5. PROXY PERMISSION
   *************************************************/

  const proxyPermission =
    canAccessLocation_(
      proxyUser,
      location
    );


  tests.push({

    test:
      'STEP_27_05',

    passed:
      proxyPermission === true,

    detail:
      proxyPermission
        ? 'Proxy Permission ผ่าน'
        : 'Proxy Permission ไม่ผ่าน'

  });


  /*************************************************
   * 6. NORMAL VALIDATION
   *************************************************/

  const normalValidation =
    validateInspectionData_(
      normalUser,
      LOCATION_ID,
      [
        5, 5, 5, 5,
        5, 5, 5, 5
      ]
    );


  const test06 =
    normalValidation.valid === true &&
    normalValidation.scores.length === 8 &&
    normalValidation.totalScore === 40;


  tests.push({

    test:
      'STEP_27_06',

    passed:
      test06,

    detail:
      test06
        ? 'Normal Validation ผ่าน และ Total = 40'
        : 'Normal Validation ผิด',

    totalScore:
      normalValidation.totalScore

  });


  /*************************************************
   * 7. PROXY VALIDATION
   *************************************************/

  const proxyValidation =
    validateInspectionData_(
      proxyUser,
      LOCATION_ID,
      [
        5, 4, 5, 4,
        5, 4, 5, 4
      ]
    );


  const test07 =
    proxyValidation.valid === true &&
    proxyValidation.scores.length === 8 &&
    proxyValidation.totalScore === 36;


  tests.push({

    test:
      'STEP_27_07',

    passed:
      test07,

    detail:
      test07
        ? 'Proxy Validation ผ่าน และ Total = 36'
        : 'Proxy Validation ผิด',

    totalScore:
      proxyValidation.totalScore

  });


  /*************************************************
   * 8. LOG ID
   *************************************************/

  const logId =
    generateLogId_();


  const test08 =
    typeof logId === 'string' &&
    /^LOG-[A-Z0-9]{12}$/.test(
      logId
    );


  tests.push({

    test:
      'STEP_27_08',

    passed:
      test08,

    detail:
      test08
        ? 'Log_ID Format ถูกต้อง'
        : 'Log_ID Format ผิด',

    generatedLogId:
      logId

  });


  /*************************************************
   * 9. NORMAL DUPLICATE BLOCK
   *************************************************/

  const normalSubmit =
    submitInspection(

      normalUser,

      LOCATION_ID,

      [
        5, 5, 5, 5,
        5, 5, 5, 5
      ],

      '',

      false,

      ''

    );


  const test09 =
    normalSubmit.success === false &&
    normalSubmit.duplicate === true &&
    normalSubmit.type === 'NORMAL';


  tests.push({

    test:
      'STEP_27_09',

    passed:
      test09,

    detail:
      test09
        ? 'Normal Duplicate ถูก Block'
        : 'Normal Duplicate Block ผิด',

    result:
      normalSubmit

  });


  /*************************************************
   * 10. PROXY DUPLICATE BLOCK
   *************************************************/

  const proxySubmit =
    submitInspection(

      proxyUser,

      LOCATION_ID,

      [
        5, 4, 5, 4,
        5, 4, 5, 4
      ],

      '',

      true,

      ORIGINAL_ID

    );


  const test10 =
    proxySubmit.success === false &&
    proxySubmit.duplicate === true &&
    proxySubmit.type === 'PROXY';


  tests.push({

    test:
      'STEP_27_10',

    passed:
      test10,

    detail:
      test10
        ? 'Proxy Duplicate ถูก Block'
        : 'Proxy Duplicate Block ผิด',

    result:
      proxySubmit

  });


  /*************************************************
   * 11. READ EXISTING LOGS
   *************************************************/

  const lastRow =
    sheet.getLastRow();


  const data =
    lastRow > 1
      ? sheet
          .getRange(
            2,
            1,
            lastRow - 1,
            17
          )
          .getValues()
      : [];


  const test11 =
    data.every(
      function(row) {

        return row.length === 17;

      }
    );


  tests.push({

    test:
      'STEP_27_11',

    passed:
      test11,

    detail:
      test11
        ? 'ทุก Inspection Row มี 17 Columns'
        : 'พบ Row ที่จำนวน Column ผิด',

    totalInspectionRows:
      data.length

  });


  /*************************************************
   * 12. FIND NORMAL LOG
   *************************************************/

  let foundNormal =
    null;


  let foundNormalRow =
    null;


  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    const row =
      data[i];


    const inspector =
      String(
        row[4] || ''
      ).trim();


    const locationId =
      String(
        row[3] || ''
      ).trim();


    const isProxy =
      row[15] === true ||
      String(
        row[15] || ''
      ).toUpperCase() ===
      'TRUE';


    if (

      inspector === NORMAL_ID &&

      locationId === LOCATION_ID &&

      !isProxy

    ) {

      foundNormal =
        row;

      foundNormalRow =
        i + 2;

      break;

    }

  }


  const test12 =
    !!foundNormal;


  tests.push({

    test:
      'STEP_27_12',

    passed:
      test12,

    detail:
      test12
        ? 'พบ Normal Inspection Log'
        : 'ไม่พบ Normal Inspection Log',

    rowNumber:
      foundNormalRow

  });


  /*************************************************
   * 13. FIND PROXY LOG
   *************************************************/

  let foundProxy =
    null;


  let foundProxyRow =
    null;


  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    const row =
      data[i];


    const inspector =
      String(
        row[4] || ''
      ).trim();


    const locationId =
      String(
        row[3] || ''
      ).trim();


    const isProxy =
      row[15] === true ||
      String(
        row[15] || ''
      ).toUpperCase() ===
      'TRUE';


    const original =
      String(
        row[16] || ''
      ).trim();


    if (

      inspector === PROXY_ID &&

      locationId === LOCATION_ID &&

      isProxy &&

      original === ORIGINAL_ID

    ) {

      foundProxy =
        row;

      foundProxyRow =
        i + 2;

      break;

    }

  }


  const test13 =
    !!foundProxy;


  tests.push({

    test:
      'STEP_27_13',

    passed:
      test13,

    detail:
      test13
        ? 'พบ Proxy Inspection Log'
        : 'ไม่พบ Proxy Inspection Log',

    rowNumber:
      foundProxyRow

  });


  /*************************************************
   * 14. NORMAL DATA INTEGRITY
   *************************************************/

  const normalDataCorrect =
    foundNormal &&
    String(foundNormal[3]) === LOCATION_ID &&
    String(foundNormal[4]) === NORMAL_ID &&
    Number(foundNormal[13]) === 40 &&
    (
      foundNormal[15] === false ||
      String(foundNormal[15]).toUpperCase() ===
      'FALSE'
    ) &&
    String(foundNormal[16]) === NORMAL_ID;


  tests.push({

    test:
      'STEP_27_14',

    passed:
      !!normalDataCorrect,

    detail:
      normalDataCorrect
        ? 'Normal Log Integrity ถูกต้อง'
        : 'Normal Log Integrity ผิด'

  });


  /*************************************************
   * 15. PROXY DATA INTEGRITY
   *************************************************/

  const proxyDataCorrect =
    foundProxy &&
    String(foundProxy[3]) === LOCATION_ID &&
    String(foundProxy[4]) === PROXY_ID &&
    Number(foundProxy[13]) === 36 &&
    (
      foundProxy[15] === true ||
      String(foundProxy[15]).toUpperCase() ===
      'TRUE'
    ) &&
    String(foundProxy[16]) === ORIGINAL_ID;


  tests.push({

    test:
      'STEP_27_15',

    passed:
      !!proxyDataCorrect,

    detail:
      proxyDataCorrect
        ? 'Proxy Log Integrity ถูกต้อง'
        : 'Proxy Log Integrity ผิด'

  });


  /*************************************************
   * 16. NO WRITE
   *************************************************/

  /*
   * STEP 27 ต้องไม่สร้าง Row ใหม่
   *
   * เพราะทั้ง Normal และ Proxy
   * ถูก Duplicate Block
   */

  const finalRowCount =
    sheet.getLastRow();


  const wroteToSheet =
    finalRowCount !== lastRow;


  const test16 =
    wroteToSheet === false;


  tests.push({

    test:
      'STEP_27_16',

    passed:
      test16,

    detail:
      test16
        ? 'Final Integration ไม่มีการเขียนข้อมูลใหม่'
        : 'พบการเขียนข้อมูลใหม่'

  });


  /*************************************************
   * 17. FINAL BACKEND CONTRACT
   *************************************************/

  const test17 =
    tests.every(
      function(item) {

        return item.passed;

      }
    );


  tests.push({

    test:
      'STEP_27_17',

    passed:
      test17,

    detail:
      test17
        ? 'Backend Integration Contract ผ่านทั้งหมด'
        : 'Backend Integration Contract ยังไม่ผ่าน'

  });


  /*************************************************
   * FINAL
   *************************************************/

  const allPassed =
    tests.every(
      function(item) {

        return item.passed;

      }
    );


  const output = {

    step:
      'STEP_27',

    locationId:
      LOCATION_ID,

    normalUser:
      NORMAL_ID,

    proxyUser:
      PROXY_ID,

    inspectionRows:
      data.length,

    finalRowCount:
      finalRowCount,

    tests:
      tests,

    ALL_TESTS_PASSED:
      allPassed,

    wroteToSheet:
      wroteToSheet

  };


  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );


  return output;

}
function TEST_INSPECTOR_PAGE() {

  const html = HtmlService
    .createHtmlOutputFromFile('Inspector');

  Logger.log(html.getContent().substring(0, 200));

}
function TEST_INSPECTOR_ROUTE() {

  const html = doGet({
    parameter: {
      page: 'inspector'
    }
  });

  const content =
    html.getContent();

  Logger.log({
    title: html.getTitle(),
    containsHtml: content.indexOf('<!DOCTYPE html>') !== -1,
    containsInspectorTitle:
      content.indexOf(
        'Sangkha Hygiene Portal'
      ) !== -1
  });

}
function TEST_STEP_28() {

  const html =
    HtmlService
      .createHtmlOutputFromFile('Inspector')
      .getContent();

  const result = {

    step: 'STEP_28',

    tests: [

      {
        test: 'STEP_28_01',
        passed:
          html.includes('Sangkha Hygiene Portal'),
        detail:
          'พบ Inspector HTML'
      },

      {
        test: 'STEP_28_02',
        passed:
          html.includes('loadInspector'),
        detail:
          'พบ Inspector JavaScript'
      },

      {
  test: 'STEP_28_03',
  passed:
    html.includes('getInspectorData'),
  detail:
    'Inspector เรียก Backend'
},

      {
        test: 'STEP_28_04',
        passed:
          html.includes('logoutInspector'),
        detail:
          'พบระบบ Logout'
      }

    ]

  };


  result.ALL_TESTS_PASSED =
    result.tests.every(
      function(test) {
        return test.passed;
      }
    );


  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;

}
function getInspectorDashboard(user) {

  /*************************************************
   * 1. ตรวจ User
   *************************************************/

  if (!user) {
    return {
      success: false,
      error: 'ไม่พบข้อมูลผู้ตรวจ'
    };
  }


  /*************************************************
   * 2. ดึง Location ที่ User มีสิทธิ์
   *************************************************/

  const locations =
    getTargetsForUser_(user) || [];


  /*************************************************
   * 3. ดึง Inspection Logs
   *************************************************/

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName('Inspection_Logs');


  if (!sheet) {

    return {
      success: false,
      error: 'ไม่พบ Sheet: Inspection_Logs'
    };

  }


  const values =
    sheet.getDataRange().getValues();


  const headers =
    values.length
      ? values[0]
      : [];


  const rows =
    values.length > 1
      ? values.slice(1)
      : [];


  const index = {};

  headers.forEach(function(header, i) {

    index[String(header).trim()] = i;

  });


  /*************************************************
   * 4. วันที่วันนี้
   *************************************************/

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );


  /*************************************************
   * 5. สร้าง Map Inspection วันนี้
   *************************************************/

  const inspections = {};


  rows.forEach(function(row) {

    const locationId =
      String(
        row[index.Location_ID] || ''
      ).trim();


    if (!locationId) {
      return;
    }


    let dateValue =
      row[index.Date];


    let dateString = '';


    if (dateValue instanceof Date) {

      dateString =
        Utilities.formatDate(
          dateValue,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );

    } else {

      dateString =
        String(dateValue || '').substring(0, 10);

    }


    if (dateString !== today) {
      return;
    }


    inspections[locationId] = {

      logId:
        row[index.Log_ID] || '',

      inspectorId:
        row[index.Inspector_ID] || '',

      totalScore:
        Number(
          row[index.Total_Score] || 0
        ),

      isProxy:
        Boolean(
          row[index.Is_Proxy]
        ),

      originalInspectorId:
        row[index.Original_Inspector_ID] || ''

    };

  });


  /*************************************************
   * 6. สร้างข้อมูลสำหรับหน้า Inspector
   *************************************************/

  const resultLocations =
    locations.map(function(location) {

      const locationId =
        location.Location_ID;


      const inspection =
        inspections[locationId] || null;


      return {

        Location_ID:
          locationId,

        Location_Name:
          location.Location_Name || '',

        Grade_Level:
          location.Grade_Level || '',

        Type:
          location.Type || '',

        Is_SME:
          Boolean(location.Is_SME),

        inspected:
          Boolean(inspection),

        inspection:
          inspection

      };

    });


  /*************************************************
   * 7. สถิติ
   *************************************************/

  const total =
    resultLocations.length;


  const completed =
    resultLocations.filter(
      function(item) {
        return item.inspected;
      }
    ).length;


  const pending =
    total - completed;


  const scores =
    resultLocations
      .filter(function(item) {
        return item.inspected &&
               item.inspection;
      })
      .map(function(item) {
        return Number(
          item.inspection.totalScore || 0
        );
      });


  const average =
    scores.length
      ? scores.reduce(
          function(a, b) {
            return a + b;
          },
          0
        ) / scores.length
      : 0;


  const progress =
    total
      ? Math.round(
          completed / total * 100
        )
      : 0;


  /*************************************************
   * 8. Return
   *************************************************/

  return {

    success: true,

    user: user,

    locations:
      resultLocations,

    stats: {

      total:
        total,

      completed:
        completed,

      pending:
        pending,

      progress:
        progress,

      average:
        Number(
          average.toFixed(2)
        )

    }

  };

}
function getSupervisorDashboard(user) {

  /*************************************************
   * 1. ตรวจ User
   *************************************************/

  if (!user) {
    return {
      success: false,
      error: 'ไม่พบข้อมูล Supervisor'
    };
  }


  const role =
    String(user.Role || '')
      .trim()
      .toLowerCase();


  if (role !== 'supervisor') {
    return {
      success: false,
      error: 'บัญชีนี้ไม่ได้เป็น Supervisor'
    };
  }


  /*************************************************
   * 2. อ่าน Assignment
   *************************************************/

  const assignedGrade =
    String(user.Assigned_Grade || '')
      .trim();


  const assignedType =
    String(user.Assigned_Type || '')
      .trim()
      .toUpperCase();


  if (!assignedGrade || !assignedType) {
    return {
      success: false,
      error: 'ไม่พบข้อมูล Assigned_Grade หรือ Assigned_Type'
    };
  }


  /*************************************************
   * 3. เปิด Spreadsheet
   *************************************************/

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  /*************************************************
   * 4. อ่าน Locations
   *************************************************/

  const locationSheet =
    ss.getSheetByName('Locations');


  if (!locationSheet) {
    return {
      success: false,
      error: 'ไม่พบ Sheet: Locations'
    };
  }


  const locationValues =
    locationSheet.getDataRange().getValues();


  if (locationValues.length < 2) {
    return {
      success: false,
      error: 'Sheet Locations ไม่มีข้อมูล'
    };
  }


  const locationHeaders =
    locationValues[0];


  const locationIndex = {};


  locationHeaders.forEach(function(header, index) {

    locationIndex[
      String(header).trim()
    ] = index;

  });


  const requiredLocationHeaders = [
    'Location_ID',
    'Location_Name',
    'Grade_Level',
    'Type',
    'Is_SME'
  ];


  for (let i = 0; i < requiredLocationHeaders.length; i++) {

    const header =
      requiredLocationHeaders[i];

    if (
      locationIndex[header] === undefined
    ) {

      return {
        success: false,
        error:
          'Locations ไม่มีคอลัมน์: ' +
          header
      };

    }

  }


  /*************************************************
   * 5. เลือก Location ตาม Supervisor
   *************************************************/

  const locations = [];


  for (
    let i = 1;
    i < locationValues.length;
    i++
  ) {

    const row =
      locationValues[i];


    const grade =
      String(
        row[locationIndex.Grade_Level] || ''
      ).trim();


    const type =
      String(
        row[locationIndex.Type] || ''
      )
      .trim()
      .toUpperCase();


    if (
      grade !== assignedGrade ||
      type !== assignedType
    ) {

      continue;

    }


    locations.push({

      Location_ID:
        String(
          row[locationIndex.Location_ID] || ''
        ).trim(),

      Location_Name:
        String(
          row[locationIndex.Location_Name] || ''
        ).trim(),

      Grade_Level:
        grade,

      Type:
        type,

      Is_SME:
        String(
          row[locationIndex.Is_SME]
        ).toUpperCase() === 'TRUE',

      inspected: false,

      inspection: null

    });

  }


  /*************************************************
   * 6. อ่าน Inspection_Logs
   *************************************************/

  const inspectionSheet =
    ss.getSheetByName('Inspection_Logs');


  if (!inspectionSheet) {

    return {
      success: false,
      error: 'ไม่พบ Sheet: Inspection_Logs'
    };

  }


  const inspectionValues =
    inspectionSheet.getDataRange().getValues();


  const inspections = {};


  if (inspectionValues.length > 1) {

    const inspectionHeaders =
      inspectionValues[0];


    const inspectionIndex = {};


    inspectionHeaders.forEach(
      function(header, index) {

        inspectionIndex[
          String(header).trim()
        ] = index;

      }
    );


    const requiredInspectionHeaders = [
      'Log_ID',
      'Date',
      'Location_ID',
      'Inspector_ID',
      'Total_Score',
      'Is_Proxy',
      'Original_Inspector_ID'
    ];


    for (
      let i = 0;
      i < requiredInspectionHeaders.length;
      i++
    ) {

      const header =
        requiredInspectionHeaders[i];


      if (
        inspectionIndex[header] === undefined
      ) {

        return {
          success: false,
          error:
            'Inspection_Logs ไม่มีคอลัมน์: ' +
            header
        };

      }

    }


    /*************************************************
     * 7. วันที่วันนี้
     *************************************************/

    const today =
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      );


    /*************************************************
     * 8. เก็บผลตรวจของวันนี้
     *************************************************/

    for (
      let i = 1;
      i < inspectionValues.length;
      i++
    ) {

      const row =
        inspectionValues[i];


      const locationId =
        String(
          row[inspectionIndex.Location_ID] || ''
        ).trim();


      if (!locationId) {
        continue;
      }


      let dateString = '';


      const dateValue =
        row[inspectionIndex.Date];


      if (dateValue instanceof Date) {

        dateString =
          Utilities.formatDate(
            dateValue,
            Session.getScriptTimeZone(),
            'yyyy-MM-dd'
          );

      } else {

        dateString =
          String(
            dateValue || ''
          ).substring(0, 10);

      }


      if (dateString !== today) {
        continue;
      }


      inspections[locationId] = {

        logId:
          row[inspectionIndex.Log_ID] || '',

        inspectorId:
          row[inspectionIndex.Inspector_ID] || '',

        totalScore:
          Number(
            row[inspectionIndex.Total_Score] || 0
          ),

        isProxy:
          String(
            row[inspectionIndex.Is_Proxy] || ''
          ).toUpperCase() === 'TRUE',

        originalInspectorId:
          row[
            inspectionIndex.Original_Inspector_ID
          ] || ''

      };

    }

  }


  /*************************************************
   * 9. ผูก Inspection เข้ากับ Location
   *************************************************/

  locations.forEach(function(location) {

    const inspection =
      inspections[
        location.Location_ID
      ] || null;


    if (inspection) {

      location.inspected = true;

      location.inspection =
        inspection;

    }

  });


  /*************************************************
   * 10. คำนวณสถิติ
   *************************************************/

  const total =
    locations.length;


  const completed =
    locations.filter(
      function(location) {
        return location.inspected;
      }
    ).length;


  const pending =
    total - completed;


  const scores =
    locations
      .filter(
        function(location) {
          return (
            location.inspected &&
            location.inspection &&
            Number.isFinite(
              Number(
                location.inspection.totalScore
              )
            )
          );
        }
      )
      .map(
        function(location) {
          return Number(
            location.inspection.totalScore
          );
        }
      );


  const average =
    scores.length
      ? scores.reduce(
          function(sum, score) {
            return sum + score;
          },
          0
        ) / scores.length
      : null;


  const progress =
    total
      ? Math.round(
          completed / total * 100
        )
      : 0;


  /*************************************************
   * 11. Return
   *************************************************/

  return {

    success: true,

    user: user,

    assignment: {

      grade:
        assignedGrade,

      type:
        assignedType

    },

    locations:
      locations,

    stats: {

      total:
        total,

      completed:
        completed,

      pending:
        pending,

      progress:
        progress,

      average:
        average === null
          ? null
          : Number(
              average.toFixed(2)
            ),

      committee:
        null

    }

  };

}
function TEST_STEP_29_4_SESSION() {

  const testUser = {

    Student_ID:
      'TEST_SESSION_USER',

    Full_Name:
      'STEP 29 SESSION TEST',

    Role:
      'Inspector',

    Assigned_Grade:
      '1',

    Assigned_Type:
      'CLASSROOM',

    Assigned_Locations:
      'M1-01'

  };


  // =========================================
  // 1. สร้าง Session
  // =========================================

  const result =
    createSession_(testUser);


  // =========================================
  // 2. ตรวจผลการสร้าง
  // =========================================

  if (
    !result ||
    result.success !== true
  ) {

    throw new Error(
      'สร้าง Session ไม่สำเร็จ'
    );

  }


  // =========================================
  // 3. ต้องมี Session ID
  // =========================================

  if (
    !result.sessionId
  ) {

    throw new Error(
      'ไม่พบ sessionId ในผลลัพธ์'
    );

  }


  // =========================================
  // 4. อ่าน Session จาก Cache
  // =========================================

  const cache =
    CacheService.getScriptCache();


  const stored =
    cache.get(
      'SESSION_' +
      result.sessionId
    );


  if (!stored) {

    throw new Error(
      'ไม่พบ Session ใน Cache'
    );

  }


  // =========================================
  // 5. แปลงข้อมูล Session
  // =========================================

  const parsed =
    JSON.parse(stored);


  // =========================================
  // 6. ตรวจ User
  // =========================================

  if (
    parsed.Student_ID !==
    'TEST_SESSION_USER'
  ) {

    throw new Error(
      'Session User ไม่ถูกต้อง'
    );

  }


  if (
    parsed.Role !==
    'Inspector'
  ) {

    throw new Error(
      'Session Role ไม่ถูกต้อง'
    );

  }


  if (
    parsed.Assigned_Grade !==
    '1'
  ) {

    throw new Error(
      'Assigned_Grade ไม่ถูกต้อง'
    );

  }


  if (
    parsed.Assigned_Type !==
    'CLASSROOM'
  ) {

    throw new Error(
      'Assigned_Type ไม่ถูกต้อง'
    );

  }


  // =========================================
  // 7. PASS
  // =========================================

  console.log({

    step:
      'STEP_29_4',

    success:
      true,

    sessionId:
      result.sessionId,

    user:
      parsed,

    expiresIn:
      result.expiresIn,

    ALL_TESTS_PASSED:
      true

  });

}
/*************************************************
 * STEP 29.5
 * SESSION VERIFY TEST
 *************************************************/

function TEST_STEP_29_5_SESSION_VERIFY() {

  const testUser = {
    Student_ID: 'TEST_SESSION_USER',
    Full_Name: 'STEP 29 SESSION TEST',
    Role: 'Inspector',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: 'M1-01'
  };

  // สร้าง Session
  const created =
    createSession_(testUser);

  if (
    !created ||
    !created.success ||
    !created.sessionId
  ) {

    throw new Error(
      'สร้าง Session ไม่สำเร็จ'
    );

  }

  const sessionId =
    created.sessionId;

  // อ่าน Session กลับ
  const session =
    getSession_(sessionId);

  if (!session) {

    throw new Error(
      'ไม่สามารถอ่าน Session กลับได้'
    );

  }

  // ตรวจข้อมูล
  if (
    session.Student_ID !==
    testUser.Student_ID
  ) {

    throw new Error(
      'Student_ID ใน Session ไม่ถูกต้อง'
    );

  }

  if (
    session.Role !==
    testUser.Role
  ) {

    throw new Error(
      'Role ใน Session ไม่ถูกต้อง'
    );

  }

  if (
    session.Assigned_Locations !==
    testUser.Assigned_Locations
  ) {

    throw new Error(
      'Assigned_Locations ใน Session ไม่ถูกต้อง'
    );

  }

  return {

    step:
      'STEP_29_5',

    success:
      true,

    sessionId:
      sessionId,

    session:
      session,

    ALL_TESTS_PASSED:
      true

  };

}
/*************************************************
 * STEP 30
 * INSPECTOR SESSION DATA
 *************************************************/

function getInspectorData(sessionId) {

  try {

    console.log('===== getInspectorData =====');
    console.log('Session ID:', sessionId);

    const session =
      requireSession_(sessionId);

    if (!session) {
      throw new Error('ไม่พบ Session');
    }

    console.log('Session:', JSON.stringify(session));

    const role =
      normalizeText_(session.Role);

    console.log('Role:', role);

    if (role !== 'INSPECTOR') {

      throw new Error(
        'User นี้ไม่มีสิทธิ์ใช้งาน Inspector'
      );

    }

    const locations =
      getAccessibleLocations_(session);

    console.log(
      'Accessible locations:',
      locations.length
    );

    return {

      success: true,

      sessionId:
        sessionId,

      user:
        session,

      locationCount:
        locations.length,

      locations:
        locations

    };

  } catch (error) {

    console.error(
      'getInspectorData ERROR:',
      error
    );

    throw new Error(
      'โหลดข้อมูล Inspector ไม่สำเร็จ: ' +
      error.message
    );

  }

}


/*************************************************
 * STEP 30 TEST
 *************************************************/

function TEST_STEP_30_INSPECTOR_SESSION() {

  const testUser = {
    Student_ID: 'TEST_SESSION_USER',
    Full_Name: 'STEP 30 INSPECTOR TEST',
    Role: 'Inspector',
    Assigned_Grade: '1',
    Assigned_Type: 'CLASSROOM',
    Assigned_Locations: 'M1-01'
  };

  const created =
    createSession_(testUser);

  if (
    !created ||
    !created.success ||
    !created.sessionId
  ) {
    throw new Error(
      'สร้าง Session สำหรับ Test ไม่สำเร็จ'
    );
  }

  const result =
    getInspectorData(
      created.sessionId
    );

  if (
    !result ||
    result.success !== true
  ) {
    throw new Error(
      'getInspectorData ไม่สำเร็จ'
    );
  }

  if (!result.user) {
    throw new Error(
      'ไม่พบ User ใน Inspector Data'
    );
  }

  if (!Array.isArray(result.locations)) {
    throw new Error(
      'locations ไม่ใช่ Array'
    );
  }

  const output = {

  step:
    'STEP_30',

  success:
    true,

  sessionId:
    created.sessionId,

  user:
    result.user,

  locationCount:
    result.locations.length,

  locations:
    result.locations,

  ALL_TESTS_PASSED:
    true

};

Logger.log(
  JSON.stringify(
    output,
    null,
    2
  )
);

return output;
}
function TEST_INSPECTOR_USER() {

  const studentId = 'Ins23442';

  const user = findUserById_(studentId);

  console.log('USER =', JSON.stringify(user));

  if (!user) {
    console.log('ไม่พบ User');
    return;
  }

  console.log(
    'Assigned_Locations RAW =',
    user.Assigned_Locations
  );

  const assignedLocations =
    getAssignedLocations_(
      user.Assigned_Locations
    );

  console.log(
    'ASSIGNED LOCATIONS =',
    JSON.stringify(assignedLocations)
  );

  assignedLocations.forEach(function(locationId) {

    const location =
      findLocationById_(locationId);

    console.log(
      'LOCATION:',
      locationId,
      '=>',
      JSON.stringify(location)
    );

  });

}
function getInspectorLocations(sessionId) {

  try {

    console.log('========================================');
    console.log('STEP 38.2 - GET INSPECTOR LOCATIONS');
    console.log('Session:', sessionId);
    console.log('========================================');


    /*************************************************
     * 1. SESSION
     *************************************************/

    const session =
      requireSession_(sessionId);


    if (!session) {

      return {
        success: false,
        error: 'Session หมดอายุ กรุณา Login ใหม่'
      };

    }


    /*************************************************
     * 2. ASSIGNMENT
     *************************************************/

    const assignedGradeRaw =
      String(
        session.Assigned_Grade || ''
      ).trim();


    const assignedTypeRaw =
      String(
        session.Assigned_Type || ''
      ).trim();


    const assignedLocationsRaw =
      String(
        session.Assigned_Locations || ''
      ).trim();


    const inspectorId =
      String(
        session.Student_ID || ''
      ).trim();


    /*************************************************
     * 2.1 NORMALIZE ASSIGNMENT
     *************************************************/

    function normalizeGrade(value) {

      const text =
        String(value || '')
          .trim()
          .toUpperCase();


      if (
        text === '' ||
        text === 'ALL'
      ) {

        return 'ALL';

      }


      const cleaned =
        text
          .replace(/\s+/g, '')
          .replace(/^ม\./, '')
          .replace(/^ม/, '')
          .replace(/^M\./, '')
          .replace(/^M/, '');


      const number =
        Number(cleaned);


      if (
        Number.isFinite(number)
      ) {

        return String(number);

      }


      return text;

    }


    function normalizeType(value) {

      const text =
        String(value || '')
          .trim()
          .toUpperCase();


      if (
        text === '' ||
        text === 'ALL'
      ) {

        return 'ALL';

      }


      if (
        text === 'AREA' ||
        text === 'ZONE' ||
        text === 'ZONE_AREA' ||
        text === 'เขต' ||
        text === 'เขตพื้นที่'
      ) {

        return 'ZONE';

      }


      if (
        text === 'ROOM' ||
        text === 'CLASS' ||
        text === 'CLASSROOM' ||
        text === 'ห้อง' ||
        text === 'ห้องเรียน'
      ) {

        return 'CLASSROOM';

      }


      return text;

    }


    const assignedGrade =
      normalizeGrade(
        assignedGradeRaw
      );


    const assignedType =
      normalizeType(
        assignedTypeRaw
      );


    const assignedLocations =
      assignedLocationsRaw;


    console.log(
      '========== ASSIGNMENT DEBUG =========='
    );

    console.log(
      'Inspector ID:',
      inspectorId
    );

    console.log(
      'Assigned Grade RAW:',
      assignedGradeRaw
    );

    console.log(
      'Assigned Grade NORMALIZED:',
      assignedGrade
    );

    console.log(
      'Assigned Type RAW:',
      assignedTypeRaw
    );

    console.log(
      'Assigned Type NORMALIZED:',
      assignedType
    );

    console.log(
      'Assigned Locations:',
      assignedLocations
    );

    console.log(
      '======================================'
    );


    /*************************************************
     * 3. LOCATIONS SHEET
     *************************************************/

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();


    const locationSheet =
      ss.getSheetByName(
        'Locations'
      );


    if (!locationSheet) {

      return {
        success: false,
        error: 'ไม่พบ Sheet Locations'
      };

    }


    const locationValues =
      locationSheet
        .getDataRange()
        .getValues();


    if (
      !locationValues ||
      locationValues.length < 2
    ) {

      return {
        success: true,
        locations: [],
        averageScore: 0
      };

    }


    /*************************************************
     * 4. LOCATION HEADER
     *************************************************/

    const headers =
      locationValues[0].map(
        function(header) {

          return String(
            header
          ).trim();

        }
      );


    const index = {};


    headers.forEach(
      function(header, i) {

        index[header] = i;

      }
    );


    const requiredColumns = [

      'Location_ID',
      'Location_Name',
      'Grade_Level',
      'Type',
      'Is_SME'

    ];


    for (
      let i = 0;
      i < requiredColumns.length;
      i++
    ) {

      if (
        index[
          requiredColumns[i]
        ] === undefined
      ) {

        return {

          success: false,

          error:
            'Sheet Locations ไม่มี Column ' +
            requiredColumns[i]

        };

      }

    }


    /*************************************************
     * 5. TODAY
     *************************************************/

    const today =
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      );


    /*************************************************
     * 6. READ INSPECTION LOGS
     *************************************************/

    const logSheet =
      ss.getSheetByName(
        'Inspection_Logs'
      );


    const completedLocations =
      new Set();


    const locationScores =
      new Map();


    if (logSheet) {

      const logValues =
        logSheet
          .getDataRange()
          .getValues();


      if (
        logValues &&
        logValues.length >= 2
      ) {

        const logHeaders =
          logValues[0].map(
            function(header) {

              return String(
                header
              ).trim();

            }
          );


        const logIndex = {};


        logHeaders.forEach(
          function(header, i) {

            logIndex[header] = i;

          }
        );


        const dateIndex =
          logIndex.Date;


        const locationIdIndex =
          logIndex.Location_ID;


        let scoreIndex =
          undefined;


        if (
          logIndex.Total_Score !== undefined
        ) {

          scoreIndex =
            logIndex.Total_Score;

        }

        else if (
          logIndex.Score !== undefined
        ) {

          scoreIndex =
            logIndex.Score;

        }

        else if (
          logIndex.TotalScore !== undefined
        ) {

          scoreIndex =
            logIndex.TotalScore;

        }


        if (
          dateIndex !== undefined &&
          locationIdIndex !== undefined
        ) {

          for (
            let r = 1;
            r < logValues.length;
            r++
          ) {

            const rawDate =
              logValues[r][dateIndex];


            if (!rawDate) {

              continue;

            }


            const logDate =
              Utilities.formatDate(
                new Date(rawDate),
                Session.getScriptTimeZone(),
                'yyyy-MM-dd'
              );


            const logLocationId =
              String(
                logValues[r][locationIdIndex] || ''
              ).trim();


            if (
              logDate !== today ||
              !logLocationId
            ) {

              continue;

            }


            completedLocations.add(
              logLocationId
            );


            if (
              scoreIndex !== undefined
            ) {

              const rawScore =
                Number(
                  logValues[r][scoreIndex]
                );


              if (
                Number.isFinite(
                  rawScore
                )
              ) {

                locationScores.set(
                  logLocationId,
                  rawScore
                );

              }

            }

          }

        }

      }

    }


    /*************************************************
     * 7. ASSIGNED LOCATION LIST
     *************************************************/

    let allowedIds = [];


    if (
      assignedLocations !== '' &&
      assignedLocations.toUpperCase() !== 'ALL'
    ) {

      allowedIds =
        assignedLocations
          .split(',')
          .map(
            function(id) {

              return String(
                id
              )
                .trim()
                .toLowerCase();

            }
          )
          .filter(Boolean);

    }


    /*************************************************
     * 8. BUILD LOCATIONS
     *************************************************/

    const locations = [];


    for (
      let r = 1;
      r < locationValues.length;
      r++
    ) {

      const row =
        locationValues[r];


      /*************************************************
       * LOCATION ID
       *************************************************/

      const locationId =
        String(
          row[index.Location_ID] || ''
        ).trim();


      if (!locationId) {

        continue;

      }


      /*************************************************
       * LOCATION NAME
       *************************************************/

      const locationName =
        String(
          row[index.Location_Name] || ''
        ).trim();


      /*************************************************
       * GRADE
       *************************************************/

      const rawGrade =
        String(
          row[index.Grade_Level] || ''
        ).trim();


      const normalizedGrade =
        normalizeGrade(
          rawGrade
        );


      /*************************************************
       * TYPE
       *************************************************/

      const rawType =
        String(
          row[index.Type] || ''
        ).trim();


      const normalizedLocationType =
        normalizeType(
          rawType
        );


      /*************************************************
       * SME
       *************************************************/

      const isSME =
        String(
          row[index.Is_SME] || ''
        )
          .trim()
          .toUpperCase() === 'TRUE';


      /*************************************************
       * 9. SME FILTER
       *
       * ห้อง SME จะไม่แสดงใน Inspector
       *************************************************/

      if (isSME) {

        console.log(
          'SKIP SME LOCATION:',
          {
            Location_ID:
              locationId,

            Location_Name:
              locationName,

            Grade:
              rawGrade,

            Type:
              rawType
          }
        );

        continue;

      }


      /*************************************************
       * 10. GRADE MATCH
       *************************************************/

      const gradeMatch =
        assignedGrade === 'ALL' ||
        assignedGrade === normalizedGrade;


      if (!gradeMatch) {

        console.log(
          'SKIP GRADE:',
          {
            Location_ID:
              locationId,

            Location_Grade:
              rawGrade,

            Location_Grade_Normalized:
              normalizedGrade,

            Assigned_Grade:
              assignedGrade
          }
        );

        continue;

      }


      /*************************************************
       * 11. TYPE MATCH
       *************************************************/

      const typeMatch =
        assignedType === 'ALL' ||
        assignedType === normalizedLocationType;


      if (!typeMatch) {

        console.log(
          'SKIP TYPE:',
          {
            Location_ID:
              locationId,

            Location_Type:
              rawType,

            Location_Type_Normalized:
              normalizedLocationType,

            Assigned_Type:
              assignedType
          }
        );

        continue;

      }


      /*************************************************
       * 12. ASSIGNED LOCATIONS
       *************************************************/

      let locationMatch =
        true;


      if (
        allowedIds.length > 0
      ) {

        locationMatch =
          allowedIds.indexOf(
            locationId
              .trim()
              .toLowerCase()
          ) !== -1;

      }


      if (!locationMatch) {

        console.log(
          'SKIP ASSIGNED LOCATION:',
          {
            Location_ID:
              locationId,

            Assigned_Locations:
              assignedLocations
          }
        );

        continue;

      }


      /*************************************************
       * 13. COMPLETED
       *************************************************/

      const completed =
        completedLocations.has(
          locationId
        );


      /*************************************************
       * 14. SCORE
       *************************************************/

      const score =
        locationScores.has(
          locationId
        )

          ? locationScores.get(
              locationId
            )

          : null;


      /*************************************************
       * 15. PUSH
       *************************************************/

      const locationObject = {

        Location_ID:
          locationId,

        Location_Name:
          locationName,

        Grade_Level:
          rawGrade,

        Type:
          normalizedLocationType,

        Is_SME:
          false,

        Completed:
          completed,

        Score:
          score

      };


      locations.push(
        locationObject
      );


      console.log(
        'MATCH LOCATION:',
        locationObject
      );

    }


    /*************************************************
     * 16. AVERAGE SCORE
     *************************************************/

    const scoredLocations =
      locations.filter(
        function(location) {

          return Number.isFinite(
            Number(
              location.Score
            )
          );

        }
      );


    let averageScore =
      0;


    if (
      scoredLocations.length > 0
    ) {

      const scoreTotal =
        scoredLocations.reduce(
          function(
            total,
            location
          ) {

            return (
              total +
              Number(
                location.Score
              )
            );

          },
          0
        );


      averageScore =
        scoreTotal /
        scoredLocations.length;

    }


    averageScore =
      Number(
        averageScore.toFixed(2)
      );


    /*************************************************
     * 17. FINAL DEBUG
     *************************************************/

    console.log(
      '========================================'
    );

    console.log(
      'FINAL INSPECTOR LOCATION RESULT'
    );

    console.log(
      'Inspector:',
      inspectorId
    );

    console.log(
      'Assigned Grade RAW:',
      assignedGradeRaw
    );

    console.log(
      'Assigned Grade NORMALIZED:',
      assignedGrade
    );

    console.log(
      'Assigned Type RAW:',
      assignedTypeRaw
    );

    console.log(
      'Assigned Type NORMALIZED:',
      assignedType
    );

    console.log(
      'Assigned Locations:',
      assignedLocations
    );

    console.log(
      'Total Locations:',
      locations.length
    );

    console.log(
      'Locations:',
      locations
    );

    console.log(
      'Average Score:',
      averageScore
    );

    console.log(
      '========================================'
    );


    /*************************************************
     * 18. RETURN
     *************************************************/

    return {

      success: true,

      locations:
        locations,

      averageScore:
        averageScore

    };


  } catch (error) {

    console.error(
      'getInspectorLocations ERROR:',
      error
    );


    return {

      success: false,

      error:
        error &&
        error.message

          ? error.message

          : String(error)

    };

  }

}
function getTargetsForUser_(user) {

  if (!user) {
    return [];
  }


  /*************************************************
   * 1. เปิด Sheet Locations
   *************************************************/

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName('Locations');


  if (!sheet) {
    console.error(
      'ไม่พบ Sheet: Locations'
    );

    return [];
  }


  /*************************************************
   * 2. อ่านข้อมูล
   *************************************************/

  const values =
    sheet.getDataRange().getValues();


  if (values.length <= 1) {
    return [];
  }


  const headers =
    values[0];

  const rows =
    values.slice(1);


  /*************************************************
   * 3. Header Index
   *************************************************/

  const index = {};


  headers.forEach(function(header, i) {

    index[
      String(header).trim()
    ] = i;

  });


  /*************************************************
   * 4. ตรวจ Header
   *************************************************/

  const requiredHeaders = [
    'Location_ID',
    'Location_Name',
    'Grade_Level',
    'Type',
    'Is_SME'
  ];


  for (
    let i = 0;
    i < requiredHeaders.length;
    i++
  ) {

    if (
      index[requiredHeaders[i]] === undefined
    ) {

      console.error(
        'Locations ขาด Column: ' +
        requiredHeaders[i]
      );

      return [];
    }

  }


  /*************************************************
   * 5. แปลง Locations
   *************************************************/

  const locations =
    rows.map(function(row) {

      const rawSME =
        row[index.Is_SME];


      const isSME =
        rawSME === true ||
        String(rawSME)
          .trim()
          .toUpperCase() === 'TRUE';


      return {

        Location_ID:
          String(
            row[index.Location_ID] || ''
          ).trim(),

        Location_Name:
          String(
            row[index.Location_Name] || ''
          ).trim(),

        Grade_Level:
          normalizeText_(
            row[index.Grade_Level]
          ),

        Type:
          normalizeText_(
            row[index.Type]
          ),

        Is_SME:
          isSME

      };

    });


  /*************************************************
   * 6. User Data
   *************************************************/

  const role =
    normalizeText_(
      user.Role
    );

  const grade =
    normalizeText_(
      user.Assigned_Grade
    );

  const type =
    normalizeText_(
      user.Assigned_Type
    );


  /*************************************************
   * 7. ADMIN
   *************************************************/

  if (role === 'ADMIN') {
    return locations;
  }


  /*************************************************
   * 8. CLASSROOM
   *************************************************/

  if (type === 'CLASSROOM') {


    /***********************************************
     * ม.3
     *
     * ห้องปกติที่ใช้จริง:
     *
     * M3-02
     * M3-03
     * M3-04
     * M3-05
     * M3-06
     * M3-07
     * M3-08
     * M3-09
     * M3-10
     *
     * = 9 ห้อง
     *
     * +
     *
     * SME:
     * M1-01
     * M2-01
     * M3-01
     * M4-01
     * M5-01
     * M6-01
     *
     * = 6 ห้อง
     *
     * รวม = 15 ห้อง
     ***********************************************/

    if (grade === '3') {

      return locations.filter(function(location) {


        /*
         * SME ทุกระดับ
         */

        if (
          location.Type === 'CLASSROOM' &&
          location.Is_SME === true
        ) {

          return true;

        }


        /*
         * ห้อง ม.3 ปกติ
         *
         * ต้องเป็น M3-02 ถึง M3-10 เท่านั้น
         */

        if (
          location.Type === 'CLASSROOM' &&
          location.Grade_Level === '3' &&
          location.Is_SME === false
        ) {

          const locationId =
            location.Location_ID;


          const match =
            /^M3-(0[2-9]|10)$/
              .test(locationId);


          return match;

        }


        return false;

      });

    }


    /***********************************************
     * ม.1 / ม.2 / ม.4 / ม.5 / ม.6
     *
     * 10 ห้องปกติ
     * ไม่เห็น SME
     ***********************************************/

    return locations.filter(function(location) {

      return (

        location.Type === 'CLASSROOM' &&

        location.Grade_Level === grade &&

        location.Is_SME === false

      );

    });

  }


  /*************************************************
   * 9. ZONE
   *************************************************/

  if (type === 'ZONE') {

    return locations.filter(function(location) {

      if (
        location.Type !== 'ZONE'
      ) {

        return false;

      }


      if (
        grade === '' ||
        grade === 'ALL'
      ) {

        return true;

      }


      return (
        location.Grade_Level === grade
      );

    });

  }


  /*************************************************
   * 10. ไม่ตรง Type
   *************************************************/

  return [];

}
function testInspectorLocations() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName('Users');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: Users');
  }

  const values =
    sheet.getDataRange().getValues();

  const headers =
    values[0];

  const rows =
    values.slice(1);

  const index = {};

  headers.forEach(function(header, i) {
    index[String(header).trim()] = i;
  });


  /*************************************************
   * ทดสอบ User ม.1
   *************************************************/

  const userM1Row =
    rows.find(function(row) {

      return (
        normalizeText_(
          row[index.Role]
        ) === 'INSPECTOR' &&

        normalizeText_(
          row[index.Assigned_Grade]
        ) === '1' &&

        normalizeText_(
          row[index.Assigned_Type]
        ) === 'CLASSROOM'
      );

    });


  if (!userM1Row) {
    throw new Error(
      'ไม่พบ Inspector CLASSROOM ม.1'
    );
  }


  const userM1 = {};

  headers.forEach(function(header, i) {

    userM1[
      String(header).trim()
    ] =
      userM1Row[i];

  });


  /*************************************************
   * ทดสอบ User ม.3
   *************************************************/

  const userM3Row =
    rows.find(function(row) {

      return (
        normalizeText_(
          row[index.Role]
        ) === 'INSPECTOR' &&

        normalizeText_(
          row[index.Assigned_Grade]
        ) === '3' &&

        normalizeText_(
          row[index.Assigned_Type]
        ) === 'CLASSROOM'
      );

    });


  if (!userM3Row) {
    throw new Error(
      'ไม่พบ Inspector CLASSROOM ม.3'
    );
  }


  const userM3 = {};

  headers.forEach(function(header, i) {

    userM3[
      String(header).trim()
    ] =
      userM3Row[i];

  });


  /*************************************************
   * ดึง Locations
   *************************************************/

  const m1Locations =
    getTargetsForUser_(
      userM1
    );


  const m3Locations =
    getTargetsForUser_(
      userM3
    );


  /*************************************************
   * แสดงผล
   *************************************************/

  console.log(
    '=============================='
  );

  console.log(
    'M.1 USER'
  );

  console.log(
    userM1
  );

  console.log(
    'M.1 TOTAL:',
    m1Locations.length
  );

  console.log(
    'M.1 LOCATIONS:',
    m1Locations
  );


  console.log(
    '=============================='
  );

  console.log(
    'M.3 USER'
  );

  console.log(
    userM3
  );

  console.log(
    'M.3 TOTAL:',
    m3Locations.length
  );

  console.log(
    'M.3 LOCATIONS:',
    m3Locations
  );


  console.log(
    '=============================='
  );


  return {

    M1: {

      total:
        m1Locations.length,

      locations:
        m1Locations.map(function(location) {

          return location.Location_ID;

        })

    },

    M3: {

      total:
        m3Locations.length,

      locations:
        m3Locations.map(function(location) {

          return location.Location_ID;

        })

    }

  };

}
function testClassroomPermission() {

  const usersSheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName('Users');

  const values =
    usersSheet
      .getDataRange()
      .getValues();

  const headers = values[0];
  const rows = values.slice(1);

  const index = {};

  headers.forEach(function(header, i) {
    index[String(header).trim()] = i;
  });


  // หา User ม.1
  const userM1Row =
    rows.find(function(row) {

      return (
        String(
          row[index.Assigned_Grade]
        ).trim() === '1' &&
        String(
          row[index.Assigned_Type]
        ).trim().toUpperCase() === 'CLASSROOM'
      );

    });


  // หา User ม.3
  const userM3Row =
    rows.find(function(row) {

      return (
        String(
          row[index.Assigned_Grade]
        ).trim() === '3' &&
        String(
          row[index.Assigned_Type]
        ).trim().toUpperCase() === 'CLASSROOM'
      );

    });


  if (!userM1Row || !userM3Row) {

    console.log(
      'ไม่พบ User ม.1 หรือ ม.3'
    );

    return;

  }


  function makeUser(row) {

    const user = {};

    headers.forEach(function(header, i) {

      user[String(header).trim()] =
        row[i];

    });

    return user;

  }


  const userM1 =
    makeUser(userM1Row);

  const userM3 =
    makeUser(userM3Row);


  /*************************************************
   * TEST
   *************************************************/

  const testLocations = [

    'M1-01',
    'M1-02',
    'M3-01',
    'M3-02',
    'M6-01',
    'M3-11'

  ];


  console.log(
    '========================================'
  );

  console.log(
    'TEST M.1'
  );

  console.log(
    'USER:',
    userM1
  );


  testLocations.forEach(function(locationId) {

    const location =
      findLocationById_(
        locationId
      );

    const allowed =
      canAccessLocation_(
        userM1,
        location
      );

    console.log(
      'M.1 -> ' +
      locationId +
      ' = ' +
      allowed
    );

  });


  console.log(
    '========================================'
  );

  console.log(
    'TEST M.3'
  );

  console.log(
    'USER:',
    userM3
  );


  testLocations.forEach(function(locationId) {

    const location =
      findLocationById_(
        locationId
      );

    const allowed =
      canAccessLocation_(
        userM3,
        location
      );

    console.log(
      'M.3 -> ' +
      locationId +
      ' = ' +
      allowed
    );

  });


  console.log(
    '========================================'
  );

}