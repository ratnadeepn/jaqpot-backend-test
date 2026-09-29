import "dotenv/config";

import app from "./app.js";
import pool from "./db/pool.js";

const port = process.env.PORT || 3000;

async function startServer() {
    try {
        await pool.query("SELECT 1");
        console.log("PostgreSQL connected");

        app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
        });

    } catch (error) {
        console.error("Failed to start server: ", error);
        process.exit(1);
    }
}

startServer();