
CREATE TABLE IF NOT EXISTS t_p14707447_client_finder_ai.users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  credits       INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p14707447_client_finder_ai.sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES t_p14707447_client_finder_ai.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS t_p14707447_client_finder_ai.payments (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES t_p14707447_client_finder_ai.users(id),
  yookassa_id     TEXT UNIQUE,
  amount          NUMERIC(10,2) NOT NULL,
  credits         INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  sbp_url         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS t_p14707447_client_finder_ai.credit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES t_p14707447_client_finder_ai.users(id),
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON t_p14707447_client_finder_ai.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON t_p14707447_client_finder_ai.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_log_user ON t_p14707447_client_finder_ai.credit_log(user_id);
