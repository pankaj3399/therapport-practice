import { transporter, EMAIL_FROM } from '../config/email';

export interface WelcomeEmailData {
  firstName: string;
  email: string;
  password: string;
}

export interface PasswordResetEmailData {
  firstName: string;
  email: string;
  resetLink: string;
}

export interface EmailChangeVerificationData {
  firstName: string;
  verificationLink: string;
  newEmail: string;
}

export interface EmailChangeConfirmationData {
  firstName: string;
  oldEmail: string;
}

export interface DocumentExpiryReminderData {
  firstName: string;
  email: string;
  documentType: 'insurance' | 'clinical_registration';
  documentName: string;
  expiryDate: string;
}

export interface AdminEscalationData {
  practitionerName: string;
  practitionerEmail: string;
  documentType: 'insurance' | 'clinical_registration';
  documentName: string;
  expiryDate: string;
  daysOverdue: number;
}

export class EmailService {
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Therapport</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Welcome to Therapport, ${data.firstName}!</h1>
            <p>Your account has been successfully created. Here are your login credentials:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Email:</strong> ${data.email}</p>
              <p><strong>Password:</strong> ${data.password}</p>
            </div>
            <p>Please log in and change your password after your first login.</p>
            <p>If you have any questions, please contact us at info@therapport.co.uk</p>
            <p>Best regards,<br>The Therapport Team</p>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: data.email,
      subject: 'Welcome to Therapport - Your Account Details',
      html,
    });
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset Request</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Password Reset Request</h1>
            <p>Hello ${data.firstName},</p>
            <p>You have requested to reset your password. Click the link below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.resetLink}" style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this, please ignore this email.</p>
            <p>Best regards,<br>The Therapport Team</p>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: data.email,
      subject: 'Password Reset Request - Therapport',
      html,
    });
  }

  async sendEmailChangeVerification(data: EmailChangeVerificationData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Email Change Verification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Verify Your New Email Address</h1>
            <p>Hello ${data.firstName},</p>
            <p>You have requested to change your email address to <strong>${data.newEmail}</strong>.</p>
            <p>Please click the link below to verify this email address:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.verificationLink}" style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
            </div>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not request this change, please ignore this email.</p>
            <p>Best regards,<br>The Therapport Team</p>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: data.newEmail,
      subject: 'Verify Your New Email Address - Therapport',
      html,
    });
  }

  async sendEmailChangeConfirmation(data: EmailChangeConfirmationData): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Email Change Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2c3e50;">Email Address Changed</h1>
            <p>Hello ${data.firstName},</p>
            <p>This is to confirm that your email address has been successfully changed from <strong>${data.oldEmail}</strong>.</p>
            <p>If you did not make this change, please contact us immediately at info@therapport.co.uk</p>
            <p>Best regards,<br>The Therapport Team</p>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: data.oldEmail,
      subject: 'Email Address Changed - Therapport',
      html,
    });
  }

  async sendDocumentExpiryReminder(data: DocumentExpiryReminderData): Promise<void> {
    const documentTypeLabel =
      data.documentType === 'insurance'
        ? 'Professional Indemnity Insurance'
        : 'Clinical Registration';
    const expiryDateFormatted = new Date(data.expiryDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Document Expiry Reminder</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #e74c3c;">Important: Document Expiry Reminder</h1>
            <p>Hello ${data.firstName},</p>
            <p>This is a reminder that your <strong>${documentTypeLabel}</strong> document is expiring soon or has expired.</p>
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Document:</strong> ${data.documentName}</p>
              <p style="margin: 5px 0 0 0;"><strong>Expiry Date:</strong> ${expiryDateFormatted}</p>
            </div>
            <p>Please log in to your Therapport account and upload a new document to maintain compliance.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://therapport.co.uk'}/profile" style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Update Document</a>
            </div>
            <p>If you have any questions, please contact us at info@therapport.co.uk</p>
            <p>Best regards,<br>The Therapport Team</p>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: data.email,
      subject: `Action Required: ${documentTypeLabel} Document Expiry - Therapport`,
      html,
    });
  }

  async sendAdminEscalation(data: AdminEscalationData): Promise<void> {
    const documentTypeLabel =
      data.documentType === 'insurance'
        ? 'Professional Indemnity Insurance'
        : 'Clinical Registration';
    const expiryDateFormatted = new Date(data.expiryDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Document Expiry Escalation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #e74c3c;">Action Required: Document Expiry Escalation</h1>
            <p>Hello Admin,</p>
            <p>This is an escalation notice regarding an expired document that has not been renewed.</p>
            <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Practitioner:</strong> ${data.practitionerName}</p>
              <p style="margin: 5px 0 0 0;"><strong>Email:</strong> ${data.practitionerEmail}</p>
              <p style="margin: 5px 0 0 0;"><strong>Document:</strong> ${data.documentName}</p>
              <p style="margin: 5px 0 0 0;"><strong>Document Type:</strong> ${documentTypeLabel}</p>
              <p style="margin: 5px 0 0 0;"><strong>Expiry Date:</strong> ${expiryDateFormatted}</p>
              <p style="margin: 5px 0 0 0;"><strong>Days Overdue:</strong> ${data.daysOverdue}</p>
            </div>
            <p>Please follow up with the practitioner to ensure compliance.</p>
            <p>Best regards,<br>The Therapport System</p>
          </div>
        </body>
      </html>
    `;

    // Send to admin email (you may want to make this configurable)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@therapport.co.uk';

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: adminEmail,
      subject: `Escalation: ${documentTypeLabel} Document Expired - ${data.practitionerName}`,
      html,
    });
  }
}

export const emailService = new EmailService();
