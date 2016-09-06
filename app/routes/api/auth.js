"use strict";

const Router = require('koa-router');
const User = require('mongoose').model('User');
const bodyParser = require('koa-body')();
const crypto = require('crypto');
const auth = require(__dirname + '/../../auth');
const reCaptcha = require(__dirname + '/../../reCaptcha')();

module.exports = function (apiRouter) {

  let authRouter = new Router({ prefix: '/auth' });

  authRouter.post('/register', bodyParser, function *(){
    try {
      yield reCaptcha.verify(this.request.body.captchaResponse, this.request.ip);

      let user = new User({
        email: this.request.body.email.toLowerCase(),
        confirmationKey: {
          key: generateConfirmationKey(),
          created: new Date()
        },
        isActivated: false
      });

      user = yield User.createAccount(user);

      this.apiRespond(201, {
        email: user.email,
      });

      // TODO this should be sent by email
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
        user: user,
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
          user: user,
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
        user: user,
        token: auth.generateAuthToken({ sub: user._id, social: true, provider: grantData.provider })
      });
      this.session = null;
    } catch (err) {
      console.error(err); // TODO Remove me
      this.throw(401, 'authentication_failed');
    }
  });

  authRouter.get('/me', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.apiRespond(this.user);
  });

  apiRouter.use('', authRouter.routes(), authRouter.allowedMethods());
};

function generateConfirmationKey() {
  return crypto.randomBytes(20).toString('hex');
}
