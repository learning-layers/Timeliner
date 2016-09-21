"use strict";

const nodemailer = require('nodemailer');
const _ = require('lodash');

module.exports = function(mailConfig) {
  const transporter = nodemailer.createTransport(mailConfig.smtp);
  const defaultMailOptions = {
    from: mailConfig.from,
    subject: mailConfig.subject
  };
  const sendConfirmation = transporter.templateSender({
    from: defaultMailOptions.from,
    subject: 'Registration confirmation',
    text: 'Dear {{ email }} address owner!\r\n\r\nPlease proceed to this URL to complete your registration process:\r\n{{ confirmation }}\r\n\r\nBest,\r\nTimeliner Team'
  });
  const sendPasswordReset = transporter.templateSender({
    from: defaultMailOptions.from,
    subject: 'Password reset',
    text: 'Dear {{ fullname }}!\r\n\r\nPlease proceed to this URL to reset your password:\r\n{{ reset }}\r\n\r\nBest,\r\nTimeliner Team'
  });

  return {
    /**
     * Generator that sends an email to the a one or multiple users.
     * Please check the official Nodemailer documentation for list of available
     * options: https://github.com/nodemailer/nodemailer#e-mail-message-fields
     * @param  {object} options Options that would be used when sending email
     * @return {promise}        Yield a promise
     */
    sendMail: function (options) {
      if ( !options.to ) {
        throw new Error('Recipient email is required!');
      }

      if ( !( options.text || options.html) ) {
        throw new Error('Either plaintext or html is required as a content!');
      }

      let mailOptions = _.defaults(options, defaultMailOptions);

      return transporter.sendMail(mailOptions);
    },
    sendConfirmation: function(to, email, confirmationUrl) {
      return sendConfirmation({
        to: to
      }, {
        email: email,
        confirmation: confirmationUrl
      });
    },
    sendPasswordReset: function(to, fullName, resetUrl) {
      return sendPasswordReset({
        to: to
      }, {
        fullname: fullName,
        reset : resetUrl
      });
    }
  };
};
