"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { useEffect, useRef } from "react";
import { ClipboardPlus, Radio } from "lucide-react";
import { useConsult, outOfRange } from "./context";
import { useReferenceHost } from "@pepbits/reference-host";
import { DemoNotice, cx } from "../ui";

// Illustrative PQRST complex, phase 0..1. The trace is drawn from the heart rate the API reports; it is not a recorded waveform.
function ecg(phase: number) {
  const g = (x: number, mu: number, sigma: number, a: number) => a * Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));
  return g(phase, 0.18, 0.025, 0.12) - g(phase, 0.285, 0.008, 0.12) + g(phase, 0.3, 0.01, 1) - g(phase, 0.315, 0.009, 0.25) + g(phase, 0.55, 0.045, 0.28);
}

function EcgTrace({ hr, active }: { hr: number; active: boolean }) {
  const { t } = useLocalization();
  const ref = useRef<HTMLCanvasElement>(null);
  const hrRef = useRef(hr);
  hrRef.current = hr;
  const reducedPreference = useReferenceHost().preferences.reducedMotion;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);

    const reduced = reducedPreference || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = 0;
    let phase = 0;
    let last = performance.now();
    let prevY: number | null = null;
    let raf = 0;
    const speed = 70 * dpr; // px per second

    const yFor = (p: number) => c.height * 0.62 - ecg(p) * c.height * 0.5;

    const drawStatic = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.strokeStyle = "#52E08A";
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      for (let i = 0; i < c.width; i++) {
        const p = ((i / speed) * (hrRef.current / 60)) % 1;
        const y = yFor(p);
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
    };

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const steps = Math.max(1, Math.round(speed * dt));
      for (let i = 0; i < steps; i++) {
        phase = (phase + hrRef.current / 60 / speed) % 1;
        const y = active ? yFor(phase) : c.height * 0.62;
        ctx.clearRect(x, 0, 14 * dpr, c.height); // erase ahead of the sweep
        if (prevY !== null && x > 0) {
          ctx.strokeStyle = "#52E08A";
          ctx.lineWidth = 1.6 * dpr;
          ctx.beginPath();
          ctx.moveTo(x - 1, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        prevY = y;
        x += 1;
        if (x >= c.width) {
          x = 0;
          prevY = null;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    if (reduced) drawStatic();
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active, reducedPreference]);

  return <canvas ref={ref} className="h-14 w-full" aria-label={t("Illustrative trace drawn from the simulated heart rate {value0}", { value0: hr })} role="img" />;
}

function Readout({ label, value, unit, color, alarm, small }: { label: string; value: string; unit: string; color: string; alarm?: boolean; small?: boolean }) {
  const { t } = useLocalization();
  return (
    <div className={cx("rounded px-2 py-1.5", alarm ? "bg-alarm-500/20 ring-1 ring-alarm-500" : "bg-white/[0.03]")}>
      <p className="text-2xs" style={{ color }}>{t(label)}</p>
      <p className={cx("font-semibold leading-none tabular", small ? "text-lg" : "text-2xl", alarm && "animate-pulse")} style={{ color: alarm ? "#FF8A9A" : color }}>
        {value}
        <span className="ml-0.5 text-2xs font-normal opacity-70">{unit}</span>
      </p>
    </div>
  );
}

export function VitalsMonitor() {
  const { t } = useLocalization();
  const { live, actions, appt, locked } = useConsult();
  const sharing = appt.preVisit?.shareDeviceData ?? true;

  return (
    <section className="rounded-lg bg-monitor-bg p-2.5 shadow-panel" aria-label={t("Simulated demo vitals from patient devices")}>
      <div className="mb-1 flex items-center gap-2">
        <span className={cx("inline-flex items-center gap-1 text-2xs font-medium", live ? "text-vital-500" : "text-ink-400")}>
          <Radio className={cx("h-3 w-3", live && "animate-pulse")} />
          {t(live ? (live.signal === "weak" ? "Weak signal (simulated)" : "Demo device feed (simulated)") : sharing ? "Connecting to devices…" : "Patient not sharing devices")}
        </span>
        <SourceButton
          onClick={actions.captureLive}
          disabled={!live || locked}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-2xs font-medium text-ink-200 hover:bg-white/10 hover:text-white disabled:opacity-40"
          title={t("Save the current reading to the chart")}
        >
          <ClipboardPlus className="h-3.5 w-3.5" />  <LocalizedText message={"Capture to chart"} />
        </SourceButton>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <div className="rounded bg-[linear-gradient(#0E2633_1px,transparent_1px),linear-gradient(90deg,#0E2633_1px,transparent_1px)] bg-[size:12px_12px]">
          <EcgTrace hr={live?.hr ?? 70} active={!!live} />
        </div>
        <Readout label="HR" value={live ? String(live.hr) : "--"} unit="bpm" color="#52E08A" alarm={outOfRange("hr", live?.hr)} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <Readout small label="SpO2" value={live ? String(live.spo2) : "--"} unit="%" color="#5CC8FF" alarm={outOfRange("spo2", live?.spo2)} />
        <Readout small label="NIBP" value={live ? `${live.sys}/${live.dia}` : "--/--"} unit="" color="#F5D25C" alarm={outOfRange("sys", live?.sys)} />
        <Readout small label="RR" value={live ? String(live.rr) : "--"} unit="/min" color="#E7E7F0" alarm={outOfRange("rr", live?.rr)} />
        <Readout small label="Temp" value={live ? live.temp.toFixed(1) : "--"} unit="°C" color="#FF9A76" alarm={outOfRange("temp", live?.temp)} />
      </div>
      <DemoNotice className="mt-2"><LocalizedText message={"Demo readings generated by the API. They are not from a real device and not a clinical measurement."} /></DemoNotice>
    </section>
  );
}
