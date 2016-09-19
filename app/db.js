"use strict";

const mongoose = require('mongoose');

module.exports = function(appConfig) {
  mongoose.Promise = require('bluebird');

  mongoose.connect(appConfig.app.db.uri, appConfig.app.db.options);

  mongoose.connection.on('connected', function () {
    console.log('Mongoose default connection open to ' + appConfig.app.db.uri);
  });

  mongoose.connection.on('error', function(err) {
    console.error('Mongoose default connection error: ', err);
  });

  process.on('SIGINT', function() {
  mongoose.connection.close(function () {
    console.log('Mongoose default connection disconnected through app termination');
    process.exit(0);
  });
});
};
