import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ShoppingCart, Home, Car, Music2, Stethoscope, Repeat,
  MoreHorizontal, Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp,
  TrendingDown, PiggyBank, Pencil, Check, Landmark, Wallet, Target,
  LayoutGrid, BarChart3, KeyRound, Copy, Receipt, X, ChevronDown, Plane,
  Maximize2, Banknote, PenSquare,
} from "lucide-react";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine, Cell, PieChart, Pie, ComposedChart,
  Line, AreaChart, Area,
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
    subcategories: ["Bar", "Sport", "Shopping", "Plaisirs divers"] },
  { key: "voyage", label: "Voyage", color: "#3D6B8A", icon: Plane, defaultBudget: 100,
    subcategories: [] },
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
  { key: "salaires", label: "Fixe", color: "#4F7859", icon: Landmark },
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

const TRIP_CATEGORIES = ["Restaurant", "Logement", "Déplacement", "Activités", "Autre"];
const TRIP_CAT_COLORS = {
  Restaurant: "#4F7859",
  Logement: "#1F3A3E",
  "Déplacement": "#B8901F",
  "Activités": "#C05A3D",
  Autre: "#7E7E74",
};
// Catégorie principale suggérée par défaut à la création d'une dépense de voyage
const TRIP_CAT_TO_MAIN = { Restaurant: "alimentation", Logement: "logement", "Déplacement": "transport", "Activités": "loisirs", Autre: "autres" };
// Catégorie de voyage suggérée par défaut à l'import d'une dépense existante
const MAIN_TO_TRIP_CAT = { alimentation: "Restaurant", logement: "Logement", transport: "Déplacement", loisirs: "Activités", voyage: "Activités", ndf: "Logement", sante: "Autre", abonnements: "Autre", autres: "Autre" };

const CHART_TITLES = {
  donut: "Répartition des dépenses par catégorie",
  "revenus-depenses": "Revenus vs dépenses",
  "dep-mensuelles": "Évolution des dépenses mensuelles",
  "dep-categorie": "Évolution des dépenses par catégorie",
  "rev-categorie": "Évolution des revenus par catégorie",
  epargne: "Évolution de l'épargne",
  patrimoine: "Évolution de mon épargne totale",
};
const PERIOD_CHART_IDS = ["revenus-depenses", "dep-mensuelles", "dep-categorie", "rev-categorie", "epargne"];

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [catBudgets, setCatBudgets] = useState(DEFAULT_CAT_BUDGETS);
  const [savingsGoal, setSavingsGoal] = useState(300);
  const [salaryBreakdown, setSalaryBreakdown] = useState({}); // { "2026-07": { fixe, variable, ndf } }
  const [trips, setTrips] = useState([]); // [{ id, title, createdDate }]
  const [savingsAccounts, setSavingsAccounts] = useState([]); // [{ id, name }]
  const [savingsBalances, setSavingsBalances] = useState({}); // { "2026-08": { accId: "12749" } }
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [tab, setTab] = useState("overview");
  const [journalFilter, setJournalFilter] = useState("all"); // "all" | "cash"

  const [entryType, setEntryType] = useState("expense");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("alimentation");
  const [subcat, setSubcat] = useState(firstSubcat("alimentation"));
  const [incCat, setIncCat] = useState("salaires");
  const [date, setDate] = useState(todayISO());
  const [isCash, setIsCash] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null); // { id, type } | null
  const [editDraft, setEditDraft] = useState({ description: "", amount: "", date: "", category: "", subcategory: "", isCash: false });

  const [syncKey] = useState(() => getSyncKey());
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [renamingKey, setRenamingKey] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameStatus, setRenameStatus] = useState("idle"); // idle | saving | error

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
  const applyRename = async () => {
    const newKey = renameDraft.trim().replace(/\s+/g, "-");
    if (!newKey) return;
    setRenameStatus("saving");
    try {
      const expRes = await storage.get("expenses");
      const incRes = await storage.get("incomes");
      const setRes = await storage.get("settings");
      setSyncKey(newKey);
      if (expRes && expRes.value) await storage.set("expenses", expRes.value);
      if (incRes && incRes.value) await storage.set("incomes", incRes.value);
      if (setRes && setRes.value) await storage.set("settings", setRes.value);
      window.location.reload();
    } catch (e) {
      setRenameStatus("error");
    }
  };

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(savingsGoal));
  const [editingCat, setEditingCat] = useState(null);
  const [catDraft, setCatDraft] = useState("");
  const [expandedCat, setExpandedCat] = useState(null);
  const [expandedSubcat, setExpandedSubcat] = useState(null);
  const [pieExpandedCat, setPieExpandedCat] = useState(null);
  const [pieExpandedSubcat, setPieExpandedSubcat] = useState(null);
  const [expandedIncomeCat, setExpandedIncomeCat] = useState(null);
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [newTripTitle, setNewTripTitle] = useState("");
  const [tripAddDraft, setTripAddDraft] = useState({ description: "", amount: "", date: todayISO(), tripCategory: "Autre" });
  const [tripImportSearch, setTripImportSearch] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("expenses");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          // Corrige rétroactivement les anciennes dépenses de voyage : catégorie
          // principale -> "voyage" (avec conservation de la catégorie d'origine
          // pour pouvoir la restaurer si la dépense est un jour retirée du voyage).
          const migrated = parsed.map((e) => (
            e.tripId && e.category !== "voyage"
              ? { ...e, originalCategory: e.category, originalSubcategory: e.subcategory || "", category: "voyage", subcategory: "" }
              : e
          ));
          setExpenses(migrated);
        }
      } catch (e) {}
      try {
        const res = await storage.get("incomes");
        if (res && res.value) setIncomes(JSON.parse(res.value));
      } catch (e) {}
      try {
        const res = await storage.get("trips");
        if (res && res.value) setTrips(JSON.parse(res.value));
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
          if (s.salaryBreakdown) setSalaryBreakdown(s.salaryBreakdown);
          if (s.savingsAccounts) setSavingsAccounts(s.savingsAccounts);
          if (s.savingsBalances) setSavingsBalances(s.savingsBalances);
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
        await storage.set("trips", JSON.stringify(trips));
        await storage.set("settings", JSON.stringify({ catBudgets, savingsGoal, salaryBreakdown, savingsAccounts, savingsBalances }));
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [expenses, incomes, trips, catBudgets, savingsGoal, salaryBreakdown, savingsAccounts, savingsBalances, loaded]);

  const currentKey = monthKey(current);
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.date.slice(0, 7) === currentKey && !e.excludeFromMonth),
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

  // --- Répartition par catégorie du mois en cours (donut) ---
  const pieData = useMemo(
    () => catTotals.filter((c) => c.value > 0).map((c) => ({
      key: c.key, name: (CAT_MAP[c.key] || FALLBACK_CAT).label, value: c.value, color: (CAT_MAP[c.key] || FALLBACK_CAT).color,
    })),
    [catTotals]
  );

  // --- Décomposition du salaire (mois en cours, saisie manuelle Fixe/Variable/NDF) ---
  const salaireTotal = useMemo(
    () => monthIncomes.filter((e) => e.category === "salaires").reduce((s, e) => s + e.amount, 0),
    [monthIncomes]
  );
  const sbDraft = salaryBreakdown[currentKey] || {};
  const sbFixe = parseFloat(String(sbDraft.fixe || "0").replace(",", ".")) || 0;
  const sbVariable = parseFloat(String(sbDraft.variable || "0").replace(",", ".")) || 0;
  const sbNdf = parseFloat(String(sbDraft.ndf || "0").replace(",", ".")) || 0;
  const sbDelta = round2(salaireTotal - (sbFixe + sbVariable + sbNdf));
  const updateSalaryBreakdown = (field, value) => {
    setSalaryBreakdown((prev) => ({ ...prev, [currentKey]: { ...(prev[currentKey] || {}), [field]: value } }));
  };

  // --- Simulateur coûts voiture & déplacements pro (mois en cours) ---
  const carSim = useMemo(() => {
    const sum = (catKey, sub) =>
      monthExpenses.filter((e) => e.category === catKey && e.subcategory === sub).reduce((s, e) => s + e.amount, 0);
    return {
      credit: sum("transport", "Crédit Voiture"),
      assurance: sum("transport", "Assurance Auto"),
      essence: sum("transport", "Essence"),
      autoroute: sum("ndf", "Autoroute"),
      hotel: sum("ndf", "Logement"),
      repas: sum("ndf", "Repas"),
    };
  }, [monthExpenses]);
  const carSimTotal = carSim.credit + carSim.assurance + carSim.essence + carSim.autoroute + carSim.hotel + carSim.repas;
  const ndfReimbursedAmount = sbNdf;
  const carSimDelta = round2(ndfReimbursedAmount - carSimTotal);

  // --- Répartition des revenus du mois en cours ---
  const incomeTotals = useMemo(() => {
    const map = {};
    monthIncomes.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return INCOME_CATEGORIES.map((c) => ({
      key: c.key, label: c.label, color: c.color, icon: c.icon,
      value: map[c.key] || 0, pct: totalIncome > 0 ? ((map[c.key] || 0) / totalIncome) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [monthIncomes, totalIncome]);

  // --- Top 5 des plus grosses dépenses du mois ---
  const topExpenses = useMemo(
    () => [...monthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [monthExpenses]
  );
  const txCount = monthExpenses.length;
  const avgTx = txCount > 0 ? totalExpense / txCount : 0;
  const maxTx = monthExpenses.reduce((m, e) => Math.max(m, e.amount), 0);

  // --- Patrimoine / comptes d'épargne (saisie manuelle mensuelle) ---
  const currentSavingsBalances = savingsBalances[currentKey] || {};
  const savingsAccountsWithValues = useMemo(
    () => savingsAccounts.map((a) => ({
      ...a,
      value: parseFloat(String(currentSavingsBalances[a.id] || "0").replace(",", ".")) || 0,
    })),
    [savingsAccounts, currentSavingsBalances]
  );
  const totalSavingsBalance = savingsAccountsWithValues.reduce((s, a) => s + a.value, 0);
  const hasPrevMonthSavings = !!savingsBalances[prevKey] && Object.keys(savingsBalances[prevKey] || {}).length > 0;

  const savingsEvolutionData = useMemo(() => {
    const months = Object.keys(savingsBalances).sort();
    return months.map((key) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const balances = savingsBalances[key] || {};
      const total = savingsAccounts.reduce((s, a) => s + (parseFloat(String(balances[a.id] || "0").replace(",", ".")) || 0), 0);
      return { key, label, total };
    });
  }, [savingsBalances, savingsAccounts]);

  // --- Historique complet (tous les mois ayant au moins une écriture) pour les graphiques d'évolution ---
  const allMonths = useMemo(() => {
    const set = new Set([...expenses.map((e) => e.date.slice(0, 7)), ...incomes.map((e) => e.date.slice(0, 7))]);
    return Array.from(set).sort();
  }, [expenses, incomes]);

  const allMonthsData = useMemo(() => {
    let running = 0;
    return allMonths.map((key) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const inc = round2(incomes.filter((e) => e.date.slice(0, 7) === key).reduce((s, e) => s + e.amount, 0));
      const exp = round2(expenses.filter((e) => e.date.slice(0, 7) === key).reduce((s, e) => s + e.amount, 0));
      const savings = round2(inc - exp);
      running = round2(running + savings);
      return { key, label, income: inc, expense: exp, savings, cumulative: running };
    });
  }, [expenses, incomes, allMonths]);

  // --- Évolution des dépenses par catégorie, mois par mois (historique complet) ---
  const categoryMonthlyData = useMemo(() => {
    return allMonths.map((key) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const monthExp = expenses.filter((e) => e.date.slice(0, 7) === key);
      const row = { key, label };
      CATEGORIES.forEach((c) => {
        row[c.key] = round2(monthExp.filter((e) => e.category === c.key).reduce((s, e) => s + e.amount, 0));
      });
      return row;
    });
  }, [expenses, allMonths]);

  // --- Évolution des revenus par catégorie, mois par mois (historique complet) ---
  const incomeMonthlyData = useMemo(() => {
    return allMonths.map((key) => {
      const [y, m] = key.split("-");
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const monthInc = incomes.filter((e) => e.date.slice(0, 7) === key);
      const row = { key, label };
      INCOME_CATEGORIES.forEach((c) => {
        row[c.key] = round2(monthInc.filter((e) => e.category === c.key).reduce((s, e) => s + e.amount, 0));
      });
      return row;
    });
  }, [incomes, allMonths]);

  // --- Période affichée dans les graphiques d'évolution (ajustable, notamment en plein écran) ---
  const [evolutionPeriod, setEvolutionPeriod] = useState(6); // 3 | 6 | 12 | "all"
  const periodFilteredMonths = useMemo(
    () => (evolutionPeriod === "all" ? allMonthsData : allMonthsData.slice(-evolutionPeriod)),
    [allMonthsData, evolutionPeriod]
  );
  const periodFilteredCategoryMonthly = useMemo(
    () => (evolutionPeriod === "all" ? categoryMonthlyData : categoryMonthlyData.slice(-evolutionPeriod)),
    [categoryMonthlyData, evolutionPeriod]
  );
  const periodFilteredIncomeMonthly = useMemo(
    () => (evolutionPeriod === "all" ? incomeMonthlyData : incomeMonthlyData.slice(-evolutionPeriod)),
    [incomeMonthlyData, evolutionPeriod]
  );
  const [fullscreenChart, setFullscreenChart] = useState(null);

  // --- Voyages : totaux et répartition par sous-catégorie de voyage ---
  const tripsWithTotals = useMemo(() => {
    return trips
      .map((t) => {
        const items = expenses.filter((e) => e.tripId === t.id);
        const total = items.reduce((s, e) => s + e.amount, 0);
        const byCat = {};
        TRIP_CATEGORIES.forEach((c) => (byCat[c] = 0));
        items.forEach((e) => {
          const tc = e.tripCategory || "Autre";
          byCat[tc] = (byCat[tc] || 0) + e.amount;
        });
        return { ...t, items: items.sort((a, b) => (a.date < b.date ? 1 : -1)), total, byCat };
      })
      .sort((a, b) => (a.createdDate < b.createdDate ? 1 : -1));
  }, [trips, expenses]);

  const unassignedExpenses = useMemo(
    () => [...expenses].filter((e) => !e.tripId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [expenses]
  );

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

  const cashLedger = useMemo(() => {
    const items = [
      ...monthExpenses.filter((e) => e.isCash).map((e) => ({ ...e, type: "expense" })),
      ...monthIncomes.filter((e) => e.isCash).map((e) => ({ ...e, type: "income" })),
    ];
    const map = {};
    items.forEach((e) => {
      map[e.date] = map[e.date] || [];
      map[e.date].push(e);
    });
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [monthExpenses, monthIncomes]);
  const cashTotal = useMemo(
    () => monthExpenses.filter((e) => e.isCash).reduce((s, e) => s + e.amount, 0),
    [monthExpenses]
  );

  const goMonth = (d) => setCurrent(new Date(current.getFullYear(), current.getMonth() + d, 1));

  const handleCatChange = (newCat) => {
    setCat(newCat);
    setSubcat(firstSubcat(newCat));
  };

  const addEntry = (e) => {
    e.preventDefault();
    const num = parseFloat(String(amount).replace(",", "."));
    if (!desc.trim() || !Number.isFinite(num) || num <= 0) return;
    if (entryType === "expense") {
      setExpenses((prev) => [...prev, { id: uid(), description: desc.trim(), amount: round2(num), category: cat, subcategory: subcat, date, isCash }]);
    } else {
      setIncomes((prev) => [...prev, { id: uid(), description: desc.trim(), amount: round2(num), category: incCat, date, isCash }]);
    }
    setDesc("");
    setAmount("");
    setIsCash(false);
  };

  // --- Édition inline (directement sur la ligne cliquée, pas dans le formulaire du haut) ---
  const startEditEntry = (e, type) => {
    setEditingEntry({ id: e.id, type });
    setEditDraft({
      description: e.description,
      amount: String(e.amount).replace(".", ","),
      date: e.date,
      category: e.category,
      subcategory: type === "expense" ? (e.subcategory || firstSubcat(e.category)) : "",
      isCash: !!e.isCash,
    });
  };

  const cancelEdit = () => setEditingEntry(null);

  const saveInlineEdit = () => {
    const num = parseFloat(String(editDraft.amount).replace(",", "."));
    if (!editDraft.description.trim() || !Number.isFinite(num) || num <= 0 || !editDraft.date) return;
    const { id, type } = editingEntry;
    if (type === "expense") {
      setExpenses((prev) => prev.map((x) => x.id === id
        ? { ...x, description: editDraft.description.trim(), amount: round2(num), category: editDraft.category, subcategory: editDraft.subcategory, date: editDraft.date, isCash: editDraft.isCash }
        : x));
    } else {
      setIncomes((prev) => prev.map((x) => x.id === id
        ? { ...x, description: editDraft.description.trim(), amount: round2(num), category: editDraft.category, date: editDraft.date, isCash: editDraft.isCash }
        : x));
    }
    setEditingEntry(null);
  };

  const removeEntry = (id, type) => {
    if (type === "expense") setExpenses((prev) => prev.filter((e) => e.id !== id));
    else setIncomes((prev) => prev.filter((e) => e.id !== id));
    if (editingEntry && editingEntry.id === id) cancelEdit();
  };

  // Rendu d'une ligne de transaction : édition inline si c'est la ligne en cours d'édition, sinon ligne normale.
  const renderTxRow = (e, type) => {
    const isEditing = editingEntry && editingEntry.id === e.id && editingEntry.type === type;
    if (isEditing) {
      const catDef = type === "expense" ? CAT_MAP[editDraft.category] : null;
      const showSub = type === "expense" && catDef && catDef.subcategories.length > 0;
      return (
        <div key={e.id} className="flex flex-col gap-2 p-3 rounded-lg my-1" style={{ background: "rgba(31,58,62,0.05)", border: "1px solid var(--line)" }}>
          <input type="text" autoFocus value={editDraft.description}
            onChange={(ev) => setEditDraft((d) => ({ ...d, description: ev.target.value }))} placeholder="Description" />
          <div className="flex gap-2">
            <input type="number" step="0.01" min="0" value={editDraft.amount}
              onChange={(ev) => setEditDraft((d) => ({ ...d, amount: ev.target.value }))} style={{ width: "42%" }} />
            <input type="date" value={editDraft.date}
              onChange={(ev) => setEditDraft((d) => ({ ...d, date: ev.target.value }))} style={{ width: "38%" }} />
          </div>
          {type === "expense" ? (
            <div className="flex gap-2">
              <select value={editDraft.category} onChange={(ev) => {
                const newCat = ev.target.value;
                setEditDraft((d) => ({ ...d, category: newCat, subcategory: firstSubcat(newCat) }));
              }}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              {showSub && (
                <select value={editDraft.subcategory} onChange={(ev) => setEditDraft((d) => ({ ...d, subcategory: ev.target.value }))}>
                  {catDef.subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          ) : (
            <select value={editDraft.category} onChange={(ev) => setEditDraft((d) => ({ ...d, category: ev.target.value }))}>
              {INCOME_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.75 }}>
            <input type="checkbox" checked={!!editDraft.isCash} onChange={(ev) => setEditDraft((d) => ({ ...d, isCash: ev.target.checked }))} style={{ width: "auto" }} />
            Payé en espèces
          </label>
          <div className="flex gap-2 mt-1">
            <button onClick={saveInlineEdit} className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium" style={{ background: "var(--petrol)", color: "#fff" }}>
              <Check size={14} /> Enregistrer
            </button>
            <button onClick={cancelEdit} aria-label="Annuler" className="px-3 rounded-md" style={{ background: "rgba(0,0,0,0.06)" }}>
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }
    const c = (type === "expense" ? CAT_MAP[e.category] : INC_MAP[e.category]) || (type === "expense" ? FALLBACK_CAT : FALLBACK_INC);
    const Icon = c.icon;
    return (
      <div key={e.id} className="ledger-row group py-1.5">
        <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: c.color }}>
          <Icon size={12} color="#fff" />
        </span>
        <span className="text-sm shrink-0 max-w-[38%] truncate">
          {e.description}
          {e.subcategory ? <span style={{ opacity: 0.5 }}> · {e.subcategory}</span> : null}
        </span>
        {e.isCash && <Banknote size={13} className="shrink-0" style={{ color: "var(--gold)" }} />}
        <span className="dots" />
        <span className="fx-mono text-sm shrink-0" style={{ color: type === "income" ? "var(--sage)" : "var(--ink)" }}>
          {type === "income" ? "+" : "-"}{fmt(e.amount)}
        </span>
        <button onClick={() => startEditEntry(e, type)} aria-label="Modifier"
          className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
          <Pencil size={13} style={{ color: "var(--petrol)" }} />
        </button>
        <button onClick={() => removeEntry(e.id, type)} aria-label="Supprimer"
          className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
          <Trash2 size={14} style={{ color: "var(--coral)" }} />
        </button>
      </div>
    );
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

  // --- Voyages ---
  const createTrip = () => {
    const title = newTripTitle.trim();
    if (!title) return;
    const id = uid();
    setTrips((prev) => [...prev, { id, title, createdDate: todayISO() }]);
    setNewTripTitle("");
    setExpandedTrip(id);
  };
  const deleteTrip = (tripId) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    setExpenses((prev) => prev.map((e) => {
      if (e.tripId !== tripId) return e;
      const restored = e.originalCategory
        ? { category: e.originalCategory, subcategory: e.originalSubcategory || "" }
        : {};
      return { ...e, ...restored, tripId: null, tripCategory: null, originalCategory: null, originalSubcategory: null };
    }));
    if (expandedTrip === tripId) setExpandedTrip(null);
  };
  const importExpenseToTrip = (tripId, expenseId) => {
    setExpenses((prev) => prev.map((e) => {
      if (e.id !== expenseId) return e;
      const tripCategory = MAIN_TO_TRIP_CAT[e.category] || "Autre";
      return {
        ...e, tripId, tripCategory,
        originalCategory: e.category, originalSubcategory: e.subcategory || "",
        category: "voyage", subcategory: "",
      };
    }));
  };
  const removeExpenseFromTrip = (expenseId) => {
    setExpenses((prev) => prev.map((e) => {
      if (e.id !== expenseId) return e;
      const restored = e.originalCategory
        ? { category: e.originalCategory, subcategory: e.originalSubcategory || "" }
        : {};
      return { ...e, ...restored, tripId: null, tripCategory: null, originalCategory: null, originalSubcategory: null };
    }));
  };
  const changeTripCategory = (expenseId, newTripCategory) => {
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, tripCategory: newTripCategory } : e)));
  };
  const toggleTripExpenseCount = (expenseId, countInMonth) => {
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, excludeFromMonth: !countInMonth } : e)));
  };
  const addTripExpense = (tripId) => {
    const num = parseFloat(String(tripAddDraft.amount).replace(",", "."));
    if (!tripAddDraft.description.trim() || !Number.isFinite(num) || num <= 0 || !tripAddDraft.date) return;
    setExpenses((prev) => [...prev, {
      id: uid(), description: tripAddDraft.description.trim(), amount: round2(num), date: tripAddDraft.date,
      category: "voyage", subcategory: "",
      tripId, tripCategory: tripAddDraft.tripCategory,
      originalCategory: null, originalSubcategory: null,
      excludeFromMonth: true, // par défaut, une dépense de voyage ajoutée ici ne compte pas dans le mois
    }]);
    setTripAddDraft({ description: "", amount: "", date: todayISO(), tripCategory: "Autre" });
  };

  const hasSubcats = CAT_MAP[cat] && CAT_MAP[cat].subcategories.length > 0;

  // --- Comptes d'épargne / patrimoine ---
  const [newAccountName, setNewAccountName] = useState("");
  const addSavingsAccount = () => {
    const name = newAccountName.trim();
    if (!name) return;
    setSavingsAccounts((prev) => [...prev, { id: uid(), name }]);
    setNewAccountName("");
  };
  const removeSavingsAccount = (accountId) => {
    setSavingsAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setSavingsBalances((prev) => {
      const next = {};
      Object.entries(prev).forEach(([mk, balances]) => {
        const copy = { ...balances };
        delete copy[accountId];
        next[mk] = copy;
      });
      return next;
    });
  };
  const updateSavingsBalance = (accountId, value) => {
    setSavingsBalances((prev) => ({ ...prev, [currentKey]: { ...(prev[currentKey] || {}), [accountId]: value } }));
  };
  const copyPreviousMonthBalances = () => {
    const prevBalances = savingsBalances[prevKey] || {};
    setSavingsBalances((prev) => ({ ...prev, [currentKey]: { ...prevBalances } }));
  };

  const renderAddForm = (title = "Nouvelle écriture") => (
    <>
      <h2 className="fx-display text-lg font-medium mb-3">{title}</h2>
      <div className="flex gap-1 mb-3 rounded-lg" style={{ background: "rgba(0,0,0,0.04)", padding: "3px" }}>
        <button type="button" onClick={() => setEntryType("expense")} className="flex-1 text-sm py-1.5 rounded-md font-medium"
          style={{ background: entryType === "expense" ? "var(--card)" : "transparent", color: entryType === "expense" ? "var(--coral)" : "var(--ink)", opacity: entryType === "expense" ? 1 : 0.6, boxShadow: entryType === "expense" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Dépense
        </button>
        <button type="button" onClick={() => setEntryType("income")} className="flex-1 text-sm py-1.5 rounded-md font-medium"
          style={{ background: entryType === "income" ? "var(--card)" : "transparent", color: entryType === "income" ? "var(--sage)" : "var(--ink)", opacity: entryType === "income" ? 1 : 0.6, boxShadow: entryType === "income" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Revenu
        </button>
      </div>
      <form onSubmit={addEntry} className="flex flex-col gap-2.5">
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
        <label className="flex items-center gap-1.5 text-sm" style={{ opacity: 0.75 }}>
          <input type="checkbox" checked={isCash} onChange={(e) => setIsCash(e.target.checked)} style={{ width: "auto" }} />
          Payé en espèces
        </label>
        <button type="submit" className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 mt-1 text-sm font-medium"
          style={{ background: entryType === "expense" ? "var(--petrol)" : "var(--sage)", color: "#fff" }}>
          <Plus size={16} /> Ajouter
        </button>
      </form>
    </>
  );

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
          {!editingKey && !renamingKey && (
            <div className="ml-auto flex items-center gap-3">
              <button onClick={() => { setRenameDraft(""); setRenameStatus("idle"); setRenamingKey(true); }} className="opacity-70 hover:opacity-100 underline">
                Personnaliser
              </button>
              <button onClick={() => { setKeyDraft(""); setEditingKey(true); }} className="opacity-70 hover:opacity-100 underline">
                Utiliser une autre clé
              </button>
            </div>
          )}
          {editingKey && (
            <div className="flex items-center gap-1.5 ml-auto">
              <input type="text" placeholder="Coller une clé" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} style={{ width: "200px" }} />
              <button onClick={applyKey} aria-label="Charger cette clé" className="p-1.5 rounded-md" style={{ background: "var(--petrol)", color: "#fff" }}>
                <Check size={13} />
              </button>
              <button onClick={() => setEditingKey(false)} aria-label="Annuler" className="p-1.5 rounded-md" style={{ background: "rgba(0,0,0,0.06)" }}>
                <X size={13} />
              </button>
            </div>
          )}
          {renamingKey && (
            <div className="flex items-center gap-1.5 ml-auto">
              {renameStatus === "saving" ? (
                <span className="text-xs" style={{ opacity: 0.6 }}>Personnalisation en cours…</span>
              ) : (
                <>
                  <input type="text" placeholder="ex. pierre-budget" value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyRename()} style={{ width: "160px" }} />
                  <button onClick={applyRename} aria-label="Valider le nouveau nom" className="p-1.5 rounded-md" style={{ background: "var(--petrol)", color: "#fff" }}>
                    <Check size={13} />
                  </button>
                  <button onClick={() => setRenamingKey(false)} aria-label="Annuler" className="p-1.5 rounded-md" style={{ background: "rgba(0,0,0,0.06)" }}>
                    <X size={13} />
                  </button>
                  {renameStatus === "error" && <span className="text-xs" style={{ color: "var(--coral)" }}>Erreur, réessaie</span>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 mb-6 rounded-lg w-fit" style={{ background: "rgba(0,0,0,0.04)", padding: "4px", flexWrap: "wrap" }}>
          <button className={`tab-btn ${tab === "quickadd" ? "active" : ""}`} onClick={() => setTab("quickadd")}>
            <PenSquare size={15} /> Ajout rapide
          </button>
          <button className={`tab-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
            <LayoutGrid size={15} /> Vue d'ensemble
          </button>
          <button className={`tab-btn ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
            <BarChart3 size={15} /> Statistiques
          </button>
        </div>

        {tab === "quickadd" && (
          <div className="max-w-md mx-auto rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
            {renderAddForm("Ajout rapide")}
          </div>
        )}

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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="fx-display text-lg font-medium">Budgets par catégorie</h2>
                  <span className="text-xs" style={{ opacity: 0.45 }}>Clique une catégorie pour voir le détail</span>
                </div>
                <div className="flex flex-col gap-2">
                  {catTotals.map(({ key, value, budget }) => {
                    const c = CAT_MAP[key];
                    const Icon = c.icon;
                    const pct = budget > 0 ? Math.min((value / budget) * 100, 100) : 0;
                    const over = budget > 0 && value > budget;
                    const isOpen = expandedCat === key;
                    const hasSubs = c.subcategories.length > 0;

                    // Regroupe les dépenses de la catégorie par sous-catégorie
                    let subRows = [];
                    let flatTx = [];
                    if (isOpen) {
                      const catTxAll = monthExpenses.filter((e) => e.category === key);
                      if (hasSubs) {
                        const map = {};
                        catTxAll.forEach((e) => {
                          const sub = e.subcategory || "Non précisé";
                          if (!map[sub]) map[sub] = { sub, total: 0, items: [] };
                          map[sub].total += e.amount;
                          map[sub].items.push(e);
                        });
                        subRows = Object.values(map).sort((a, b) => b.total - a.total);
                      } else {
                        flatTx = [...catTxAll].sort((a, b) => (a.date < b.date ? 1 : -1));
                      }
                    }

                    return (
                      <div key={key}>
                        <div className="cat-track" style={{ cursor: "pointer" }}
                          onClick={() => { setExpandedCat(isOpen ? null : key); setExpandedSubcat(null); }}>
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
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <input type="number" autoFocus value={catDraft} onChange={(e) => setCatDraft(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveCatBudget(key)}
                                  onBlur={() => saveCatBudget(key)} style={{ width: "70px" }} className="fx-mono text-right" />
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); startEditCat(key); }} className="flex items-center gap-1 shrink-0 fx-mono text-sm opacity-70 hover:opacity-100">
                                {fmt(budget)} <Pencil size={10} />
                              </button>
                            )}
                            <ChevronDown size={14} className="shrink-0" style={{ opacity: 0.4, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                          </div>
                        </div>

                        {isOpen && !hasSubs && (
                          <div className="flex flex-col gap-1 py-2 pl-4" style={{ borderLeft: `2px solid ${c.color}`, marginLeft: "12px" }}>
                            {flatTx.length === 0 ? (
                              <p className="text-xs py-1" style={{ opacity: 0.5 }}>Aucune transaction dans cette catégorie ce mois-ci.</p>
                            ) : (
                              flatTx.map((e) => renderTxRow(e, "expense"))
                            )}
                          </div>
                        )}

                        {isOpen && hasSubs && (
                          <div className="flex flex-col gap-1.5 py-2 pl-4" style={{ borderLeft: `2px solid ${c.color}`, marginLeft: "12px" }}>
                            {subRows.length === 0 ? (
                              <p className="text-xs py-1" style={{ opacity: 0.5 }}>Aucune transaction dans cette catégorie ce mois-ci.</p>
                            ) : (
                              subRows.map(({ sub, total, items }) => {
                                const subKey = `${key}::${sub}`;
                                const subOpen = expandedSubcat === subKey;
                                const subPct = value > 0 ? (total / value) * 100 : 0;
                                return (
                                  <div key={sub}>
                                    <div className="cat-track" style={{ height: "30px", cursor: "pointer" }}
                                      onClick={() => setExpandedSubcat(subOpen ? null : subKey)}>
                                      <div className="cat-fill" style={{ width: `${subPct}%`, background: c.color, opacity: 0.28 }} />
                                      <div className="relative h-full flex items-center px-3 gap-2 ledger-row">
                                        <span className="text-sm shrink-0">{sub}</span>
                                        <span className="dots" />
                                        <span className="fx-mono text-xs shrink-0">{fmt(total)}</span>
                                        <span className="text-xs shrink-0 opacity-45 w-8 text-right">{Math.round(subPct)}%</span>
                                        <ChevronDown size={12} className="shrink-0" style={{ opacity: 0.4, transform: subOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                                      </div>
                                    </div>
                                    {subOpen && (
                                      <div className="flex flex-col gap-1 py-2 pl-4" style={{ borderLeft: `2px solid ${c.color}`, marginLeft: "10px", opacity: 0.92 }}>
                                        {items
                                          .sort((a, b) => (a.date < b.date ? 1 : -1))
                                          .map((e) => renderTxRow(e, "expense"))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
                {renderAddForm()}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="fx-display text-lg font-medium">
                  {journalFilter === "cash" ? "Journal en espèces" : "Journal du mois"}
                </h2>
                <span className="text-xs" style={{ opacity: 0.5 }}>
                  {saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Erreur d'enregistrement" : loaded ? "Enregistré" : ""}
                </span>
              </div>
              <button onClick={() => setJournalFilter(journalFilter === "cash" ? "all" : "cash")}
                className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: journalFilter === "cash" ? "var(--petrol)" : "rgba(0,0,0,0.05)", color: journalFilter === "cash" ? "#fff" : "var(--ink)" }}>
                <Banknote size={14} /> {journalFilter === "cash" ? "Voir tout le journal" : "Voir le journal en espèces"}
                {journalFilter !== "cash" && cashTotal > 0 && (
                  <span className="fx-mono text-xs" style={{ opacity: 0.6 }}>({fmt(cashTotal)})</span>
                )}
              </button>
              {(journalFilter === "cash" ? cashLedger : ledger).length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>
                  {journalFilter === "cash" ? "Aucune écriture en espèces ce mois-ci." : "Aucune écriture ce mois-ci. Ajoutez une dépense ou un revenu ci-dessus."}
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {(journalFilter === "cash" ? cashLedger : ledger).map(([d, items]) => (
                    <div key={d}>
                      <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--sage)", letterSpacing: "0.08em" }}>{dayLabel(d)}</p>
                      <div className="flex flex-col gap-1.5">
                        {items.map((e) => renderTxRow(e, e.type))}
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
            {/* Mon épargne (comptes, patrimoine) */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="fx-display text-lg font-medium">Mon épargne</h2>
                <button onClick={() => setFullscreenChart("patrimoine")} aria-label="Plein écran" className="shrink-0 p-1 opacity-40 hover:opacity-90 transition-opacity">
                  <Maximize2 size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>{monthLabel(current)} — solde de chaque compte, à mettre à jour toi-même chaque mois</p>

              <div className="rounded-lg px-4 py-3 mb-4" style={{ background: "rgba(79,120,89,0.1)" }}>
                <p className="text-xs mb-1" style={{ opacity: 0.6 }}>Total épargné</p>
                <p className="fx-mono text-2xl font-medium" style={{ color: "var(--sage)" }}>{fmt(totalSavingsBalance)}</p>
              </div>

              {savingsAccounts.length === 0 ? (
                <p className="text-sm py-3 text-center" style={{ opacity: 0.5 }}>Ajoute un compte ci-dessous pour commencer (ex. Livret A, PEA...).</p>
              ) : (
                <div className="flex flex-col gap-2 mb-3">
                  {savingsAccountsWithValues.map((a) => {
                    const pct = totalSavingsBalance > 0 ? (a.value / totalSavingsBalance) * 100 : 0;
                    return (
                      <div key={a.id} className="cat-track" style={{ height: "34px" }}>
                        <div className="cat-fill" style={{ width: `${pct}%`, background: "var(--petrol)" }} />
                        <div className="relative h-full flex items-center px-3 gap-2 ledger-row group">
                          <span className="text-sm shrink-0">{a.name}</span>
                          <span className="dots" />
                          <input type="number" step="0.01" placeholder="0"
                            value={currentSavingsBalances[a.id] ?? ""}
                            onChange={(e) => updateSavingsBalance(a.id, e.target.value)}
                            style={{ width: "100px" }} className="fx-mono text-right" />
                          <span className="text-xs shrink-0 opacity-45 w-9 text-right">{Math.round(pct)}%</span>
                          <button onClick={() => removeSavingsAccount(a.id)} aria-label="Supprimer ce compte"
                            className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
                            <Trash2 size={12} style={{ color: "var(--coral)" }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasPrevMonthSavings && (
                <button onClick={copyPreviousMonthBalances} className="text-xs underline opacity-60 hover:opacity-100 mb-3">
                  Copier les soldes du mois précédent
                </button>
              )}

              <div className="flex gap-2 mb-2">
                <input type="text" placeholder="Nom du compte (ex. Livret A)" value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSavingsAccount()} />
                <button onClick={addSavingsAccount} className="shrink-0 flex items-center gap-1 rounded-lg px-3 text-sm font-medium" style={{ background: "var(--petrol)", color: "#fff" }}>
                  <Plus size={15} /> Ajouter
                </button>
              </div>

              {savingsEvolutionData.length > 1 && (
                <div style={{ height: 140, marginTop: "12px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={savingsEvolutionData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                      <Area type="monotone" dataKey="total" name="Épargne totale" stroke="#4F7859" fill="#4F7859" fillOpacity={0.18} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Taux d'épargne moyen", value: avgSavingsRate === null ? "—" : `${Math.round(avgSavingsRate)}%`, color: "var(--petrol)" },
                { label: "Épargné sur 6 mois", value: fmt(cumulSavings), color: cumulSavings >= 0 ? "var(--sage)" : "var(--coral)" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
                  <p className="text-xs mb-1" style={{ opacity: 0.55 }}>{s.label}</p>
                  <p className="fx-mono text-xl font-medium" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Détail du mois en cours */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-4">Ce mois-ci en détail</h2>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div>
                  <p className="text-xs mb-1" style={{ opacity: 0.55 }}>Transactions</p>
                  <p className="fx-mono text-lg font-medium">{txCount}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ opacity: 0.55 }}>Panier moyen</p>
                  <p className="fx-mono text-lg font-medium">{fmt(avgTx)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ opacity: 0.55 }}>Plus grosse dépense</p>
                  <p className="fx-mono text-lg font-medium">{fmt(maxTx)}</p>
                </div>
              </div>
              {topExpenses.length > 0 && (
                <>
                  <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--sage)", letterSpacing: "0.08em" }}>Top 5 des dépenses</p>
                  <div className="flex flex-col gap-1.5">
                    {topExpenses.map((e, i) => {
                      const c = CAT_MAP[e.category] || FALLBACK_CAT;
                      const Icon = c.icon;
                      return (
                        <div key={e.id} className="ledger-row text-sm py-1">
                          <span className="fx-mono shrink-0 w-4 text-right" style={{ opacity: 0.4 }}>{i + 1}</span>
                          <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: c.color }}>
                            <Icon size={11} color="#fff" />
                          </span>
                          <span className="shrink-0 max-w-[45%] truncate">{e.description}</span>
                          <span className="dots" />
                          <span className="fx-mono shrink-0">{fmt(e.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Répartition par catégorie (donut, mois en cours) */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="fx-display text-lg font-medium">Répartition des dépenses par catégorie</h2>
                <button onClick={() => setFullscreenChart("donut")} aria-label="Plein écran" className="shrink-0 p-1 opacity-40 hover:opacity-90 transition-opacity">
                  <Maximize2 size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Mois en cours</p>
              {pieData.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>Aucune dépense ce mois-ci.</p>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div style={{ width: 190, height: 190 }} className="shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 w-full">
                    {pieData.map((d) => {
                      const catDef = CAT_MAP[d.key] || FALLBACK_CAT;
                      const hasSubs = catDef.subcategories.length > 0;
                      const isOpen = pieExpandedCat === d.key;

                      let subRows = [];
                      let flatTx = [];
                      if (isOpen) {
                        const catTxAll = monthExpenses.filter((e) => e.category === d.key);
                        if (hasSubs) {
                          const map = {};
                          catTxAll.forEach((e) => {
                            const sub = e.subcategory || "Non précisé";
                            if (!map[sub]) map[sub] = { sub, total: 0, items: [] };
                            map[sub].total += e.amount;
                            map[sub].items.push(e);
                          });
                          subRows = Object.values(map).sort((a, b) => b.total - a.total);
                        } else {
                          flatTx = [...catTxAll].sort((a, b) => (a.date < b.date ? 1 : -1));
                        }
                      }

                      return (
                        <div key={d.key}>
                          <div className="ledger-row text-sm" style={{ cursor: "pointer" }}
                            onClick={() => { setPieExpandedCat(isOpen ? null : d.key); setPieExpandedSubcat(null); }}>
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                            <span className="shrink-0">{d.name}</span>
                            <span className="dots" />
                            <span className="fx-mono shrink-0">{fmt(d.value)}</span>
                            <ChevronDown size={13} className="shrink-0" style={{ opacity: 0.4, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                          </div>

                          {isOpen && !hasSubs && (
                            <div className="flex flex-col gap-1 py-2 pl-4" style={{ borderLeft: `2px solid ${d.color}`, marginLeft: "5px" }}>
                              {flatTx.length === 0 ? (
                                <p className="text-xs py-1" style={{ opacity: 0.5 }}>Aucune transaction ce mois-ci.</p>
                              ) : (
                                flatTx.map((e) => renderTxRow(e, "expense"))
                              )}
                            </div>
                          )}

                          {isOpen && hasSubs && (
                            <div className="flex flex-col gap-1.5 py-2 pl-4" style={{ borderLeft: `2px solid ${d.color}`, marginLeft: "5px" }}>
                              {subRows.map(({ sub, total, items }) => {
                                const subKey = `${d.key}::${sub}`;
                                const subOpen = pieExpandedSubcat === subKey;
                                const subPct = d.value > 0 ? (total / d.value) * 100 : 0;
                                return (
                                  <div key={sub}>
                                    <div className="cat-track" style={{ height: "28px", cursor: "pointer" }}
                                      onClick={() => setPieExpandedSubcat(subOpen ? null : subKey)}>
                                      <div className="cat-fill" style={{ width: `${subPct}%`, background: d.color, opacity: 0.28 }} />
                                      <div className="relative h-full flex items-center px-3 gap-2 ledger-row">
                                        <span className="text-sm shrink-0">{sub}</span>
                                        <span className="dots" />
                                        <span className="fx-mono text-xs shrink-0">{fmt(total)}</span>
                                        <span className="text-xs shrink-0 opacity-45 w-8 text-right">{Math.round(subPct)}%</span>
                                        <ChevronDown size={11} className="shrink-0" style={{ opacity: 0.4, transform: subOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                                      </div>
                                    </div>
                                    {subOpen && (
                                      <div className="flex flex-col gap-1 py-2 pl-4" style={{ borderLeft: `2px solid ${d.color}`, marginLeft: "10px" }}>
                                        {items
                                          .sort((a, b) => (a.date < b.date ? 1 : -1))
                                          .map((e) => renderTxRow(e, "expense"))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>



            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between mb-4">
                <h2 className="fx-display text-lg font-medium">Revenus vs dépenses</h2>
                <button onClick={() => setFullscreenChart("revenus-depenses")} aria-label="Plein écran" className="shrink-0 p-1 opacity-40 hover:opacity-90 transition-opacity">
                  <Maximize2 size={15} />
                </button>
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={periodFilteredMonths} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
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

            {/* Répartition des revenus (mois en cours) */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-1">Répartition des revenus</h2>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Mois en cours</p>
              {totalIncome === 0 ? (
                <p className="text-sm py-4 text-center" style={{ opacity: 0.5 }}>Aucun revenu ce mois-ci.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {incomeTotals.map((c) => {
                    const Icon = c.icon;
                    const isOpen = expandedIncomeCat === c.key;
                    const incTx = isOpen
                      ? [...monthIncomes].filter((e) => e.category === c.key).sort((a, b) => (a.date < b.date ? 1 : -1))
                      : [];
                    return (
                      <div key={c.key}>
                        <div className="cat-track" style={{ cursor: "pointer" }} onClick={() => setExpandedIncomeCat(isOpen ? null : c.key)}>
                          <div className="cat-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                          <div className="relative h-full flex items-center px-3 gap-2.5 ledger-row">
                            <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: c.color }}>
                              <Icon size={13} color="#fff" />
                            </span>
                            <span className="text-sm font-medium shrink-0">{c.label}</span>
                            <span className="dots" />
                            <span className="fx-mono text-sm shrink-0">{fmt(c.value)}</span>
                            <span className="text-xs shrink-0 opacity-50 w-9 text-right">{Math.round(c.pct)}%</span>
                            <ChevronDown size={14} className="shrink-0" style={{ opacity: 0.4, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                          </div>
                        </div>
                        {isOpen && (
                          <div className="flex flex-col gap-1 py-2 pl-4" style={{ borderLeft: `2px solid ${c.color}`, marginLeft: "12px" }}>
                            {incTx.length === 0 ? (
                              <p className="text-xs py-1" style={{ opacity: 0.5 }}>Aucun revenu dans cette catégorie ce mois-ci.</p>
                            ) : (
                              incTx.map((e) => renderTxRow(e, "income"))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Évolution des dépenses mensuelles (historique complet) */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="fx-display text-lg font-medium">Évolution des dépenses mensuelles</h2>
                <button onClick={() => setFullscreenChart("dep-mensuelles")} aria-label="Plein écran" className="shrink-0 p-1 opacity-40 hover:opacity-90 transition-opacity">
                  <Maximize2 size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Depuis votre première écriture</p>
              {periodFilteredMonths.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>Pas encore assez de données.</p>
              ) : (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={periodFilteredMonths} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                      <Area type="monotone" dataKey="expense" name="Dépenses" stroke="#C05A3D" fill="#C05A3D" fillOpacity={0.18} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Évolution des dépenses par catégorie (historique complet, barres empilées) */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="fx-display text-lg font-medium">Évolution des dépenses par catégorie</h2>
                <button onClick={() => setFullscreenChart("dep-categorie")} aria-label="Plein écran" className="shrink-0 p-1 opacity-40 hover:opacity-90 transition-opacity">
                  <Maximize2 size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Depuis votre première écriture</p>
              {periodFilteredCategoryMonthly.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>Pas encore assez de données.</p>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={periodFilteredCategoryMonthly} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {CATEGORIES.map((c) => (
                        <Bar key={c.key} dataKey={c.key} name={c.label} stackId="cat" fill={c.color} radius={[0, 0, 0, 0]} />
                      ))}
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Évolution des revenus par catégorie (historique complet, barres empilées) */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="fx-display text-lg font-medium">Évolution des revenus par catégorie</h2>
                <button onClick={() => setFullscreenChart("rev-categorie")} aria-label="Plein écran" className="shrink-0 p-1 opacity-40 hover:opacity-90 transition-opacity">
                  <Maximize2 size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Fixe / Variable / NDF / Autres — depuis votre première écriture</p>
              {periodFilteredIncomeMonthly.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>Pas encore assez de données.</p>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={periodFilteredIncomeMonthly} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {INCOME_CATEGORIES.map((c) => (
                        <Bar key={c.key} dataKey={c.key} name={c.label} stackId="inc" fill={c.color} radius={[0, 0, 0, 0]} />
                      ))}
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Évolution de l'épargne (historique complet, barres + cumul) */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="fx-display text-lg font-medium">Évolution de l'épargne</h2>
                <button onClick={() => setFullscreenChart("epargne")} aria-label="Plein écran" className="shrink-0 p-1 opacity-40 hover:opacity-90 transition-opacity">
                  <Maximize2 size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>
                Barres = épargne du mois · ligne = épargne cumulée · pointillés = objectif de {fmt(savingsGoal)}
                {bestMonth && worstMonth && bestMonth.key !== worstMonth.key && (
                  <> · meilleur mois (6 derniers) : {bestMonth.label} · plus faible : {worstMonth.label}</>
                )}
              </p>
              {periodFilteredMonths.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>Pas encore assez de données.</p>
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={periodFilteredMonths} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 12, borderRadius: 8, border: "1px solid var(--line)" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine y={savingsGoal} stroke="#B8901F" strokeDasharray="4 4" />
                      <Bar dataKey="savings" name="Épargne du mois" radius={[4, 4, 0, 0]}>
                        {periodFilteredMonths.map((d, i) => (
                          <Cell key={i} fill={d.savings >= 0 ? "#4F7859" : "#C05A3D"} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="cumulative" name="Épargne cumulée" stroke="#1F3A3E" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Décomposition du salaire */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-1">Décomposition du salaire</h2>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Mois en cours — ton relevé bancaire affiche un seul virement, répartis-le ici selon ton bulletin de paie</p>

              <div className="ledger-row text-sm mb-3">
                <span className="shrink-0 font-medium">Salaire perçu (banque)</span>
                <span className="dots" />
                <span className="fx-mono shrink-0 font-medium">{fmt(salaireTotal)}</span>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                {[
                  { field: "fixe", label: "Fixe" },
                  { field: "variable", label: "Variable" },
                  { field: "ndf", label: "NDF" },
                ].map((f) => (
                  <div key={f.field} className="ledger-row text-sm">
                    <span className="shrink-0">{f.label}</span>
                    <span className="dots" />
                    <input type="number" step="0.01" min="0" placeholder="0"
                      value={sbDraft[f.field] ?? ""}
                      onChange={(e) => updateSalaryBreakdown(f.field, e.target.value)}
                      style={{ width: "100px" }} className="fx-mono text-right" />
                  </div>
                ))}
              </div>

              <div className="rounded-lg px-4 py-2.5 flex items-center justify-between"
                style={{ background: Math.abs(sbDelta) < 0.01 ? "rgba(79,120,89,0.1)" : "rgba(192,90,61,0.1)" }}>
                <span className="text-sm font-medium">Écart avec le salaire perçu</span>
                <span className="fx-mono text-sm font-medium" style={{ color: Math.abs(sbDelta) < 0.01 ? "var(--sage)" : "var(--coral)" }}>
                  {fmt(sbDelta)}
                </span>
              </div>
            </div>

            {/* Simulateur coûts voiture & déplacements pro */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-1">Simulateur voiture & déplacements pro</h2>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Mois en cours — coûts réels calculés depuis tes transactions, à comparer au remboursement NDF</p>

              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--coral)", letterSpacing: "0.08em" }}>Sorties</p>
              <div className="flex flex-col gap-1.5 mb-4">
                {[
                  { label: "Crédit voiture", value: carSim.credit },
                  { label: "Assurance voiture", value: carSim.assurance },
                  { label: "Essence", value: carSim.essence },
                  { label: "Autoroute", value: carSim.autoroute },
                  { label: "Hôtel", value: carSim.hotel },
                  { label: "Repas NDF", value: carSim.repas },
                ].map((l) => (
                  <div key={l.label} className="ledger-row text-sm">
                    <span className="shrink-0">{l.label}</span>
                    <span className="dots" />
                    <span className="fx-mono shrink-0">{fmt(l.value)}</span>
                  </div>
                ))}
                <div className="ledger-row text-sm pt-2 mt-1" style={{ borderTop: "1px solid var(--line)" }}>
                  <span className="shrink-0 font-medium">Total sorties</span>
                  <span className="dots" />
                  <span className="fx-mono shrink-0 font-medium">{fmt(carSimTotal)}</span>
                </div>
              </div>

              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--sage)", letterSpacing: "0.08em" }}>Entrée</p>
              <div className="ledger-row text-sm mb-4">
                <span className="shrink-0">Montant remboursé NDF</span>
                <span className="text-xs shrink-0" style={{ opacity: 0.45 }}>(défini dans l'encart ci-dessus)</span>
                <span className="dots" />
                <span className="fx-mono shrink-0">{fmt(ndfReimbursedAmount)}</span>
              </div>

              <div className="rounded-lg px-4 py-3 flex items-center justify-between"
                style={{ background: carSimDelta >= 0 ? "rgba(79,120,89,0.1)" : "rgba(192,90,61,0.1)" }}>
                <span className="text-sm font-medium">Delta (entrée − sorties)</span>
                <span className="fx-mono text-lg font-medium" style={{ color: carSimDelta >= 0 ? "var(--sage)" : "var(--coral)" }}>
                  {carSimDelta >= 0 ? "+" : ""}{fmt(carSimDelta)}
                </span>
              </div>
            </div>

            {/* Mes voyages */}
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-1">Mes voyages</h2>
              <p className="text-xs mb-4" style={{ opacity: 0.55 }}>Regroupe des dépenses existantes (ou nouvelles) sous un voyage pour voir leur répartition par poste</p>

              <div className="flex gap-2 mb-4">
                <input type="text" placeholder="Titre du voyage (ex. Rome 2026)" value={newTripTitle}
                  onChange={(e) => setNewTripTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createTrip()} />
                <button onClick={createTrip} className="shrink-0 flex items-center gap-1 rounded-lg px-3 text-sm font-medium" style={{ background: "var(--petrol)", color: "#fff" }}>
                  <Plus size={15} /> Créer
                </button>
              </div>

              {tripsWithTotals.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ opacity: 0.5 }}>Aucun voyage pour l'instant. Crée-en un ci-dessus.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {tripsWithTotals.map((t) => {
                    const isOpen = expandedTrip === t.id;
                    return (
                      <div key={t.id} className="rounded-lg" style={{ border: "1px solid var(--line)" }}>
                        <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ cursor: "pointer" }}
                          onClick={() => { setExpandedTrip(isOpen ? null : t.id); setTripImportSearch(""); }}>
                          <Plane size={15} style={{ color: "var(--petrol)" }} className="shrink-0" />
                          <span className="text-sm font-medium shrink-0">{t.title}</span>
                          <span className="dots" />
                          <span className="fx-mono text-sm shrink-0">{fmt(t.total)}</span>
                          <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Supprimer le voyage "${t.title}" ? Les dépenses associées ne seront pas supprimées, juste détachées.`)) deleteTrip(t.id); }}
                            aria-label="Supprimer le voyage" className="shrink-0 p-1 opacity-50 hover:opacity-100">
                            <Trash2 size={13} style={{ color: "var(--coral)" }} />
                          </button>
                          <ChevronDown size={14} className="shrink-0" style={{ opacity: 0.4, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                        </div>

                        {isOpen && (
                          <div className="px-3 pb-3 pt-2 flex flex-col gap-4" style={{ borderTop: "1px solid var(--line)" }}>
                            {t.total > 0 && (
                              <div className="flex flex-col gap-1.5">
                                {TRIP_CATEGORIES.filter((c) => t.byCat[c] > 0).map((c) => {
                                  const pct = t.total > 0 ? (t.byCat[c] / t.total) * 100 : 0;
                                  return (
                                    <div key={c} className="cat-track" style={{ height: "28px" }}>
                                      <div className="cat-fill" style={{ width: `${pct}%`, background: TRIP_CAT_COLORS[c] }} />
                                      <div className="relative h-full flex items-center px-3 gap-2 ledger-row">
                                        <span className="text-sm shrink-0">{c}</span>
                                        <span className="dots" />
                                        <span className="fx-mono text-xs shrink-0">{fmt(t.byCat[c])}</span>
                                        <span className="text-xs shrink-0 opacity-45 w-8 text-right">{Math.round(pct)}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="flex flex-col gap-1">
                              {t.items.length === 0 ? (
                                <p className="text-xs py-1" style={{ opacity: 0.5 }}>Aucune dépense dans ce voyage pour l'instant.</p>
                              ) : (
                                t.items.map((e) => {
                                  const isEditingThis = editingEntry && editingEntry.id === e.id && editingEntry.type === "expense";
                                  if (isEditingThis) return renderTxRow(e, "expense");
                                  const c = CAT_MAP[e.category] || FALLBACK_CAT;
                                  const Icon = c.icon;
                                  return (
                                    <div key={e.id} className="ledger-row group text-sm py-1">
                                      <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: TRIP_CAT_COLORS[e.tripCategory] || TRIP_CAT_COLORS.Autre }}>
                                        <Icon size={11} color="#fff" />
                                      </span>
                                      <span className="fx-mono shrink-0 text-xs" style={{ opacity: 0.5, width: "32px" }}>{e.date.slice(8, 10)}/{e.date.slice(5, 7)}</span>
                                      <span className="shrink-0 max-w-[22%] truncate">{e.description}</span>
                                      <select value={e.tripCategory || "Autre"} onChange={(ev) => changeTripCategory(e.id, ev.target.value)}
                                        style={{ width: "auto", padding: "2px 6px", fontSize: "12px" }}>
                                        {TRIP_CATEGORIES.map((tc) => <option key={tc} value={tc}>{tc}</option>)}
                                      </select>
                                      <label className="flex items-center gap-1 shrink-0 text-xs" style={{ opacity: 0.55 }} title="Compter cette dépense dans le budget du mois">
                                        <input type="checkbox" checked={!e.excludeFromMonth} onChange={(ev) => toggleTripExpenseCount(e.id, ev.target.checked)} style={{ width: "auto" }} />
                                        Mois
                                      </label>
                                      <span className="dots" />
                                      <span className="fx-mono text-sm shrink-0">{fmt(e.amount)}</span>
                                      <button onClick={() => startEditEntry(e, "expense")} aria-label="Modifier" title="Modifier"
                                        className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
                                        <Pencil size={12} style={{ color: "var(--petrol)" }} />
                                      </button>
                                      <button onClick={() => removeExpenseFromTrip(e.id)} aria-label="Retirer du voyage" title="Retirer du voyage"
                                        className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
                                        <X size={13} style={{ color: "var(--ink)" }} />
                                      </button>
                                      <button onClick={() => removeEntry(e.id, "expense")} aria-label="Supprimer définitivement" title="Supprimer définitivement"
                                        className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1">
                                        <Trash2 size={13} style={{ color: "var(--coral)" }} />
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            <div className="rounded-lg p-3" style={{ background: "rgba(31,58,62,0.04)" }}>
                              <p className="text-xs font-medium mb-2" style={{ opacity: 0.6 }}>Ajouter une dépense</p>
                              <div className="flex flex-col gap-2">
                                <input type="text" placeholder="Description" value={tripAddDraft.description}
                                  onChange={(e) => setTripAddDraft((d) => ({ ...d, description: e.target.value }))} />
                                <div className="flex gap-2">
                                  <input type="number" step="0.01" min="0" placeholder="Montant" value={tripAddDraft.amount}
                                    onChange={(e) => setTripAddDraft((d) => ({ ...d, amount: e.target.value }))} style={{ width: "34%" }} />
                                  <input type="date" value={tripAddDraft.date}
                                    onChange={(e) => setTripAddDraft((d) => ({ ...d, date: e.target.value }))} style={{ width: "36%" }} />
                                  <select value={tripAddDraft.tripCategory} onChange={(e) => setTripAddDraft((d) => ({ ...d, tripCategory: e.target.value }))} style={{ width: "30%" }}>
                                    {TRIP_CATEGORIES.map((tc) => <option key={tc} value={tc}>{tc}</option>)}
                                  </select>
                                </div>
                                <button onClick={() => addTripExpense(t.id)} className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium" style={{ background: "var(--petrol)", color: "#fff" }}>
                                  <Plus size={14} /> Ajouter au voyage
                                </button>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-medium mb-2" style={{ opacity: 0.6 }}>Importer une dépense existante</p>
                              <input type="text" placeholder="Rechercher par description..." value={tripImportSearch}
                                onChange={(e) => setTripImportSearch(e.target.value)} style={{ marginBottom: "8px" }} />
                              <div className="flex flex-col gap-1" style={{ maxHeight: "210px", overflowY: "auto" }}>
                                {unassignedExpenses
                                  .filter((e) => tripImportSearch.trim() === "" || e.description.toLowerCase().includes(tripImportSearch.trim().toLowerCase()))
                                  .slice(0, tripImportSearch.trim() === "" ? 10 : 25)
                                  .map((e) => {
                                    const c = CAT_MAP[e.category] || FALLBACK_CAT;
                                    const Icon = c.icon;
                                    return (
                                      <div key={e.id} className="ledger-row text-sm py-1">
                                        <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: c.color }}>
                                          <Icon size={11} color="#fff" />
                                        </span>
                                        <span className="fx-mono shrink-0 text-xs" style={{ opacity: 0.5, width: "32px" }}>{e.date.slice(8, 10)}/{e.date.slice(5, 7)}</span>
                                        <span className="shrink-0 max-w-[38%] truncate">{e.description}</span>
                                        <span className="dots" />
                                        <span className="fx-mono text-sm shrink-0">{fmt(e.amount)}</span>
                                        <button onClick={() => importExpenseToTrip(t.id, e.id)} className="shrink-0 text-xs px-2 py-1 rounded-md font-medium" style={{ background: "var(--sage)", color: "#fff" }}>
                                          Ajouter
                                        </button>
                                      </div>
                                    );
                                  })}
                                {unassignedExpenses.filter((e) => tripImportSearch.trim() === "" || e.description.toLowerCase().includes(tripImportSearch.trim().toLowerCase())).length === 0 && (
                                  <p className="text-xs py-2" style={{ opacity: 0.5 }}>Aucune dépense non assignée ne correspond.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <h2 className="fx-display text-lg font-medium mb-1">Moyenne par catégorie</h2>
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

      {fullscreenChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,36,31,0.65)" }}
          onClick={() => setFullscreenChart(null)}>
          <div className="rounded-xl p-6 w-full" style={{ background: "#FFFFFF", maxWidth: "900px", maxHeight: "88vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="fx-display text-xl font-medium">{CHART_TITLES[fullscreenChart]}</h2>
              <button onClick={() => setFullscreenChart(null)} aria-label="Fermer" className="p-1.5 rounded-md hover:bg-black/5">
                <X size={20} />
              </button>
            </div>

            {PERIOD_CHART_IDS.includes(fullscreenChart) && (
              <div className="flex gap-1 mb-5 rounded-lg w-fit" style={{ background: "rgba(0,0,0,0.04)", padding: "3px" }}>
                {[3, 6, 12, "all"].map((p) => (
                  <button key={p} onClick={() => setEvolutionPeriod(p)} className="px-3 py-1.5 text-sm rounded-md font-medium"
                    style={{ background: evolutionPeriod === p ? "var(--card)" : "transparent", opacity: evolutionPeriod === p ? 1 : 0.6, boxShadow: evolutionPeriod === p ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
                    {p === "all" ? "Tout" : `${p} mois`}
                  </button>
                ))}
              </div>
            )}

            {fullscreenChart === "donut" && (
              <div className="flex flex-col items-center gap-6">
                <div style={{ width: 320, height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={90} outerRadius={150} paddingAngle={2}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-md">
                  {pieData.map((d) => (
                    <div key={d.key} className="ledger-row text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="shrink-0">{d.name}</span>
                      <span className="dots" />
                      <span className="fx-mono shrink-0">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fullscreenChart === "revenus-depenses" && (
              <div style={{ height: 450 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={periodFilteredMonths} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="income" name="Revenus" fill="#4F7859" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Dépenses" fill="#C05A3D" radius={[4, 4, 0, 0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            )}

            {fullscreenChart === "dep-mensuelles" && (
              <div style={{ height: 450 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={periodFilteredMonths} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }} />
                    <Area type="monotone" dataKey="expense" name="Dépenses" stroke="#C05A3D" fill="#C05A3D" fillOpacity={0.18} strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {fullscreenChart === "dep-categorie" && (
              <div style={{ height: 450 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={periodFilteredCategoryMonthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {CATEGORIES.map((c) => (
                      <Bar key={c.key} dataKey={c.key} name={c.label} stackId="cat" fill={c.color} radius={[0, 0, 0, 0]} />
                    ))}
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            )}

            {fullscreenChart === "rev-categorie" && (
              <div style={{ height: 450 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={periodFilteredIncomeMonthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    {INCOME_CATEGORIES.map((c) => (
                      <Bar key={c.key} dataKey={c.key} name={c.label} stackId="inc" fill={c.color} radius={[0, 0, 0, 0]} />
                    ))}
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            )}

            {fullscreenChart === "epargne" && (
              <div style={{ height: 450 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={periodFilteredMonths} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <ReferenceLine y={savingsGoal} stroke="#B8901F" strokeDasharray="4 4" />
                    <Bar dataKey="savings" name="Épargne du mois" radius={[4, 4, 0, 0]}>
                      {periodFilteredMonths.map((d, i) => (
                        <Cell key={i} fill={d.savings >= 0 ? "#4F7859" : "#C05A3D"} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="cumulative" name="Épargne cumulée" stroke="#1F3A3E" strokeWidth={2.5} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {fullscreenChart === "patrimoine" && (
              <div style={{ height: 450 }}>
                {savingsEvolutionData.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ opacity: 0.5 }}>Ajoute au moins un compte et un solde pour voir l'évolution.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={savingsEvolutionData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--ink)" }} axisLine={false} tickLine={false} width={55} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "IBM Plex Sans", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }} />
                      <Area type="monotone" dataKey="total" name="Épargne totale" stroke="#4F7859" fill="#4F7859" fillOpacity={0.18} strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
