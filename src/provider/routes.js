import express from "express";

import { verifyProviderSignature } from "../middleware/hmac.js";
import { launchProviderSession } from "./launch.js";
import { simulateProviderRound } from "./simulate.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    service: "provider",
    status: "ok",
  });
});

// Casino -> Provider
router.post(
  "/launch",
  verifyProviderSignature,
  async (req, res) => {
    try {
      const { 
        casinoSessionToken, casinoCode, externalUserId, providerGameId 
      } = req.body;

      if (!casinoSessionToken || !casinoCode || !externalUserId || !providerGameId) {
        return res.status(400).json(
          { error: "Missing required launch fields" }
        );
      }

      const result = await launchProviderSession({
        casinoSessionToken,
        casinoCode,
        externalUserId,
        providerGameId,
      });

      return res.status(200).json({
          success: true,
        ...result,
      });
    } catch (error) {
      console.error("Provider launch failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Provider launch failed",
      });
    }
  }
);


router.post(
  "/simulate",
  verifyProviderSignature,
  async (req, res) => {
    try {
      const { casinoSessionToken, providerSessionId } = req.body;
      
      if (!casinoSessionToken || !providerSessionId) {
        return res.status(400).json(
          { error: "Missing required casinoSessionToken and providerSessionId fields to simulate" }
        );
      }

      const result = await simulateProviderRound({
        casinoSessionToken,
        providerSessionId,
      });
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("Provider simulation failed: ", error);
      return res.status(error.status || 500).json({
        error: error.message || "Provider simulation failed",
      });
    }
  }
);

export default router;