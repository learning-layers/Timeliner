"use strict";

var app    = require('koa')();
var router = require('koa-router');

var config = require('./config/config');

//Middleware: request logger
function *reqlogger(next){
  console.log('%s - %s %s',new Date().toISOString(), this.req.method, this.req.url);
  yield next;
}
app.use(reqlogger);

// Routes
require('./app/routes')(app);

// Start app
if (!module.parent) {
  app.listen(config.app.port);
  console.log('Server started on port: ' + config.app.port);
}
console.log('Environment: ' + config.app.env);
console.log('------ logging ------');