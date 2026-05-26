'use strict';

const { Pool } = require('pg');

/**
 * Connection pool configuration for Aurora PostgreSQL Serverless v2.
 *
 * AC2: Pool maintains max 20 connections with proper timeout handling.
 */
const POOL_CONFIG = {
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '5432', 10),
  database:           process.env.DB_NAME     || 'helix',
  user:               process.env.DB_USER     || 'helix_user',
  password:           process.env.DB_PASSWORD || '',
  ssl:                process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,

  // Pool sizing — max 20 connections per container (AC2)
  max:                20,
  min:                2,

  // How long (ms) a client may remain idle in the pool before being removed
  idleTimeoutMillis: 30000,

  // How long (ms) to wait for an available connection before throwing
  connectionTimeoutMillis: 5000,

  // How long (ms) a single query may run before being cancelled
  statement_timeout:  30000,
};

/** Singleton pool instance shared across the process. */
let pool = null;

/**
 * Returns the shared Pool instance, creating it on first call.
 *
 * @returns {Pool}
 */
function getPool() {
  if (!pool) {
    pool = new Pool(POOL_CONFIG);

    pool.on('error', (err) => {
      // Log unexpected errors on idle clients without crashing the process
      console.error('[connection-pool] Unexpected error on idle client', err);
    });

    pool.on('connect', () => {
      console.info('[connection-pool] New client connected to the database');
    });
  }
  return pool;
}

/**
 * Executes a parameterized query against the pool.
 *
 * AC4: All queries MUST use the `params` array to prevent SQL injection.
 *
 * @param {string}  sql    - Parameterized SQL string (use $1, $2, … placeholders)
 * @param {Array}  [params=[]] - Bound parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(sql, params = []) {
  return getPool().query(sql, params);
}

/**
 * Acquires a dedicated client from the pool.
 * Callers are responsible for calling `client.release()` when finished.
 *
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  return getPool().connect();
}

/**
 * Gracefully drains and closes the pool.
 * Should be called on process shutdown to prevent connection leaks.
 *
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.info('[connection-pool] Pool closed');
  }
}

module.exports = {
  getPool,
  query,
  getClient,
  closePool,
  // Expose config for testing/inspection (passwords excluded at runtime)
  POOL_CONFIG: { ...POOL_CONFIG, password: undefined },
};
