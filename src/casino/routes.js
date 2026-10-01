import express from "express";

import { verifyCasinoSignature } from "../middleware/hmac.js";
import { launchGame } from "./launchGame.js";
import { getBalance } from "./getBalance.js";

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

export default router;