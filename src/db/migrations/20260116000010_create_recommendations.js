exports.up = function(knex) {
  return knex.schema.createTable('recommendations', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('title', 255);
    table.text('description');
    table.string('effort', 20); // 'low', 'medium', 'high'
    table.string('cost_range', 50); // '$1-5K', '$5-10K', etc.
    table.string('priority', 20); // 'high', 'medium', 'low'
    table.string('quarter', 10); // 'Q1 2026', 'Q2 2026', etc.
    table.string('status', 20).defaultTo('pending'); // 'pending', 'approved', 'completed'
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_recommendations_client');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('recommendations');
};
