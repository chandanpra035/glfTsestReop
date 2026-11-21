
"use strict";

/*
 GLF RESERVE — MANUAL EMAIL TEST SIGNUP

 1. User joins TEST website
 2. Signup saves to TEST Google Sheet
 3. A unique Welcome Kit link is saved
 4. No automatic welcome email is sent
*/

const {
  createWelcomeToken
} = require("./welcome-kit/_email");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function saveToTestSheet(url, payload) {
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
        "TEST Google Apps Script did not return JSON"
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(
        String(
          data.error || "TEST signup was rejected"
        )
      );
    }

    return data;

  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  if (process.env.GLF_TEST_MODE !== "true") {
    return res.status(503).json({
      error: "TEST mode disabled"
    });
  }

  const required = [
    "GLF_TEST_SIGNUP_SCRIPT_URL",
    "GLF_TEST_SIGNUP_SECRET",
    "GLF_TEST_SITE_URL",
    "GLF_TEST_ALLOWED_EMAILS",
    "GLF_TOKEN_SECRET"
  ];

  const missing = required.filter(
    key => !process.env[key]
  );

  if (missing.length > 0) {
    console.error(
      "[GLF TEST] Missing settings:",
      missing.join(", ")
    );

    return res.status(503).json({
      error: "TEST configuration incomplete"
    });
  }

  const site = process.env.GLF_TEST_SITE_URL
    .replace(/\/+$/, "");

  if (
    !/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(site)
  ) {
    return res.status(503).json({
      error: "Invalid TEST site URL"
    });
  }

  const body =
    req.body && typeof req.body === "object"
      ? req.body
      : {};

  // Spam protection
  if (body.company) {
    return res.status(200).json({
      ok: true
    });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();

  if (
    email.length > 254 ||
    !EMAIL_RE.test(email)
  ) {
    return res.status(400).json({
      error: "Please enter a valid email"
    });
  }

  // Approved TEST addresses only
  const allowed = process.env
    .GLF_TEST_ALLOWED_EMAILS
    .split(",")
    .map(value => value.trim().toLowerCase());

  if (!allowed.includes(email)) {
    return res.status(403).json({
      error: "TEST ONLY: Email not approved"
    });
  }

  // Country detection
  let country = "Unknown";

  const countryCode = String(
    req.headers["x-vercel-ip-country"] ||
    body.countryCode ||
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

    // Generate personal Welcome Kit link
    const token = createWelcomeToken(email);

    const welcomeLink =
      site +
      "/welcome-kit/?token=" +
      encodeURIComponent(token);

    // Save signup and personal link
    // in TEST Google Sheet
    const result = await saveToTestSheet(
      process.env.GLF_TEST_SIGNUP_SCRIPT_URL,
      {
        secret:
          process.env.GLF_TEST_SIGNUP_SECRET,
        email: email,
        country: country,
        welcomeLink: welcomeLink
      }
    );

    // NO automatic email sending

    return res.status(200).json({
      ok: true,
      alreadyJoined: !!result.alreadyJoined,
      message:
        "Signup saved. Welcome email will be sent manually."
    });

  } catch (error) {

    console.error(
      "[GLF MANUAL TEST JOIN]",
      error.message
    );

    return res.status(502).json({
      error:
        "TEST signup could not be saved. Check Vercel logs."
    });
  }
};
