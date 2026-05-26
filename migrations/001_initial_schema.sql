-- Migration: 001_initial_schema.sql
-- Description: Initial Aurora PostgreSQL schema for Helix music streaming platform
-- Tables: users, artists, tracks, albums, streams, revenue_transactions

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('Artist', 'Listener')),
    display_name  VARCHAR(100),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email   ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at);

-- ============================================================
-- ARTISTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS artists (
    artist_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES users (user_id) ON DELETE CASCADE,
    stage_name          VARCHAR(50) NOT NULL,
    bio                 TEXT,
    payout_email        VARCHAR(255),
    total_streams       BIGINT      NOT NULL DEFAULT 0,
    total_revenue_cents BIGINT      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_user_id    ON artists (user_id);
CREATE INDEX IF NOT EXISTS idx_artists_stage_name ON artists (stage_name);

-- ============================================================
-- ALBUMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS albums (
    album_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id    UUID         NOT NULL REFERENCES artists (artist_id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    release_date DATE,
    cover_art_key VARCHAR(512),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums (artist_id);

-- ============================================================
-- TRACKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tracks (
    track_id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id        UUID         NOT NULL REFERENCES artists (artist_id) ON DELETE CASCADE,
    album_id         UUID         REFERENCES albums (album_id) ON DELETE SET NULL,
    title            VARCHAR(200) NOT NULL,
    genre            VARCHAR(20)  NOT NULL CHECK (genre IN ('ROCK','POP','JAZZ','ELECTRONIC','HIPHOP','INDIE','CLASSICAL','OTHER')),
    release_date     DATE,
    explicit         BOOLEAN      NOT NULL DEFAULT FALSE,
    isrc             VARCHAR(12),
    duration_seconds INTEGER      CHECK (duration_seconds > 0),
    s3_key           VARCHAR(512),
    waveform_data_key VARCHAR(512),
    status           VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING','PUBLISHED','FAILED','DELETED')),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks (artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id  ON tracks (album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_genre     ON tracks (genre);
CREATE INDEX IF NOT EXISTS idx_tracks_status    ON tracks (status);
CREATE INDEX IF NOT EXISTS idx_tracks_created   ON tracks (created_at);

-- ============================================================
-- STREAMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS streams (
    stream_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id         UUID        NOT NULL REFERENCES tracks (track_id) ON DELETE CASCADE,
    listener_id      UUID        REFERENCES users (user_id) ON DELETE SET NULL,
    streamed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INTEGER     NOT NULL CHECK (duration_seconds >= 0),
    is_qualified     BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_streams_track_id    ON streams (track_id);
CREATE INDEX IF NOT EXISTS idx_streams_listener_id ON streams (listener_id);
CREATE INDEX IF NOT EXISTS idx_streams_streamed_at ON streams (streamed_at);
CREATE INDEX IF NOT EXISTS idx_streams_qualified   ON streams (is_qualified) WHERE is_qualified = TRUE;

-- ============================================================
-- REVENUE_TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue_transactions (
    transaction_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id               UUID        NOT NULL REFERENCES artists (artist_id) ON DELETE RESTRICT,
    track_id                UUID        NOT NULL REFERENCES tracks (track_id) ON DELETE RESTRICT,
    period_start            TIMESTAMPTZ NOT NULL,
    period_end              TIMESTAMPTZ NOT NULL,
    total_qualified_streams INTEGER     NOT NULL CHECK (total_qualified_streams >= 0),
    artist_revenue_cents    INTEGER     NOT NULL CHECK (artist_revenue_cents >= 0),
    platform_revenue_cents  INTEGER     NOT NULL CHECK (platform_revenue_cents >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_period CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_revenue_artist_id   ON revenue_transactions (artist_id);
CREATE INDEX IF NOT EXISTS idx_revenue_track_id    ON revenue_transactions (track_id);
CREATE INDEX IF NOT EXISTS idx_revenue_period      ON revenue_transactions (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_revenue_created     ON revenue_transactions (created_at);
