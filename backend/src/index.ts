import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { pool, initDb } from "./db";
import { AuthRequest, requireAuth, signToken } from "./auth";

const app = express();
app.use(cors());
app.use(express.json());

const isNum = (v: unknown) => typeof v === "number" && isFinite(v) && v >= 0;

// ---------- Auth ----------
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body ?? {};
  if (!username || !email || !password || password.length < 6) {
    return res.status(400).json({ error: "Preencha tudo. A senha precisa ter 6+ caracteres." });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [String(username).trim(), String(email).trim().toLowerCase(), hash]
    );
    res.status(201).json({ token: signToken(rows[0].id), user: rows[0] });
  } catch (e: any) {
    if (e.code === "23505") return res.status(409).json({ error: "Usuário ou email já cadastrado." });
    console.error(e);
    res.status(500).json({ error: "Erro ao cadastrar." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { login, password } = req.body ?? {}; // login = email ou nome de usuário
  if (!login || !password) return res.status(400).json({ error: "Informe login e senha." });
  const id = String(login).trim().toLowerCase();
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE lower(email) = $1 OR lower(username) = $1",
    [id]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Login ou senha incorretos." });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, username: user.username, email: user.email } });
});

// ---------- Produtos ----------
app.use("/api/products", requireAuth);

app.get("/api/products", async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM products WHERE user_id = $1 ORDER BY (sold_price IS NOT NULL), created_at DESC",
    [req.userId]
  );
  res.json(rows);
});

app.post("/api/products", async (req: AuthRequest, res) => {
  const { name, buy_price, target_percent } = req.body ?? {};
  if (!name || !isNum(buy_price) || !isNum(target_percent)) {
    return res.status(400).json({ error: "Informe nome, preço de compra e porcentagem." });
  }
  const { rows } = await pool.query(
    "INSERT INTO products (user_id, name, buy_price, target_percent) VALUES ($1,$2,$3,$4) RETURNING *",
    [req.userId, String(name).trim(), buy_price, target_percent]
  );
  res.status(201).json(rows[0]);
});

app.patch("/api/products/:id/sell", async (req: AuthRequest, res) => {
  const { sold_price } = req.body ?? {};
  if (!isNum(sold_price)) return res.status(400).json({ error: "Preço de venda inválido." });
  const { rows } = await pool.query(
    "UPDATE products SET sold_price = $1, sold_at = now() WHERE id = $2 AND user_id = $3 RETURNING *",
    [sold_price, req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Produto não encontrado." });
  res.json(rows[0]);
});

app.patch("/api/products/:id/unsell", async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    "UPDATE products SET sold_price = NULL, sold_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *",
    [req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Produto não encontrado." });
  res.json(rows[0]);
});

app.delete("/api/products/:id", async (req: AuthRequest, res) => {
  await pool.query("DELETE FROM products WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.status(204).end();
});

const port = Number(process.env.PORT) || 3333;
initDb()
  .then(() => app.listen(port, () => console.log(`API em http://localhost:${port}`)))
  .catch((e) => {
    console.error("Falha ao conectar no banco:", e.message);
    process.exit(1);
  });

app.patch("/api/products/:id", async (req: AuthRequest, res) => {
  const { name, buy_price, target_percent, sold_price } = req.body ?? {};
  if (!name || !isNum(buy_price) || !isNum(target_percent)) {
    return res.status(400).json({ error: "Informe nome, preço de compra e porcentagem." });
  }
  if (sold_price != null && !isNum(sold_price)) {
    return res.status(400).json({ error: "Preço de venda inválido." });
  }
  const { rows } = await pool.query(
    `UPDATE products
        SET name = $1, buy_price = $2, target_percent = $3,
            sold_price = CASE WHEN sold_price IS NOT NULL AND $4::numeric IS NOT NULL
                              THEN $4::numeric ELSE sold_price END
      WHERE id = $5 AND user_id = $6
      RETURNING *`,
    [String(name).trim(), buy_price, target_percent, sold_price ?? null, req.params.id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Produto não encontrado." });
  res.json(rows[0]);
});
