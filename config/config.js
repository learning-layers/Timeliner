"use strict";
module.exports = {
  app: {
    port: 3000,
    env: 'development',
    secret: 'eX0u5tsuUydDDtUSHbnef1EE',
    db: {
      uri: 'mongodb://localhost/timeliner',
      options: {}
    },
    mail: {
      from: '"Timeliner" <no-reply@timeliner.me>',
      subject: 'Timeliner automatic email message',
      smtp: {
        hostname: '',
        login: '',
        password: ''
      }
    },
    jwt: {
      algorithm: 'HS512',
      issuer: 'timeliner.app'
    },
    reCaptchaSecret: ''
  }
};
