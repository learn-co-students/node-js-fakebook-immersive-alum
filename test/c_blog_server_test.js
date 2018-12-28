"use strict";

const _       = require('lodash');
const expect  = require('unexpected');
const request = require('supertest');
const baseUrl = 'http://localhost:3000';

const User = require('../app/models/user');
const Post = require('../app/models/post');
const Comment = require('../app/models/comment');

const bookshelf = require('../app/db/bookshelf');
const app = require('../app/');

let mockUser = {
  name: 'Sally Low',
  username: 'sally',
  email: 'sally@example.org',
  password: 'password',
};

let anotherMockUser = {
  name: 'Bob Saltwater',
  username: 'bob',
  email: 'bob@example.org',
  password: 'password',
};

let aThirdMockUser = {
  name: 'Johnny Auslander',
  username: 'johnny',
  email: 'johnny@example.org',
  password: 'password'
};

let mockPost = {
  title: 'Test Post',
  body: 'This is just a test post with no content.'
};

let anotherMockPost = {
  title: 'Test Post 2',
  body: 'This is a second post.'
};

let mockComment = {
  body: 'This is just a test comment.'
};

const login = (server, opts) => {
  const loginData = opts.loginData || {};
  return new Promise((resolve, reject) => {
    let newUser, newPost;
    let saveUser = opts.createUser ? User.forge().save(mockUser) : null;
    Promise.resolve(saveUser).then((usr) => {
      newUser = usr;
      return !(usr && opts.createPost) ? null :
        Post.forge().save(_.extend({author: usr.get('id')}, mockPost));
    }).then((post) => {
      newPost = post;
      return !(post && opts.createComment) ? null :
        Comment.forge().save(_.extend(
          {user_id: newUser.get('id'), post_id: post.get('id')}, mockComment));
    }).then((comment) => {
      server
        .post('/login')
        .send(loginData)
        .end((err, resp) => {
          if (err) throw err;
          resolve({
            testUserId: newUser ? newUser.get('id') : null,
            testPostId: newPost ? newPost.get('id') : null,
            testCommentId: comment ? comment.get('id') : null,
            loginResponse: resp
          });
        });
    }).catch(reject);
  });
};

const cleanup = () => {
  return Promise.all([
    Comment.where('id', '!=', 0).destroy(),
    Post.where('id', '!=', 0).destroy(),
    User.where('id', '!=', 0).
      fetchAll({withRelated: ['followers', 'following']})
      .then(coll => {
        return Promise.all([
          _.forEach(coll.models, v => {
            v.destroy();
          })
        ]);
    })
  ]);
};

let loginData = {
  username: mockUser.username,
  password: mockUser.password
};

describe('Server', () => {

  after((done) => {
    return cleanup().then(() => {
      done();
    }).catch(done);
  });

  describe('/user endpoint', () => {

    let server;

    beforeEach(() => {
      server = request.agent(baseUrl);
    });

    afterEach((done) => {
      cleanup().then(() => {
        done();
      }).catch(done);
    });

    it('Can log a user in', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        expect(obj.loginResponse.status, 'to be', 302);
        expect(obj.loginResponse.redirect, 'to be', true);
        expect(obj.loginResponse.headers.location, 'to be', '/posts');
        done();
      }).catch(done);
    });

    it('POST to /user with valid data returns new user id', (done) => {
      server
        .post('/user')
        .send(mockUser)
        .expect(200)
        .end((err, resp) => {
          if (err) done(err);
          expect(resp.body, 'to have key', 'id');
          expect(resp.body.id, 'to be a', 'number');
          done();
        });
    });

    it('POST to /user with invalid data returns 400', (done) => {
      server
        .post('/user')
        .send({})
        .expect(400, done);
    });

    it('GET to /user/:id with id specified returns usr object', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        server
          .get('/user/' + obj.testUserId)
          .expect(200)
          .end((err, resp) => {
            if (err) done(err);
            expect(resp.body, 'to have keys', [
              'id',
              'name',
              'username',
              'email',
              'created_at',
              'updated_at',
            ]);
            expect(resp.body.id, 'to be a', 'number');
            expect(resp.body.id, 'to be', obj.testUserId);
            expect(resp.body.name, 'to be', mockUser.name);
            expect(resp.body.username, 'to be', mockUser.username);
            expect(resp.body.email, 'to be', mockUser.email);
            done();
          });
      }).catch(done);
    });

    it('GET to /user/:id with non-existant user specified returns 404', (done) => {
      login(server, {createUser: true, loginData}).then(() => {
         server
          .get('/user/' + 7009)
          .expect(404, done);
      }).catch(done);
    });

  });


  describe('/post endpoint:', () => {

    let server;

    beforeEach(() => {
      server = request.agent(baseUrl);
    });

    afterEach((done) => {
      cleanup().then(() => {
        done();
      }).catch(done);
    });

    it('POST to /post with post data returns new post id', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        let data = _.extend({author: obj.testUserId}, mockPost);
        server
          .post('/post')
          .send(data)
          .expect(200)
          .end((err, resp) => {
            if (err) return done(err);
            expect(resp.body, 'to have key', 'id');
            expect(resp.body.id, 'to be a', 'number');
            done();
          });
      }).catch(done);
    });

    it('POST to /post with invalid data returns 400', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        server
          .post('/post')
          .send({})
          .expect(400, done);
      }).catch(done);
    });

    it('GET to /post/:id with id specified returns post object', (done) => {
      login(server, {
        createUser: true,
        createPost:true,
        loginData
      }).then((obj) => {
        server
          .get('/post/' + obj.testPostId)
          .expect(200)
          .end((err, resp) => {
            if (err) done(err);
            expect(resp.body, 'to have keys', [
              'id',
              'title',
              'body',
              'created_at',
              'updated_at',
            ]);
            expect(resp.body.id, 'to be a', 'number');
            expect(resp.body.id, 'to be', obj.testPostId);
            expect(resp.body.title, 'to be', mockPost.title);
            expect(resp.body.body, 'to be', mockPost.body);
            expect(resp.body.author, 'to be a', 'object');
            expect(resp.body.author.id, 'to be', obj.testUserId);
            expect(resp.body.author.name, 'to be', mockUser.name);
            done();
          });
      }).catch(done);
    });

    it('GET to /posts returns a list of all the posts', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        server
          .get('/posts')
          .expect(200)
          .end((err, resp) => {
            if (err) return done(err);
            expect(resp.body, 'to be a', 'array');
            done();
          });
      }).catch(done);
    });

    it('GET to /post/:id with non-existant user id specified returns 404', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        server
          .get('/post/' + 7009)
          .expect(404, done);
      }).catch(done);
    });

  });

  describe('/comment endpt', () => {

    let server;

    beforeEach(() => {
      server = request.agent(baseUrl);
    });

    afterEach((done) => {
      return cleanup().then(() => {
        done();
      }).catch(done);
    });

    it('POST to /comment with valid data returns new comment id', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        server
          .post('/comment')
          .send(mockComment)
          .expect(200)
          .end((err, resp) => {
            if (err) done(err);
            expect(resp.body, 'to have key', 'id');
            expect(resp.body.id, 'to be a', 'number');
            done();
          });
      }).catch(done);
    });

    it('POST to /comment with empty data returns 400', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        server
          .post('/comment')
          .send({})
          .expect(400, done);
      }).catch(done);
    });

    it('GET to /post/:id where post has comment includes comments in response', (done) => {
      login(server, {
        createUser: true,
        createPost: true,
        createComment: true,
        loginData
      })
      .catch(done)
      .then((obj) => {
        server
          .get('/post/' + obj.testPostId)
          .expect(200)
          .end((err, resp) => {
            if (err) done(err);
            expect(resp.body, 'to have key', 'comments');
            expect(resp.body.comments, 'to be a', 'array');
            expect(resp.body.comments, 'to have length', 1);
            done();
          });
      });
    });

  });

  describe('/follow endpt', () => {

    let server;

    beforeEach(() => {
      server = request.agent(baseUrl);
    });

    afterEach((done) => {
      cleanup().then(() => {
        done();
      }).catch(done);
    });

    it('GET to /follow/:id with valid user returns followed user id', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        User.forge().save(anotherMockUser).then((usrToFollow) => {
          server
            .get('/follow/' + usrToFollow.get('id'))
            .expect(200)
            .end((err, resp) => {
              if (err) return done(err);
              expect(resp.body, 'to be a', 'array');
              expect(resp.body[0], 'to be', usrToFollow.get('id'));
              User
                .forge({id: obj.testUserId})
                .fetch({withRelated: ['following']})
                .then((usr) => {
                  let following = usr.related('following').models;
                  expect(following.length, 'to be', 1);
                  expect(following[0].id, 'to be', usrToFollow.get('id'));
                  done();
                });
            });
        }).catch((err) => { throw err; });
      }).catch(done);
    });

    // it('GET to /unfollow/:id with valid user id returns something', (done) => {
    //   let userToFollowId;
    //   login(server, {createUser: true, loginData}).then((obj) => {
    //     User.forge().save(anotherMockUser).then((usr) => {
    //       userToFollowId = usr.get('id');
    //       return User
    //         .forge({id: usr.get('id')})
    //         .followers()
    //         .attach([obj.testUserId]);
    //     }).then(() => {
    //       server
    //         .get('/unfollow/' + userToFollowId)
    //         .expect(200)
    //         .end((err, resp) => {
    //           if (err) return done(err);
    //           User
    //             .forge({id: obj.testUserId})
    //             .fetch({withRelated: ['following']})
    //             .then((usr) => {
    //               expect(usr.related('following').length, 'to be', 0);
    //               done();
    //             }).catch(done);
    //         });
    //     });
    //   }).catch(done);
    //
    // });

  });

  describe('/ endpoint (home page)', () => {

    let server;

    beforeEach(() => {
      server = request.agent(baseUrl);
    });

    afterEach((done) => {
      return cleanup().then(() => {
        done();
      }).catch(done);
    });

    it('GET to / returns list of latest posts by followed users', (done) => {
      login(server, {createUser: true, loginData}).then((obj) => {
        Promise.all([
          User.forge().save(anotherMockUser).then(u => {
            return User.forge({id: obj.testUserId}).following().attach(u);
          }),
          User.forge().save(aThirdMockUser).then(u => {
            return User.forge({id: obj.testUserId}).following().attach(u);
          })
        ]).then((results) => {
          let post1 = _.extend({author: results[0].models[0].get('id')}, mockPost);
          let post2 = _.extend({author: results[1].models[0].get('id')}, anotherMockPost);
          return Promise.all([
            Post.forge().save(post1),
            new Promise((resolve, reject) => {
              setTimeout(() => {
                return Post.forge().save(post2).then(resolve);
              }, 1000);
            })
          ]);
        }).then((results) => {
          server
            .get('/')
            .expect(200)
            .end((err, resp) => {
              if (err) return done(err);
              expect(resp.body, 'to be a', 'array');
              expect(resp.body.length, 'to be', 2);
              expect(resp.body[0].title, 'to be', anotherMockPost.title);
              expect(resp.body[1].title, 'to be', mockPost.title);
              done();
            });
        }).catch(done);
      });
    });

  });

});
