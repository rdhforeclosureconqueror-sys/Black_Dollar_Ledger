import express from "express";
import cors from "cors";
import { ledgerRoutes } from "./ledgerRoutes.js";
import { pagtRoutes } from "./pagtRoutes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_, res) => res.json({ ok: true }));

app.use("/ledger", ledgerRoutes);
app.use("/pagt", pagtRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API running on", port));
