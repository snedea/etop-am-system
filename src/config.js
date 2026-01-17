require('dotenv').config();

module.exports = {
  // App settings
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiKey: process.env.API_KEY,

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/etop_am',
  },

  // ConnectWise Manage
  connectwise: {
    companyId: process.env.CW_COMPANY_ID,
    publicKey: process.env.CW_PUBLIC_KEY,
    privateKey: process.env.CW_PRIVATE_KEY,
    clientId: process.env.CW_CLIENT_ID,
    baseUrl: process.env.CW_BASE_URL || 'https://api-na.myconnectwise.net/v4_6_release/apis/3.0',
  },

  // Immy.Bot
  immy: {
    apiKey: process.env.IMMY_API_KEY,
    baseUrl: process.env.IMMY_BASE_URL,
  },

  // Microsoft 365
  m365: {
    tenantId: process.env.M365_TENANT_ID,
    clientId: process.env.M365_CLIENT_ID,
    clientSecret: process.env.M365_CLIENT_SECRET,
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    timeout: 60000, // 60 seconds
    maxRetries: 3,
  },

  // Job Queue (pg-boss)
  pgBoss: {
    schema: process.env.PG_BOSS_SCHEMA || 'pgboss',
    retryLimit: 3,
    retryDelay: 30, // seconds
    retryBackoff: true,
  },
};
