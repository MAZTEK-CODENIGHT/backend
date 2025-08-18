import dotenv from "dotenv";
import http from "http";
import app from "./app/app.js"; // Importing app directly, assuming it's the default export
import { dbConnect } from "./config/dbConnect.js"; // Importing dbConnect assuming it's a function to connect to the database

dotenv.config();
dbConnect(); // Connect to the database

const PORT = process.env.PORT || 2020;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
