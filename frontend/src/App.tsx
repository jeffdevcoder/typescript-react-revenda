import { FormEvent, useEffect, useState } from "react";
import { api, Product, User } from "./api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const toNum = (s: string) => parseFloat(s.replace(",", "."));

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

const Sun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const Moon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export default function App() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw && localStorage.getItem("token") ? JSON.parse(raw) : null;
  });

  const enter = (token: string, u: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };
  const leave = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand-wrap">
          <img
            src={theme.dark ? "/icone-dark.png" : "/icone-light.png"}
            alt=""
            className="brand-icon"
          />
          <strong className="brand">Revenda</strong>
        </div>
        <div className="actions">
          {user && <span className="muted">{user.username}</span>}
          <button
            className="ghost icon-btn"
            onClick={theme.toggle}
            aria-label={theme.dark ? "Ativar modo claro" : "Ativar modo noturno"}
            title={theme.dark ? "Modo claro" : "Modo noturno"}
          >
            {theme.dark ? <Sun /> : <Moon />}
          </button>
          {user && <button className="ghost" onClick={leave}>Sair</button>}
        </div>
      </header>
      {user ? <div className="page"><Dashboard onUnauthorized={leave} /></div> : <AuthScreen onDone={enter} />}
    </div>
  );
}

function AuthScreen({ onDone }: { onDone: (t: string, u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ username: "", email: "", password: "", confirm: "", login: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function switchMode(next: "login" | "register") {
    setF({ username: "", email: "", password: "", confirm: "", login: "" });
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        const r = await api.login({ login: f.login, password: f.password });
        onDone(r.token, r.user);
      } else {
        if (f.password !== f.confirm) {
          setError("As senhas não são iguais.");
          return;
        }
        await api.register({ username: f.username, email: f.email, password: f.password });
        // não entra direto: volta para o login com o email já preenchido
        setF({ username: "", email: "", password: "", confirm: "", login: f.email });
        setMode("login");
        setNotice("Conta criada. Entre para continuar.");
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form key={mode} className="panel auth" onSubmit={submit}>
      <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      {mode === "register" && (
        <>
          <label>Nome de usuário<input value={f.username} onChange={set("username")} autoComplete="off" required /></label>
          <label>Email<input type="email" value={f.email} onChange={set("email")} autoComplete="off" required /></label>
        </>
      )}
      {mode === "login" && <label>Email ou usuário<input value={f.login} onChange={set("login")} autoComplete="off" required /></label>}
      <label>Senha<input type="password" value={f.password} onChange={set("password")} minLength={6} autoComplete="off" required /></label>
      {mode === "register" && (
        <label>Confirmar senha<input type="password" value={f.confirm} onChange={set("confirm")} minLength={6} autoComplete="off" required /></label>
      )}
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <button className="solid">{mode === "login" ? "Entrar" : "Criar conta"}</button>
      <button type="button" className="link" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Ainda não tenho conta" : "Já tenho conta"}
      </button>
    </form>
  );
}

function Dashboard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", buy: "", percent: "" });
  const [error, setError] = useState("");

  const load = () => api.list().then(setProducts).catch((e) => {
    if (/Sessão/.test(e.message)) onUnauthorized(); else setError(e.message);
  });
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.create({ name: form.name, buy_price: toNum(form.buy), target_percent: toNum(form.percent) });
      setForm({ name: "", buy: "", percent: "" });
      load();
    } catch (err) { setError((err as Error).message); }
  }

  const sold = products.filter((p) => p.sold_price !== null);
  const profit = sold.reduce((s, p) => s + (p.sold_price! - p.buy_price), 0);

  return (
    <main>
      <form className="panel add" onSubmit={add}>
        <label className="grow">Produto<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Comprei por (R$)<input inputMode="decimal" value={form.buy} onChange={(e) => setForm({ ...form, buy: e.target.value })} required /></label>
        <label>Quero ganhar (%)<input inputMode="decimal" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} required /></label>
        <button className="solid">Adicionar</button>
      </form>
      {error && <p className="error">{error}</p>}

      <p className="summary muted">
        {products.length - sold.length} à venda · {sold.length} vendidos · lucro total {money(profit)}
      </p>

      {products.length === 0 && <p className="muted empty">Nenhum produto ainda. Cadastre o primeiro acima.</p>}
      <ul className="list">
        {products.map((p) => <Item key={p.id} p={p} reload={load} />)}
      </ul>
    </main>
  );
}

function Item({ p, reload }: { p: Product; reload: () => void }) {
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState(false);
  const [ed, setEd] = useState({ name: "", buy: "", percent: "", sold: "" });
  const [error, setError] = useState("");
  const isSold = p.sold_price !== null;
  const target = p.buy_price * (1 + p.target_percent / 100);
  const realPct = isSold ? ((p.sold_price! - p.buy_price) / p.buy_price) * 100 : 0;
  const preview = toNum(price);
  const previewPct = isFinite(preview) ? ((preview - p.buy_price) / p.buy_price) * 100 : null;

  const fmt = (n: number) => String(n).replace(".", ",");

  const startEdit = () => {
    setEd({
      name: p.name,
      buy: fmt(p.buy_price),
      percent: fmt(p.target_percent),
      sold: isSold ? fmt(p.sold_price!) : "",
    });
    setError("");
    setEditing(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.update(p.id, {
        name: ed.name,
        buy_price: toNum(ed.buy),
        target_percent: toNum(ed.percent),
        sold_price: isSold ? toNum(ed.sold) : undefined,
      });
      setEditing(false);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const sell = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFinite(preview)) return;
    await api.sell(p.id, preview);
    reload();
  };

  if (editing) {
    return (
      <li className={`item ${isSold ? "sold" : "unsold"}`}>
        <form className="edit" onSubmit={save}>
          <label className="grow">Produto<input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} required /></label>
          <label>Comprei por (R$)<input inputMode="decimal" value={ed.buy} onChange={(e) => setEd({ ...ed, buy: e.target.value })} required /></label>
          <label>Quero ganhar (%)<input inputMode="decimal" value={ed.percent} onChange={(e) => setEd({ ...ed, percent: e.target.value })} required /></label>
          {isSold && (
            <label>Vendi por (R$)<input inputMode="decimal" value={ed.sold} onChange={(e) => setEd({ ...ed, sold: e.target.value })} required /></label>
          )}
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button className="solid">Salvar</button>
            <button type="button" className="ghost" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`item ${isSold ? "sold" : "unsold"}`}>
      <div className="row">
        <h3>{p.name}</h3>
        <span className="status">{isSold ? "Vendido" : "À venda"}</span>
      </div>
      <p className="muted">Comprei por {money(p.buy_price)} · meta {pct(p.target_percent)} = vender a {money(target)}</p>

      {isSold ? (
        <div className="row">
          <p>
            Vendi por <b>{money(p.sold_price!)}</b> · lucro {money(p.sold_price! - p.buy_price)} (<b>{pct(realPct)}</b>)
          </p>
          <div className="actions">
            <button className="ghost" onClick={startEdit}>Editar</button>
            <button className="ghost" onClick={async () => { await api.unsell(p.id); reload(); }}>Desfazer venda</button>
            <button className="ghost" onClick={async () => { await api.remove(p.id); reload(); }}>Excluir</button>
          </div>
        </div>
      ) : (
        <form className="row sell" onSubmit={sell}>
          <input placeholder="Preço que vendi (R$)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <span className="muted preview">{previewPct !== null && `lucro ${pct(previewPct)}`}</span>
          <button className="solid" disabled={!isFinite(preview)}>Marcar como vendido</button>
          <button type="button" className="ghost" onClick={startEdit}>Editar</button>
          <button type="button" className="ghost" onClick={async () => { await api.remove(p.id); reload(); }}>Excluir</button>
        </form>
      )}
    </li>
  );
}