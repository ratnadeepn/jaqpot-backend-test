import { postSignedJson } from "../shared/http.js";
import pool from "../db/pool.js";

// Provider -> Casino http call
export async function simulateProviderRound({ casinoSessionToken, providerSessionId }) {
    const casinoBaseUrl = "http://localhost:3000/casino";

    //validation
    const sessionResult = await pool.query(
        `SELECT pgs.id,
        pc.player_id
        FROM provider_game_sessions pgs
        
        JOIN provider_customers pc ON pgs.customer_id = pc.id

        WHERE pgs.session_id = $1
        AND pgs.casino_session_token = $2
        AND pgs.is_active = TRUE`,
        [providerSessionId, casinoSessionToken]
    );
    if (sessionResult.rowCount === 0) {
        const error = new Error(
            "Active provider session not found"
        );
        error.status = 404;
        throw error;
    }
        

    // get balance from casino
    const balanceResponse = await postSignedJson({
        url: `${casinoBaseUrl}/getBalance`,
        body: { casinoSessionToken, providerSessionId },
        secret: process.env.CASINO_SECRET,
        signatureHeader: "x-casino-signature",

    });

    // debit from casino
    const rollbackRoundId = `SIM-${providerSessionId}-ROUND-A`;
    const rollbackBetTransactionId = `SIM-${providerSessionId}-BET-A`;
    const debitResponse = await postSignedJson({
        url: `${casinoBaseUrl}/debit`,
        body: {
            casinoSessionToken,
            providerSessionId,
            transactionId: rollbackBetTransactionId,
            roundId: rollbackRoundId,
            amount: 1000,
        },
        secret: process.env.CASINO_SECRET,
        signatureHeader: "x-casino-signature",
    });

    /* rollback from casino
    since rollback is only allowed for the same round, so simulate immediately after bet/debit
    */
    const rollbackTransactionId = `SIM-${providerSessionId}-ROLLBACK-A`;
    const rollbackResponse = await postSignedJson({
        url: `${casinoBaseUrl}/rollback`,
        body: {
            casinoSessionToken,
            providerSessionId,
            transactionId: rollbackTransactionId,
            roundId: rollbackRoundId,
            relatedBetTransactionId: rollbackBetTransactionId,
        },
        secret: process.env.CASINO_SECRET,
        signatureHeader: "x-casino-signature",
    });

    //debit for another round
    const payoutRoundId = `SIM-${providerSessionId}-ROUND-B`;
    const payoutBetTransactionId = `SIM-${providerSessionId}-BET-B`;
    const payoutBetResponse = await postSignedJson({
        url: `${casinoBaseUrl}/debit`,
        body: {
            casinoSessionToken,
            providerSessionId,
            transactionId: payoutBetTransactionId,
            roundId: payoutRoundId,
            amount: 2000,
        },
        secret: process.env.CASINO_SECRET,
        signatureHeader: "x-casino-signature",
    });

    //payout for the above round
    const payoutTransactionId = `SIM-${providerSessionId}-PAYOUT-B`;
    const payoutResponse = await postSignedJson({
        url: `${casinoBaseUrl}/credit`,
        body: {
            casinoSessionToken,
            providerSessionId,
            transactionId: payoutTransactionId,
            roundId: payoutRoundId,
            relatedBetTransactionId: payoutBetTransactionId,
            amount: 3500,
        },
        secret: process.env.CASINO_SECRET,
        signatureHeader: "x-casino-signature",
    });



    return {
        success: true,
        initialBalance: balanceResponse,
        debit: debitResponse,
        rollback: rollbackResponse,
        payoutBet: payoutBetResponse,
        payout: payoutResponse,
    };
}   
