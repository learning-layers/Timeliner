"use strict";

var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

var Schema = mongoose.Schema;

// create a schema
var userSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: String,
    name: {
      first: String,
      middle: String,
      last: String
    },
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
      }
    }
  });

userSchema.pre('save', function(done) {
  var currentDate = new Date();

  this.updated = currentDate;

  // if created doesn't exist, add to that field
  if (!this.created){
    this.created = currentDate;
  }

  // only hash the password if it has been modified (or is new)
  if (this.isModified('password')) {
    var salt = bcrypt.genSaltSync();
    this.password = bcrypt.hashSync(this.password, salt);
  }

  done();
});

// checking if password is valid
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

userSchema.statics.matchUser = function *(email, password) {
  var user = yield this.findOne({ 'email': email.toLowerCase() }).exec();
  if (!user) throw new Error('User not found');

  if (user.comparePassword(password)){
    return user;
  }

  throw new Error('Password does not match');
};

userSchema.statics.findByConfirmationKey = function *(confirmKey) {
  var user = yield this.findOne({ 'confirmationKey.key': confirmKey }).exec();
  if (!user) throw new Error('User not found');


  //TODO check key validity
  return user;
};



var User = mongoose.model('User', userSchema);

module.exports = User;