'use strict';

const config = require(__dirname + '/../config/config');
const request = require('request-promise');

module.exports = function() {

  const verificationApiURL = 'https://www.google.com/recaptcha/api/siteverify';

  return {
    /**
     * Generator that verifies solved Captcha with Google
     * @param  {string} response The value of 'g-recaptcha-response'
     * @param  {string} remoteip Client IP address
     * @return {promise}        Yield a promise
     */
    verify: function *(response, remoteip) {
      if ( !response ) {
        throw new Error('captcha_response_missing');
      }
      if ( !remoteip ) {
        throw new Error('captcha_remoteip_missing');
      }

      let postData = {
        secret: config.app.reCaptchaSecret,
        response: response,
        remoteip: remoteip
      };

      return yield request.post({url: verificationApiURL, form: postData})
        .catch(function () {
          throw new Error('captcha_server_error');
        })
        .then(function (body) {
          body = JSON.parse(body);
          if (body.success){
            return true;
          } else if (body.success === false){
            throw new Error('captcha_verification_invalid');
          }
          throw new Error('captcha_verification_error');
        });
    }
  };
};
