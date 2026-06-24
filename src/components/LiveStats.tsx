import { Users, MessageCircle, Share2, TrendingUp, Zap, Calendar } from "lucide-react";

export default function LiveStats() {
  const stats = [
    { icon: Users, label: "Active Users", value: "55", color: "text-accent" },
    { icon: MessageCircle, label: "Telegram", value: "185", color: "text-white" },
    { icon: Share2, label: "X Followers", value: "182", color: "text-white" },
    { icon: TrendingUp, label: "Tokens Listed", value: "847", color: "text-accent" },
    { icon: Zap, label: "Volume", value: "$2.4M", color: "text-white" },
    { icon: Calendar, label: "Days Live", value: "47", color: "text-accent" },
  ];

  return (
    <div className="sticky top-14 z-20 border-b border-line bg-gradient-to-r from-bg via-panel to-bg/80 backdrop-blur">
      <div className="max-w-[1500px] mx-auto px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel/50 border border-line/30 hover:border-line/60 transition-all">
                <Icon className={`w-4 h-4 ${stat.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-muted uppercase tracking-wide">{stat.label}</div>
                  <div className={`text-sm font-bold ${stat.color} truncate`}>{stat.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
