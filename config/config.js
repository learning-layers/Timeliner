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
    reCaptchaSecret: '',
    grant: {
      server: {
        protocol: 'http',
        host: 'localhost:3000',
        path: '/auth',
        callback: 'callback',
        transport: 'session',
        state: true
      },
      facebook: {
        key: '',
        secret: '',
        scope: ['email', 'public_profile', 'user_friends'],
        callback: '/auth/facebook/callback'
      },
      google: {
        key: '',
        secret: '',
        scope: ['profile', 'https://www.googleapis.com/auth/plus.login', 'email'],
        callback: '/auth/google/callback'
      }
    }
  }
};
