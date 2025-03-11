const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,       // e.g., smtp.gmail.com
  port: process.env.EMAIL_PORT,       // e.g., 587 for TLS or 465 for SSL
  secure: process.env.EMAIL_PORT == 465, // true if port is 465, otherwise false
  auth: {
    user: process.env.EMAIL_USER,     // your email address
    pass: process.env.EMAIL_PASS      // your email password or app password
  }
});

const sendEmail = async (to, subject, text) => {
  try {
    let info = await transporter.sendMail({
      from: process.env.EMAIL_USER, // sender address
      to,
      subject,
      text
    });
    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = sendEmail;
