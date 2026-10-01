import crypto from 'crypto';
import pool from '../db/pool.js';

export async function launchProviderSession({
    casinoSessionToken,
    casinoCode,
    externalUserId,
    providerGameId,

})
{
    /* in case if casino retries the same exact launch then  we
    return the already created provider session instead of creating a new one 
    */
    const existingSessionResult = await pool.query(
        `SELECT pgs.session_id, pc.player_id, pg.game_id
        FROM provider_game_sessions pgs
        JOIN provider_customers pc
        ON pc.id = pgs.customer_id
        JOIN provider_games pg
        ON pg.id = pgs.game_id
        WHERE pgs.casino_session_token = $1`,
        [casinoSessionToken]
    );

    if (existingSessionResult.rowCount > 0) {
        const existing = existingSessionResult.rows[0];
        return {
            providerSessionId: existing.session_id,
            playerId: existing.player_id,
            gameId: existing.game_id,
            reused: true,
        };
    }

    /* otherwise 
        1. validate that this game exists and is active on the provider side 
    */
    const gameResult = await pool.query(
        `SELECT id, game_id
        FROM provider_games
        WHERE game_id = $1
        AND is_active = TRUE`,
        [providerGameId]
    );

    if (gameResult.rowCount === 0) {
        const error = new Error("Provider game not found or inactive");
        error.status = 404;
        throw error;
    }

    const providerGame = gameResult.rows[0];


    /* 
        2. get the provider side customer mapping 
    */
    let customerResult = await pool.query(
        `SELECT id, player_id
        FROM provider_customers
        WHERE casino_code = $1
        AND external_user_id = $2`,
        [casinoCode, externalUserId]
    );


    /*  providers create external player mapping when they first see 
        a new player 
    */
    if (customerResult.rowCount === 0) {
        const playerId = `player-${crypto.randomUUID()}`;

        customerResult = await pool.query(
            `INSERT INTO provider_customers (
                player_id,
                casino_code,
                external_user_id
            )
            VALUES ($1, $2, $3)
            RETURNING id, player_id`,
            [playerId, casinoCode, externalUserId]
        );
    }

    const customer = customerResult.rows[0];


    /* 3. create a new provider game session
            and return the provider session id to the casino 
    */
    const providerSessionId = `provider-${crypto.randomUUID()}`;

    await pool.query(
        `INSERT INTO provider_game_sessions (
            session_id,
            casino_session_token,
            customer_id,
            game_id,
            is_active
        )
        VALUES ($1, $2, $3, $4, TRUE)`,
        [
            providerSessionId,
            casinoSessionToken,
            customer.id,
            providerGame.id
        ]
    );

    return {
        providerSessionId,
        playerId: customer.player_id,
        gameId: providerGame.game_id,
        reused: false,
    };

}


