exports.up = function(knex) {
  return knex.schema.createTable('risks', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('external_id', 255);
    table.string('risk_type', 100); // 'identity', 'email', 'endpoint', 'business'
    table.string('title', 255);
    table.text('description');
    table.string('likelihood', 20); // 'low', 'medium', 'high'
    table.string('impact', 20); // 'low', 'medium', 'high'
    table.string('status', 20); // 'open', 'mitigated', 'accepted'
    table.timestamp('detected_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_risks_client');
    table.index('status', 'idx_risks_status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('risks');
};
