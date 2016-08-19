"use strict";

// XXX This should be used as a reference to deal with emitting events to certain rooms or sockets
// http://stackoverflow.com/a/10099325/2704169
// TODO It makes sense to define helper methods that would remove the need for repetitive code (emitting to the same room and so on)

const auth = require(__dirname + '/auth');
const IO = require('koa-socket');
const io = new IO();
const co = require('co');
const Annotation = require('mongoose').model('Annotation');
const Participant = require('mongoose').model('Participant');

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
      // TODO Make sure to either list socket as acceptable audience within the token
      // or just use another token for socket authentication
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
      // TODO Need to check if user is part of the project
      socket.join(data.id);
      socket.emit('join', {
        success: true
      });
      app._io.in(data.id).emit('join', {
        user: getAuthenticatedUserId(ctx)
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
      // TODO Need to check if user is part of the project
      // TODO Need to check if socket is within the room
      socket.leave(data.id);
      socket.emit('leave', {
        success: true
      });
      app._io.in(data.id).emit('leave', {
        user: getAuthenticatedUserId(ctx)
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
        let participant = yield Participant.findOne({ project: annotation.project, user: userId, status: 'active' }).exec();

        if ( participant ) {
          annotation.start = new Date(data.start);
          annotation = yield annotation.save();
        } else {
          // TODO A better handling of everything is needed
          throw new Error('Not a participant');
        }

        // TODO This needs way better error handling
        return annotation;
      }).then(function(annotation) {
        app._io.in(annotation.project).emit('move:annotation', {
          _id: annotation._id,
          start: annotation.start
        });
      }, function(err) {
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

  // XXX Not real annotation, just data with _id and project (identifiers)
  app.on('delete:annotation', function(annotation) {
    app._io.in(annotation.project).emit('delete:annotation', annotation);
  });
};
