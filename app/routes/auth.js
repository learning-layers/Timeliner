"use strict";

const Router = require('koa-router');
const mount = require('koa-mount');
const session = require('koa-generic-session');
const Grant = require('grant-koa');
const facebookMe = require(__dirname + '/../lib/social').facebook.me;
const googleMe = require(__dirname + '/../lib/social').google.me;
const constructUiRedirectUrl = require(__dirname + '/../lib/social').constructUiRedirectUrl;
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

    if ( !this.session.grant ) {
      this.throw(400);
      return;
    }

    grantData = this.session.grant;

    try {
      userData = yield facebookMe(grantData.response.access_token);
    } catch (err) {
      // TODO Different error code needed
      this.throw(500);
      return;
    }

    try {
      let user = yield User.findBySocialId(grantData.provider, userData.id);

      yield user.updateSocialProviderAccessToken(grantData.provider, userData.id, grantData.response.access_token, grantData.response.raw.expires);

      this.response.redirect(constructUiRedirectUrl(config.app.uiUrl, grantData.state));
      return;
    } catch (err) {
      if ( err.message !== 'User not found' ) {
        console.log(err);
        this.throw(500);
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
        this.throw(409);
        return;
      }

      this.throw(500);
      return;
    }

    this.response.redirect(constructUiRedirectUrl(config.app.uiUrl, grantData.state));
  });

  authRouter.get('/google/callback', function *() {
    let grantData, userData;

    if ( !this.session.grant ) {
      this.throw(400);
      return;
    }

    grantData = this.session.grant;

    console.log(grantData);

    try {
      userData = yield googleMe(grantData.response.access_token);
    } catch (err) {
      // TODO Different error code needed
      this.throw(500);
      return;
    }

    try {
      let user = yield User.findBySocialId(grantData.provider, userData.id);

      yield user.updateSocialProviderAccessToken(grantData.provider, userData.id, grantData.response.access_token, grantData.response.raw.expires_in);

      this.response.redirect(constructUiRedirectUrl(config.app.uiUrl, grantData.state));
      return;
    } catch (err) {
      if ( err.message !== 'User not found' ) {
        console.log(err);
        this.throw(500);
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
        this.throw(409);
        return;
      }

      this.throw(500);
      return;
    }

    this.response.redirect(constructUiRedirectUrl(config.app.uiUrl, grantData.state));
  });

  app.use(authRouter.routes());
  app.use(authRouter.allowedMethods());

  require(__dirname + '/api')(app, config);
};
