import pool from "../db/pool.js";

/*
Rollback rules:
1. only bets can be rolled back
2. payouts cannot be rolled back
3. no rollback is allowed if that round already has a payout
4. if the original bet is missing then create a tombstone and return with no balance chnage
5. rollback must be idempotent
*/

export async function rollback({ casinoSessionToken, providerSessionId, transactionId, 
    roundId, relatedBetTransactionId }) {

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const walletResult = await client.query(
                `SELECT s.id AS session_id, 
                w.id AS wallet_id,
                w.currency_code,
                w.playable_balance

                FROM casino_game_sessions s
                
                JOIN casino_wallets w ON s.wallet_id = w.id

                WHERE s.token = $1 
                AND s.provider_session_id = $2
                AND s.is_active = TRUE
                
                FOR UPDATE OF w`,
                [casinoSessionToken, providerSessionId]
            );
            
            if (walletResult.rowCount === 0) {
                const error = new Error(
                    "Active session not found"
                );
                error.status = 404;
                throw error;
            }

            const wallet = walletResult.rows[0];
            
            /* if there is a rollback for the transaction id then return fromm cache
            -> one transaction id can only ever identify one transaction 
            across debit/credit/rollback
            */
            const existingRollbackResult = await client.query(
                `SELECT transaction_type, response_cache FROM casino_transactions
                WHERE external_transaction_id = $1`,
                [transactionId]
            );

            if (existingRollbackResult.rowCount > 0) {
                const existingRollback = existingRollbackResult.rows[0];

                if (existingTransaction.transaction_type !== "ROLLBACK") {
                    const error = new Error(
                        "Transaction id already used for a different transaction type"
                    );
                    error.status = 409;
                    throw error;
                }

                await client.query("ROLLBACK");

                return existingRollback.response_cache;
            }

            //validation: no bet rollback after payout 
            const payoutResult = await client.query(
                `SELECT id FROM casino_transactions
                WHERE provider_round_id = $1 
                AND transaction_type = 'PAYOUT'
                LIMIT 1`,
                [roundId]
            );

            if (payoutResult.rowCount > 0) {
                const error = new Error(
                    "Rollback not allowed after payout"
                );
                error.status = 409;
                throw error;
            }

            /* find the original bet or create a tombstone
            only reversal of bets belonging to the same round is allowed
            */
            const originalBetResult = await client.query(
                `SELECT id, amount, provider_round_id
                FROM casino_transactions
                WHERE external_transaction_id = $1
                AND transaction_type = 'BET'
                AND provider_round_id = $2`,
                [relatedBetTransactionId, roundId]
            );
            
            //tombstone
            if (originalBetResult.rowCount === 0) {
                const response = {
                    success: true,
                    transactionId,
                    rolledBack: false,
                    tombstone: true,
                    balance: wallet.playable_balance,
                    currencyCode: wallet.currency_code,
                };

                await client.query(
                    `INSERT INTO casino_transactions (
                        wallet_id,
                        session_id,
                        transaction_type,
                        amount,
                        external_transaction_id,
                        related_external_transaction_id,
                        provider_round_id,
                        balance_after,
                        is_tombstone,
                        response_cache
                    ) 
                    VALUES ($1, $2, 'ROLLBACK', 0, $3, $4, $5, $6, TRUE, $7)`,
                    [ 
                        wallet.wallet_id, 
                        wallet.session_id, 
                        transactionId,
                        relatedBetTransactionId,
                        roundId,
                        wallet.playable_balance,
                        JSON.stringify(response)
                    ]
                );
                
                await client.query("COMMIT");

                return response;
            }

            //actual balance restrore
            const originalBet = originalBetResult.rows[0];
            const currentBalance = BigInt(wallet.playable_balance);
            const rollbackAmount = BigInt(originalBet.amount);
            const newBalance = currentBalance + rollbackAmount;

            await client.query(
                `UPDATE casino_wallets
                SET 
                playable_balance = $1,
                updated_at = CURRENT_TIMESTAMP
                WHERE id = $2`,
                [newBalance.toString(), wallet.wallet_id]
            );

            //ledger entry for rollback
            const response = {
                success: true,
                transactionId,
                rolledBack: true,
                tombstone: false,
                balance: newBalance.toString(),
                currencyCode: wallet.currency_code,
            };

            await client.query(
                `INSERT INTO casino_transactions (
                    wallet_id,
                    session_id,
                    transaction_type,
                    amount,
                    external_transaction_id,
                    related_external_transaction_id,
                    provider_round_id,
                    balance_after,
                    is_tombstone,
                    response_cache
                ) 
                VALUES ($1, $2, 'ROLLBACK', $3, $4, $5, $6, $7, FALSE,$8)`,
                [
                    wallet.wallet_id,
                    wallet.session_id,
                    rollbackAmount.toString(),
                    transactionId,
                    relatedBetTransactionId,
                    roundId,
                    newBalance.toString(),
                    JSON.stringify(response),
                ]
            );

            console.log("Locked wallet for rollback: ", wallet);

            await client.query("COMMIT");

            return response;

        } catch (error) {
            await client.query("ROLLBACK");
            throw error;

        } finally {
            client.release();
        }

}