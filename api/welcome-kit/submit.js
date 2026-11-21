"use strict";
// TEST-ONLY Welcome Kit submission.
// A verified personal token is required; recipient email is always derived from the token.
const { validateToken } = require("./_token");
const validFragrances = new Set(["Santal Reserve", "Citrus Hinoki", "Amber Coast", "FREE"]);
const clean = (v, max = 500) => typeof v === "string" ? v.trim().slice(0, max) : "";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });
  if (process.env.GLF_TEST_MODE !== "true") return res.status(503).json({ success: false, error: "Test mode disabled" });
  if (!req.body || typeof req.body !== "object") return res.status(400).json({ success: false, error: "Invalid form" });

  const verified = validateToken(req.body.token);
  if (!verified) return res.status(401).json({ success: false, error: "Invalid or expired invitation" });

  const data = {
    name: clean(req.body.fullName, 120),
    email: verified.email,
    fragrance: clean(req.body.fragrance, 60),
    address: clean(req.body.address),
    city: clean(req.body.city, 100),
    state: clean(req.body.state, 100),
    postal: clean(req.body.postal, 40),
    country: clean(req.body.country, 100)
  };
  if (!data.name || !validFragrances.has(data.fragrance) || !data.address ||
      !data.city || !data.state || !data.postal || !data.country) {
    return res.status(400).json({ success: false, error: "Please complete all required fields" });
  }
  const scriptUrl = process.env.GLF_SHEET_WEBAPP_URL;
  const secret = process.env.GLF_API_SECRET;
  if (!scriptUrl || !secret) return res.status(503).json({ success: false, error: "Sheet connection not configured" });
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(scriptUrl)) {
    return res.status(503).json({ success: false, error: "Invalid Welcome Kit Script URL" });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...data, secret }),
      redirect: "follow",
      signal: controller.signal
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); }
    catch (_) { throw new Error("Welcome Kit Script returned non-JSON response"); }
    if (!response.ok || result.success !== true) throw new Error("Welcome Kit Script rejected submission");
    return res.status(200).json({ success: true, message: "Your details have been received" });
  } catch (error) {
    console.error("[GLF TEST WELCOME KIT]", error.message);
    return res.status(502).json({ success: false, error: "Could not save Welcome Kit details" });
  } finally {
    clearTimeout(timer);
  }
};
