exports.up = function(knex) {
  return knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.string('external_id', 255).notNullable();
    table.string('source', 50).notNullable(); // 'connectwise', 'immy', 'm365'
    table.string('name', 255).notNullable();
    table.enu('segment', ['A', 'B', 'C', 'D']);
    table.decimal('mrr', 10, 2);
    table.date('agreement_start');
    table.date('agreement_end');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Unique constraint on external_id + source combination
    table.unique(['external_id', 'source']);
    table.index(['external_id', 'source'], 'idx_clients_external');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('clients');
};
