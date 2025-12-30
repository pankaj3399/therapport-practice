import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@therapport.co.uk';

