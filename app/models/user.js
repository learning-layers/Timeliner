"use strict";

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt-nodejs');
const moment = require('moment');

const Schema = mongoose.Schema;

const _ = require('lodash');

// Create a schema
let userSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: String,
    name: {
      first: String,
      middle: String,
      last: String
    },
    image: { type: String },
    isActivated: Boolean,
    isAdmin: Boolean,
    created: Date,
    updated: Date,
    confirmationKey: {
      key: String,
      created: Date
    },
    passwordResetKey: {
      key: String,
      created: Date
    },
    lastLogin: Date,
    social: [{
      provider: { type: String, required: true },
      id: { type: String, required: true },
      token: {
        value: { type: String, required: true },
        expires: { type: Date, required: true }
      },
      created: { type: Date, default: Date.now }
    }]
  },
  {
    toJSON : {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.isActivated;
        delete ret.updated;
        delete ret.__v;
        delete ret.lastLogin;
        delete ret.social;
      }
    }
  });

userSchema.pre('save', function(next) {
  const currentDate = new Date();

  this.updated = currentDate;

  // if created doesn't exist, add to that field
  if (!this.created){
    this.created = currentDate;
  }

  // only hash the password if it has been modified (or is new)
  if (this.isModified('password')) {
    const salt = bcrypt.genSaltSync();
    this.password = bcrypt.hashSync(this.password, salt);
  }

  next();
});

// checking if password is valid
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

userSchema.methods.updateLastLogin = function *() {
  this.lastLogin = new Date();
  yield this.save();
};

userSchema.methods.addAdmin = function *() {
  this.isAdmin = true;
  return yield this.save();
};

userSchema.methods.removeAdmin = function *() {
  this.isAdmin = false;
  return yield this.save();
};

userSchema.methods.updateSocialProviderAccessToken = function *(provider, id, token, expires) {
  let socialIndex = _.findIndex(this.social, function(single) {
    return single.provider === provider && single.id === id;
  });

  if ( socialIndex === -1 ) {
    throw new Error('Updated provider does not exist');
  }

  // TODO It might make sense to use some findAndUpdate methods with $set
  if ( this.social[socialIndex].token.value !== token ) {
    this.social[socialIndex].token.value = token;
    this.social[socialIndex].token.expires = new Date( (new Date()).getTime() + (1000 * parseInt(expires) ) );

    yield this.save();
  }
};

/**
 * Creates user account from provided User Schema object.
 * Makes sure that initial user becomes an administrator.
 * @param  {Object} user User Schema object
 * @return {Object}      Saved User Schema object
 */
userSchema.statics.createAccount = function *(user) {
  let count = yield this.getUsersCount({});

  if ( count === 0 ) {
    user.isAdmin = true;
  }

  return yield user.save();
};

userSchema.statics.matchUser = function *(email, password) {
  const user = yield this.findOne({ 'email': email.toLowerCase() }).exec();
  if (!user) {
    throw new Error('User not found');
  }
  if (user.isActivated !== true) {
    throw new Error('User not active');
  }

  if ( !user.password ) {
    throw new Error('Not a local user');
  }

  if (user.comparePassword(password)){
    return user;
  }

  throw new Error('Password does not match');
};

userSchema.statics.findByConfirmationKey = function *(confirmKey) {
  const user = yield this.findOne({ 'confirmationKey.key': confirmKey }).exec();
  if (!user) {
    throw new Error('User not found');
  }

  //TODO check key validity
  return user;
};

userSchema.statics.findBySocialId = function *(provider, id) {
  const user = yield this.findOne({ "social.provider": provider, "social.id": id}).exec();
  if (!user) {
    throw new Error('User not found');
  }

  // TODO Check user validity (isAcivated and not blocked)
  return user;
};

userSchema.statics.findBySocialToken = function *(provider, token) {
  const user = yield this.findOne({ "social.provider": provider, "social.token.value": token}).exec();
  if (!user) {
    throw new Error('User not found');
  }

  // TODO Check user validity (isAcivated and not blocked)
  return user;
};

userSchema.statics.findByEmail = function *(email) {
  const user = yield this.findOne({ 'email': email.toLowerCase() }).exec();

  if ( !user ) {
    throw new Error('User not found');
  }

  // TODO Check user validity (isActivated and not blocked)
  return user;
};

userSchema.statics.findByPasswordResetKey = function *(passwordResetKey) {
  const user = yield this.findOne({ 'passwordResetKey.key': passwordResetKey, 'passwordResetKey.created': { '$gte': moment().subtract(1, 'days').toDate() } }).exec();
  if (!user) {
    throw new Error('User not found');
  }

  if ( user.isActivated !== true ) {
    throw new Error('User not active');
  }

  return user;
};

userSchema.statics.getUsersCount = function *(query) {
  if ( !(query || typeof query === 'object') ) {
    query = {};
  }
  const count = yield this.count(query);

  return count;
};

userSchema.statics.getActiveUsersCount = function *() {
  return yield this.getUsersCount({ 'isActivated' : true });
};

userSchema.statics.getInactiveUsersCount = function *() {
  return yield this.getUsersCount({ 'isActivated': false });
};

userSchema.statics.isAdmin = function(user) {
  return user.isAdmin;
};


const User = mongoose.model('User', userSchema);

module.exports = User;
