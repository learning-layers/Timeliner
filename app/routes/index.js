"use strict";

module.exports = function (app, config) {
  require(__dirname + '/api')(app);
  require(__dirname + '/auth')(app, config);
};
