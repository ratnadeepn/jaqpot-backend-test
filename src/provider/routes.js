import express from "express";
import { verifyProviderSignature } from "../middleware/hmac.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    service: "provider",
    status: "ok",
  });
});

router.post(
  "/auth-test",
  verifyProviderSignature,
  (req, res) => {
    res.json({
      authenticated: true,
      receiver: "provider",
      received: req.body,
    });
  }
);

export default router;