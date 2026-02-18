const { port } = require("./config");
const db = require("./db");
const app = require("./app");

app.listen(port, () => {
  db.prepare("SELECT 1").get();
  console.log(`Backend listening on port ${port}`);
});
