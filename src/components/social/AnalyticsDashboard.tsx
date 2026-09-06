import { useState } from "react";
import {
  TrendingUp,
  Users,
  Eye,
  MousePointerClick,
  Sparkles,
  ArrowUpRight,
  Download,
  Calendar,
  Lock,
  DollarSign,
  Clock,
  Zap,
  Target,
  Award,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { usePlan, openUpgradeModal } from "@/lib/plan-state";
import { useMonetization } from "@/lib/monetization-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const REACH_DATA_7D = [
  { day: "Mon", impressions: 1240, reach: 980, engagement: 8.2 },
  { day: "Tue", impressions: 1890, reach: 1420, engagement: 9.1 },
  { day: "Wed", impressions: 2400, reach: 1910, engagement: 11.4 },
  { day: "Thu", impressions: 2100, reach: 1650, engagement: 8.9 },
  { day: "Fri", impressions: 3200, reach: 2540, engagement: 12.8 },
  { day: "Sat", impressions: 4100, reach: 3280, engagement: 14.5 },
  { day: "Sun", impressions: 4850, reach: 3920, engagement: 15.2 },
];

const REACH_DATA_30D = [
  { day: "Week 1", impressions: 12400, reach: 9800, engagement: 9.4 },
  { day: "Week 2", impressions: 16800, reach: 13200, engagement: 10.8 },
  { day: "Week 3", impressions: 22400, reach: 17800, engagement: 12.1 },
  { day: "Week 4", impressions: 28900, reach: 23100, engagement: 14.6 },
];

const HOURLY_PEAK_DATA = [
  { hour: "12am", activity: 12 },
  { hour: "3am", activity: 8 },
  { hour: "6am", activity: 22 },
  { hour: "9am", activity: 68 },
  { hour: "12pm", activity: 85 },
  { hour: "3pm", activity: 94 },
  { hour: "6pm", activity: 98 },
  { hour: "9pm", activity: 76 },
];

const AUDIENCE_REGIONS = [
  { country: "United States", percentage: 42, color: "bg-brand" },
  { country: "United Kingdom", percentage: 18, color: "bg-violet-400" },
  { country: "Germany", percentage: 14, color: "bg-pink-500" },
  { country: "Canada", percentage: 12, color: "bg-amber-400" },
  { country: "Other", percentage: 14, color: "bg-muted-foreground/40" },
];

const TOP_POSTS = [
  {
    id: "p1",
    title: "Building next-generation distributed audio spaces...",
    views: 4820,
    likes: 384,
    reposts: 92,
    ctr: "14.2%",
    tips: "$45.00",
  },
  {
    id: "p2",
    title: "Design systems for multi-tier creator memberships",
    views: 3190,
    likes: 245,
    reposts: 58,
    ctr: "11.8%",
    tips: "$20.00",
  },
  {
    id: "p3",
    title: "Why micro-communities are beating algorithmic feeds",
    views: 2950,
    likes: 210,
    reposts: 44,
    ctr: "9.5%",
    tips: "$15.00",
  },
];

export function AnalyticsDashboard() {
  const { currentPlan, isPlus, isPro } = usePlan();
  const { totalEarnings, pendingBalance } = useMonetization();
  const [timeframe, setTimeframe] = useState<"7d" | "30d">("7d");
  const [activeTab, setActiveTab] = useState<"overview" | "audience" | "revenue" | "ai_insights">("overview");

  const chartData = timeframe === "7d" ? REACH_DATA_7D : REACH_DATA_30D;

  const handleExportData = () => {
    if (!isPlus) {
      openUpgradeModal("Export Analytics Data");
      return;
    }
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Period,Impressions,Reach,EngagementRate"]
        .concat(
          chartData.map(
            (r) => `${r.day},${r.impressions},${r.reach},${r.engagement}%`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `spaces_analytics_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics data exported to CSV!");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black">Creator Analytics</h2>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide",
              isPro
                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                : isPlus
                ? "bg-brand/15 text-brand border border-brand/30"
                : "bg-muted text-muted-foreground"
            )}>
              {currentPlan} Plan Insights
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPro
              ? "Full Pro Analytics: Monetization conversion, peak hours, and AI copilot advice."
              : isPlus
              ? "Comprehensive reach, demographics, and content performance."
              : "Standard impression overview. Upgrade to Plus or Pro for deep metrics."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe selector */}
          <div className="flex rounded-full border border-border bg-muted/40 p-1 text-xs">
            <button
              onClick={() => setTimeframe("7d")}
              className={cn(
                "rounded-full px-3 py-1 font-bold transition-all cursor-pointer",
                timeframe === "7d"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              7 Days
            </button>
            <button
              onClick={() => {
                if (!isPlus) {
                  openUpgradeModal("30-Day Analytics Window");
                  return;
                }
                setTimeframe("30d");
              }}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1 font-bold transition-all cursor-pointer",
                timeframe === "30d"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>30 Days</span>
              {!isPlus && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
            </button>
          </div>

          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
            {!isPlus && <Lock className="h-2.5 w-2.5 text-muted-foreground ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2 overflow-x-auto [scrollbar-width:none]">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "overview"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Performance & Reach
        </button>
        <button
          onClick={() => setActiveTab("audience")}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "audience"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          Audience & Peak Hours
        </button>
        <button
          onClick={() => {
            if (!isPro && !isPlus) {
              openUpgradeModal("Monetization & Tips Analytics");
              return;
            }
            setActiveTab("revenue");
          }}
          className={cn(
            "flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "revenue"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <DollarSign className="h-3 w-3" />
          <span>Tips & Revenue</span>
          {!isPlus && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
        </button>
        <button
          onClick={() => {
            if (!isPro) {
              openUpgradeModal("AI Growth Copilot");
              return;
            }
            setActiveTab("ai_insights");
          }}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
            activeTab === "ai_insights"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xs"
              : "text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
          )}
        >
          <Sparkles className="h-3 w-3" />
          <span>AI Growth Advisor</span>
          {!isPro && <Lock className="h-2.5 w-2.5 text-purple-400" />}
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">Impressions</span>
                <Eye className="h-4 w-4 text-violet-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight">19.8k</span>
                <span className="text-xs font-bold text-emerald-500 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" /> +24%
                </span>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">Total post views across feeds</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">Unique Reach</span>
                <Users className="h-4 w-4 text-pink-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight">14.6k</span>
                <span className="text-xs font-bold text-emerald-500 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" /> +18%
                </span>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">Unique accounts viewed</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">Engagement Rate</span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight">12.4%</span>
                <span className="text-xs font-bold text-emerald-500 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" /> +3.2%
                </span>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">Likes, replies & shares / views</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">Profile Clicks</span>
                <MousePointerClick className="h-4 w-4 text-cyan-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight">842</span>
                <span className="text-xs font-bold text-emerald-500 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" /> +31%
                </span>
              </div>
              <p className="text-[0.7rem] text-muted-foreground">Bio & external links visited</p>
            </div>
          </div>

          {/* Main Impressions & Reach Chart */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Impressions & Reach Trends</h3>
                <p className="text-xs text-muted-foreground">Daily audience growth velocity</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                  <span>Impressions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-pink-500" />
                  <span>Reach</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="impressionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(23, 23, 23, 0.9)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "1rem",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="impressions"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#impressionGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="reach"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#reachGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Posts Breakdown */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Top Performing Posts</h3>
                <p className="text-xs text-muted-foreground">Ranked by engagement rate & click-through velocity</p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {TOP_POSTS.map((post, idx) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">{post.title}</p>
                    <span className="text-[0.65rem] font-extrabold px-2 py-0.5 rounded bg-brand/10 text-brand">
                      Rank #{idx + 1}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{post.views.toLocaleString()} views</span>
                    <span>{post.likes} likes</span>
                    <span>{post.reposts} reposts</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{post.ctr} CTR</span>
                    {isPlus && (
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {post.tips} Tips Generated
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "audience" && (
        <div className="space-y-6">
          {/* Hourly Peak Engagement */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand" />
                  Follower Active Hours (UTC)
                </h3>
                <p className="text-xs text-muted-foreground">Best windows to publish posts or host live audio spaces</p>
              </div>
              <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                Peak: 3pm – 7pm UTC
              </span>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={HOURLY_PEAK_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="hour" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(23, 23, 23, 0.9)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "1rem",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="activity" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audience Geography */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Top Audience Locations</h3>
              <span className="text-xs text-muted-foreground font-semibold">Worldwide</span>
            </div>

            <div className="space-y-3 pt-1">
              {AUDIENCE_REGIONS.map((region) => (
                <div key={region.country} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{region.country}</span>
                    <span className="font-bold text-muted-foreground">{region.percentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={cn("h-full rounded-full", region.color)}
                      style={{ width: `${region.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-1">
              <span className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400">Total Lifetime Tips</span>
              <p className="text-3xl font-black">${totalEarnings.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">From posts, live spaces & messages</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
              <span className="text-xs font-bold uppercase text-muted-foreground">Average Tip Amount</span>
              <p className="text-3xl font-black">$12.50</p>
              <p className="text-[11px] text-muted-foreground">Top supporters send $25+</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
              <span className="text-xs font-bold uppercase text-muted-foreground">Available for Payout</span>
              <p className="text-3xl font-black text-emerald-500">${pendingBalance.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">Zero fee instant transfers on Pro</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card p-5 md:p-6 space-y-4 shadow-soft">
            <h3 className="text-base font-bold">Top Tip Sources</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20">
                <span className="text-xs font-bold">Live Audio Spaces</span>
                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">58% ($46.40)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20">
                <span className="text-xs font-bold">Direct Post Tips</span>
                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">28% ($22.40)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20">
                <span className="text-xs font-bold">Direct Message Contributions</span>
                <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">14% ($11.20)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ai_insights" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-transparent p-6 space-y-4 shadow-soft">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-extrabold">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-base font-black">AI Growth Copilot Insights</h3>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-4 rounded-2xl bg-card/80 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>High-Performing Format: Code & Interactive Frames</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your posts containing live sandbox links and design demos achieved <strong>3.4x higher repost rates</strong> than plain text updates.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-card/80 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Target className="h-4 w-4 text-emerald-500" />
                  <span>Optimal Space Schedule</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your European and North American audiences overlap most strongly on <strong>Fridays at 4:00 PM UTC</strong>. Hosting your next room then will maximize listeners.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Banner for Free Users */}
      {!isPlus && (
        <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-transparent p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Lock className="h-4 w-4 text-violet-500" />
              <h4 className="text-sm font-black">Unlock Full Advanced Analytics with Plus & Pro</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Get hourly demographic peaks, monetization conversion tracking, and CSV raw data exports.
            </p>
          </div>
          <button
            onClick={() => openUpgradeModal("Advanced Creator Analytics")}
            className="rounded-full bg-gradient-to-r from-brand to-brand-pink px-5 py-2.5 text-xs font-bold text-white shadow-soft hover:brightness-105 transition-all cursor-pointer whitespace-nowrap"
          >
            Upgrade to Plus ($7/mo)
          </button>
        </div>
      )}
    </div>
  );
}
