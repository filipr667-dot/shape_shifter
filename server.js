console.log("STARTING SERVER...");

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("It works!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("RUNNING ON PORT", PORT);
});