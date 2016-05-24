"use strict";

const Router = require('koa-router');
const mount = require('koa-mount');
const session = require('koa-generic-session');
const Grant = require('grant-koa');
const facebookMe = require(__dirname + '/../lib/social').facebook.me;
const googleMe = require(__dirname + '/../lib/social').google.me;
const constructUiSuccessRedirectUrl = require(__dirname + '/../lib/social').constructUiSuccessRedirectUrl;
const constructUiErrorRedirectUrl = require(__dirname + '/../lib/social').constructUiErrorRedirectUrl;
const User = require('mongoose').model('User');


module.exports = function (app, config) {
  const grant = new Grant(config.app.grant);

  app.keys = [config.app.secret];

  // TODO Make sure sessions a not long lived
  const appSession = session(app);

  app.use(mount('/auth', appSession));
  app.use(mount('/api/auth/login/social', appSession));
  app.use(mount('/auth', grant));

  const authRouter = new Router({ prefix: '/auth' });

  authRouter.get('/facebook/callback', function *() {
    let grantData, userData;

    if ( this.query && this.query['error[error]'] === 'access_denied' && this.query['error[error_code]'] === '200' && this.query['error[error_reason]'] === 'user_denied' ) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 200, 'user_denied'));
      return;
    }

    if ( !this.session.grant ) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 400, 'bad_request'));
      return;
    }

    grantData = this.session.grant;

    try {
      userData = yield facebookMe(grantData.response.access_token);
    } catch (err) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 404, 'could_not_load_profile_data'));
      return;
    }

    if ( !userData.email ) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 400, 'email_is_missing'));
      return;
    }

    try {
      let user = yield User.findBySocialId(grantData.provider, userData.id);

      yield user.updateSocialProviderAccessToken(grantData.provider, userData.id, grantData.response.access_token, grantData.response.raw.expires);

      this.response.redirect(constructUiSuccessRedirectUrl(config.app.uiUrl, grantData.state));
      return;
    } catch (err) {
      if ( err.message !== 'User not found' ) {
        console.log(err);
        this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 500, 'internal_server_error'));
        return;
      }
    }

    let user = new User({
      email: userData.email.toLowerCase(),
      name: {
        first: userData.first_name,
        last: userData.last_name
      },
      isActivated: true,
      social: [{
        provider: grantData.provider,
        id: userData.id,
        token: {
          value: grantData.response.access_token,
          expires: new Date( (new Date()).getTime() + (1000 * parseInt(grantData.response.raw.expires) ) ),
          created: new Date()
        }
      }]
    });

    try {
      user = yield user.save();
    } catch(err) {
      console.log(err);

      if ( err.code === 11000 ) {
        this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 409, 'email_already_used'));
        return;
      }

      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 500, 'internal_server_error'));
      return;
    }

    this.response.redirect(constructUiSuccessRedirectUrl(config.app.uiUrl, grantData.state));
  });

  authRouter.get('/google/callback', function *() {
    let grantData, userData;

    if ( this.query && this.query['error[error]'] === 'access_denied' ) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 200, 'user_denied'));
      return;
    }

    if ( !this.session.grant ) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 400, 'bad_request'));
      return;
    }

    grantData = this.session.grant;

    try {
      userData = yield googleMe(grantData.response.access_token);
    } catch (err) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 404, 'could_not_load_profile_data'));
      return;
    }

    if ( !( userData.emails && userData.emails.length > 0 && userData.emails[0].value ) ) {
      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 400, 'email_is_missing'));
      return;
    }

    try {
      let user = yield User.findBySocialId(grantData.provider, userData.id);

      yield user.updateSocialProviderAccessToken(grantData.provider, userData.id, grantData.response.access_token, grantData.response.raw.expires_in);

      this.response.redirect(constructUiSuccessRedirectUrl(config.app.uiUrl, grantData.state));
      return;
    } catch (err) {
      if ( err.message !== 'User not found' ) {
        console.log(err);
        this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 500, 'internal_server_error'));
        return;
      }
    }

    let user = new User({
      email: userData.emails[0].value.toLowerCase(),
      name: {
        first: userData.name.givenName,
        last: userData.name.familyName
      },
      isActivated: true,
      social: [{
        provider: grantData.provider,
        id: userData.id,
        token: {
          value: grantData.response.access_token,
          expires: new Date( (new Date()).getTime() + (1000 * parseInt(grantData.response.raw.expires_in) ) ),
          created: new Date()
        }
      }]
    });

    try {
      user = yield user.save();
    } catch(err) {
      console.log(err);

      if ( err.code === 11000 ) {
        this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 409, 'email_already_used'));
        return;
      }

      this.response.redirect(constructUiErrorRedirectUrl(config.app.uiUrl, 500, 'internal_server_error'));
      return;
    }

    this.response.redirect(constructUiSuccessRedirectUrl(config.app.uiUrl, grantData.state));
  });

  app.use(authRouter.routes());
  app.use(authRouter.allowedMethods());

  require(__dirname + '/api')(app, config);
};
