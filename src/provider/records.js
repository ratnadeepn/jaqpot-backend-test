import pool from "../db/pool.js";

export async function createOrGetRound({
    providerSessionId, roundId
}){
    const result = await pool.query(
        `INSERT INTO provider_game_rounds (
            round_id, session_id, player_id, game_id,
            currency, status, total_bet_amount, total_payout_amount
        )
            SELECT $1, pgs.id, pgs.customer_id, pgs.game_id, 
            'USD', 'OPEN', 0, 0

            FROM provider_game_sessions pgs
            WHERE pgs.session_id = $2
            ON CONFLICT (round_id)
            DO UPDATE SET round_id = EXCLUDED.round_id

            RETURNING id`,
            [roundId, providerSessionId]
    );

    if (result.rowCount === 0){
        const error = new Error("Provider session not found while creating round");
        error.status = 404
        throw error
        

    }
    return result.rows[0];
}

export async function recordProviderTransaction({
    transactionId, roundDbId, type, amount, casinoResponse
}){
    const result = await pool.query(
        `
            INSERT INTO provider_bets (
            transaction_id, round_id, bet_type, amount, 
            casino_balance_after, status, response_cache
            )
            VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6)

            ON CONFLICT (transaction_id)
            DO NOTHING

            RETURNING id`,
            [transactionId, roundDbId, type, amount,
                casinoResponse.balance, JSON.stringify(casinoResponse)
            ]
    );

    return {
        inserted: result.rowCount > 0,
        id: result.rows[0]?.id ?? null
    };
}

export async function addRoundBetAmount({
    roundDbId, amount
}) {
    await pool.query(
        ` UPDATE provider_game_rounds
            SET total_bet_amount = total_bet_amount + $1
            WHERE id = $2`,
            [amount, roundDbId]
    );

}

export async function addRoundPayoutAmount({
    roundDbId, amount
}){
    await pool.query(
        `UPDATE provider_game_rounds
        SET
            total_payout_amount = total_payout_amount + $1,
            status = 'COMPLETED'
        WHERE id = $2`,
        [amount, roundDbId]
    );
}

export async function markRoundRolledBack({
    roundDbId
}){
    await pool.query(
        `
        UPDATE provider_game_rounds
        SET status = 'ROLLED_BACK'
        WHERE id = $1
        `,
        [roundDbId]
    );
}