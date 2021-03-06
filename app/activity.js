"use strict";

const Activity = require('mongoose').model('Activity');

module.exports = function (app) {
  const activityPopulateOptions = Activity.getPopulateOptions();

  function extractModelFromData(data, type) {
    if ( type ) {
      return data.data[type];
    }

    return data.data;
  }

  function extractActorFromData(data) {
    return data.actor;
  }

  function getModelTypeToExtract(actionType, objectType) {
    if ( actionType === 'attach' || actionType === 'detach' ) {
      return objectType;
    }

    return null;
  }

  function createActivityFromEvent(activityType, objectType, data) {
    const object = extractModelFromData(data, getModelTypeToExtract(activityType, objectType));
    const actor = extractActorFromData(data);
    let activityData = {};

    if ( object.title ) {
      activityData.title = object.title;
    }
    if ( object._id ) {
      activityData.id = object._id;
    }
    if ( activityType === 'move' ) {
      if ( object.start ) {
        activityData.start = object.start;
      }
      if ( object.end ) {
        activityData.end = object.end;
      }
    }
    if ( objectType === 'participant' && ( activityType === 'invite' || activityType === 'remove' || activityType === 'attach' || activityType === 'detach' ) ) {
      activityData.user = ( object.user._id ) ? object.user._id : object.user;
    }

    if ( activityType === 'attach' || activityType === 'detach' ) {
      const taskObject = extractModelFromData(data, 'task');

      activityData.task = {};
      activityData.task.title = taskObject.title;
      activityData.task.id = taskObject._id;
    }

    new Activity({
      activityType: activityType,
      objectType: objectType,
      data: activityData,
      actor: actor._id ? actor._id : actor,
      project: object.project ? object.project : object._id
    })
    .save()
    .then(function(activity) {
      return Activity.populate(activity, activityPopulateOptions);
    })
    .then(function(activity) {
      app.emit('create:activity', {
        data: activity,
        actor: actor
      });
    })
    .catch(function(err) {
      console.error('Activity creation failed: ', err);
    });
  }

  app.on('create:project', function(data) {
    createActivityFromEvent('create', 'project', data);
  });

  app.on('update:project', function(data) {
    createActivityFromEvent('update', 'project', data);
  });

  // XXX This one is highly questionable as activities
  // might be removed along with the project itself
  app.on('delete:project', function(data) {
    createActivityFromEvent('delete', 'project', data);
  });

  app.on('create:annotation', function(data) {
    createActivityFromEvent('create', 'annotation', data);
  });

  app.on('update:annotation', function(data) {
    createActivityFromEvent('update', 'annotation', data);
  });

  app.on('delete:annotation', function(data) {
    createActivityFromEvent('delete', 'annotation', data);
  });

  app.on('move:annotation', function(data) {
    createActivityFromEvent('move', 'annotation', data);
  });

  app.on('create:milestone', function(data) {
    createActivityFromEvent('create', 'milestone', data);
  });

  app.on('update:milestone', function(data) {
    createActivityFromEvent('update', 'milestone', data);
  });

  app.on('delete:milestone', function(data) {
    createActivityFromEvent('delete', 'milestone', data);
  });

  app.on('move:milestone', function(data) {
    createActivityFromEvent('move', 'milestone', data);
  });

  app.on('create:task', function(data) {
    createActivityFromEvent('create', 'task', data);
  });

  app.on('update:task', function(data) {
    createActivityFromEvent('update', 'task', data);
  });

  app.on('delete:task', function(data) {
    createActivityFromEvent('delete', 'task', data);
  });

  app.on('move:task', function(data) {
    createActivityFromEvent('move', 'task', data);
  });

  app.on('create:resource', function(data) {
    createActivityFromEvent('create', 'resource', data);
  });

  app.on('update:resource', function(data) {
    createActivityFromEvent('update', 'resource', data);
  });

  app.on('delete:resource', function(data) {
    createActivityFromEvent('delete', 'resource', data);
  });

  app.on('create:outcome', function(data) {
    createActivityFromEvent('create', 'outcome', data);
  });

  app.on('update:outcome', function(data) {
    createActivityFromEvent('update', 'outcome', data);
  });

  app.on('delete:outcome', function(data) {
    createActivityFromEvent('delete', 'outcome', data);
  });

  app.on('invite:participant', function(data) {
    createActivityFromEvent('invite', 'participant', data);
  });

  app.on('leave:participant', function(data) {
    createActivityFromEvent('leave', 'participant', data);
  });

  app.on('accept:participant', function(data) {
    createActivityFromEvent('accept', 'participant', data);
  });

  app.on('reject:participant', function(data) {
    createActivityFromEvent('reject', 'participant', data);
  });

  app.on('remove:participant', function(data) {
    createActivityFromEvent('remove', 'participant', data);
  });

  app.on('attach:participant', function(data) {
    createActivityFromEvent('attach', 'participant', data);
  });

  app.on('detach:participant', function(data) {
    createActivityFromEvent('detach', 'participant', data);
  });

  app.on('attach:resource', function(data) {
    createActivityFromEvent('attach', 'resource', data);
  });

  app.on('detach:resource', function(data) {
    createActivityFromEvent('detach', 'resource', data);
  });

  app.on('attach:outcome', function(data) {
    createActivityFromEvent('attach', 'outcome', data);
  });

  app.on('detach:outcome', function(data) {
    createActivityFromEvent('detach', 'outcome', data);
  });
};
