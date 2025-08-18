import express from "express";
import cors from "cors";
import {
  notFoundErr,
  globalErrHandler,
} from "../middlewares/globalErrHandler.js";

//app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes

app.get("/", (req, res) => {
  res.send("Welcome to MAZTEK Backend");
});

// Error Handler
app.use(notFoundErr);
app.use(globalErrHandler);

export default app;
