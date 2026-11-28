require("dotenv").config();
const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "interlink",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dateStrings: ['DATE'],

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const connectDB = async () => {
    try {
        const connection = await db.getConnection();
        console.log("MySQL Connected Successfully");
        connection.release();
        return true;
    } catch (error) {
        console.error("MySQL Connection Warning:");
        console.error(error.message);
        // Do not call process.exit(1) so web server doesn't 503 crash on boot
        return false;
    }
};

module.exports = db;
module.exports.connectDB = connectDB;