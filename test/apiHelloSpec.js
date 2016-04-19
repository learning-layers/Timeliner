"use strict";

const app = require('../server');
const request = require('supertest').agent(app.listen());

describe('Api Hello', function() {
  it('/ replies with hello world', function(done) {
    request
           .get('/api/hello')
           .expect('Content-Type', /text\/plain/)
           .expect(200)
           .expect('Hello world!')
           .end(done);
  });
  it('/:name replies with Hello :name!', function(done) {
    request
           .get('/api/hello/Tester')
           .expect('Content-Type', /text\/plain/)
           .expect(200)
           .expect('Hello Tester!')
           .end(done);
  });
});
