"use strict";

const mongoose = require('mongoose');

module.exports = function(appConfig) {
  // TODO Consider replacing this with Bluebird
  mongoose.Promise = global.Promise;

  mongoose.connect(appConfig.app.db.uri, appConfig.app.db.options);
  mongoose.connection.on('error', function(err) {
    console.error('Database error', err);
  });
};
