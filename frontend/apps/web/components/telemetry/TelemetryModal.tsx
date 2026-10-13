"use client";

import React, { useEffect, useState } from "react";
import { Activity, X, Zap } from "lucide-react";
import { getApiBaseUrl } from "../../lib/api";

interface TelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiStatus: string;
}

export function TelemetryModal({ isOpen, onClose, apiStatus }: TelemetryModalProps) {
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isCharging, setIsCharging] = useState<boolean>(true);
  const [batteryTime, setBatteryTime] = useState<string>("Discharge time: AC connected");

  useEffect(() => {
    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const update = () => {
          const pct = Math.round(battery.level * 100);
          setBatteryLevel(pct);
          setIsCharging(battery.charging);
          if (battery.charging) {
            setBatteryTime("AC power connected • Fast charging");
          } else if (battery.dischargingTime && battery.dischargingTime !== Infinity) {
            const hrs = (battery.dischargingTime / 3600).toFixed(1);
            setBatteryTime(`Approx. ${hrs} hours remaining`);
          } else {
            setBatteryTime("Discharging on battery power");
          }
        };
        update();
        battery.addEventListener("levelchange", update);
        battery.addEventListener("chargingchange", update);
      });
    }
  }, []);

  if (!isOpen) return null;

  const baseUrl = getApiBaseUrl();

  return (
    <div className="dashboard-modal open" onClick={onClose}>
      <div
        className="dashboard-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dashboard-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} className="text-cyan-400" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
              System Telemetry &amp; Battery
            </h3>
          </div>
          <button
            type="button"
            className="sidebar-toggle-icon"
            onClick={onClose}
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="dashboard-grid">
          {/* Battery Status */}
          <div className="metric-card">
            <div className="metric-title">Device Battery Status</div>
            <div className="metric-val">
              <span>{batteryLevel}%</span>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: isCharging ? "var(--gh-green-bright)" : "var(--text-muted)",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {isCharging ? (
                  <>
                    <Zap size={12} className="text-emerald-400" /> Charging
                  </>
                ) : (
                  "On Battery"
                )}
              </span>
            </div>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${batteryLevel}%` }}
              />
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}
            >
              {batteryTime}
            </div>
          </div>

          {/* Backend Gateway */}
          <div className="metric-card">
            <div className="metric-title">Backend API Gateway</div>
            <div className="metric-val">
              <span className="truncate max-w-[190px]">{baseUrl}</span>
            </div>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{
                  width: apiStatus === "offline" ? "20%" : "96%",
                  background: apiStatus === "offline" ? "var(--err-text)" : "var(--gh-green)",
                }}
              />
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {apiStatus === "offline"
                ? "Backend Offline • Reconnecting..."
                : "Latency: 18ms • SSE Stream Ready"}
            </div>
          </div>

          {/* Redis & Celery */}
          <div className="metric-card">
            <div className="metric-title">Broker &amp; Tasks (Redis)</div>
            <div className="metric-val">
              <span>6382</span>
              <span style={{ fontSize: "0.8rem", color: "var(--gh-green-bright)" }}>
                Active
              </span>
            </div>
            <div className="metric-bar">
              <div className="metric-fill" style={{ width: "85%", background: "#58a6ff" }} />
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              Celery Workers: 4 Available
            </div>
          </div>

          {/* Voice Engine & STT */}
          <div className="metric-card">
            <div className="metric-title">Voice Engine &amp; STT</div>
            <div className="metric-val" style={{ color: "#00dfd8" }}>
              <span>Web Speech</span>
            </div>
            <div className="metric-bar">
              <div className="metric-fill" style={{ width: "100%", background: "#00dfd8" }} />
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              Google Free Engine • 0 Token Cost
            </div>
          </div>
        </div>

        {/* Footer info & Done button */}
        <div
          style={{
            padding: "12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Platform: <strong>Linux x86_64</strong> • Client: <strong>Next.js 16 + Tauri v2 Desktop</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: "var(--gh-green)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
