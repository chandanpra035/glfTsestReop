const { validateToken } = require('./_token');
const choices = new Set(['Santal Reserve','Citrus Hinoki','Amber Coast','FREE']);
const clean = (v, max=500) => typeof v === 'string' ? v.trim().slice(0,max) : '';
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({success:false});
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({success:false});
  const valid = validateToken(req.body.token);
  if (!valid) return res.status(401).json({success:false,error:'Invalid or expired link'});
  const data = {
    name:clean(req.body.fullName,120), email:valid.email,
    fragrance:clean(req.body.fragrance,60), address:clean(req.body.address),
    city:clean(req.body.city,100), state:clean(req.body.state,100),
    postal:clean(req.body.postal,40), country:clean(req.body.country,100)
  };
  if (!data.name || !choices.has(data.fragrance) || !data.address || !data.city || !data.state || !data.postal || !data.country) return res.status(400).json({success:false,error:'Missing or invalid fields'});
  if (!process.env.GLF_SHEET_WEBAPP_URL || !process.env.GLF_API_SECRET) return res.status(503).json({success:false,error:'Sheet connection not configured'});
  try {
    const response = await fetch(process.env.GLF_SHEET_WEBAPP_URL, {
      method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({...data,secret:process.env.GLF_API_SECRET}),
      redirect:'follow', signal:AbortSignal.timeout(20000)
    });
    const body = await response.text();
    let result;
    try {result = JSON.parse(body);} catch (_) { throw new Error('Unexpected response from Sheet'); }
    if (!response.ok || !result.success) throw new Error('Sheet failed');
    return res.status(200).json({success:true});
  } catch (err) {
    console.error('Welcome Kit saving failed:',err.message);
    return res.status(502).json({success:false,error:'Could not save details'});
  }
};
