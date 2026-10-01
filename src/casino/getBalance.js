import pool from "../db/pool.js";

export async function getBalance({ casinoSessionToken, providerSessionId }) {
    const result = await pool.query(
        `SELECT s.user_id, w.currency_code, w.playable_balance, w.redeemable_balance
        FROM casino_game_sessions s
        JOIN casino_wallets w ON s.wallet_id = w.id
        WHERE s.token = $1
        AND s.provider_session_id = $2
        AND s.is_active = TRUE`,
        [casinoSessionToken, providerSessionId]
    );

    if (result.rowCount === 0) {
        const error = new Error("Active casino session not found");
        error.status = 404;
        throw error;
    }

    const wallet = result.rows[0];
    
    return {
        userId: wallet.user_id,
        currencyCode: wallet.currency_code,
        playableBalance: wallet.playable_balance,
        redeemableBalance: wallet.redeemable_balance,
    };
}
