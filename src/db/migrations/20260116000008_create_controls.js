exports.up = function(knex) {
  return knex.schema.createTable('controls', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('external_id', 255);
    table.string('control_type', 100); // 'immy_baseline', 'm365_secure_score', etc.
    table.string('status', 20); // 'pass', 'fail', 'unknown'
    table.jsonb('evidence'); // Vendor-specific proof
    table.timestamp('last_checked');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_controls_client');
    table.index('status', 'idx_controls_status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('controls');
};
