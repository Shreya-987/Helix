'use strict';

// ---------------------------------------------------------------------------
// Mock connection-pool before requiring transaction-manager
// ---------------------------------------------------------------------------
const mockClient = {
  query:   jest.fn(),
  release: jest.fn(),
};

jest.mock('../db/connection-pool', () => ({
  getClient: jest.fn().mockResolvedValue(mockClient),
}));

const { withTransaction, recordStream, recordRevenue, ISOLATION_LEVEL } = require('../db/transaction-manager');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resetMocks() {
  mockClient.query.mockReset();
  mockClient.release.mockReset();
}

// ---------------------------------------------------------------------------
// AC3: Isolation level
// ---------------------------------------------------------------------------
describe('transaction-manager – AC3 isolation level', () => {
  it('exports ISOLATION_LEVEL as READ COMMITTED', () => {
    expect(ISOLATION_LEVEL).toBe('READ COMMITTED');
  });

  it('withTransaction sets READ COMMITTED on BEGIN', async () => {
    resetMocks();
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await withTransaction(async () => 'done');

    const calls = mockClient.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain('BEGIN');
    expect(calls.some((c) => /READ COMMITTED/i.test(c))).toBe(true);
    expect(calls).toContain('COMMIT');
  });

  it('withTransaction rolls back on error', async () => {
    resetMocks();
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET TRANSACTION
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const err = new Error('simulated DB error');

    await expect(
      withTransaction(async () => { throw err; })
    ).rejects.toThrow('simulated DB error');

    const calls = mockClient.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
  });

  it('withTransaction releases client after commit', async () => {
    resetMocks();
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await withTransaction(async () => 'ok');

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('withTransaction releases client after rollback', async () => {
    resetMocks();
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await withTransaction(async () => { throw new Error('fail'); }).catch(() => {});

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// AC4: Parameterized queries in recordStream
// ---------------------------------------------------------------------------
describe('transaction-manager – recordStream (AC3 & AC4)', () => {
  const streamParams = {
    trackId:         'track-uuid-001',
    listenerId:      'listener-uuid-001',
    durationSeconds: 180,
    isQualified:     true,
    artistId:        'artist-uuid-001',
  };

  beforeEach(() => {
    resetMocks();
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET TRANSACTION ISOLATION LEVEL
      .mockResolvedValueOnce({ rows: [{ stream_id: 'new-stream-id' }] }) // INSERT streams
      .mockResolvedValueOnce({ rows: [{ total_streams: 42 }] })           // UPDATE artists
      .mockResolvedValueOnce(undefined);                                   // COMMIT
  });

  it('uses parameterized INSERT for the stream event', async () => {
    await recordStream(streamParams);

    const insertCall = mockClient.query.mock.calls.find(
      ([sql]) => /INSERT INTO streams/i.test(sql)
    );
    expect(insertCall).toBeDefined();
    // Second element must be the params array (AC4)
    expect(Array.isArray(insertCall[1])).toBe(true);
    expect(insertCall[1]).toContain(streamParams.trackId);
    expect(insertCall[1]).toContain(streamParams.durationSeconds);
  });

  it('uses parameterized UPDATE for artist aggregate on qualified stream', async () => {
    await recordStream(streamParams);

    const updateCall = mockClient.query.mock.calls.find(
      ([sql]) => /UPDATE artists/i.test(sql)
    );
    expect(updateCall).toBeDefined();
    expect(Array.isArray(updateCall[1])).toBe(true);
    expect(updateCall[1]).toContain(streamParams.artistId);
  });

  it('returns streamId and totalStreams on success', async () => {
    const result = await recordStream(streamParams);
    expect(result.streamId).toBe('new-stream-id');
    expect(result.totalStreams).toBe(42);
  });

  it('passes null for anonymous (null listenerId) stream', async () => {
    resetMocks();
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ stream_id: 'anon-stream' }] })
      .mockResolvedValueOnce({ rows: [{ total_streams: 1 }] })
      .mockResolvedValueOnce(undefined);

    await recordStream({ ...streamParams, listenerId: null });

    const insertCall = mockClient.query.mock.calls.find(
      ([sql]) => /INSERT INTO streams/i.test(sql)
    );
    expect(insertCall[1][1]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC4: Parameterized queries in recordRevenue
// ---------------------------------------------------------------------------
describe('transaction-manager – recordRevenue (AC3 & AC4)', () => {
  const revenueParams = {
    artistId:              'artist-uuid-001',
    trackId:               'track-uuid-001',
    periodStart:           new Date('2024-01-01'),
    periodEnd:             new Date('2024-01-31'),
    totalQualifiedStreams: 1000,
    artistRevenueCents:    2800,
    platformRevenueCents:  1200,
  };

  beforeEach(() => {
    resetMocks();
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET TRANSACTION ISOLATION LEVEL
      .mockResolvedValueOnce({ rows: [{ transaction_id: 'rev-tx-id' }] }) // INSERT revenue
      .mockResolvedValueOnce({ rows: [] })                                  // UPDATE artists
      .mockResolvedValueOnce(undefined);                                    // COMMIT
  });

  it('uses parameterized INSERT for revenue_transactions', async () => {
    await recordRevenue(revenueParams);

    const insertCall = mockClient.query.mock.calls.find(
      ([sql]) => /INSERT INTO revenue_transactions/i.test(sql)
    );
    expect(insertCall).toBeDefined();
    expect(Array.isArray(insertCall[1])).toBe(true);
    expect(insertCall[1]).toContain(revenueParams.artistId);
    expect(insertCall[1]).toContain(revenueParams.totalQualifiedStreams);
    expect(insertCall[1]).toContain(revenueParams.artistRevenueCents);
    expect(insertCall[1]).toContain(revenueParams.platformRevenueCents);
  });

  it('uses parameterized UPDATE for artist total_revenue_cents', async () => {
    await recordRevenue(revenueParams);

    const updateCall = mockClient.query.mock.calls.find(
      ([sql]) => /UPDATE artists/i.test(sql)
    );
    expect(updateCall).toBeDefined();
    expect(Array.isArray(updateCall[1])).toBe(true);
    expect(updateCall[1]).toContain(revenueParams.artistRevenueCents);
    expect(updateCall[1]).toContain(revenueParams.artistId);
  });

  it('returns the new transactionId', async () => {
    const result = await recordRevenue(revenueParams);
    expect(result.transactionId).toBe('rev-tx-id');
  });

  it('rolls back if revenue INSERT fails', async () => {
    resetMocks();
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // SET TRANSACTION ISOLATION LEVEL
      .mockRejectedValueOnce(new Error('constraint violation')) // INSERT fails
      .mockResolvedValueOnce(undefined); // ROLLBACK

    await expect(recordRevenue(revenueParams)).rejects.toThrow('constraint violation');

    const calls = mockClient.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
  });
});
