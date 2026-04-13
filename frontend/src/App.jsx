import { useState, useEffect } from "react";
import { GetNetStats } from "../wailsjs/go/main/App";
import { WindowSetSize } from "../wailsjs/runtime/runtime";
import SettingsPanel from "./components/SettingsPanel";
import { themes } from "./themes";
import "./App.css";
import { OpenSettings, CloseSettings } from "../wailsjs/go/main/App";


const DEFAULT_SETTINGS = {
  theme: "glassmorphism",
  showDownload: true,
  showUpload: true,
  showPing: true,
  showConnections: false,
  showTotalRecv: false,
  showTotalSent: false,
  opacity: 90,
  refreshInterval: 1000,
};

export default function App() {
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("nettracker_settings");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [showSettings, setShowSettings] = useState(false);

  const theme = themes[settings.theme] || themes.glassmorphism;

  const visibleCount = [
    settings.showDownload,
    settings.showUpload,
    settings.showPing,
    settings.showConnections,
    settings.showTotalRecv,
    settings.showTotalSent,
  ].filter(Boolean).length;

  const barWidth = 36 + visibleCount * 50;

  useEffect(() => {
    localStorage.setItem("nettracker_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!showSettings) WindowSetSize(barWidth, 36);
  }, [barWidth]);

  useEffect(() => {
    const fetchStats = async () => {
      try { setStats(await GetNetStats()); } catch (e) { console.error(e); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, settings.refreshInterval);
    return () => clearInterval(interval);
  }, [settings.refreshInterval]);

  const closeSettings = () => {
    setShowSettings(false);
    WindowSetSize(barWidth, 36);
  };

const toggleSettings = (e) => {
  e.stopPropagation();
  const next = !showSettings;
  setShowSettings(next);
  if (next) {
    OpenSettings();
  } else {
    CloseSettings(barWidth);
  }
};

  return (
    <div className="app-wrapper" style={{ opacity: settings.opacity / 100 }}>
      <div className="bar" style={{
        background: theme.barBg,
        border: theme.barBorder,
        boxShadow: theme.barShadow,
        backdropFilter: theme.backdropFilter,
        fontFamily: theme.fontFamily,
        "--wails-draggable": "drag",
      }}>
        <div className="stats-row">
          {settings.showDownload && stats && (
            <StatChip label="DOWN" value={stats.downloadSpeed} unit={stats.downloadUnit} color={theme.downColor} labelColor={theme.labelColor} />
          )}
          {settings.showUpload && stats && (
            <StatChip label="UP" value={stats.uploadSpeed} unit={stats.uploadUnit} color={theme.upColor} labelColor={theme.labelColor} />
          )}
          {settings.showPing && stats && (
            <StatChip label="PING" value={stats.ping} unit="" color={theme.pingColor} labelColor={theme.labelColor} />
          )}
          {settings.showConnections && stats && (
            <StatChip label="CONN" value={stats.connections} unit="" color={theme.connColor} labelColor={theme.labelColor} />
          )}
          {settings.showTotalRecv && stats && (
            <StatChip label="TOTAL ↓" value={stats.totalRecv} unit="" color={theme.downColor} labelColor={theme.labelColor} />
          )}
          {settings.showTotalSent && stats && (
            <StatChip label="TOTAL ↑" value={stats.totalSent} unit="" color={theme.upColor} labelColor={theme.labelColor} />
          )}
        </div>

        <button
          className="settings-btn"
          style={{ color: theme.labelColor, "--wails-draggable": "no-drag" }}
          onClick={toggleSettings}
          title="Settings"
        >⚙</button>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          setSettings={setSettings}
          theme={theme}
          onClose={() => { setShowSettings(false); CloseSettings(barWidth); }}
        />
      )}
    </div>
  );
}

function StatChip({ label, value, unit, color, labelColor }) {
  return (
    <div className="stat-chip">
      <div className="stat-value" style={{ color }}>{value}<span className="stat-unit">{unit}</span></div>
      <div className="stat-label" style={{ color: labelColor }}>{label}</div>
    </div>
  );
}