"use strict";

// XXX This should be used as a reference to deal with emitting events to certain rooms or sockets
// http://stackoverflow.com/a/10099325/2704169
// TODO It makes sense to define helper methods that would remove the need for repetitive code (emitting to the same room and so on)

const auth = require(__dirname + '/auth');
const IO = require('koa-socket');
const io = new IO();
const co = require('co');
const Participant = require('mongoose').model('Participant');
const Annotation = require('mongoose').model('Annotation');
const Milestone = require('mongoose').model('Milestone');
const Task = require('mongoose').model('Task');

module.exports = function (app) {
  function getRawSocket(ctx) {
    if ( ctx.socket.hasOwnProperty('socket') ) {
      return ctx.socket.socket;
    }

    return ctx.socket;
  }

  function isAuthenticated(ctx) {
    const socket = getRawSocket(ctx);
    if ( socket.hasOwnProperty('decodedToken') ) {
      return true;
    }

    return false;
  }

  function getDecodedToken(ctx) {
    const socket = getRawSocket(ctx);

    return socket.decodedToken;
  }

  function setDecodedToken(ctx, decodedToken) {
    const socket = getRawSocket(ctx);

    socket.decodedToken = decodedToken;
  }

  function getAuthenticatedUserId(ctx) {
    const decodedToken = getDecodedToken(ctx);

    return decodedToken.sub;
  }
  io.attach(app);

  // Only use WebSocket as a transport
  app._io.set( 'transports', ['websocket'] );

  io.on('authenticate', ( ctx, data ) => {
    const socket = getRawSocket(ctx);
    try {
      // TODO Consider using different kind of token
      // Another possibility would be to extend "audience" within the original
      // token with addition of "socket" an not just "api"
      let decoded = auth.verifyAuthToken(data.token);

      setDecodedToken(ctx, decoded);
      socket.emit('authenticate', {
        success: true
      });
    } catch (err) {
      console.error('Socket token verification error', err);
      socket.emit('authenticate', {
        success: false
      });
    }
  });

  io.on( 'join', ( ctx, data ) => {
    const socket = getRawSocket(ctx);

    if ( isAuthenticated(ctx) ) {
      let userId = getAuthenticatedUserId(ctx);
      let promise = Participant.getProjectActiveParticipant(data.id, userId);

      promise.then(function(participant) {
        if ( participant ) {
          socket.join(data.id);
          socket.emit('join', {
            success: true
          });
          app._io.in(data.id).emit('join', {
            user: userId
          });
        } else {
          socket.emit('join', {
            success: false
          });
        }
      }).catch(function(err) {
        console.error('Socket JOIN error', err);
        socket.emit('join', {
          success: false
        });
      });
    } else {
      socket.emit('join', {
        success: false
      });
    }
  });

  io.on( 'leave', ( ctx, data ) => {
    const socket = getRawSocket(ctx);

    if ( isAuthenticated(ctx) ) {
      let userId = getAuthenticatedUserId(ctx);
      let promise = Participant.getProjectActiveParticipant(data.id, userId);

      promise.then(function(participant) {
        if ( participant ) {
          socket.leave(data.id);
          socket.emit('leave', {
            success: true
          });
          app._io.in(data.id).emit('leave', {
            user: userId
          });
        } else {
          socket.emit('leave', {
            success: false
          });
        }
      }).catch(function(err) {
        console.error('Socket LEAVE error', err);
      });
    } else {
      socket.emit('leave', {
        success: false
      });
    }
  });

  // XXX This needs to be changed so that the bulk of the code would reside within
  // the model itself
  io.on( 'move:annotation', ( ctx, data ) => {
    if ( isAuthenticated(ctx) ) {
      // XXX need to add checks and error handlers
      // If parameters are passed, user belongs to the project and so on
      co(function* () {
        let userId = getAuthenticatedUserId(ctx);
        let annotation =  yield Annotation.findOne({ _id: data._id }).exec();
        let participant = Participant.getProjectActiveParticipant(annotation.project, userId);

        if ( participant ) {
          annotation.start = new Date(data.start);
          annotation = yield annotation.save();
        } else {
          // TODO A better handling of everything is needed
          throw new Error('Not an active participant.');
        }

        // TODO This needs way better error handling
        return annotation;
      }).then(function(annotation) {
        app._io.in(annotation.project).emit('move:annotation', {
          _id: annotation._id,
          start: annotation.start
        });
      }, function(err) {
        // TODO Need to signal to the socket that movement failed
        console.error(err);
      });
    }
  });

  // XXX This needs to be changed so that the bulk of the code would reside within
  // the model itself
  io.on( 'move:milestone', ( ctx, data ) => {
    if ( isAuthenticated(ctx) ) {
      // XXX need to add checks and error handlers
      // If parameters are passed, user belongs to the project and so on
      co(function* () {
        let userId = getAuthenticatedUserId(ctx);
        let milestone =  yield Milestone.findOne({ _id: data._id }).exec();
        let participant = yield Participant.getProjectActiveParticipant(milestone.project, userId);

        if ( participant ) {
          milestone.start = new Date(data.start);
          milestone = yield milestone.save();
        } else {
          // TODO A better handling of everything is needed
          throw new Error('Not an active participant');
        }

        // TODO This needs way better error handling
        return milestone;
      }).then(function(milestone) {
        app._io.in(milestone.project).emit('move:milestone', {
          _id: milestone._id,
          start: milestone.start
        });
      }, function(err) {
        // TODO Need to signal to the socket that movement failed
        console.error(err);
      });
    }
  });

  // XXX This needs to be changed so that the bulk of the code would reside within
  // the model itself
  io.on( 'move:task', ( ctx, data ) => {
    if ( isAuthenticated(ctx) ) {
      // XXX need to add checks and error handlers
      // If parameters are passed, user belongs to the project and so on
      co(function* () {
        let userId = getAuthenticatedUserId(ctx);
        let task =  yield Task.findOne({ _id: data._id }).exec();
        let participant = yield Participant.getProjectActiveParticipant(task.project, userId);

        if ( participant ) {
          task.start = new Date(data.start);
          task.end = new Date(data.end);
          task = yield task.save();
        } else {
          // TODO A better handling of everything is needed
          throw new Error('Not an active participant');
        }

        // TODO This needs way better error handling
        return task;
      }).then(function(task) {
        app._io.in(task.project).emit('move:task', {
          _id: task._id,
          start: task.start,
          end: task.end
        });
      }, function(err) {
        // TODO Need to signal to the socket that movement failed
        console.error(err);
      });
    }
  });

  io.on( 'connection', ( ctx, data ) => {
    console.log( 'CONNECTION', data );
    // XXX This approach has to be checked
    // will not close unauthenticated sockets for the time being
    /*setTimeout(function() {
      if ( !ctx.socket.decodedToken ) {
        ctx.socket.emit('authenticate', {
          success: false,
          error: 'Not auhenticated, closing connection'
        });
        ctx.socket.disconnect();
      }
    }, 5000);*/
    // This one fires the DISCONNECT without any errors
    //ctx.socket.disconnect('Not authenticated!');
  });

  // XXX This is an example of how certain events could be trnsmitted from
  // route handling middleware to the socket.io or any other listener
  // This could be used to notify about create/update/delete or any other action
  // along with some details.
  // This could even be used for storing activity stream events within a separate process
  app.on('create:annotation', function(annotation) {
    app._io.in(annotation.project).emit('create:annotation', annotation);
  });

  app.on('update:annotation', function(annotation) {
    app._io.in(annotation.project).emit('update:annotation', annotation);
  });

  app.on('delete:annotation', function(annotation) {
    app._io.in(annotation.project).emit('delete:annotation', annotation);
  });

  app.on('create:milestone', function(milestone) {
    app._io.in(milestone.project).emit('create:milestone', milestone);
  });

  app.on('update:milestone', function(milestone) {
    app._io.in(milestone.project).emit('update:milestone', milestone);
  });

  app.on('delete:milestone', function(milestone) {
    app._io.in(milestone.project).emit('delete:milestone', milestone);
  });

  app.on('create:task', function(task) {
    app._io.in(task.project).emit('create:task', task);
  });

  app.on('update:task', function(task) {
    app._io.in(task.project).emit('update:task', task);
  });

  app.on('delete:task', function(task) {
    app._io.in(task.project).emit('delete:task', task);
  });

  app.on('create:resource', function(resource) {
    app._io.in(resource.project).emit('create:resource', resource);
  });

  app.on('update:resource', function(resource) {
    app._io.in(resource.project).emit('update:resource', resource);
  });

  app.on('delete:resource', function(resource) {
    app._io.in(resource.project).emit('delete:resource', resource);
  });

  app.on('create:outcome', function(outcome) {
    app._io.in(outcome.project).emit('create:outcome', outcome);
  });

  app.on('update:outcome', function(outcome) {
    app._io.in(outcome.project).emit('update:outcome', outcome);
  });

  app.on('delete:outcome', function(outcome) {
    app._io.in(outcome.project).emit('delete:outcome', outcome);
  });
};
