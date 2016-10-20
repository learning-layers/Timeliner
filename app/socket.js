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

  function removeDecodedToken(ctx) {
    const socket = getRawSocket(ctx);

    socket.decodedToken = null;
  }

  function getAuthenticatedUserId(ctx) {
    const decodedToken = getDecodedToken(ctx);

    return decodedToken.sub;
  }

  function extractModelFromData(data) {
    return data.data;
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

  io.on('logout', ( ctx ) => {
    const socket = getRawSocket(ctx);
    if ( isAuthenticated(ctx) ) {
      removeDecodedToken(ctx);
    }

    socket.emit('logout', {
      success: true
    });
  });

  io.on( 'join', ( ctx, data ) => {
    const socket = getRawSocket(ctx);

    if ( isAuthenticated(ctx) ) {
      let userId = getAuthenticatedUserId(ctx);
      let promise = Participant.getProjectParticipant(data.id, userId);

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
      let promise = Participant.getProjectParticipant(data.id, userId);

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
      let userId = getAuthenticatedUserId(ctx);
      // XXX need to add checks and error handlers
      // If parameters are passed, user belongs to the project and so on
      co(function* () {
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
        app.emit('move:annotation', {
          data: annotation,
          actor: userId
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
      let userId = getAuthenticatedUserId(ctx);
      // XXX need to add checks and error handlers
      // If parameters are passed, user belongs to the project and so on
      co(function* () {
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
        app.emit('move:milestone', {
          data: milestone,
          actor: userId
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
      let userId = getAuthenticatedUserId(ctx);
      // XXX need to add checks and error handlers
      // If parameters are passed, user belongs to the project and so on
      co(function* () {
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
        app.emit('move:task', {
          data: task,
          actor: userId
        });
      }, function(err) {
        // TODO Need to signal to the socket that movement failed
        console.error(err);
      });
    }
  });

  io.on( 'connection', ( ctx, data ) => {
    console.log( 'Socket connected with data: ', data );
    /*setTimeout(function() {
      if ( !isAuthenticated(ctx) ) {
        ctx.socket.emit('authenticate', {
          success: false,
          errors: [
            'No authentication found, closing connection.'
          ]
        });
        ctx.socket.disconnect();
      }
    }, 5000);*/
  });

  app.on('create:project', function(data) {
    const project = extractModelFromData(data);
    app._io.in(project._id).emit('create:project', project);
  });

  app.on('update:project', function(data) {
    const project = extractModelFromData(data);
    app._io.in(project._id).emit('update:project', project);
  });

  app.on('delete:project', function(data) {
    const project = extractModelFromData(data);
    app._io.in(project._id).emit('delete:project', project);
  });

  app.on('create:annotation', function(data) {
    const annotation = extractModelFromData(data);
    app._io.in(annotation.project).emit('create:annotation', annotation);
  });

  app.on('update:annotation', function(data) {
    const annotation = extractModelFromData(data);
    app._io.in(annotation.project).emit('update:annotation', annotation);
  });

  app.on('delete:annotation', function(data) {
    const annotation = extractModelFromData(data);
    app._io.in(annotation.project).emit('delete:annotation', annotation);
  });

  app.on('create:milestone', function(data) {
    const milestone = extractModelFromData(data);
    app._io.in(milestone.project).emit('create:milestone', milestone);
  });

  app.on('update:milestone', function(data) {
    const milestone = extractModelFromData(data);
    app._io.in(milestone.project).emit('update:milestone', milestone);
  });

  app.on('delete:milestone', function(data) {
    const milestone = extractModelFromData(data);
    app._io.in(milestone.project).emit('delete:milestone', milestone);
  });

  app.on('create:task', function(data) {
    const task = extractModelFromData(data);
    app._io.in(task.project).emit('create:task', task);
  });

  app.on('update:task', function(data) {
    const task = extractModelFromData(data);
    app._io.in(task.project).emit('update:task', task);
  });

  app.on('delete:task', function(data) {
    const task = extractModelFromData(data);
    app._io.in(task.project).emit('delete:task', task);
  });

  app.on('create:resource', function(data) {
    const resource = extractModelFromData(data);
    app._io.in(resource.project).emit('create:resource', resource);
  });

  app.on('update:resource', function(data) {
    const resource = extractModelFromData(data);
    app._io.in(resource.project).emit('update:resource', resource);
  });

  app.on('delete:resource', function(data) {
    const resource = extractModelFromData(data);
    app._io.in(resource.project).emit('delete:resource', resource);
  });

  app.on('create:outcome', function(data) {
    const outcome = extractModelFromData(data);
    app._io.in(outcome.project).emit('create:outcome', outcome);
  });

  app.on('update:outcome', function(data) {
    const outcome = extractModelFromData(data);
    app._io.in(outcome.project).emit('update:outcome', outcome);
  });

  app.on('delete:outcome', function(data) {
    const outcome = extractModelFromData(data);
    app._io.in(outcome.project).emit('delete:outcome', outcome);
  });

  app.on('create:activity', function(data) {
    const activity = extractModelFromData(data);
    app._io.in(activity.project).emit('create:activity', activity);
  });

  app.on('create:message', function(data) {
    const message = extractModelFromData(data);
    app._io.in(message.project).emit('create:message', message);
  });

  app.on('invite:participant', function(data) {
    const participant = extractModelFromData(data);
    app._io.in(participant.project).emit('invite:participant', participant);
  });

  app.on('accept:participant', function(data) {
    const participant = extractModelFromData(data);
    app._io.in(participant.project).emit('update:participant', participant);
  });

  app.on('reject:participant', function(data) {
    const participant = extractModelFromData(data);
    app._io.in(participant.project).emit('update:participant', participant);
  });

  app.on('leave:participant', function(data) {
    const participant = extractModelFromData(data);
    app._io.in(participant.project).emit('update:participant', participant);
  });

  app.on('remove:participant', function(data) {
    const participant = extractModelFromData(data);
    app._io.in(participant.project).emit('update:participant', participant);
  });
};
