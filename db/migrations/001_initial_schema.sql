BEGIN;
-- belongs to casino domain

CREATE TABLE casino_users(
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE casino_wallets(
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES casino_users(id),
    currency_code VARCHAR(10) NOT NULL,

    playable_balance BIGINT NOT NULL DEFAULT 0,
    -- the assignment does not specify the rules/logic for redeemable balance
    -- so, it is retained here but not actively modelled
    -- playable balance is used by the bets and payouts. 
    redeemable_balance BIGINT NOT NULL DEFAULT 0,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, currency_code),
    CHECK (playable_balance >= 0),
    CHECK (redeemable_balance >= 0)
);

CREATE TABLE casino_game_providers(
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    api_endpoint TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE casino_games(
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES casino_game_providers(id),
    provider_game_id VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    min_bet BIGINT NOT NULL,
    max_bet BIGINT NOT NULL,

    UNIQUE(provider_id, provider_game_id),
    CHECK (min_bet >= 0),
    CHECK (max_bet >= min_bet)
);

CREATE TABLE casino_game_sessions (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(128) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES casino_users(id),
    wallet_id BIGINT NOT NULL REFERENCES casino_wallets(id),
    game_id BIGINT NOT NULL REFERENCES casino_games(id),
    provider_session_id VARCHAR(128) UNIQUE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE casino_transactions(
    id BIGSERIAL PRIMARY KEY,
    wallet_id BIGINT NOT NULL REFERENCES casino_wallets(id),
    session_id BIGINT REFERENCES casino_game_sessions(id),
    transaction_type VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,

    external_transaction_id VARCHAR(128) NOT NULL UNIQUE,
    related_external_transaction_id VARCHAR(128),
    provider_round_id VARCHAR(128) NOT NULL,
    balance_after BIGINT NOT NULL,

    is_tombstone BOOLEAN NOT NULL DEFAULT FALSE,

    response_cache JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        transaction_type IN (
            'BET',
            'PAYOUT',
            'ROLLBACK'
        )
    ),

    CHECK (amount >= 0),
    CHECK (balance_after >= 0)
);

CREATE INDEX idx_casino_transactions_round ON casino_transactions(provider_round_id);

CREATE INDEX idx_casino_transactions_session ON casino_transactions(session_id);


-- from onwards belongs to provider domain

CREATE TABLE provider_games (
    id BIGSERIAL PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    min_bet BIGINT NOT NULL,
    max_bet BIGINT NOT NULL,

    CHECK (min_bet >= 0),
    CHECK (max_bet >= min_bet)
);

CREATE TABLE provider_customers (
    id BIGSERIAL PRIMARY KEY,
    player_id VARCHAR(128) NOT NULL UNIQUE,
    casino_code VARCHAR(50) NOT NULL,
    external_user_id VARCHAR(128) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (casino_code, external_user_id)
);

CREATE TABLE provider_game_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(128) NOT NULL UNIQUE,
    casino_session_token VARCHAR(128) NOT NULL UNIQUE,

    customer_id BIGINT NOT NULL REFERENCES provider_customers(id),
    game_id BIGINT NOT NULL REFERENCES provider_games(id),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE provider_game_rounds (
    id BIGSERIAL PRIMARY KEY,
    round_id VARCHAR(128) NOT NULL UNIQUE,
    session_id BIGINT NOT NULL REFERENCES provider_game_sessions(id),
    player_id BIGINT NOT NULL REFERENCES provider_customers(id),
    game_id BIGINT NOT NULL REFERENCES provider_games(id),

    currency VARCHAR(3) NOT NULL,

    status VARCHAR(30) NOT NULL,

    total_bet_amount BIGINT NOT NULL DEFAULT 0,
    total_payout_amount BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (total_bet_amount >= 0),
    CHECK (total_payout_amount >= 0)
);

CREATE TABLE provider_bets (
    id BIGSERIAL PRIMARY KEY,
    transaction_id VARCHAR(128) NOT NULL UNIQUE,
    round_id BIGINT NOT NULL REFERENCES provider_game_rounds(id),

    bet_type VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,

    casino_balance_after BIGINT,
    status VARCHAR(30) NOT NULL,

    response_cache JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        bet_type IN (
            'BET',
            'PAYOUT',
            'ROLLBACK'
        )
    ),

    CHECK (amount >= 0)
);


CREATE INDEX idx_provider_bets_round ON provider_bets(round_id);


COMMIT;