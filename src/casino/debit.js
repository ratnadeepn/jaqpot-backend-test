import pool from "../db/pool.js";

export async function debit({casinoSessionToken, providerSessionId, 
    transactionId, roundId, amount}) {

        const client  = await pool.connect();

        //the wallet update and ledger insert must behave as one atomic unit

        try {
            await client.query('BEGIN');
            
            // lock the wallet row before making any changes.
            const walletResult = await client.query(
                `SELECT 
                s.id as session_id,
                w.id as wallet_id,
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
                const error = new Error("Active casino session not found");
                error.status = 404;
                throw error;
            }
            
            const wallet = walletResult.rows[0];

            console.log("Locked wallet for debit:", wallet);
            
            // If retried an existing transaction then return from db cache
            const existingTransactionResult = await client.query(
                `SELECT transaction_type, response_cache
                FROM casino_transactions
                WHERE external_transaction_id = $1`,
                [transactionId]
            );

            if (existingTransactionResult.rowCount > 0) {
                const existingTransaction = existingTransactionResult.rows[0];
                console.log("Returning cached response of existing transaction:", existingTransaction);

                if (existingTransaction.transaction_type !== "BET") {
                    const error = new Error(
                        "Transaction id already used for a different transaction type"
                    );
                    error.status = 409;
                    throw error;
                }
                
                await client.query("ROLLBACK");

                return existingTransaction.response_cache;
            }

            //Check if wallet balance is sufficient for debit
            const currentBalance = BigInt(wallet.playable_balance);
            const debitAmount = BigInt(amount);

            if (currentBalance < debitAmount) {
                const error = new Error("Insufficient balance for debit");
                error.status = 422;
                throw error;
            }

            //Actual wallet deduction now
            const newBalance = currentBalance - debitAmount;
            await client.query(
                `UPDATE casino_wallets
                SET playable_balance = $1,
                updated_at = CURRENT_TIMESTAMP
                WHERE id = $2`,
                [newBalance.toString(), wallet.wallet_id]
            );

            //Next we record the debit in transaction ledger
            const response = {
                success: true,
                transactionId,
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
                    provider_round_id,
                    balance_after,
                    response_cache
            ) VALUES ($1, $2, 'BET', $3, $4, $5, $6, $7)`,
            [wallet.wallet_id, wallet.session_id, debitAmount.toString(), 
                transactionId, roundId, newBalance.toString(), JSON.stringify(response)]
            );

            await client.query("COMMIT");

            return response;

                
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("Debit transaction failed: ", error);
            throw error;

        } finally {
            client.release();
        }
}