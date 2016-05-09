"use strict";

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt-nodejs');

const Schema = mongoose.Schema;

// Create a schema
let userSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: String,
    name: {
      first: String,
      middle: String,
      last: String
    },
    isActivated: Boolean,
    created: Date,
    updated: Date,
    confirmationKey: {
      key: String,
      created: Date
    }
  },
  {
    toJSON : {
      transform: function (doc, ret, options) {
        delete ret.password;
        delete ret.isActivated;
        delete ret.updated;
        delete ret.__v;
      }
    }
  });

userSchema.pre('save', function(done) {
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

  done();
});

// checking if password is valid
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

userSchema.statics.matchUser = function *(email, password) {
  const user = yield this.findOne({ 'email': email.toLowerCase() }).exec();
  if (!user) {
    throw new Error('User not found');
  }
  if (user.isActivated !== true) {
    throw new Error('User not active');
  }

  if (user.comparePassword(password)){
    return user;
  }

  throw new Error('Password does not match');
};

userSchema.statics.findByConfirmationKey = function *(confirmKey) {
  const user = yield this.findOne({ 'confirmationKey.key': confirmKey }).exec();
  if (!user) throw new Error('User not found');


  //TODO check key validity
  return user;
};

userSchema.statics.getUsersCount = function *(query) {
  if ( !(query || typeof query === 'object') ) {
    query = {};
  }
  const count = yield this.count(query);

  if (!count) {
    throw new Error('No count fetched');
  }

  return count;
};

userSchema.statics.getActiveUsersCount = function *() {
  return yield this.getUsersCount({ 'isActivated' : true });
};

userSchema.statics.getInactiveUsersCount = function *() {
  return yield this.getUsersCount({ 'isActivated': false });
};



const User = mongoose.model('User', userSchema);

module.exports = User;
