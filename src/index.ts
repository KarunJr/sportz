import "dotenv/config"
import express from "express";
import { matchRouter } from "./routes/matches.js";
const app = express();
const PORT = 3000;
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.use('/matches', matchRouter)

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
