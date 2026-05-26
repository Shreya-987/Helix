'use strict';

const { POOL_CONFIG, query, getClient, closePool } = require('../db/connection-pool');

// ---------------------------------------------------------------------------
// Helpers / mocks
// ---------------------------------------------------------------------------

// Mock the pg module so tests never open real DB connections
jest.mock('pg', () => {
  const mockClient = {
    query:   jest.fn(),
    release: jest.fn(),
  };

  const Pool = jest.fn().mockImplementation(() => ({
    query:   jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue(mockClient),
    end:     jest.fn().mockResolvedValue(undefined),
    on:      jest.fn(),
    _mockClient: mockClient,
  }));

  return { Pool };
});

// Reset module registry between tests so singleton `pool` is cleared
beforeEach(() => {
  jest.resetModules();
});

// ---------------------------------------------------------------------------
// AC2: Pool configuration
// ---------------------------------------------------------------------------
describe('connection-pool – AC2 pool configuration', () => {
  it('exports POOL_CONFIG with max 20 connections', () => {
    const { POOL_CONFIG: cfg } = require('../db/connection-pool');
    expect(cfg.max).toBe(20);
  });

  it('exports POOL_CONFIG with idleTimeoutMillis > 0', () => {
    const { POOL_CONFIG: cfg } = require('../db/connection-pool');
    expect(cfg.idleTimeoutMillis).toBeGreaterThan(0);
  });

  it('exports POOL_CONFIG with connectionTimeoutMillis > 0', () => {
    const { POOL_CONFIG: cfg } = require('../db/connection-pool');
    expect(cfg.connectionTimeoutMillis).toBeGreaterThan(0);
  });

  it('does not expose the password in exported POOL_CONFIG', () => {
    const { POOL_CONFIG: cfg } = require('../db/connection-pool');
    expect(cfg.password).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC4: Parameterized query helper
// ---------------------------------------------------------------------------
describe('connection-pool – query helper (AC4)', () => {
  it('calls pool.query with the provided sql and params', async () => {
    const mod = require('../db/connection-pool');
    await mod.query('SELECT $1::text AS val', ['hello']);

    // Retrieve the underlying mock Pool instance
    const { Pool } = require('pg');
    const poolInstance = Pool.mock.results[0].value;
    expect(poolInstance.query).toHaveBeenCalledWith('SELECT $1::text AS val', ['hello']);
  });

  it('defaults params to an empty array when omitted', async () => {
    const mod = require('../db/connection-pool');
    await mod.query('SELECT 1');

    const { Pool } = require('pg');
    const poolInstance = Pool.mock.results[0].value;
    expect(poolInstance.query).toHaveBeenCalledWith('SELECT 1', []);
  });
});

// ---------------------------------------------------------------------------
// Pool lifecycle
// ---------------------------------------------------------------------------
describe('connection-pool – lifecycle', () => {
  it('getPool returns the same singleton on successive calls', () => {
    const { getPool } = require('../db/connection-pool');
    const p1 = getPool();
    const p2 = getPool();
    expect(p1).toBe(p2);
  });

  it('closePool calls pool.end and nullifies the singleton', async () => {
    const mod = require('../db/connection-pool');
    const pool = mod.getPool();
    await mod.closePool();

    // pool.end should have been called exactly once
    expect(pool.end).toHaveBeenCalledTimes(1);

    // After closing, getPool() should create a fresh pool
    const { Pool } = require('pg');
    const callCountBefore = Pool.mock.calls.length;
    mod.getPool();
    expect(Pool.mock.calls.length).toBe(callCountBefore + 1);
  });

  it('getClient returns a client from the pool', async () => {
    const mod = require('../db/connection-pool');
    const client = await mod.getClient();
    expect(client).toBeDefined();
    expect(typeof client.query).toBe('function');
    expect(typeof client.release).toBe('function');
  });
});
