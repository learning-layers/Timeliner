"use strict";

const Activity = require('mongoose').model('Activity');

//

module.exports = function (app) {
  function extractModelFromData(data) {
    return data.data;
  }

  function extractActorFromData(data) {
    return data.actor;
  }

  function createActivityFromEvent(activityType, objectType, data) {
    const object = extractModelFromData(data);
    const actor = extractActorFromData(data);
    let activityData = {};

    if ( object.title ) {
      activityData.title = object.title;
    }

    new Activity({
      activityType: activityType,
      objectType: objectType,
      data: activityData,
      actor: actor._id ? actor._id : actor,
      project: object.project
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

  const activityPopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

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
};
