"use strict";

var app    = require('koa')();
var router = require('koa-router');

var config = require(__dirname + '/config/config');
var appEnv = process.env.NODE_ENV || config.app.env;

// Instanciate the MongoDB connection (mongoose)
require(__dirname + '/app/db')(config);

//Middleware: request logger
function *reqLogger(next){
  console.log('%s - %s %s',new Date().toISOString(), this.req.method, this.req.url);
  yield next;
}

if ( appEnv !== 'test' ) {
  app.use(reqLogger);
}

// Routes
require(__dirname + '/app/routes')(app);

// Start app
if (!module.parent) {
  app.listen(process.env.PORT || config.app.port);
  console.log('Server started on port: ' + config.app.port);
  console.log('Environment: ' + appEnv );
  console.log('------ logging ------');
}

module.exports = app;
