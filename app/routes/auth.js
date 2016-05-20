"use strict";

const Router = require('koa-router');
const mount = require('koa-mount');
const session = require('koa-generic-session');
const Grant = require('grant-koa');
const Purest = require('purest');
const facebook = new Purest({ provider: 'facebook' });
const google = new Purest({ provider: 'google' });
const User = require('mongoose').model('User');


module.exports = function (app, config) {
  const grant = new Grant(config.app.grant);

  // XXX All these functions has to go into a standalone module
  // and become properly written to be used with generators
  function facebookMe(token) {
    return function(done) {
      facebook.query().get('me?fields=id,email,name,first_name,last_name,picture').auth(token).request(function(err, res, body) {
        done(null, body);
      });
    }
  }

  function facebookFrields(token) {
    return function(done) {
      facebook.query().get('/me/friends?fields=id,email,name,first_name,last_name,picture').auth(token).request(function(err, res, body) {
        done(null, body);
      });
    }
  }

  function googleMe(token) {
    return function(done) {
      google.query('plus').get('people/me').auth(token).request(function(err, res, body) {
        done(null, body);
      });
    }
  }

  function googleContacts(token) {
    return function(done) {
      // POSSIBLE VALUES: connected OR visible
      google.query('plus').get('people/me/people/visible').auth(token).request(function(err, res, body) {
        done(null, body);
      });
    }
  }

  app.keys = [config.app.secret];

  app.use(mount('/auth', session(app)));
  app.use(mount('/auth', grant));

  const authRouter = new Router({ prefix: '/auth' });

  authRouter.get('/facebook/callback', function *() {
    if ( !this.session.grant ) {
      this.throw(400);
      return;
    }
    // TODO Add try/catch and handle errors
    let grantData = this.session.grant;
    let userData = yield facebookMe(grantData.response.access_token);

    try {
      let user = yield User.findBySocialId(grantData.provider, userData.id);

      // TODO Update token and expiration and move on
      this.status = 200;
      this.body = {
        data: user
      };
      return;
    } catch (err) {
      console.log(err);
      // TODO See if this has to be handled
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

    this.status = 200;
    this.body = {
      data: user
    };
  });

  authRouter.get('/google/callback', function *() {
    if ( !this.session.grant ) {
      this.throw(400);
      return;
    }
    // TODO Add try/catch and handle errors
    let grantData = this.session.grant;
    console.log(grantData);
    let userData = yield googleMe(grantData.response.access_token);

    try {
      let user = yield User.findBySocialId(grantData.provider, userData.id);

      // TODO Update token and expiration and move on
      this.status = 200;
      this.body = {
        data: user
      };
      return;
    } catch (err) {
      console.log(err);
      // TODO See if this has to be handled
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

    this.status = 200;
    this.body = {
      data: user
    };
  });

  app.use(authRouter.routes());
  app.use(authRouter.allowedMethods());

  require(__dirname + '/api')(app, config);
};
