"use strict";

const nodemailer = require('nodemailer');
const _ = require('lodash');

module.exports = function(mailConfig) {
  const transporter = nodemailer.createTransport('smtps://' + mailConfig.smtp.login+ ':' + mailConfig.smtp.password + '@' + mailConfig.smtp.hostname);
  const defaultMailOptions = {
    from: mailConfig.from,
    subject: mailConfig.subject
  };

  return {
    /**
     * Generator that sends an email to the a one or multiple users.
     * Please check the official Nodemailer documentation for list of available
     * options: https://github.com/nodemailer/nodemailer#e-mail-message-fields
     * @param  {object} options Options that would be used when sending email
     * @return {promise}        Yield a promise
     */
    sendMail: function *(options) {
      if ( !options.to ) {
        throw new Error('Recipient email is required!');
      }

      if ( !( options.text || options.html) ) {
        throw new Error('Either plaintext or html is required as a content!');
      }

      let mailOptions = _.defaults(options, defaultMailOptions);

      return yield transporter.sendMail(mailOptions);
    }
  };
};
