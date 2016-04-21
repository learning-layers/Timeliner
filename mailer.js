"use strict";

const nodemailer = require('nodemailer');

module.exports = function(mailConfig) {
  const transporter = nodemailer.createTransport('smtps://' + mailConfig.smtp.login+ ':' + mailConfig.smtp.password + '@' + mailConfig.smtp.hostname);

  return {
    /**
     * Generator that sends an email to the a one or multiple users.
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

      // TODO A better solution would be to merge the preconfigured minimal list
      // of options with provided ones
      let mailOptions = {
        from: options.from ? options.from : mailConfig.from,
        to: options.to,
        subject: options.subject ? options.subject : 'Automatic Email Message'
      };

      if ( options.text ) {
        mailOptions.text = options.text;
      }

      if ( options.html ) {
        mailOptions.html = options.html;
      }

      return yield transporter.sendMail(mailOptions);
    }
  };
};
