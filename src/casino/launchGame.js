import crypto from "crypto";
import pool from "../db/pool.js";

import { postSignedJson } from "../shared/http.js";

export async function launchGame({
    userId,
    gameId,
    currencyCode,
})
{
    /* validtae the complete casino side:
    1. user
    2. wallet
    3. requested game
    4. provider
    */

    const contextResult = await pool.query(
        `SELECT 
        u.id AS user_id, 

        w.id AS wallet_id, 
        w.currency_code, 

        g.id AS game_id, 
        g.provider_game_id,

        gp.code AS provider_code,
        gp.api_endpoint

        FROM casino_users u
        JOIN casino_wallets w 
        ON u.id = w.user_id
        JOIN casino_games g 
        ON g.id = $2

        JOIN casino_game_providers gp
        ON g.provider_id = gp.id

        WHERE u.id = $1
        AND w.currency_code = $3
        AND g.is_active = TRUE
        AND gp.is_disabled = FALSE
        `,
        [userId, gameId, currencyCode]
    );

    if (contextResult.rowCount === 0) {
        const error = new Error("Valid user, wallet, game and provider combination not found");
        error.status = 404;
        throw error;
    }

    const context = contextResult.rows[0];

    const casinoSessionToken = `casino-${crypto.randomUUID()}`;

    /* 
        create the casino session as inactive first
        It only becomes active after provider confirms that it's corresponding session exists
    */

    const sessionResult = await pool.query(
        `INSERT INTO casino_game_sessions (
            token, user_id, wallet_id, game_id, is_active
        )
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING id, token`,
        [casinoSessionToken, context.user_id, context.wallet_id, context.game_id]
    );

    const casinoSession = sessionResult.rows[0];

    const providerPayload = {
        casinoSessionToken, 
        casinoCode: "JAQPOT-CASINO",
        externalUserId: String(context.user_id),
        providerGameId: context.provider_game_id,
    };

    let providerResponse;

    try {
        providerResponse = await postSignedJson({
            url: `${context.api_endpoint}/launch`,
            body: providerPayload,
            secret: process.env.PROVIDER_SECRET,
            signatureHeader: "x-provider-signature",
        });

        console.log("Provider response:", providerResponse);
        
    } catch (error) {
        console.error(
            "Provider launch request failed: ", error.responseBody || error.message
        );
        
        const launchError = new Error("Unable to initialize provider session");
        launchError.status = 502;
        throw launchError;
    }


    await pool.query(
        `UPDATE casino_game_sessions
        SET 
        provider_session_id = $1,
        is_active = TRUE
        WHERE id = $2`,
        [providerResponse.providerSessionId, casinoSession.id]
    );

    return {
        casinoSessionToken,
        providerSessionId: providerResponse.providerSessionId,
        userId: context.user_id,
        gameId: context.game_id,
        currencyCode: context.currency_code,
        
    };

}