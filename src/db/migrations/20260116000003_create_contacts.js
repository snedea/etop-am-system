exports.up = function(knex) {
  return knex.schema.createTable('contacts', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('external_id', 255);
    table.string('role', 100); // 'CEO', 'CFO', 'IT Manager', etc.
    table.string('email', 255);
    table.string('phone', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('client_id', 'idx_contacts_client');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('contacts');
};
