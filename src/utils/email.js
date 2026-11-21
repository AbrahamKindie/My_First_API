
import nodemailer from "nodemailer";
import "dotenv/config";

// ==========================================
// EMAIL CONFIGURATION
// ==========================================

const requiredEmailVariables = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
];

const missingVariables = requiredEmailVariables.filter(
  (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing email environment variables: ${missingVariables.join(", ")}`
  );
}

const emailPort = Number(process.env.EMAIL_PORT);

if (!Number.isInteger(emailPort) || emailPort <= 0) {
  throw new Error("EMAIL_PORT must be a valid port number.");
}

// ==========================================
// NODEMAILER TRANSPORTER
// ==========================================

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: emailPort,
  secure:
    process.env.EMAIL_SECURE === "true" || emailPort === 465,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },

  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

export default transporter;
