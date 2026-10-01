import pool from "../db/pool.js";

export async function credit({casinoSessionToken, providerSessionId, transactionId,
    roundId, relatedBetTransactionId, amount}) 
    {
        const client  = await pool.connect();
        
        // atomic unit wallet update
        try{

            await client.query('BEGIN');

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
            
            // If existing transaction is found, return the cached response
            const existingTransactionResult = await client.query(
                `SELECT transaction_type, response_cache
                FROM casino_transactions
                WHERE external_transaction_id = $1`,
                [transactionId]
            );
            
            if (existingTransactionResult.rowCount > 0) {
                const existingTransaction = existingTransactionResult.rows[0];

                if (existingTransaction.transaction_type !== "CREDIT") {
                    const error = new Error(
                        "Transaction id already used for a different transaction type"
                    );
                    error.status = 409;
                    throw error;
                }

                await client.query("ROLLBACK");

                return existingTransaction.response_cache;
            }

            /* Validation : a credit has to be linked to the corresponding bet round
               if it's not from the specific bet transaction and specific round
               then reject it
            */
            const betResult = await client.query(
                `SELECT id
                FROM casino_transactions
                WHERE external_transaction_id = $1
                AND transaction_type = 'BET'
                AND provider_round_id = $2`,
                [relatedBetTransactionId, roundId]
            );

            if (betResult.rowCount === 0) {
                const error = new Error(
                    "Related bet transaction not found for the given round"
                );
                error.status = 404;
                throw error;
            }

            //actual wallet credit operation
            const currentBalance = BigInt(wallet.playable_balance);
            const creditAmount = BigInt(amount);
            const newBalance = currentBalance + creditAmount;

            await client.query(
                `UPDATE casino_wallets
                SET playable_balance = $1,
                updated_at = CURRENT_TIMESTAMP
                WHERE id = $2`,
                [newBalance.toString(), wallet.wallet_id]
            );

            //payout ledger entry
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
                    related_external_transaction_id,
                    provider_round_id,
                    balance_after,
                    response_cache
                ) 
                    VALUES ($1, $2, 'PAYOUT', $3, $4, $5, $6, $7, $8)`,
                [
                    wallet.wallet_id,
                    wallet.session_id,
                    creditAmount.toString(),
                    transactionId,
                    relatedBetTransactionId,
                    roundId,
                    newBalance.toString(),
                    JSON.stringify(response),
                ]
            );

            console.log("Locked wallet for credit:", wallet);

            await client.query("COMMIT");

            return response;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;

        } finally {
            client.release();
        }
    }