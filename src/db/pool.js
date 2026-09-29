/*
Note for self: pool is the Node's reusuable collection of the postgres
conections. We can make a client reserve a connection and execute queries.
*/

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;