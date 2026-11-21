const express = require("express");
const { spawn } = require("child_process");
const readline = require("readline");

const app = express();
app.use(express.json({ limit: "4kb" }));

const API_KEY = process.env.API_KEY;

const settings = {
    low: 300,
    medium: 1000,
    high: 2500
};

app.get("/", (req, res) => {
    res.json({ status: "online", engine: "Stockfish" });
});

app.post("/api/analyze", (req, res) => {
    if (!API_KEY || req.headers["x-api-key"] !== API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { fen, strength = "medium" } = req.body || {};

    if (typeof fen !== "string" || fen.length > 200) {
        return res.status(400).json({ error: "Invalid FEN" });
    }

    const time = settings[String(strength).toLowerCase()];

    if (!time) {
        return res.status(400).json({ error: "Invalid strength" });
    }

    const engine = spawn("stockfish", [], {
        stdio: ["pipe", "pipe", "pipe"]
    });

    let stage = "uci";
    let finished = false;

    const timeout = setTimeout(() => {
        finish(504, { error: "Engine timed out" });
    }, time + 10000);

    function finish(status, data) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        engine.kill();
        if (!res.headersSent) res.status(status).json(data);
    }

    engine.on("error", () => {
        finish(500, { error: "Could not start Stockfish" });
    });

    const output = readline.createInterface({
        input: engine.stdout
    });

    output.on("line", line => {
        line = line.trim();

        if (stage === "uci" && line === "uciok") {
            stage = "ready";
            engine.stdin.write("isready\n");
        } else if (stage === "ready" && line === "readyok") {
            stage = "search";
            engine.stdin.write(`position fen ${fen}\n`);
            engine.stdin.write(`go movetime ${time}\n`);
        } else if (stage === "search" && line.startsWith("bestmove ")) {
            const match = line.match(/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);

            if (!match) {
                finish(422, { error: "No legal move available", output: line });
                return;
            }

            finish(200, {
                bestmove: match[1],
                strength,
                engine: "Stockfish"
            });
        }
    });

    engine.on("exit", () => {
        if (!finished) {
            finish(500, { error: "Stockfish exited unexpectedly" });
        }
    });

    engine.stdin.write("uci\n");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Stockfish API listening on ${PORT}`);
});
