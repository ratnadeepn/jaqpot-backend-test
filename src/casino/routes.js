import express from "express";
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    service: "casino",
    status: "ok",
  });
});

export default router;