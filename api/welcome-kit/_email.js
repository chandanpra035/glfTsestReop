const crypto = require('node:crypto');

function createWelcomeToken(email) {
  const secret = process.env.GLF_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error('GLF_TOKEN_SECRET missing');
  const payload = Buffer.from(JSON.stringify({
    email: String(email).trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function makeEmailHtml(url) {
  const link = escapeHtml(url);
  const origin = 'https://glfreserve.com';
  const art = `${origin}/images/welcome-email-art.jpg`;
  const button = `${origin}/images/welcome-email-button.jpg`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#faf7f5;color:#3a211c;font-family:Arial,sans-serif">
  <div style="display:none;font-size:1px;color:#faf7f5;max-height:0;max-width:0;opacity:0;overflow:hidden">Thank you for becoming a RESERVE member. A complimentary fragrance gift is reserved for you.</div>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;background:#faf7f5"><tr><td align="center" style="padding:20px 8px">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="497" style="border-collapse:collapse;width:100%;max-width:497px;background:#f8eae8">
      <tr><td style="margin:0;padding:0;line-height:0"><img src="${art}" width="497" alt="GLF RESERVE. Thank you for becoming a RESERVE member. Discover four fragrances and receive a complimentary welcome gift." style="display:block;border:0;width:100%;height:auto;max-width:497px"></td></tr>
      <tr><td style="margin:0;padding:0;line-height:0"><a href="${link}" target="_blank" style="display:block;text-decoration:none"><img src="${button}" width="497" alt="CHOOSE YOUR FRAGRANCE — open your secure Welcome Kit form" style="display:block;border:0;width:100%;height:auto;max-width:497px"></a></td></tr>
      <tr><td align="center" style="padding:14px 16px 22px;background:#f6e7e5"><a href="${link}" style="color:#511f1c;font-weight:bold;text-decoration:underline;font-size:13px">Choose your fragrance &amp; confirm your shipping address</a></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function sendWelcomeEmail(email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true, reason: 'RESEND_API_KEY is not configured' };
  const token = createWelcomeToken(email);
  const url = `https://glfreserve.com/welcome-kit/?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'GLF RESERVE <member@glfreserve.com>',
      to: [email],
      subject: 'Welcome to GLF RESERVE — Your Gift Awaits',
      html: makeEmailHtml(url),
      text: `Welcome to GLF RESERVE! Thank you for becoming a RESERVE member. Choose your complimentary fragrance and confirm your shipping address here: ${url}`
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Email provider returned ${response.status}: ${details.slice(0,300)}`);
  }
  return { sent: true };
}
module.exports = { createWelcomeToken, makeEmailHtml, sendWelcomeEmail };
