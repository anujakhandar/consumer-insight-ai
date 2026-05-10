import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  FiActivity,
  FiBarChart2,
  FiCheckCircle,
  FiDownload,
  FiGrid,
  FiHeart,
  FiLink,
  FiMenu,
  FiSearch,
  FiUsers,
  FiX
} from "react-icons/fi";
import jsPDF from "jspdf";
import { createSharedReport, fetchConsumerInsights, fetchSharedReport } from "./services/geminiService";

const HISTORY_KEY = "consumer-insight-history";
const trendingProducts = ["Maggi", "iPhone", "Zomato", "Swiggy", "Surf Excel"];
const typingWords = ["Maggi Noodles", "iPhone 16", "Zomato Gold", "Swiggy Instamart", "Surf Excel"];

const Card = ({ title, children, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className={`glass rounded-2xl p-6 border border-indigo-200/10 shadow-xl ${className}`}
  >
    {title && <h3 className="text-sm text-slate-300 tracking-wide uppercase mb-4">{title}</h3>}
    {children}
  </motion.div>
);

const Skeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-28 bg-indigo-100/10 rounded-2xl" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="h-40 bg-indigo-100/10 rounded-2xl" />
      <div className="h-40 bg-indigo-100/10 rounded-2xl" />
      <div className="h-40 bg-indigo-100/10 rounded-2xl" />
    </div>
    <div className="h-72 bg-indigo-100/10 rounded-2xl" />
  </div>
);

const AnimatedNumber = ({ value, decimals = 1 }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame;
    let start;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / 700, 1);
      setDisplay(value * progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
};

function App() {
  const [product, setProduct] = useState("");
  const [typedIndex, setTypedIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [insight, setInsight] = useState(null);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState("");
  const [activeEmotion, setActiveEmotion] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [compareResult, setCompareResult] = useState({ left: null, right: null });
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    setHistory(savedHistory);
    const reportId = new URLSearchParams(window.location.search).get("reportId");
    if (!reportId) return;
    fetchSharedReport(reportId)
      .then((report) => {
        setInsight(report);
        setProduct(report.productName || "");
      })
      .catch(() => setError("Shared report not found"));
  }, []);

  useEffect(() => {
    const word = typingWords[typedIndex];
    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      setTypedText(word.slice(0, idx));
      if (idx >= word.length) {
        clearInterval(timer);
        setTimeout(() => {
          setTypedIndex((v) => (v + 1) % typingWords.length);
          setTypedText("");
        }, 850);
      }
    }, 75);
    return () => clearInterval(timer);
  }, [typedIndex]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const updateHistory = (entry) => {
    const next = [entry, ...history.filter((item) => item.product !== entry.product)].slice(0, 5);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const runAnalysis = async (name) => {
    if (!name?.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchConsumerInsights(name.trim());
      setInsight(result);
      updateHistory({ product: name.trim(), result, createdAt: Date.now() });
    } catch (e) {
      setError("Unable to analyze right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const runCompare = async () => {
    if (!compareLeft.trim() || !compareRight.trim()) return;
    setCompareLoading(true);
    try {
      const [left, right] = await Promise.all([
        fetchConsumerInsights(compareLeft.trim()),
        fetchConsumerInsights(compareRight.trim())
      ]);
      setCompareResult({ left, right });
    } finally {
      setCompareLoading(false);
    }
  };

  const emotionColors = {
    Joy: "#16C47F",
    Anger: "#FF4D4D",
    Surprise: "#5B8CFF",
    Disgust: "#A855F7",
    Trust: "#22D3EE"
  };

  const emotions = useMemo(() => {
    if (!insight?.emotions) return [];
    const map = {};
    insight.emotions.forEach((item) => {
      map[item.emotion] = Number(item.percent || 0);
    });
    if (!map.Trust) {
      const known = (map.Joy || 0) + (map.Anger || 0) + (map.Surprise || 0) + (map.Disgust || 0);
      map.Trust = Math.max(5, 100 - known);
    }
    return ["Joy", "Anger", "Surprise", "Disgust", "Trust"].map((key) => ({
      emotion: key,
      percent: map[key] || 1
    }));
  }, [insight]);

  const scoreColor = (value, max) => {
    const scaled = (value / max) * 10;
    if (scaled < 5) return "text-red-400";
    if (scaled < 7) return "text-yellow-300";
    return "text-green-400";
  };

  const exportPDF = () => {
    if (!insight) return;
    const pdf = new jsPDF("p", "pt", "a4");
    pdf.setFillColor(10, 10, 26);
    pdf.rect(0, 0, 595, 842, "F");
    pdf.setTextColor(230, 240, 255);
    pdf.setFontSize(22);
    pdf.text("Consumer Insight AI Report", 36, 50);
    pdf.setFontSize(13);
    pdf.text(`Product: ${insight.productName}`, 36, 78);
    pdf.text(`Summary: ${insight.summary}`, 36, 110, { maxWidth: 520 });
    pdf.addPage();
    pdf.setFillColor(10, 10, 26);
    pdf.rect(0, 0, 595, 842, "F");
    pdf.setTextColor(230, 240, 255);
    pdf.text("Voice of Customer + Actions", 36, 50);
    pdf.text(`Love: ${(insight.love || []).map((l) => `${l.label} (${l.percent}%)`).join(", ")}`, 36, 80, { maxWidth: 520 });
    pdf.text(`Hate: ${(insight.hate || []).map((h) => `${h.label} (${h.percent}%)`).join(", ")}`, 36, 130, { maxWidth: 520 });
    pdf.text(`Recommendations: ${(insight.recommendations || []).join(" | ")}`, 36, 190, { maxWidth: 520 });
    pdf.save(`${insight.productName.replace(/\s+/g, "-").toLowerCase()}-consumer-report.pdf`);
    setToast("PDF saved successfully");
  };

  const shareReport = async () => {
    if (!insight) return;
    try {
      const { id } = await createSharedReport(insight);
      const shareUrl = `${window.location.origin}${window.location.pathname}?reportId=${id}`;
      await navigator.clipboard.writeText(shareUrl);
      setToast("Share link copied");
    } catch (error) {
      setError("Unable to create share link.");
    }
  };

  const navItems = [
    { label: "Analysis", href: "#analysis" },
    { label: "Compare", href: "#compare" },
    { label: "Trending", href: "#trending" },
    { label: "About", href: "#about" }
  ];

  return (
    <div className="min-h-screen text-slate-100 bg-[#0a0a1a] relative overflow-x-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#0a0a1a]/70 border-b border-indigo-200/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="font-bold text-lg">Consumer Insight AI</div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>
          <button onClick={() => setMenuOpen((v) => !v)} className="md:hidden text-xl">
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-4 pb-4 space-y-2">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="block text-slate-300">
                {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-6">
        <section id="analysis" className="space-y-6">
          <h1 className="text-center text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Consumer Insight AI
          </h1>
          <p className="text-center text-lg text-slate-300 h-7">
            Live insights for <span className="text-indigo-300">{typedText}</span>
            <span className="animate-pulse">|</span>
          </p>
          <div className="max-w-3xl mx-auto glass rounded-2xl p-6 space-y-4">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAnalysis(product)}
                placeholder='Enter product name (e.g., "Maggi Noodles", "iPhone 16")'
                className="w-full bg-[#121233] border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => runAnalysis(product)}
              className="w-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-xl px-6 py-4 font-semibold active:scale-[0.98]"
            >
              Analyze
            </button>
            <div id="trending" className="flex flex-wrap justify-center gap-2">
              {trendingProducts.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setProduct(item);
                    runAnalysis(item);
                  }}
                  className="px-3 py-2 rounded-full bg-indigo-500/15 border border-indigo-400/20 text-sm hover:bg-indigo-500/25"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-center text-red-300">{error}</p>}
        </section>

        <section>
          <Card title="Search History">
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={`${item.product}-${item.createdAt}`}
                  onClick={() => runAnalysis(item.product)}
                  className="px-3 py-2 rounded-full bg-slate-800 border border-slate-700 text-sm"
                >
                  🔎 {item.product}
                </button>
              ))}
            </div>
          </Card>
        </section>

        {loading && <Skeleton />}

        {!loading && insight && (
          <section className="space-y-6">
            <Card className="relative">
              <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs bg-indigo-500/20 border border-indigo-300/20">
                {insight.trend?.direction?.toUpperCase()}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">{insight.productName}</h2>
              <p className="text-slate-300">{insight.summary}</p>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Sentiment Score", value: insight.overallSentimentScore, max: 10 },
                { label: "Brand Health", value: insight.brandHealthScore, max: 100 },
                { label: "Price Perception", value: insight.pricePerception?.valueForMoneyScore || 0, max: 10 }
              ].map((score) => (
                <Card key={score.label} title={score.label}>
                  <p className={`text-4xl font-bold ${scoreColor(score.value, score.max)}`}>
                    <AnimatedNumber value={score.value} />/{score.max}
                  </p>
                  <div className="h-2 bg-slate-800 rounded-full mt-4 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((score.value / score.max) * 100, 100)}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    />
                  </div>
                </Card>
              ))}
            </div>

            <Card title="What Customers Love vs Hate">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3 pr-0 lg:pr-4 lg:border-r lg:border-indigo-200/10">
                  <h4 className="text-green-300 font-semibold">Love</h4>
                  {(insight.love || []).map((item, idx) => (
                    <div key={idx} className="bg-green-500/10 rounded-lg p-3 border border-green-400/20">
                      <div className="flex justify-between">
                        <p className="text-green-300">{item.emoji} {item.label}</p>
                        <p className="text-green-300">{item.percent}%</p>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${item.percent}%` }} className="h-full bg-green-400" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h4 className="text-red-300 font-semibold">Hate</h4>
                  {(insight.hate || []).map((item, idx) => (
                    <div key={idx} className="bg-red-500/10 rounded-lg p-3 border border-red-400/20">
                      <div className="flex justify-between">
                        <p className="text-red-300">{item.emoji} {item.label}</p>
                        <p className="text-red-300">{item.percent}%</p>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${item.percent}%` }} className="h-full bg-red-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Emotional Analysis" className="h-[430px]">
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie data={emotions} dataKey="percent" nameKey="emotion" innerRadius={90} outerRadius={140} label onClick={setActiveEmotion}>
                    {emotions.map((entry) => (
                      <Cell key={entry.emotion} fill={emotionColors[entry.emotion]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {activeEmotion && <p className="text-center text-slate-300">{activeEmotion.emotion}: {activeEmotion.percent}%</p>}
            </Card>

            <Card title="Top Requested Features">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {(insight.topRequestedFeatures || []).slice(0, 5).map((feature) => (
                  <div key={feature.feature} className="bg-slate-900/70 rounded-xl p-4 border border-indigo-200/10">
                    <FiGrid className="text-indigo-300 mb-2" />
                    <p className="font-semibold">{feature.feature}</p>
                    <p className="text-sm text-slate-400">Requested by {feature.mentionsPercent}% users.</p>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Target Audience">
                <div className="space-y-3">
                  {(insight.targetAudience || []).map((audience, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between mb-1">
                        <span>{audience.segment}</span>
                        <span>{audience.percent}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${audience.percent}%` }} className="h-full bg-indigo-500" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-lg">Age: 18-35</div>
                  <div className="bg-slate-900/60 p-3 rounded-lg">Gender: Mixed</div>
                  <div className="bg-slate-900/60 p-3 rounded-lg">Urban Focus</div>
                </div>
              </Card>

              <Card title="PM Recommendations">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(insight.recommendations || []).slice(0, 3).map((item, idx) => (
                    <div key={idx} className="rounded-xl p-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-300/20">
                      <p className="text-2xl font-bold text-indigo-300 mb-2">{idx + 1}</p>
                      <p className="text-sm text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={exportPDF} className="bg-slate-800 hover:bg-slate-700 rounded-xl px-4 py-3 border border-slate-700 inline-flex gap-2 items-center active:scale-[0.98]">
                <FiDownload /> Download PDF
              </button>
              <button onClick={shareReport} className="bg-slate-800 hover:bg-slate-700 rounded-xl px-4 py-3 border border-slate-700 inline-flex gap-2 items-center active:scale-[0.98]">
                <FiLink /> Share Report
              </button>
            </div>
          </section>
        )}

        <section id="compare">
          <Card title="Compare Mode">
            <button onClick={() => setCompareMode((v) => !v)} className="mb-4 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-300/20">
              {compareMode ? "Turn Compare Off" : "Turn Compare On"}
            </button>
            {compareMode && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  <input value={compareLeft} onChange={(e) => setCompareLeft(e.target.value)} placeholder="First product" className="w-full bg-[#121233] border border-slate-700 rounded-xl py-3 px-4" />
                  <div className="text-center font-bold text-indigo-300">VS</div>
                  <input value={compareRight} onChange={(e) => setCompareRight(e.target.value)} placeholder="Second product" className="w-full bg-[#121233] border border-slate-700 rounded-xl py-3 px-4" />
                </div>
                <button onClick={runCompare} className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] active:scale-[0.98]">
                  Compare Products
                </button>
                {compareLoading && <div className="text-slate-300">Running compare analysis...</div>}
                {compareResult.left && compareResult.right && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[compareResult.left, compareResult.right].map((item) => (
                      <div key={item.productName} className="bg-slate-900/70 rounded-xl p-4 border border-indigo-200/10">
                        <p className="text-xl font-bold mb-2">{item.productName}</p>
                        <p className="text-slate-300 text-sm mb-3">{item.summary}</p>
                        <p>Sentiment: {item.overallSentimentScore}/10</p>
                        <p>Brand Health: {item.brandHealthScore}/100</p>
                        <p>Trend: {item.trend?.direction}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </section>

        <section id="about">
          <Card title="About">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-slate-900/60 rounded-xl p-4 border border-indigo-200/10"><FiBarChart2 className="mb-2" />AI sentiment analytics</div>
              <div className="bg-slate-900/60 rounded-xl p-4 border border-indigo-200/10"><FiHeart className="mb-2" />Love/hate mapping</div>
              <div className="bg-slate-900/60 rounded-xl p-4 border border-indigo-200/10"><FiUsers className="mb-2" />Audience intelligence</div>
              <div className="bg-slate-900/60 rounded-xl p-4 border border-indigo-200/10"><FiActivity className="mb-2" />Action-ready insights</div>
            </div>
          </Card>
        </section>
      </main>

      {toast && (
        <div className="fixed right-4 bottom-4 z-50 px-4 py-3 rounded-xl bg-indigo-500/90 text-white shadow-xl inline-flex items-center gap-2">
          <FiCheckCircle />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
