'use strict';

const { getClient } = require('./connection-pool');

/**
 * Transaction isolation level used for all financial operations.
 * AC3: READ COMMITTED prevents dirty reads while allowing concurrent access.
 */
const ISOLATION_LEVEL = 'READ COMMITTED';

/**
 * Executes `workFn` inside a database transaction with READ COMMITTED isolation.
 *
 * AC3: If `workFn` throws, the transaction is automatically rolled back.
 * AC4: Queries issued inside `workFn` must use parameterized statements.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} workFn
 *   Callback that receives a connected client.  All queries within this callback
 *   participate in the same transaction.
 * @returns {Promise<T>} The value returned by `workFn`.
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query(
 *     'INSERT INTO streams (track_id, listener_id, duration_seconds, is_qualified) VALUES ($1, $2, $3, $4)',
 *     [trackId, listenerId, duration, isQualified]
 *   );
 *   const { rows } = await client.query(
 *     'UPDATE artists SET total_streams = total_streams + 1 WHERE artist_id = $1 RETURNING total_streams',
 *     [artistId]
 *   );
 *   return rows[0];
 * });
 */
async function withTransaction(workFn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`SET TRANSACTION ISOLATION LEVEL ${ISOLATION_LEVEL}`);

    const result = await workFn(client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[transaction-manager] Transaction rolled back due to error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Records a stream event and updates aggregate counters atomically.
 *
 * AC3 & AC4 reference implementation — uses READ COMMITTED transaction with
 * parameterized queries throughout.
 *
 * @param {object} params
 * @param {string}       params.trackId    - UUID of the track being streamed
 * @param {string|null}  params.listenerId - UUID of the authenticated listener (nullable)
 * @param {number}       params.durationSeconds - How long the stream lasted
 * @param {boolean}      params.isQualified     - Whether stream counts for revenue
 * @param {string}       params.artistId        - UUID of the track's artist
 * @returns {Promise<{streamId: string, totalStreams: number}>}
 */
async function recordStream({ trackId, listenerId, durationSeconds, isQualified, artistId }) {
  return withTransaction(async (client) => {
    // AC4: parameterized INSERT for stream event
    const streamResult = await client.query(
      `INSERT INTO streams (track_id, listener_id, duration_seconds, is_qualified)
       VALUES ($1, $2, $3, $4)
       RETURNING stream_id`,
      [trackId, listenerId || null, durationSeconds, isQualified]
    );

    const streamId = streamResult.rows[0].stream_id;

    if (isQualified) {
      // AC4: parameterized UPDATE for artist aggregate
      const artistResult = await client.query(
        `UPDATE artists
         SET total_streams = total_streams + 1,
             updated_at    = NOW()
         WHERE artist_id = $1
         RETURNING total_streams`,
        [artistId]
      );

      return { streamId, totalStreams: artistResult.rows[0].total_streams };
    }

    return { streamId, totalStreams: null };
  });
}

/**
 * Inserts a revenue transaction record for a given artist/track period.
 *
 * Revenue calculation: $0.004 per qualified stream; 70% artist / 30% platform.
 *
 * AC3 & AC4 reference implementation.
 *
 * @param {object} params
 * @param {string}  params.artistId               - UUID of the artist
 * @param {string}  params.trackId                - UUID of the track
 * @param {Date}    params.periodStart             - Start of reporting period
 * @param {Date}    params.periodEnd               - End of reporting period
 * @param {number}  params.totalQualifiedStreams   - Count of qualified streams
 * @param {number}  params.artistRevenueCents      - Artist share in cents
 * @param {number}  params.platformRevenueCents    - Platform share in cents
 * @returns {Promise<{transactionId: string}>}
 */
async function recordRevenue({
  artistId,
  trackId,
  periodStart,
  periodEnd,
  totalQualifiedStreams,
  artistRevenueCents,
  platformRevenueCents,
}) {
  return withTransaction(async (client) => {
    // AC4: parameterized INSERT for revenue transaction
    const revenueResult = await client.query(
      `INSERT INTO revenue_transactions
         (artist_id, track_id, period_start, period_end,
          total_qualified_streams, artist_revenue_cents, platform_revenue_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING transaction_id`,
      [
        artistId,
        trackId,
        periodStart,
        periodEnd,
        totalQualifiedStreams,
        artistRevenueCents,
        platformRevenueCents,
      ]
    );

    const transactionId = revenueResult.rows[0].transaction_id;

    // AC4: parameterized UPDATE for artist revenue aggregate
    await client.query(
      `UPDATE artists
       SET total_revenue_cents = total_revenue_cents + $1,
           updated_at          = NOW()
       WHERE artist_id = $2`,
      [artistRevenueCents, artistId]
    );

    return { transactionId };
  });
}

module.exports = {
  withTransaction,
  recordStream,
  recordRevenue,
  ISOLATION_LEVEL,
};
