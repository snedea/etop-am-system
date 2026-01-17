exports.up = function(knex) {
  return knex.schema.createTable('tickets', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('external_id', 255);
    table.string('category', 100);
    table.string('priority', 20);
    table.string('status', 50);
    table.decimal('hours_spent', 5, 2);
    table.boolean('sla_met');
    table.integer('reopen_count').defaultTo(0);
    table.integer('csat_score'); // 1-5 or NULL
    table.timestamp('created_date');
    table.timestamp('closed_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_tickets_client');
    table.index('created_date', 'idx_tickets_created');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tickets');
};
