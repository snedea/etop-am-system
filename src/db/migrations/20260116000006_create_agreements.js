exports.up = function(knex) {
  return knex.schema.createTable('agreements', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('external_id', 255);
    table.decimal('mrr', 10, 2);
    table.decimal('effective_rate', 10, 2);
    table.integer('term_months');
    table.date('start_date');
    table.date('end_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('agreements');
};
