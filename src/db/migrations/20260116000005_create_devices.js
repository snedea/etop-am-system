exports.up = function(knex) {
  return knex.schema.createTable('devices', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.integer('site_id').unsigned().references('id').inTable('sites').onDelete('SET NULL');
    table.string('external_id', 255);
    table.string('name', 255);
    table.string('type', 50); // 'endpoint', 'server', 'network'
    table.string('os', 100);
    table.boolean('managed').defaultTo(false);
    table.string('health_status', 20); // 'healthy', 'warning', 'critical'
    table.timestamp('last_seen');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_devices_client');
    table.index('health_status', 'idx_devices_health');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('devices');
};
