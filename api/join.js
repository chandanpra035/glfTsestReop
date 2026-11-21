"use strict";
// TEST-ONLY signup: save only Date, Time, Email, Country.
// NO automatic emails and NO signup allowlist. Do NOT deploy to the live GLF project.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendToTestSheet(url, payload) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    throw new Error("Invalid TEST Signup Apps Script Web App URL");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); }
    catch (_) { throw new Error("Signup Apps Script did not return JSON"); }
    if (!response.ok || result.success !== true) {
      throw new Error(String(result.error || "Signup Script rejected the request"));
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (process.env.GLF_TEST_MODE !== "true") return res.status(503).json({ error: "Test mode disabled" });
  const scriptUrl = process.env.GLF_TEST_SIGNUP_SCRIPT_URL;
  const scriptSecret = process.env.GLF_TEST_SIGNUP_SECRET;
  if (!scriptUrl || !scriptSecret) {
    return res.status(503).json({ error: "TEST Signup connection is not configured" });
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.company) return res.status(200).json({ ok: true });
  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  let country = "Unknown";
  const cc = String(req.headers["x-vercel-ip-country"] || body.countryCode || "").toUpperCase();
  if (/^[A-Z]{2}$/.test(cc)) {
    try { country = new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || cc; }
    catch (_) { country = cc; }
  }
  try {
    const saved = await sendToTestSheet(scriptUrl, {
      secret: scriptSecret,
      email,
      country
    });
    return res.status(200).json({
      ok: true,
      alreadyJoined: Boolean(saved.alreadyJoined),
      message: "TEST signup saved; welcome email will be sent manually"
    });
  } catch (error) {
    console.error("[GLF TEST SIGNUP]", error.message);
    return res.status(502).json({ error: "TEST signup could not be saved. Check Vercel Logs." });
  }
};
