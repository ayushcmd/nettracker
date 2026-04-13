import { useState, useEffect } from "react";
import { Quit } from "../../wailsjs/runtime/runtime";
import { GetStartup, SetStartup } from "../../wailsjs/go/main/App";

export default function SettingsPanel({ settings, setSettings, theme, onClose }) {
  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const [startupEnabled, setStartupEnabled] = useState(false);

  useEffect(() => {
    GetStartup().then(setStartupEnabled).catch(() => {});
  }, []);

  const toggleStartup = (val) => {
    SetStartup(val).then(() => setStartupEnabled(val)).catch(() => {});
  };

  return (
    <div className="settings-panel" style={{
      background: theme.panelBg,
      border: theme.barBorder,
      boxShadow: theme.barShadow,
      backdropFilter: theme.backdropFilter,
      fontFamily: theme.fontFamily,
      color: theme.labelColor,
    }}>
      <div className="settings-header">
        <span style={{ color: theme.brandColor, fontWeight: 700 }}>⚙ Settings</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="close-btn" style={{ color: "#ef4444" }} onClick={Quit} title="Quit">⏻</button>
          <button className="close-btn" style={{ color: theme.labelColor }} onClick={onClose}>✕</button>
        </div>
      </div>

      <Section label="Theme" color={theme.brandColor}>
        <div className="theme-grid">
          {["glassmorphism", "tokyonight", "ironman", "pacman"].map(t => (
            <button
              key={t}
              className={`theme-btn ${settings.theme === t ? "active" : ""}`}
              style={{
                borderColor: settings.theme === t ? theme.brandColor : theme.dividerColor,
                color: settings.theme === t ? theme.brandColor : theme.labelColor,
                background: settings.theme === t ? theme.brandColor + "22" : "transparent",
              }}
              onClick={() => update("theme", t)}
            >
              {t === "glassmorphism" && "🔮 Glass"}
              {t === "tokyonight" && "🌃 Tokyo"}
              {t === "ironman" && "🔴 Iron Man"}
              {t === "pacman" && "🟡 Pac-Man"}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Display" color={theme.brandColor}>
        {[
          ["showDownload", "↓ Download Speed"],
          ["showUpload", "↑ Upload Speed"],
          ["showPing", "◉ Ping"],
          ["showConnections", "⇌ Connections"],
          ["showTotalRecv", "▼ Total Downloaded"],
          ["showTotalSent", "▲ Total Uploaded"],
        ].map(([key, label]) => (
          <ToggleRow key={key} label={label} value={settings[key]} onChange={v => update(key, v)} theme={theme} />
        ))}
      </Section>

      <Section label="Opacity" color={theme.brandColor}>
        <div className="slider-row">
          <input
            type="range" min="30" max="100" value={settings.opacity}
            onChange={e => update("opacity", Number(e.target.value))}
            style={{ accentColor: theme.brandColor }}
          />
          <span style={{ color: theme.brandColor, minWidth: 36 }}>{settings.opacity}%</span>
        </div>
      </Section>

      <Section label="Refresh Rate" color={theme.brandColor}>
        <div className="theme-grid">
          {[500, 1000, 2000].map(ms => (
            <button
              key={ms}
              className={`theme-btn ${settings.refreshInterval === ms ? "active" : ""}`}
              style={{
                borderColor: settings.refreshInterval === ms ? theme.brandColor : theme.dividerColor,
                color: settings.refreshInterval === ms ? theme.brandColor : theme.labelColor,
                background: settings.refreshInterval === ms ? theme.brandColor + "22" : "transparent",
              }}
              onClick={() => update("refreshInterval", ms)}
            >
              {ms === 500 ? "0.5s" : ms === 1000 ? "1s" : "2s"}
            </button>
          ))}
        </div>
      </Section>

      <Section label="System" color={theme.brandColor}>
        <ToggleRow
          label="Start with Windows"
          value={startupEnabled}
          onChange={toggleStartup}
          theme={theme}
        />
      </Section>
    </div>
  );
}

function Section({ label, color, children }) {
  return (
    <div className="settings-section">
      <div className="section-label" style={{ color }}>{label}</div>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange, theme }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <div
        className={`toggle ${value ? "on" : "off"}`}
        style={{ background: value ? theme.brandColor : theme.dividerColor }}
        onClick={() => onChange(!value)}
      >
        <div className="toggle-knob" />
      </div>
    </div>
  );
}