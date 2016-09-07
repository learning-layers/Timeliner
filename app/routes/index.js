"use strict";

module.exports = function (app, config) {
  require(__dirname + '/auth')(app, config);
  require(__dirname + '/api')(app, config);
  require(__dirname + '/download')(app, config);
};
