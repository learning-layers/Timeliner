"use strict";

const Purest = require('purest');
const facebook = new Purest({ provider: 'facebook' });
const google = new Purest({ provider: 'google' });
const linkedin = new Purest({ provider: 'linkedin' });

// XXX All these functions has to go into a standalone module
// and become properly written to be used with generators
function facebookMe(token) {
  return function(done) {
    facebook.query().get('me?fields=id,email,name,first_name,last_name,picture').auth(token).request(function(err, res, body) {
      if ( err ) {
        console.error('Request error', err);
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
        console.error('Request error', err);
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

function linkedinMe(token) {
  return function(done) {
    // Possible fields
    // id,email-address,first-name,last-name,formatted-name,headline,picture-url,auth-token,distance,num-connections
    linkedin
      .query()
      .select('people/~:(id,email-address,first-name,last-name,picture-url)').auth(token).request(function(err, res, body) {
      if ( err ) {
        console.error('Request error', err);
        done(new Error('Request error'), body);
      } else {
        done(null, body);
      }
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
  linkedin: {
    me: linkedinMe
  },
  constructUiSuccessRedirectUrl: function(baseUrl, state) {
    return baseUrl + '/#/login/' + state;
  },
  constructUiErrorRedirectUrl: function(baseUrl, code, message) {
    return baseUrl + '/#/login?code=' + encodeURIComponent(code) + '&message=' + encodeURIComponent(message);
  }
};
