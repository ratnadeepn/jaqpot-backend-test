import { postSignedJson } from "../shared/http.js";
import pool from "../db/pool.js";

import { createOrGetRound, recordProviderTransaction,
    addRoundBetAmount, markRoundRolledBack, addRoundPayoutAmount
 } from "./records.js";


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

    //before actual debit, record/creates durable provider round A - only one
    const roundA = await createOrGetRound({
        providerSessionId,
        roundId: rollbackRoundId
    });
    

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

    //record bet A and casino's response
    const recordedBetA = await recordProviderTransaction({
        transactionId: rollbackBetTransactionId,
        roundDbId: roundA.id,
        type: 'BET',
        amount: 1000,
        casinoResponse: debitResponse
    });

    if (recordedBetA.inserted){
        await addRoundBetAmount({
            roundDbId: roundA.id,
            amount: 1000
        });
    }


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

    //record this rollback at provider end
    const recordedRollbackA = await recordProviderTransaction({
        transactionId: rollbackTransactionId,
        roundDbId: roundA.id,
        type: 'ROLLBACK',
        amount: 1000,
        casinoResponse: rollbackResponse
    });

    if (recordedRollbackA.inserted){
        await markRoundRolledBack({
            roundDbId: roundA.id
        });
    }
    

    //debit for another round
    const payoutRoundId = `SIM-${providerSessionId}-ROUND-B`;
    const payoutBetTransactionId = `SIM-${providerSessionId}-BET-B`;

    //record the round details for round B
    const roundB = await createOrGetRound({
        providerSessionId,
        roundId: payoutRoundId,
    });

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

    //record the bet reponse
    const recordedBetB = await recordProviderTransaction({
        transactionId: payoutBetTransactionId,
        roundDbId: roundB.id,
        type: 'BET',
        amount: 2000,
        casinoResponse: payoutBetResponse
    });

    if (recordedBetB.inserted){
        await addRoundBetAmount({
            roundDbId: roundB.id,
            amount: 2000
        });
    }

    //payout for the above round B
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

    //record payout of round B transaction
    const recordedPayoutB = await recordProviderTransaction({
        transactionId: payoutTransactionId,
        roundDbId: roundB.id,
        type: 'PAYOUT',
        amount: 3500,
        casinoResponse: payoutResponse
    });

    if (recordedPayoutB.inserted){
        await addRoundPayoutAmount({
            roundDbId: roundB.id,
            amount: 3500
        });
    }



    return {
        success: true,
        initialBalance: balanceResponse,
        debit: debitResponse,
        rollback: rollbackResponse,
        payoutBet: payoutBetResponse,
        payout: payoutResponse,
    };
}   
