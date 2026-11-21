
"use strict";

/*
 GLF RESERVE — TEST SIGNUP
 Only for the separate Vercel TEST project.
 Original GLF website is not affected.
*/

const { createWelcomeToken } = require(
  "./welcome-kit/_email"
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Send data securely to Google Apps Script
async function callAppsScript(url, payload) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        "Apps Script returned a non-JSON response"
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(
        String(
          data.error ||
          "Google Apps Script request failed"
        )
      );
    }

    return data;

  } finally {
    clearTimeout(timeout);
  }
}

// Main TEST signup API
module.exports = async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // TEST mode must be enabled
  if (process.env.GLF_TEST_MODE !== "true") {
    return res.status(503).json({
      error: "Test mode disabled"
    });
  }

  // Required Vercel environment variables
  const required = [
    "GLF_TEST_SIGNUP_SCRIPT_URL",
    "GLF_TEST_SIGNUP_SECRET",
    "GLF_TEST_EMAIL_SCRIPT_URL",
    "GLF_TEST_EMAIL_SECRET",
    "GLF_TEST_SITE_URL",
    "GLF_TEST_ALLOWED_EMAILS",
    "GLF_TOKEN_SECRET"
  ];

  const missing = required.filter(
    key => !process.env[key]
  );

  if (missing.length > 0) {
    console.error(
      "[GLF TEST] Missing variables:",
      missing.join(", ")
    );

    return res.status(503).json({
      error: "Test server settings are incomplete"
    });
  }

  const site = process.env.GLF_TEST_SITE_URL
    .replace(/\/+$/, "");

  if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(site)) {
    return res.status(503).json({
      error: "Invalid TEST website URL"
    });
  }

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({
      error: "Invalid request"
    });
  }

  // Honeypot spam protection
  if (req.body.company) {
    return res.status(200).json({
      ok: true
    });
  }

  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({
      error: "Please enter a valid email address"
    });
  }

  // Allow approved TEST recipients only
  const allowedEmails = process.env
    .GLF_TEST_ALLOWED_EMAILS
    .split(",")
    .map(value => value.trim().toLowerCase());

  if (!allowedEmails.includes(email)) {
    return res.status(403).json({
      error: "TEST ONLY: Email not approved"
    });
  }

  // Country detection
  let country = "Unknown";

  const countryCode = String(
    req.headers["x-vercel-ip-country"] ||
    req.body.countryCode ||
    ""
  ).toUpperCase();

  if (/^[A-Z]{2}$/.test(countryCode)) {
    try {
      country = new Intl.DisplayNames(
        ["en"],
        { type: "region" }
      ).of(countryCode) || countryCode;
    } catch (error) {
      country = countryCode;
    }
  }

  try {

    // STEP 1: Save email in Signup TEST Sheet
    const saved = await callAppsScript(
      process.env.GLF_TEST_SIGNUP_SCRIPT_URL,
      {
        secret: process.env.GLF_TEST_SIGNUP_SECRET,
        email: email,
        country: country
      }
    );

    if (saved.alreadyJoined) {
      return res.status(200).json({
        ok: true,
        alreadyJoined: true
      });
    }

    // STEP 2: Generate secure welcome link
    const token = createWelcomeToken(email);

    const welcomeLink =
      site +
      "/welcome-kit/?token=" +
      encodeURIComponent(token);

    // STEP 3: Send Welcome Email from Chandan Gmail
    await callAppsScript(
      process.env.GLF_TEST_EMAIL_SCRIPT_URL,
      {
        secret: process.env.GLF_TEST_EMAIL_SECRET,
        to: email,
        link: welcomeLink
      }
    );

    return res.status(200).json({
      ok: true,
      alreadyJoined: false,
      message: "Welcome email sent"
    });

  } catch (error) {

    console.error(
      "[GLF TEST JOIN ERROR]",
      error.message
    );

    return res.status(502).json({
      error:
        "TEST signup could not finish. Check Vercel Function Logs."
    });
  }
};
