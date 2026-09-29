import express from "express";

import casinoRoutes from "./casino/routes.js";
import providerRoutes from "./provider/routes.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({
        service: "jaqpot-backend-test-application",
        status: "ok",
    });
    });

    
app.use("/casino", casinoRoutes);
app.use("/provider", providerRoutes);

export default app;