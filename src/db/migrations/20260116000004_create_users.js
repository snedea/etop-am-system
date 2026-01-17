exports.up = function(knex) {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('external_id', 255);
    table.string('email', 255);
    table.string('upn', 255); // User Principal Name (M365)
    table.boolean('mfa_enabled').defaultTo(false);
    table.string('risk_level', 20); // 'none', 'low', 'medium', 'high'
    table.timestamp('last_sign_in');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_users_client');
    table.index('risk_level', 'idx_users_risk');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
