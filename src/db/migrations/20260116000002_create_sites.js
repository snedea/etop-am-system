exports.up = function(knex) {
  return knex.schema.createTable('sites', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('external_id', 255);
    table.string('name', 255);
    table.text('address');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_sites_client');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('sites');
};
