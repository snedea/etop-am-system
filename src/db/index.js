const knex = require('knex');
const config = require('./knexfile');
const appConfig = require('../config');

// Select configuration based on environment
const environment = appConfig.env || 'development';
const knexConfig = config[environment];

// Create and export Knex instance
const db = knex(knexConfig);

module.exports = db;
