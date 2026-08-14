import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ShoppingCart, Home, Car, Music2, Stethoscope, Repeat,
  MoreHorizontal, Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp,
  TrendingDown, PiggyBank, Pencil, Check, Landmark, Wallet, Target,
  LayoutGrid, BarChart3, KeyRound, Copy, Receipt, X,
} from "lucide-react";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine, Cell,
} from "recharts";
import { storage, getSyncKey, setSyncKey } from "./storage";

const CATEGORIES = [
  { key: "alimentation", label: "Alimentation", color: "#4F7859", icon: ShoppingCart, defaultBudget: 350,
    subcategories: ["Courses", "Fast Food", "Autre Alimentation"] },
  { key: "logement", label: "Logement", color: "#1F3A3E", icon: Home, defaultBudget: 600,
    subcategories: ["Loyer", "Travaux", "Autres"] },
  { key: "transport", label: "Transport", color: "#B8901F", icon: Car, defaultBudget: 150,
    subcategories: ["Essence", "Assurance Auto", "Crédit Voiture", "Autre Transport"] },
  { key: "loisirs", label: "Loisirs", color: "#C05A3D", icon: Music2, defaultBudget: 120,
    subcategories: ["Bar", "Sport", "Shopping", "Voyage", "Plaisirs divers"] },
  { key: "sante", label: "Santé", color: "#8A5A44", icon: Stethoscope, defaultBudget: 60,
    subcategories: [] },
  { key: "ndf", label: "NDF", color: "#6B4D6B", icon: Receipt, defaultBudget: 100,
    subcategories: ["Logement", "Repas", "Autoroute"] },
  { key: "abonnements", label: "Abonnements", color: "#4A6670", icon: Repeat, defaultBudget: 50,
    subcategories: [] },
  { key: "autres", label: "Autres", color: "#7E7E74", icon: MoreHorizontal, defaultBudget: 70,
    subcategories: [] },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const DEFAULT_CAT_BUDGETS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultBudget]));
const FALLBACK_CAT = { key: "autres", label: "Autres (ancienne catégorie)", color: "#7E7E74", icon: MoreHorizontal, subcategories: [] };

const INCOME_CATEGORIES = [
  { key: "salaires", label: "Salaires", color: "#4F7859", icon: Landmark },
  { key: "variable", label: "Variable", color: "#1F3A3E", icon: TrendingUp },
  { key: "ndf", label: "NDF", color: "#B8901F", icon: Receipt },
  { key: "autres", label: "Autres", color: "#6B4D6B", icon: Wallet },
];
const INC_MAP = Object.fromEntries(INCOME_CATEGORIES.map((c) => [c.key, c]));
const FALLBACK_INC = { key: "autres", label: "Autres (ancienne catégorie)", color: "#6B4D6B", icon: Wallet };

const fmt = (n) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    Number.isFinite(n) ? n : 0
  );
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d) =>
  d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
const dayLabel = (isoDate) => {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).replace(/^./, (c) => c.toUpperCase());
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const round2 = (n) => Math.round(n * 100) / 100;
const firstSubcat = (catKey) => {
  const def = CAT_MAP[catKey];
  return def && def.subcategories && def.subcategories.length ? def.subcategories[0] : "";
};

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [catBudgets, setCatBudgets] = useState(DEFAULT_CAT_BUDGETS);
  const [savingsGoal, setSavingsGoal] = useState(300);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [tab, setTab] = useState("overview");

  const [entryType, setEntryType] = useState("expense");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("alimentation");
  const [subcat, setSubcat] = useState(firstSubcat("alimentation"));
  const [incCat, setIncCat] = useState("salaires");
  const [date, setDate] = useState(todayISO());
  const [editingEntry, setEditingEntry] = useState(null); // { id, type } | null

  const [syncKey] = useState(() => getSyncKey());
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(syncKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };
  const applyKey = () => {
    if (!keyDraft.trim()) return;
    setSyncKey(keyDraft);
    window.location.reload();
  };

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(savingsGoal));
  const [editingCat, setEditingCat] = useState(null);
  const [catDraft, setCatDraft] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("expenses");
        if (res && res.value) setExpenses(JSON.parse(res.value));
      } catch (e) {}
      try {
        const res = await storage.get("incomes");
        if (res && res.value) setIncomes(JSON.parse(res.value));
      } catch (e) {}
      try {
        const res = await storage.get("settings");
        if (res && res.value) {
          const s = JSON.parse(res.value);
          if (s.catBudgets) setCatBudgets({ ...DEFAULT_CAT_BUDGETS, ...s.catBudgets });
          if (typeof s.savingsGoal === "number") {
            setSavingsGoal(s.savingsGoal);
            setGoalDraft(String(s.savingsGoal));
          }
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await storage.set("expenses", JSON.stringify(expenses));
        await storage.set("incomes", JSON.stringify(incomes));
        await storage.set("settings", JSON.stringify({ catBudgets, savingsGoal }));
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [expenses, incomes, catBudgets, savingsGoal, loaded]);

  const currentKey = monthKey(current);
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date.slice(0, 7) === currentKey),
    [expenses, currentKey]
  );
  const monthIncomes = useMemo(
    () => incomes.filter((e) => e.date.slice(0, 7) === currentKey),
    [incomes, currentKey]
  );
  const totalExpense = useMemo(() => monthExpenses.reduce((s, e) => s + e.amount, 0), [monthExpenses]);
  const totalIncome = useMemo(() => monthIncomes.reduce((s, e) => s + e.amount, 0), [monthIncomes]);
  const totalBudget = useMemo(() => Object.values(catBudgets).reduce((s, v) => s + (Number(v) || 0), 0), [catBudgets]);
  const remaining = totalBudget - totalExpense;
  const realSavings = totalIncome - totalExpense;
  const savingsDelta = realSavings - savingsGoal;
  const savingsRate = totalIncome > 0 ? (realSavings / totalIncome) * 100 : null;

  const prevKey = useMemo(() => {
    const d = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    return monthKey(d);
  }, [current]);
  const prevExpense = useMemo(
    () => expenses.filter((e) => e.date.slice(0, 7) === prevKey).reduce((s, e) => s + e.amount, 0),
    [expenses, prevKey]
  );
  const delta = prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : null;

  const catTotals = useMemo(() => {
    const map = {};
    monthExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return CATEGORIES.map((c) => ({
      key: c.key,
      value: map[c.key] || 0,
      budget: Number(catBudgets[c.key]) || 0,
    })).sort((a, b) => b.value - a.value);
  }, [monthExpenses, catBudgets]);

  const monthsRange = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      arr.push({ key: monthKey(d), label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "") });
    }
    return arr;
  }, [current]);

  const statsData = useMemo(
    () =>
      monthsRange.map(({ key, label }) => {
        const inc = round2(incomes.filter((e) => e.date.slice(0, 7) === key).reduce((s, e) => s + e.amount, 0));
        const exp = round2(expenses.filter((e) => e.date.slice(0, 7) === key).reduce((s, e) => s + e.amount, 0));
        return { key, label, income: inc, expense: exp, savings: round2(inc - exp), isCurrent: key === currentKey };
      }),
    [incomes, expenses, monthsRange, currentKey]
  );

  const avgIncome = useMemo(() => statsData.reduce((s, m) => s + m.income, 0) / statsData.length, [statsData]);
  const avgExpense = useMemo(() => statsData.reduce((s, m) => s + m.expense, 0) / statsData.length, [statsData]);
  const cumulSavings = useMemo(() => statsData.reduce((s, m) => s + m.savings, 0), [statsData]);
  const avgSavingsRate = avgIncome > 0 ? ((avgIncome - avgExpense) / avgIncome) * 100 : null;
  const bestMonth = useMemo(() => statsData.reduce((b, m) => (m.savings > b.savings ? m : b), statsData[0]), [statsData]);
  const worstMonth = useMemo(() => statsData.reduce((w, m) => (m.savings < w.savings ? m : w), statsData[0]), [statsData]);

  const catAverages = useMemo(() => {
    const sums = {};
    CATEGORIES.forEach((c) => (sums[c.key] = 0));
    monthsRange.forEach(({ key }) => {
      expenses.filter((e) => e.date.slice(0, 7) === key).forEach((e) => {
        sums[e.category] = (sums[e.category] || 0) + e.amount;
      });
    });
    const total6 = Object.values(sums).reduce((s, v) => s + v, 0);
    return CATEGORIES.map((c) => ({ key: c.key, avg: sums[c.key] / monthsRange.length, pct: total6 > 0 ? (sums[c.key] / total6) * 100 : 0 }))
      .sort((a, b) => b.avg - a.avg);
  }, [expenses, monthsRange]);

  const ledger = useMemo(() => {
    const items = [
      ...monthExpenses.map((e) => ({ ...e, type: "expense" })),
      ...monthIncomes.map((e) => ({ ...e, type: "income" })),
    ];
    const map = {};
    items.forEach((e) => {
      map[e.date] = map[e.date] || [];
      map[e.date].push(e);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [monthExpenses, monthIncomes]);

  const goMonth = (d) => setCurrent(new Date(current.getFullYear(), current.getMonth() + d, 1));

  const handleCatChange = (newCat) => {
    setCat(newCat);
    setSubcat(firstSubcat(newCat));
  };

  const resetForm = () => {
    setDesc("");
    setAmount("");
    setDate(todayISO());
    setCat("alimentation");
    setSubcat(firstSubcat("alimentation"));
    setIncCat("salaires");
  };

  const startEditEntry = (e) => {
    setEntryType(e.type);
    setDesc(e.description);
    setAmount(String(e.amount).replace(".", ","));
    setDate(e.date);
    if (e.type === "expense") {
      setCat(e.category);
      setSubcat(e.subcategory || firstSubcat(e.category));
    } else {
      setIncCat(e.category);
    }
    setEditingEntry({ id: e.id, type: e.type });
  };

  const cancelEdit = () => {
    setEditingEntry(null);
    resetForm();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = parseFloat(String(amount).replace(",", "."));
    if (!desc.trim() || !Number.isFinite(num) || num <= 0) return;

    if (editingEntry) {
      if (editingEntry.type === "expense") {
        setExpenses((prev) => prev.map((x) => x.id === editingEntry.id
          ? { ...x, description: desc.trim(), amount: round2(num), category: cat, subcategory: subcat, date }
          : x));
      } else {
        setIncomes((prev) => prev.map((x) => x.id === editingEntry.id
          ? { ...x, description: desc.trim(), amount: round2(num), category: incCat, date }
          : x));
      }
      setEditingEntry(null);
      resetForm();
      return;
    }

    if (entryType === "expense") {
      setExpenses((prev) => [...prev, { id: uid(), description: desc.trim(), amount: round2(num), category: cat, subcategory: subcat, date }]);
    } else {
      setIncomes((prev) => [...prev, { id: uid(), description: desc.trim(), amount: round2(num), category: incCat, date }]);
    }
    setDesc("");
    setAmount("");
  };

  const removeEntry = (id, type) => {
    if (type === "expense") setExpenses((prev) => prev.filter((e) => e.id !== id));
    else setIncomes((prev) => prev.filter((e) => e.id !== id));
    if (editingEntry && editingEntry.id === id) cancelEdit();
  };

  const saveGoal = () => {
    const num = parseFloat(String(goalDraft).replace(",", "."));
    if (Number.isFinite(num) && num >= 0) setSavingsGoal(round2(num));
    setEditingGoal(false);
  };
  const startEditCat = (key) => {
    setEditingCat(key);
    setCatDraft(String(catBudgets[key] ?? 0));
  };
  const saveCatBudget = (key) => {
    const num = parseFloat(String(catDraft).replace(",", "."));
    if (Number.isFinite(num) && num >= 0) setCatBudgets((prev) => ({ ...prev, [key]: round2(num) }));
    setEditingCat(null);
  };

  const hasSubcats = CAT_MAP[cat] && CAT_MAP[cat].subcategories.length > 0;

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-body)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .budget-app-root { --paper:#E7ECE7; --ink:#16241F; --card:#FDFDFB; --petrol:#1F3A3E; --gold:#B8901F; --coral:#C05A3D; --sage:#4F7859; --line:#C6CFC7; --font-display:'Fraunces',serif; --font-body:'IBM Plex Sans',sans-serif; --font-mono:'IBM Plex Mono',monospace; }
        .fx-display { font-family: var(--font-display); }
        .fx-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
        .ledger-row { display:flex; align-items:baseline; gap:8px; min-width:0; }
        .ledger-row .dots { flex:1 1 auto; border-bottom:2px dotted var(--line); margin-bottom:5px; min-width:12px; }
        .cat-track { position:relative; height:36px; border-radius:6px; background:rgba(0,0,0,0.035); overflow:hidden; }
        .cat-fill { position:absolute; inset:0; border-radius:6px; opacity:0.16; transition:width .4s ease; }
        .tab-btn { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; background:transparent; color:var(--ink); opacity:0.55; }
        .tab-btn.active { background:var(--card); opacity:1; box-shadow:0 1px 2px rgba(0,0,0,0.06); }
        input[type="text"], input[type="number"], input[type="date"], select {
          font-family: var(--font-body); border:1px solid var(--line); border-radius:8px; padding:8px 10px; background:#fff; color:var(--ink); width:100%; font-size:14px;
        }
        input:focus, select:focus { outline:none; border-color:var(--petrol); box-shadow:0 0 0 3px rgba(31,58,62,0.12); }
        input:disabled, select:disabled, button:disabled { opacity:0.5; cursor:not-allowed; }
        ::-webkit-scrollbar { width:8px; height:8px; }
        ::-webkit-scrollbar-thumb { background:var(--line); border-radius:8px; }
      `}</style>

      <div className="budget-app-root max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <p className="text-xs tracking-widest uppercase" style={{ color: "var(--sage)", letterSpacing: "0.12em" }}>Registre personnel</p>
            <h1 className="fx-display text-3xl md:text-4xl font-medium">Mon budget</h1>
          </div>
          <div className="flex items-center gap-1 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--line)", padding: "4px" }}>
            <button onClick={() => goMonth(-1)} aria-label="Mois précédent" className="p-2 rounded-md hover:bg-black/5"><ChevronLeft size={18} /></button>
            <span className="fx-display px-3 text-base font-medium capitalize min-w-[150px] text-center">{monthLabel(current)}</span>
            <button onClick={() => goMonth(1)} aria-label="Mois suivant" className="p-2 rounded-md hover:bg-black/5"><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="rounded-lg mb-6 px-4 py-3 flex flex-wrap items-center gap-3 text-sm" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
          <KeyRound size={15} style={{ color: "var(--sage)" }} />
          <span style={{ opacity: 0.6 }}>Clé de synchronisation :</span>
          <span className="fx-mono">{syncKey.slice(0, 8)}…</span>
          <button onClick={copyKey} className="flex items-center gap-1 opacity-70 hover:opacity-100">
            <Copy size={13} /> {copied ? "Copié" : "Copier"}
          </button>
          {!editingKey ? (
            <button onClick={() => { setKeyDraft(""); setEditingKey(true); }} className="ml-auto opacity-70 hover:opacity-100 underline">
              Utiliser une autre clé
            </button>
          ) : (
            <div className="flex items-center gap-1.5 ml-auto">
              <input type="text" placeholder="Coller une clé" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} style={{ width: "220px" }} />
              <button onClick={applyKey} aria-label="Charger cette clé" className="p-1.5 rounded-md" style={{ background: "var(--petrol)", color: "#fff" }}>
                <Check size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 mb-6 rounded-lg w-fit" style={{ background: "rgba(0,0,0,0.04)", padding: "4px" }}>
          <button className={`tab-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
            <LayoutGrid size={15} /> Vue d'ensemble
          </button>
          <button className={`tab-btn ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
            <BarChart3 size={15} /> Statistiques
          </button>
        </div>

        {tab === "overview" && (
          <>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl p-6" style={{ background: "var(--petrol)", color: "#EFF3EF" }}>
                <p className="text-xs uppercase tracking-widest opacity-70 mb-1" style={{ letterSpacing: "0.1em" }}>Dépensé ce mois-ci</p>
                <p className="fx-mono text-3xl md:text-4xl font-medium">{fmt(totalExpense)}</p>
                <div className="flex items-center justify-between mt-2">
                  {delta !== null ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      {delta <= 0 ? <TrendingDown size={16} style={{ color: "#8FCB9E" }} /> : <TrendingUp size={16} style={{ color: "#E39A7F" }} />}
                      <span style={{ color: delta <= 0 ? "#8FCB9E" : "#E39A7F" }}>{Math.abs(Math.round(delta))}%</span>
                      <span className="opacity-60">vs mois dernier</span>
                    </div>
                  ) : <span />}
                  <span className="text-sm opacity-80 fx-mono">/ {fmt(totalBudget)}</span>
                </div>
                <p className="text-sm mt-1" style={{ color: remaining >= 0 ? "#8FCB9E" : "#E39A7F" }}>
                  {remaining >= 0 ? `${fmt(remaining)} restants sur le budget` : `${fmt(Math.abs(remaining))} au-delà du budget`}
                </p>
              </div>

              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs uppercase tracking-widest" style={{ color: "var(--sage)", letterSpacing: "0.1em" }}>Check-up épargne</p>
                  <Target size={15} style={{ color: "var(--sage)" }} />
                </div>
                <p className="fx-mono text-3xl md:text-4xl font-medium" style={{ color: realSavings >= 0 ? "var(--sage)" : "var(--coral)" }}>
                  {fmt(realSavings)}
                </p>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span style={{ opacity: 0.6 }}>Revenus {fmt(totalIncome)}</span>
                  {editingGoal ? (
                    <div className="flex items-center gap-1.5">
                      <input type="number" autoFocus value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveGoal()} style={{ width: "80px" }} className="fx-mono text-right" />
                      <button onClick={saveGoal} aria-label="Valider l'objectif" className="p-1.5 rounded-md" style={{ background: "rgba(0,0,0,0.06)" }}><Check size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setGoalDraft(String(savingsGoal)); setEditingGoal(true); }} className="flex items-center gap-1 opacity-70 hover:opacity-100">
                      Objectif {fmt(savingsGoal)} <Pencil size={11} />
                    </button>
                  )}
                </div>
                <p className="text-sm mt-1" style={{ color: savingsDelta >= 0 ? "var(--sage)" : "var(--coral)" }}>
                  {savingsDelta >= 0 ? `Objectif dépassé de ${fmt(savingsDelta)}` : `Il manque ${fmt(Math.abs(savingsDelta))} pour l'objectif`}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-6 mb-6">
              <div className="md:col-span-3 rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
                <h2 className="fx-display text-lg font-medium mb-4">Budgets par catégorie</h2>
                <div className="flex flex-col gap-2">
                  {catTotals.map(({ key, value, budget }) => {
                    const c = CAT_MAP[key];
                    const Icon = c.icon;
                    const pct = budget > 0 ? Math.min((value / budget) * 100, 100) : 0;
                    const over = budget > 0 && value > budget;
                    return (
                      <div key={key} className="cat-track">
                        <div className="cat-fill" style={{ width: `${pct}%`, background: over ? "var(--coral)" : c.color }} />
                        <div className="relative h-full flex items-center px-3 gap-2.5 ledger-row">
                          <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: c.color }}>
                            <Icon size={13} color="#fff" />
                          </span>
                          <span className="text-sm font-medium shrink-0">{c.label}</span>
                          <span className="dots" />
                          <span className="fx-mono text-sm shrink-0" style={{ color: over ? "var(--coral)" : "var(--ink)" }}>{fmt(value)}</span>
                          <span className="text-xs shrink-0 opacity-50">/</span>
                          {editingCat === key ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <input type="number" autoFocus value={catDraft} onChange={(e) => setCatDraft(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveCatBudget(key)}
                                onBlur={() => saveCatBudget(key)} style={{ width: "70px" }} className="fx-mono text-right" />
                            </div>
                          ) : (
                            <button onClick={() => startEditCat(key)} className="flex items-center gap-1 shrink-0 fx-mono text-sm opacity-70 hover:opacity-100">
                              {fmt(budget)} <Pencil size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="fx-display text-lg font-medium">{editingEntry ? "Modifier l'écriture" : "Nouvelle écriture"}</h2>
                  {editingEntry && (
                    <button onClick={cancelEdit} aria-label="Annuler la modification" className="opacity-60 hover:opacity-100">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1 mb-3 rounded-lg" style={{ background: "rgba(0,0,0,0.04)", padding: "3px" }}>
                  <button type="button" disabled={!!editingEntry} onClick={() => setEntryType("expense")} className="flex-1 text-sm py-1.5 rounded-md font-medium"
                    style={{ background: entryType === "expense" ? "var(--card)" : "transparent", color: entryType === "expense" ? "var(--coral)" : "var(--ink)", opacity: entryType === "expense" ? 1 : 0.6, boxShadow: entryType === "expense" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
                    Dépense
                  </button>
                  <button type="button" disabled={!!editingEntry} onClick={() => setEntryType("income")} className="flex-1 text-sm py-1.5 rounded-md font-medium"
                    style={{ background: entryType === "income" ? "var(--card)" : "transparent", color: entryType === "income" ? "var(--sage)" : "var(--ink)", opacity: entryType === "income" ? 1 : 0.6, boxShadow: entryType === "income" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
                    Revenu
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                  <input type="text" placeholder={entryType === "expense" ? "Description (ex. Courses Monoprix)" : "Description (ex. Salaire août)"} value={desc} onChange={(e) => setDesc(e.target.value)} />
                  <div className="flex gap-2">
                    <input type="number" step="0.01" min="0" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "45%" }} />
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "55%" }} />
                  </div>
                  {entryType === "expense" ? (
                    <>
                      <select value={cat} onChange={(e) => handleCatChange(e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      {hasSubcats && (
                        <select value={subcat} onChange={(e) => setSubcat(e.target.value)}>
                          {CAT_MAP[cat].subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </>
                  ) : (
                    <select value={incCat} onChange={(e) => setIncCat(e.target.value)}>
                      {INCOME_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  )}
                  <button type="submit" className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 mt-1 text-sm font-medium"
                    style={{ background: entryType === "expense" ? "var(--petrol)" : "var(--sage)", color: "#fff" }}>
                    {editingEntry ? <Check size={16} /> : <Plus size={16} />} {editingEntry ? "Enregistrer" : "Ajouter"}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="fx-display text-lg font-medium">Journal du mois</h2>
                <span className="text-xs" style={{ opacity: 0.5 }}>
                  {saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Erreur d'enregistrement" : loaded ? "Enregistré" : ""}
                </span>
              </div>
              {ledger.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>Aucune écriture ce mois-ci. Ajoutez une dépense ou un revenu ci-dessus.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {ledger.map(([d, items]) => (
                    <div key={d}>
                      <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--sage)", letterSpacing: "0.08em" }}>{dayLabel(d)}</p>
                      <div className="flex flex-col gap-1.5">
                        {items.map((e) => {
                          const c = (e.type === "expense" ? CAT_MAP[e.category] : INC_MAP[e.category])
                            || (e.type === "expense" ? FALLBACK_CAT : FALLBACK_INC);
                          const Icon = c.icon;
                          const isEditingThis = editingEntry && editingEntry.id === e.id;
                          return (
                            <div key={e.id} className="ledger-row group py-1.5" style={isEditingThis ? { background: "rgba(31,58,62,0.05)", borderRadius: "6px" } : undefined}>
                              <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: c.color }}>
                                <Icon size={12} color="#fff" />
                              </span>
                              <span className="text-sm shrink-0 max-w-[38%] truncate">
                                {e.description}
                                {e.subcategory ? <span style={{ opacity: 0.5 }}> · {e.subcategory}</span> : null}
                              </span>
                              <span className="dots" />
                              <span className="fx-mono text-sm shrink-0" style={{ color: e.type === "income" ? "var(--sage)" : "var(--ink)" }}>
                                {e.type === "income" ? "+" : "-"}{fmt(e.amount)}
                              </span>
                              <button onClick={() => startEditEntry(e)} aria-label="Modifier"
                                className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
                                <Pencil size={13} style={{ color: "var(--petrol)" }} />
                              </button>
                              <button onClick={() => removeEntry(e.id, e.type)} aria-label="Supprimer"
                                className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
                                <Trash2 size={14} style={{ color: "var(--coral)" }} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "stats" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Revenu moyen (6 mois)", value: fmt(avgIncome), color: "var(--sage)" },
                { label: "Dépense moyenne (6 mois)", value: fmt(avgExpense), color: "var(--coral)" },
                { label: "Taux d'épargne moyen", value: avgSavingsRate === null ? "—" : `${Math.round(avgSavingsRate)}%`, color: "var(--petrol)" },
                { label: "Épargné sur 6 mois", value: fmt(cumulSavings), color: cumulSavings >= 0 ? "var(--sage)" : "var(--coral)" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
                  <p className="text-xs mb-1" style={{ opacity: 0.55 }}>{s.label}</p>
                  <p className="fx-mono text-xl font-medium" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-4">Revenus vs dépenses</h2>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={statsData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="income" name="Revenus" fill="#4F7859" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Dépenses" fill="#C05A3D" radius={[4, 4, 0, 0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-1">Évolution de l'épargne</h2>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
                Ligne pointillée = objectif mensuel de {fmt(savingsGoal)}
                {bestMonth && worstMonth && bestMonth.key !== worstMonth.key && (
                  <> · meilleur mois : {bestMonth.label} · plus faible : {worstMonth.label}</>
                )}
              </p>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={statsData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                    <ReferenceLine y={savingsGoal} stroke="#B8901F" strokeDasharray="4 4" />
                    <Bar dataKey="savings" name="Épargne" radius={[4, 4, 0, 0]}>
                      {statsData.map((d, i) => (
                        <Cell key={i} fill={d.savings >= 0 ? "#4F7859" : "#C05A3D"} />
                      ))}
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-1">Répartition des dépenses par catégorie</h2>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Moyenne mensuelle sur les 6 derniers mois</p>
              <div className="flex flex-col gap-2">
                {catAverages.map(({ key, avg, pct }) => {
                  const c = CAT_MAP[key];
                  const Icon = c.icon;
                  return (
                    <div key={key} className="cat-track">
                      <div className="cat-fill" style={{ width: `${Math.min(pct, 100)}%`, background: c.color }} />
                      <div className="relative h-full flex items-center px-3 gap-2.5 ledger-row">
                        <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: c.color }}>
                          <Icon size={13} color="#fff" />
                        </span>
                        <span className="text-sm font-medium shrink-0">{c.label}</span>
                        <span className="dots" />
                        <span className="fx-mono text-sm shrink-0">{fmt(avg)}</span>
                        <span className="text-xs shrink-0 opacity-50 w-9 text-right">{Math.round(pct)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-center mt-6" style={{ opacity: 0.4 }}>
          Vos données sont enregistrées automatiquement et restent privées, propres à vous.
        </p>
      </div>
    </div>
  );
}
