// utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Creates a reusable transporter object using SMTP.
 * Make sure to set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates
  }
});

/**
 * Send email using nodemailer
 * @param {string} to Recipient email address
 * @param {string} subject Email subject
 * @param {string} html HTML body content
 */
export async function sendEmail(to, subject, html) {
  try {
    if (!to || !subject || !html) {
      throw new Error('Missing required email parameters.');
    }

    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html
    });

    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return info;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw error;
  }
}
