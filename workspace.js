const WORKSPACE_VIEW_KEY = "zephyr-workspace-view-v1";

const MATRIX_DESTINATION_GROUPS = [
  {
    label: "Filters",
    options: [
      ["filter.cutoff", "LPF1 Cutoff"],
      ["filter2.cutoff", "LPF2 Cutoff"],
      ["hpf.cutoff", "HPF Cutoff"],
      ["filter.parallelBlend", "Filter Blend"],
    ],
  },
  {
    label: "Voice",
    options: [
      ["osc1.detune", "OSC1 Detune"],
      ["osc2.detune", "OSC2 Detune"],
      ["osc3.detune", "OSC3 Detune"],
      ["amp.level", "Amp Level"],
      ["pan.position", "Pan Position"],
      ["voice.drive", "Voice Drive"],
    ],
  },
  {
    label: "FX / Global",
    options: [
      ["chorus.mix", "Chorus Mix"],
      ["chorus.rate", "Chorus Rate"],
      ["delay.mix", "Delay Mix"],
      ["delay.feedback", "Delay Feedback"],
      ["reverb.mix", "Reverb Mix"],
      ["drive.master", "Master Drive"],
    ],
  },
];

function injectWorkspaceStyle() {
  if (document.getElementById("workspace-shell-style")) return;
  const style = document.createElement("style");
  style.id = "workspace-shell-style";
  style.textContent = `
    .workspace-toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      margin: 0 0 14px;
    }

    .workspace-tab {
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
      color: var(--muted);
      cursor: pointer;
      font-size: 13px;
      letter-spacing: 0.06em;
    }

    .workspace-tab.active {
      color: var(--fg);
      border-color: rgba(255,102,0,0.42);
      box-shadow: 0 0 0 1px rgba(255,102,0,0.12) inset;
      background: linear-gradient(180deg, rgba(255,102,0,0.16), rgba(255,102,0,0.04));
    }

    .target-banner {
      margin: 0 0 16px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    }

    .target-banner-title {
      font-size: 13px;
      letter-spacing: 0.08em;
      color: var(--fg);
      margin-bottom: 6px;
    }

    .target-banner-copy {
      font-size: 14px;
      color: var(--muted);
      margin-bottom: 10px;
    }

    .target-roadmap {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
    }

    .target-step {
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 10px;
      padding: 10px;
      background: rgba(255,255,255,0.02);
    }

    .target-step-label {
      display: block;
      font-size: 11px;
      letter-spacing: 0.08em;
      color: var(--fg);
      margin-bottom: 4px;
    }

    .target-step-text {
      display: block;
      font-size: 13px;
      color: var(--muted);
      line-height: 1.35;
    }

    .workspace-hidden {
      display: none !important;
    }

    @media (max-width: 700px) {
      .target-roadmap {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureBannerAndTabs() {
  const app = document.querySelector(".app");
  const topbar = document.querySelector(".topbar");
  if (!app || !topbar) return;

  if (!document.querySelector(".target-banner")) {
    const banner = document.createElement("section");
    banner.className = "target-banner";
    banner.innerHTML = `
      <div class="target-banner-title">TARGET LOCKED</div>
      <div class="target-banner-copy">Zephyr is now being built toward the premium multi-view MPE synth concept: a performance-first shell with dedicated Synth, Perform, Matrix, and FX workspaces.</div>
      <div class="target-roadmap">
        <div class="target-step">
          <span class="target-step-label">NOW</span>
          <span class="target-step-text">Lock the workspace shell and expose deeper routing so the prototype behaves like a coherent instrument, not a loose test page.</span>
        </div>
        <div class="target-step">
          <span class="target-step-label">NEXT</span>
          <span class="target-step-text">Build the Perform center: macro bank, stronger MPE monitor, and clearer performance gestures closer to the target mockup.</span>
        </div>
        <div class="target-step">
          <span class="target-step-label">THEN</span>
          <span class="target-step-text">Add richer module visuals: filter curves, envelope/LFO displays, morph presentation, and higher-fidelity shell styling.</span>
        </div>
      </div>
    `;
    topbar.insertAdjacentElement("afterend", banner);
  }

  if (!document.querySelector(".workspace-toolbar")) {
    const toolbar = document.createElement("div");
    toolbar.className = "workspace-toolbar";
    toolbar.innerHTML = `
      <button class="workspace-tab" type="button" data-workspace-view="synth">SYNTH</button>
      <button class="workspace-tab" type="button" data-workspace-view="perform">PERFORM</button>
      <button class="workspace-tab" type="button" data-workspace-view="matrix">MATRIX</button>
      <button class="workspace-tab" type="button" data-workspace-view="fx">FX</button>
    `;
    const banner = document.querySelector(".target-banner");
    if (banner) banner.insertAdjacentElement("afterend", toolbar);
    else topbar.insertAdjacentElement("afterend", toolbar);
  }
}

function classifyTitle(title) {
  switch (title) {
    case "OSC 1":
    case "OSC 2":
    case "OSC 3":
    case "FILTER BLOCK":
    case "VOICE / ANALOG":
      return "synth";
    case "MACROS":
    case "PRESETS / MORPH":
      return "perform";
    case "MOD MATRIX":
    case "LFO":
    case "ENVELOPE / MASTER":
      return "matrix";
    case "CHORUS":
    case "TAPE DELAY":
    case "REVERB":
      return "fx";
    default:
      return "synth";
  }
}

function assignWorkspacePanels() {
  document.querySelectorAll(".synth-grid > section.panel").forEach((panel) => {
    const title = panel.querySelector("h2")?.textContent?.trim() || "";
    panel.dataset.viewPanel = classifyTitle(title);
  });

  const keyboard = document.querySelector(".keyboard");
  if (keyboard) keyboard.dataset.viewPanel = "perform";

  const expression = document.querySelector(".expression-view");
  if (expression) expression.dataset.viewPanel = "perform";
}

function setWorkspaceView(view) {
  const fallback = ["synth", "perform", "matrix", "fx"].includes(view) ? view : "synth";
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("workspace-hidden", panel.dataset.viewPanel !== fallback);
  });
  document.querySelectorAll(".workspace-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.workspaceView === fallback);
  });
  try {
    localStorage.setItem(WORKSPACE_VIEW_KEY, fallback);
  } catch {}
}

function bindWorkspaceTabs() {
  document.querySelectorAll(".workspace-tab").forEach((button) => {
    button.addEventListener("click", () => setWorkspaceView(button.dataset.workspaceView));
  });

  let saved = "synth";
  try {
    saved = localStorage.getItem(WORKSPACE_VIEW_KEY) || "synth";
  } catch {}
  setWorkspaceView(saved);
}

function rebuildDestinationSelect(select) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = "";

  MATRIX_DESTINATION_GROUPS.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.options.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });

  const allValues = MATRIX_DESTINATION_GROUPS.flatMap((group) => group.options.map(([value]) => value));
  select.value = allValues.includes(current) ? current : allValues[0];
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function expandMatrixDestinationOptions() {
  for (let i = 0; i < 4; i++) {
    rebuildDestinationSelect(document.getElementById(`route-${i}-dest`));
  }
}

function bootWorkspaceShell() {
  injectWorkspaceStyle();
  ensureBannerAndTabs();
  assignWorkspacePanels();
  bindWorkspaceTabs();
  expandMatrixDestinationOptions();
  import("./performView.js?v=16").catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootWorkspaceShell, { once: true });
} else {
  bootWorkspaceShell();
}
