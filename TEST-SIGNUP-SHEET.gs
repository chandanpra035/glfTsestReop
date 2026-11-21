/** Only for GLF Reserve - Local Signup TEST sheet under adorbix.new@gmail.com.
 * REPLACE the existing test script with this version to prevent duplicate welcome emails.
 */
const TEST_SIGNUP_TAB = 'Sheet1';
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('GLF_TEST_SECRET');
    if (!secret || data.secret !== secret) return response_({success:false,error:'Unauthorized'});
    const email = String(data.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return response_({success:false,error:'Invalid email'});
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEST_SIGNUP_TAB);
    if (!sheet) throw new Error('Sheet tab not found: '+TEST_SIGNUP_TAB);
    const lock=LockService.getScriptLock(); lock.waitLock(10000);
    try {
      const n = sheet.getLastRow();
      if (n > 1) {
        const entries=sheet.getRange(2,3,n-1,1).getDisplayValues().map(x=>String(x[0]).replace(/^'/,'').trim().toLowerCase());
        if(entries.includes(email)) return response_({success:true,alreadyJoined:true});
      }
      const now=new Date();
      const date=Utilities.formatDate(now,'Asia/Kolkata','dd/MM/yyyy');
      const time=Utilities.formatDate(now,'Asia/Kolkata','HH:mm:ss');
      const country=String(data.country||'Unknown').replace(/^[=+\-@]/, "'$&").slice(0,100);
      sheet.appendRow([date,time,"'"+email,country]);
      return response_({success:true,alreadyJoined:false});
    } finally { lock.releaseLock(); }
  } catch (err) { console.error(err); return response_({success:false,error:'Unable to save test signup'}); }
}
function response_(o) {return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
