BEGIN;

-- demo casino user

INSERT INTO casino_users (
    username,
    email
)
VALUES (
    'demo_player',
    'demo@example.com'
)
ON CONFLICT DO NOTHING;


-- demo wallet
-- 100000 units = 1000.00 dollars

INSERT INTO casino_wallets (
    user_id,
    currency_code,
    playable_balance,
    redeemable_balance
)
SELECT
    id,
    'USD',
    100000,
    0
FROM casino_users
WHERE username = 'demo_player'
ON CONFLICT DO NOTHING;


-- provider

INSERT INTO casino_game_providers (
    code,
    name,
    api_endpoint,
    secret_key
)
VALUES (
    'JAQPOT',
    'Jaqpot Games',
    'http://localhost:3000/provider',
    'provider-development-secret'
)
ON CONFLICT DO NOTHING;


-- casino's mapping of provider game

INSERT INTO casino_games (
    provider_id,
    provider_game_id,
    is_active,
    min_bet,
    max_bet
)
SELECT
    id,
    'demo-slot',
    TRUE,
    100,
    10000
FROM casino_game_providers
WHERE code = 'JAQPOT'
ON CONFLICT DO NOTHING;


-- same game at provider end

INSERT INTO provider_games (
    game_id,
    is_active,
    min_bet,
    max_bet
)
VALUES (
    'demo-slot',
    TRUE,
    100,
    10000
)
ON CONFLICT DO NOTHING;


-- Provider end representation of Casino player

INSERT INTO provider_customers (
    player_id,
    casino_code,
    external_user_id
)
SELECT
    'player-demo-1',
    'JAQPOT-CASINO',
    id::TEXT
FROM casino_users
WHERE username = 'demo_player'
ON CONFLICT DO NOTHING;


COMMIT;