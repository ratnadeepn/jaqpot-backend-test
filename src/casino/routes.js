import express from "express";
import { verifyCasinoSignature } from "../middleware/hmac.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    service: "casino",
    status: "ok",
  });
});

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