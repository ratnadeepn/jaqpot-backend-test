import express from "express";

import { verifyCasinoSignature } from "../middleware/hmac.js";
import { launchGame } from "./launchGame.js";
import { getBalance } from "./getBalance.js";
import { debit } from "./debit.js";
import { credit } from "./credit.js";
import { rollback } from "./rollback.js";
import { simulateRound } from "./simulateRound.js";


const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    service: "casino",
    status: "ok",
  });
});


// Client -> Casino
router.post(
  "/launchGame",
  //verifyCasinoSignature,
  async (req, res) => {
    try {
      const { userId, gameId, currencyCode } = req.body;

      if (!userId || !gameId || !currencyCode) {
        return res.status(400).json(
          { error: "userId, gameId and currencyCode are required" }
        );
      }

      const result = await launchGame({
        userId,
        gameId,
        currencyCode,
      });

      return res.status(200).json({
          success: true,
        ...result,
      });
    } catch (error) {
      console.error("Casino launch failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Game launch failed",
      });
    }
  }

);


// Provider -> Casino
router.post(
  "/getBalance",
  verifyCasinoSignature,
  async (req, res) => {
    try {
      const { casinoSessionToken, providerSessionId } = req.body;

      if (!casinoSessionToken || !providerSessionId) {
        return res.status(400).json(
          { error: "casinoSessionToken and providerSessionId are required" }
        );
      }

      const result = await getBalance({
        casinoSessionToken,
        providerSessionId,
      });
      
      return res.status(200).json({
        success: true,
        ...result,
      });

    } catch (error) {
      console.error("Get balance failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Unable to retrieve balance",
      });
    }
  }
);


//provider -> casino
router.post(
  "/debit",
  verifyCasinoSignature,
  async (req, res) => {
    try {
      const { casinoSessionToken, providerSessionId, 
        transactionId, roundId, amount } = req.body;

      if (!casinoSessionToken || !providerSessionId || !transactionId || 
        !roundId || !amount) {
        return res.status(400).json(
          { error: "casinoSessionToken, providerSessionId, transactionId, roundId and amount are required" }
        );
      }

      const result = await debit({
        casinoSessionToken,
        providerSessionId,
        transactionId,
        roundId,
        amount,
      });
      
      return res.status(200).json(result);

    } catch (error) {
      console.error("Debit failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Debit transaction failed",
      }); 
    }
  }
);


//provider -> casino
router.post(
  "/credit",
  verifyCasinoSignature,
  async (req, res) => {
    try {
      const { casinoSessionToken, providerSessionId, 
        transactionId, roundId, relatedBetTransactionId, amount } = req.body;
        
      if (!casinoSessionToken || !providerSessionId || !transactionId || 
        !roundId || !relatedBetTransactionId || !amount) {
        return res.status(400).json(
          { error: "casinoSessionToken, providerSessionId, transactionId, roundId, relatedBetTransactionId and amount are required" }
        );
      }

      const result = await credit({
        casinoSessionToken,
        providerSessionId,
        transactionId,
        roundId,
        relatedBetTransactionId,
        amount,
      });
      
      return res.status(200).json(result);

    } catch (error) {
      console.error("Credit failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Credit transaction failed",
      }); 
    }
  }
);


router.post(
  "/rollback",
  verifyCasinoSignature,
  async (req, res) => {
    try {
      const { casinoSessionToken, providerSessionId, 
        transactionId, roundId, relatedBetTransactionId } = req.body;
        
      if (!casinoSessionToken || !providerSessionId || !transactionId || 
        !roundId || !relatedBetTransactionId) {
        return res.status(400).json(
          { 
            error: "casinoSessionToken, providerSessionId, transactionId, roundId and relatedBetTransactionId are required" 
          }
        );
      }

      const result = await rollback({
        casinoSessionToken,
        providerSessionId,
        transactionId,
        roundId,
        relatedBetTransactionId,
      });
      
      return res.status(200).json(result);

    } catch (error) {
      console.error("Rollback failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Rollback transaction failed",
      }); 
    }
  }
);

//testing client -> casino
router.post(
  "/simulateRound",
  async (req, res) => {
    try {
      const { userId, gameId, currencyCode } = req.body;

      if (!userId || !gameId || !currencyCode) {
        return res.status(400).json(
          { error: "userId, gameId and currencyCode are required" }
        );
      }
      
      const result = await simulateRound({
        userId,
        gameId,
        currencyCode,
      });

      return res.status(200).json(result);

    } catch (error) {
      console.error("Casino simulation failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Casino simulation failed",
      });
    }
  }
);

/*
router.post(
  "/auth-test",
  verifyCasinoSignature,
  (req, res) => {
    res.json({
      authenticated: true,
      receiver: "casino",
      received: req.body,
    });
  }
);

*/

export default router;