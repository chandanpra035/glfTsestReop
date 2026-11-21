/** Paste in a NEW Apps Script project owned/authorized by chandanpra035@gmail.com.
 * Do not paste in the production signup script or Welcome Kit sheet script.
 */
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('GLF_MAIL_TEST_SECRET');
    if (!secret || data.secret !== secret) return out_({success:false,error:'Unauthorized'});
    const email = String(data.to || '').trim().toLowerCase();
    const link = String(data.link || '');
    // TEST allowlist: add only addresses you own/control for testing.
    const allowed = ['chandanpra035@gmail.com'];
    if (allowed.indexOf(email) === -1) return out_({success:false,error:'Test recipient not allowed'});
    if (!/^http:\/\/(?:localhost|127\.0\.0\.1):5500\/welcome-kit\/\?token=[A-Za-z0-9_.-]+$/.test(link)) {
      return out_({success:false,error:'Invalid localhost invitation link'});
    }
    const safeLink = link.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const html = '<div style="background:#faf7f5;padding:24px;font-family:Arial,sans-serif;text-align:center;color:#3a211c">' +
      '<div style="font-size:23px;letter-spacing:2px">GLF RESERVE</div>' +
      '<h1>Welcome to the Reserve.</h1>' +
      '<p>Thank you for becoming a RESERVE member.</p>' +
      '<p>Choose your complimentary fragrance and provide your shipping details.</p>' +
      '<p style="margin:30px 0"><a style="padding:15px 24px;color:white;background:#48221d;text-decoration:none;border-radius:5px" href="'+safeLink+'">CHOOSE YOUR FRAGRANCE</a></p>' +
      '<p>GLF RESERVE Team · TEST EMAIL</p></div>';
    MailApp.sendEmail({to:email,subject:'Welcome to GLF RESERVE — TEST',name:'GLF RESERVE (TEST)',htmlBody:html,
      body:'GLF RESERVE TEST — Choose your fragrance: '+link});
    return out_({success:true});
  } catch (error) { console.error(error); return out_({success:false,error:'Unable to send test email'}); }
}
function out_(v) { return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }
