
exports.up = function(knex, Promise) {
  return knex.schema.createTableIfNotExists('users_users', table => {
    // table.increments().primary()
    table.integer('user_id').references('users.id');
    table.integer('follower_id').references('users.id');
    table.unique(['user_id', 'follower_id'])

  })
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('users_users')
};
