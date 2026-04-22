const NOTE_COLORS = ["#ff4fa6", "#5d7cff", "#53e1ff", "#6ef0a5", "#ffd35c", "#ff9c52", "#b16dff", "#8dff66"];

function injectPerformStyles() {
  if (document.getElementById("perform-view-style")) return;
  const style = document.createElement("style");
  style.id = "perform-view-style";
  style.textContent = `
    .perform-enhanced { padding: 14px; border-radius: 16px; background: linear-gradient(180deg, rgba(10,12,20,0.94), rgba(9,11,18,0.98)); box-shadow: 0 0 0 1px rgba(255,255,255,0.04) inset, 0 20px 60px rgba(0,0,0,0.32); }
    .perform-monitor-head, .perform-monitor-body { display: grid; grid-template-columns: 180px 1fr 230px; gap: 14px; }
    .perform-monitor-head { align-items: end; margin-bottom: 10px; }
    .perform-monitor-title, .perform-monitor-center-title, .perform-monitor-side-title { font-size: 13px; letter-spacing: 0.07em; color: var(--fg); text-transform: uppercase; }
    .perform-monitor-title span { color: #b16dff; font-size: 12px; letter-spacing: 0.03em; text-transform: none; }
    .perform-monitor-center-title, .perform-monitor-side-title { color: var(--muted); }
    .perform-note-list, .perform-value-list { border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); padding: 12px; min-height: 240px; }
    .perform-note-row, .perform-value-row { display: grid; gap: 4px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .perform-note-row:last-child, .perform-value-row:last-child { border-bottom: 0; }
    .perform-note-main { display: flex; align-items: center; gap: 8px; font-size: 15px; color: var(--fg); }
    .perform-note-dot { width: 10px; height: 10px; border-radius: 999px; box-shadow: 0 0 10px currentColor; flex: 0 0 auto; }
    .perform-note-sub, .perform-value-sub { font-size: 11px; color: var(--muted); letter-spacing: 0.05em; text-transform: uppercase; }
    .perform-plot-wrap { border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); padding: 12px; display: grid; grid-template-rows: auto 1fr auto; gap: 8px; min-height: 240px; }
    .perform-plot-range, .perform-plot-footer { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); letter-spacing: 0.05em; text-transform: uppercase; }
    .perform-plot-shell { position: relative; min-height: 170px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.04); background: linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.03) 1px, transparent 1px), radial-gradient(circle at center, rgba(72,112,255,0.10), rgba(255,255,255,0.02)); background-size: 12.5% 100%, 100% 25%, auto; }
    .perform-plot-shell::before { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: rgba(255,255,255,0.2); pointer-events: none; z-index: 0; }
    .perform-plot-shell #expression-stage { position: absolute; inset: 0; height: auto; border: 0; background: transparent; border-radius: 0; }
    .perform-value-main { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 14px; color: var(--fg); }
    .perform-value-main .accent { color: var(--fg); font-variant-numeric: tabular-nums; }
    .perform-setup-strip { margin-top: 12px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); letter-spacing: 0.05em; text-transform: uppercase; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; }
    .perform-setup-chip, .perform-keyboard-chip { padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
    .perform-macros-panel .knob-pair { grid-template-columns: repeat(2, minmax(120px, 1fr)); gap: 16px; }
    .perform-panel-subcopy { margin: 0 0 10px; font-size: 12px; color: var(--muted); line-height: 1.45; }
    .perform-morph-panel .preset-panel { gap: 14px; }
    .perform-morph-panel .morph-wrap { padding: 10px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); }
    .perform-keyboard-title { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
    @media (max-width: 1100px) { .perform-monitor-head, .perform-monitor-body { grid-template-columns: 1fr; } .perform-note-list, .perform-value-list, .perform-plot-wrap { min-height: 0; } }
  `;
  document.head.appendChild(style);
}

function findPanel(title) {
  return Array.from(document.querySelectorAll(".synth-grid > section.panel")).find((panel) => panel.querySelector("h2")?.textContent?.trim() === title) || null;
}

function enhanceMonitor() {
  const monitor = document.querySelector(".expression-view");
  const stage = document.getElementById("expression-stage");
  if (!monitor || !stage || monitor.dataset.performEnhanced === "true") return;
  const chips = Array.from(monitor.querySelectorAll(".expression-chip"));
  monitor.dataset.performEnhanced = "true";
  monitor.classList.add("perform-enhanced");
  monitor.innerHTML = `
    <div class="perform-monitor-head">
      <div class="perform-monitor-title">MPE Voices <span>(Per-Note Expression)</span></div>
      <div class="perform-monitor-center-title">Pitch Bend / Expression Field</div>
      <div class="perform-monitor-side-title">Expression</div>
    </div>
    <div class="perform-monitor-body">
      <div class="perform-note-list" id="perform-note-list"></div>
      <div class="perform-plot-wrap">
        <div class="perform-plot-range"><span>-2 st</span><span>center</span><span>+2 st</span></div>
        <div class="perform-plot-shell" id="perform-plot-shell"></div>
        <div class="perform-plot-footer"><span>Glow = pressure</span><span>Position = active gesture field</span></div>
      </div>
      <div class="perform-value-list" id="perform-value-list"></div>
    </div>
    <div class="perform-setup-strip" id="perform-setup-strip"></div>
  `;
  const plotShell = document.getElementById("perform-plot-shell");
  const valueList = document.getElementById("perform-value-list");
  if (plotShell) plotShell.appendChild(stage);
  chips.forEach((chip) => valueList?.appendChild(chip));
}

function enhancePerformPanels() {
  const macroPanel = findPanel("MACROS");
  if (macroPanel && !macroPanel.dataset.performDecorated) {
    macroPanel.dataset.performDecorated = "true";
    macroPanel.classList.add("perform-macros-panel");
    const title = macroPanel.querySelector("h2");
    if (title) title.textContent = "PERFORMANCE MACROS";
    const subcopy = document.createElement("p");
    subcopy.className = "perform-panel-subcopy";
    subcopy.textContent = "Macro controls are being promoted into the Perform workspace first, matching the target instrument direction.";
    title?.insertAdjacentElement("afterend", subcopy);
  }
  const morphPanel = findPanel("PRESETS / MORPH");
  if (morphPanel && !morphPanel.dataset.performDecorated) {
    morphPanel.dataset.performDecorated = "true";
    morphPanel.classList.add("perform-morph-panel");
    const title = morphPanel.querySelector("h2");
    if (title) title.textContent = "MORPH";
    const subcopy = document.createElement("p");
    subcopy.className = "perform-panel-subcopy";
    subcopy.textContent = "Preset morphing remains state-complete and now sits visually as a performance surface, not just a utility block.";
    title?.insertAdjacentElement("afterend", subcopy);
  }
  const keyboard = document.querySelector(".keyboard");
  if (keyboard && !keyboard.dataset.performDecorated) {
    keyboard.dataset.performDecorated = "true";
    const title = keyboard.querySelector("h2");
    if (title) {
      const wrap = document.createElement("div");
      wrap.className = "perform-keyboard-title";
      const chip = document.createElement("div");
      chip.className = "perform-keyboard-chip";
      chip.id = "perform-active-chip";
      chip.textContent = "Active notes 0";
      title.replaceWith(wrap);
      wrap.appendChild(title);
      wrap.appendChild(chip);
    }
  }
}

function extractVoiceRows() {
  const stage = document.getElementById("expression-stage");
  if (!stage) return [];
  return Array.from(stage.querySelectorAll(".voice-orb")).map((orb, index) => ({
    label: orb.querySelector(".voice-orb-label")?.textContent?.trim() || `Voice ${index + 1}`,
    opacity: Number.parseFloat(orb.style.opacity || "0") || 0,
  }));
}

function renderNoteList() {
  const list = document.getElementById("perform-note-list");
  const setup = document.getElementById("perform-setup-strip");
  const activeChip = document.getElementById("perform-active-chip");
  if (!list) return;
  const rows = extractVoiceRows();
  list.innerHTML = "";
  if (rows.length === 0) {
    list.innerHTML = `<div class="perform-note-row"><div class="perform-note-main">No active notes</div><div class="perform-note-sub">Touch the keys or use MIDI or MPE input</div></div>`;
  } else {
    rows.forEach((row, index) => {
      const item = document.createElement("div");
      item.className = "perform-note-row";
      const color = NOTE_COLORS[index % NOTE_COLORS.length];
      item.innerHTML = `<div class="perform-note-main"><span class="perform-note-dot" style="color:${color}; background:${color};"></span><span>${row.label}</span></div><div class="perform-note-sub">Voice ${index + 1} • intensity ${Math.round(row.opacity * 100)}%</div>`;
      list.appendChild(item);
    });
  }
  if (setup) {
    setup.innerHTML = `<div class="perform-setup-chip">zone lower</div><div class="perform-setup-chip">channels 2-16</div><div class="perform-setup-chip">pitch bend +/-2 st</div><div class="perform-setup-chip">active ${rows.length}</div>`;
  }
  if (activeChip) activeChip.textContent = `Active notes ${rows.length}`;
}

function renderValueList() {
  const valueList = document.getElementById("perform-value-list");
  if (!valueList) return;
  const chips = Array.from(valueList.querySelectorAll(".expression-chip"));
  chips.forEach((chip, index) => {
    if (chip.dataset.reframed === "true") {
      const label = chip.dataset.label || "Value";
      const valueEl = chip.querySelector(".accent");
      const sourceValue = document.getElementById(chip.dataset.valueId)?.textContent?.trim();
      if (valueEl && sourceValue) valueEl.textContent = sourceValue;
      return;
    }
    const label = chip.querySelector(".label")?.textContent?.trim() || "Value";
    const valueId = chip.querySelector(".value")?.id || "";
    const value = chip.querySelector(".value")?.textContent?.trim() || "-";
    chip.dataset.reframed = "true";
    chip.dataset.label = label;
    chip.dataset.valueId = valueId;
    chip.classList.add("perform-value-row");
    chip.innerHTML = `<div class="perform-value-main"><span>${label}</span><span class="accent" style="color:${NOTE_COLORS[index % NOTE_COLORS.length]};">${value}</span></div><div class="perform-value-sub">Primary gesture readout</div>`;
  });
}

function frame() {
  renderNoteList();
  renderValueList();
  requestAnimationFrame(frame);
}

function bootPerformView() {
  injectPerformStyles();
  enhanceMonitor();
  enhancePerformPanels();
  requestAnimationFrame(frame);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPerformView, { once: true });
} else {
  bootPerformView();
}
