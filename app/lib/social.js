"use strict";

const Purest = require('purest');
const facebook = new Purest({ provider: 'facebook' });
const google = new Purest({ provider: 'google' });

// XXX All these functions has to go into a standalone module
// and become properly written to be used with generators
function facebookMe(token) {
  return function(done) {
    facebook.query().get('me?fields=id,email,name,first_name,last_name,picture').auth(token).request(function(err, res, body) {
      if ( err ) {
        console.log('Request error', err);
        done(new Error('Request error'), body);
      } else {
        done(null, body);
      }
    });
  }
}

function facebookFrields(token) {
  return function(done) {
    facebook.query().get('/me/friends?fields=id,email,name,first_name,last_name,picture').auth(token).request(function(err, res, body) {
      // TODO Handle errors
      done(null, body);
    });
  }
}

function googleMe(token) {
  return function(done) {
    google.query('plus').get('people/me').auth(token).request(function(err, res, body) {
      if ( err ) {
        console.log('Request error', err);
        done(new Error('Request error'), body);
      } else {
        done(null, body);
      }
    });
  }
}

function googleContacts(token) {
  return function(done) {
    // TODO Handle errors
    // POSSIBLE VALUES: connected OR visible
    google.query('plus').get('people/me/people/visible').auth(token).request(function(err, res, body) {
      done(null, body);
    });
  }
}

module.exports = {
  facebook: {
    me: facebookMe,
    friends: facebookFrields
  },
  google: {
    me: googleMe,
    contects: googleContacts
  },
  constructUiRedirectUrl: function(baseUrl, state) {
    return baseUrl + '/#/auth/' + state;
  }
};
