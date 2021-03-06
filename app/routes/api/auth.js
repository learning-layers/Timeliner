"use strict";

const Router = require('koa-router');
const User = require('mongoose').model('User');
const bodyParser = require('koa-body')();
const crypto = require('crypto');
const auth = require(__dirname + '/../../auth');
const reCaptcha = require(__dirname + '/../../reCaptcha')();

module.exports = function (apiRouter, config) {

  const mailer = require(__dirname + '/../../mailer')(config.app.mail);

  let authRouter = new Router({ prefix: '/auth' });

  authRouter.post('/register', bodyParser, function *(){
    try {
      yield reCaptcha.verify(this.request.body.captchaResponse, this.request.ip);

      let user = new User({
        email: this.request.body.email.toLowerCase(),
        confirmationKey: {
          key: generateRandomKey(),
          created: new Date()
        },
        isActivated: false
      });

      user = yield User.createAccount(user);

      try {
        yield mailer.sendConfirmation(user.email, user.email, config.app.uiUrl + '/#/confirm/' + user.confirmationKey.key);
      } catch (err) {
        // Remove an account as the activation email could not be sent
        yield user.remove();

        console.error('Could not send confirmation email', err);
        this.throw(500, 'email_not_sent');
        return;
      }

      this.apiRespond(201, {
        email: user.email,
      });

      // TODO This should be removed
      console.log('User registered, confirm link: confirm/' + user.confirmationKey.key);
    } catch (err) {
      if( err.message === 'captcha_verification_invalid' ) {
        this.throw(401, 'captcha_verification_invalid');
      } else if( err.code === 11000 ) {  // Mongo error code 11000 - duplicate key
        this.throw(409, 'email_already_registered');
      } else {
        console.error(err);
        throw err;
      }
    }
  });

  authRouter.get('/confirm/:key', function *(){
    try {
      let user = yield User.findByConfirmationKey(this.params.key);
      this.apiRespond({
        email: user.email
      });
    } catch (error) {
      this.throw(404, 'expired_or_missing_key');
      throw error;
    }
  });

  authRouter.post('/confirm', bodyParser, function *(){
    try {
      let user = yield User.findByConfirmationKey(this.request.body.confirmationKey);
      user.password = this.request.body.password;
      user.name.first = this.request.body.name.first;
      user.name.last = this.request.body.name.last;

      user.confirmationKey = undefined;
      user.isActivated = true;

      user = yield user.save();
      yield user.updateLastLogin();
      this.apiRespond({
        user: user.getObjectWithPrivateData(),
        token: auth.generateAuthToken({ sub: user._id })
      });
    } catch (err) {
      console.error(err);
      this.throw('user_confirmation_failed');
    }
  });

  authRouter.post('/login', bodyParser, function *() {
    if ( !( this.request.body.email && this.request.body.password ) ) {
      this.throw(401, 'credentials_missing');
    } else {
      try {
        let user = yield User.matchUser(this.request.body.email, this.request.body.password);
        yield user.updateLastLogin();
        this.apiRespond({
          user: user.getObjectWithPrivateData(),
          token: auth.generateAuthToken({ sub: user._id })
        });
      } catch (err) {
        // TODO Better handling might be needed
        console.error(err);
        this.throw(401,'authentication_failed');
      }
    }
  });

  authRouter.post('/login/social', bodyParser, function *() {
    let grantData;

    if ( !this.session.grant ) {
      this.throw(400, 'bad_request');
    }

    grantData = this.session.grant;

    if ( !( this.request.body.state ) ) {
      this.throw(400, 'state_missing');
    }

    if ( this.request.body.state !== grantData.state ) {
      this.throw(400, 'wrong_state');
    }

    try {
      let user = yield User.findBySocialToken(grantData.provider, grantData.response.access_token);
      yield user.updateLastLogin();
      this.apiRespond({
        user: user.getObjectWithPrivateData(),
        token: auth.generateAuthToken({ sub: user._id, social: true, provider: grantData.provider })
      });
      this.session = null;
    } catch (err) {
      console.error(err);
      this.throw(401, 'authentication_failed');
    }
  });

  authRouter.post('/reset/request', bodyParser, function *() {
    let user;

    try {
      yield reCaptcha.verify(this.request.body.captchaResponse, this.request.ip);
    } catch (err) {
      this.throw(401, 'captcha_verification_invalid');
      return;
    }

    if ( !( this.request.body.email && this.request.body.email.trim() ) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    try {
      user = yield User.findByEmail(this.request.body.email);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !user ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !user.password ) {
      this.throw(400, 'password_reset_forbidden');
      return;
    }

    user.passwordResetKey = {
      key: generateRandomKey(),
      created: new Date()
    };

    try {
      user = yield user.save();

      try {
        yield mailer.sendPasswordReset(user.email, user.email, config.app.uiUrl + '/#/reset/' + user.passwordResetKey.key);
      } catch (err) {
        console.error('Could not send password reset email', err);
        this.throw(500, 'email_not_sent');
        return;
      }

      this.apiRespond(200, {
        email: user.email
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  authRouter.get('/reset/:key', function *(){
    try {
      yield User.findByPasswordResetKey(this.params.key);
      this.apiRespond({
        key: this.params.key
      });
    } catch (error) {
      console.error(error);
      this.throw(404, 'expired_or_missing_key');
      throw error;
    }
  });

  authRouter.post('/reset', bodyParser, function *() {
    let user;

    if ( !( this.request.body.email && this.request.body.email.trim() && this.request.body.passwordResetKey ) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    try {
      user = yield User.findByPasswordResetKey(this.request.body.passwordResetKey);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !user ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( user.email !== this.request.body.email.toLowerCase() ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !user.password ) {
      this.throw(400, 'password_reset_forbidden');
      return;
    }

    user.password = this.request.body.password;
    user.passwordResetKey = undefined;

    try {
      user = yield user.save();
      yield user.updateLastLogin();
      this.apiRespond({
        key: this.request.body.passwordResetKey
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'password_reset_failed');
    }
  });

  authRouter.get('/me', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.apiRespond(this.user.getObjectWithPrivateData());
  });

  apiRouter.use('', authRouter.routes(), authRouter.allowedMethods());
};

function generateRandomKey() {
  return crypto.randomBytes(20).toString('hex');
}
