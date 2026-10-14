/* PNJunction UI layer */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const UM = 1e4;
  const STORE_KEY = "pnjunction.settings.v1";
  const OV_FIELDS = [
    ["eps_r", "εr", 0.1, 1], ["chi300", "χ (eV)", 0.01, 1], ["Eg_shift", "ΔEg shift (eV)", 0.01, 1],
    ["me_dos", "m*e (m₀)", 0.01, 1], ["mh_dos", "m*h (m₀)", 0.01, 1], ["Ed", "ΔEd (eV)", 0.001, 1],
    ["Ea", "ΔEa (eV)", 0.001, 1], ["E_crit", "E_crit (MV/cm)", 0.05, 1e6],
  ];

  // ---------------------------------------------------------------- formatting
  const SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  function sci(v, d = 3) {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    if (v === 0) return "0";
    const a = Math.abs(v);
    if (a >= 1e-3 && a < 1e4) return Number(v.toPrecision(d)).toString();
    const [m, e] = v.toExponential(d - 1).split("e");
    return `${m}×10${String(parseInt(e, 10)).split("").map(c => SUP[c] || c).join("")}`;
  }
  const f4 = v => Number.isFinite(v) ? v.toFixed(4) : "—";
  const sign4 = v => (v >= 0 ? "+" : "") + v.toFixed(4);

  // ---------------------------------------------------------------- theme + chart helpers
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function colors() {
    return { s: [1, 2, 3, 4, 5, 6, 7, 8].map(i => css(`--s${i}`)), neutral: css("--neutral"), text: css("--text"),
      text2: css("--text-2"), muted: css("--muted"), grid: css("--grid"), shade: css("--shade"), panel: css("--panel") };
  }
  function baseLayout(o = {}) {
    const c = colors();
    const ax = (t, log) => ({ title: { text: t || "", font: { size: 12, color: c.text2 } }, type: log ? "log" : "linear",
      gridcolor: c.grid, zeroline: false, linecolor: c.grid, tickfont: { size: 11, color: c.muted },
      exponentformat: "power", showexponent: "all", automargin: true });
    return {
      height: o.height || 380, margin: { l: 64, r: 16, t: 34, b: 48 },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: c.text, size: 12 },
      legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font: { size: 12, color: c.text2 } },
      hovermode: o.hovermode || "x unified",
      hoverlabel: { bgcolor: c.panel, bordercolor: c.grid, font: { color: c.text } },
      xaxis: Object.assign(ax(o.xtitle ?? "Position x (µm)", o.logx), o.xaxis || {}),
      yaxis: Object.assign(ax(o.ytitle, o.logy), o.yaxis || {}),
      shapes: o.shapes || [], annotations: o.annotations || [], showlegend: o.showlegend ?? true,
    };
  }
  const CFG = { displaylogo: false, responsive: true,
    modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"], toImageButtonOptions: { format: "png", scale: 2 } };
  function plot(id, traces, layoutOpts) {
    const el = $(id);
    if (!el || el.offsetParent === null) return;      // only draw visible charts
    CFG.toImageButtonOptions.filename = "PNJunction_" + id;
    Plotly.react(el, traces, baseLayout(layoutOpts), CFG);
  }
  const line = (x, y, name, color, o = {}) => Object.assign({ type: "scatter", mode: "lines", x, y, name,
    line: { color, width: o.width || 2, dash: o.dash || "solid", shape: o.shape || "linear" },
    hovertemplate: o.ht || `${name}: %{y:.4g}<extra></extra>` }, o.extra || {});
  const posOnly = arr => Array.from(arr, v => (v > 0 && Number.isFinite(v) ? v : null));
  function depletionShapes(r) {
    const c = colors(), d = r.d || 0;
    const sh = [
      { type: "rect", xref: "x", yref: "paper", x0: -r.xp * UM, x1: (d + r.xn) * UM, y0: 0, y1: 1, fillcolor: c.shade, line: { width: 0 }, layer: "below" },
      { type: "line", xref: "x", yref: "paper", x0: 0, x1: 0, y0: 0, y1: 1, line: { color: c.neutral, width: 1, dash: "dot" } },
    ];
    if (d > 0) sh.push(
      { type: "rect", xref: "x", yref: "paper", x0: 0, x1: d * UM, y0: 0, y1: 1, fillcolor: c.shade, line: { width: 0 }, layer: "below" },
      { type: "line", xref: "x", yref: "paper", x0: d * UM, x1: d * UM, y0: 0, y1: 1, line: { color: c.neutral, width: 1, dash: "dot" } });
    return sh;
  }
  const regionLabel = r => (r.d > 0 ? [{ x: r.d * UM / 2, yref: "paper", text: "<b>i</b>", showarrow: false, yanchor: "top", y: 0.99,
    font: { size: 13, color: colors().text2 } }] : []);
  const vmark = (x, c) => ({ type: "line", xref: "x", yref: "paper", x0: x, x1: x, y0: 0, y1: 1, line: { color: c, width: 1, dash: "dot" } });

  // ---------------------------------------------------------------- state
  const DEFAULTS = { jtype: "homo", profile: "abrupt", pmat: "Si", nmat: "GaN", px: 0.3, nx: 0.3, lNA: 17, lND: 16, lgrad: 22,
    T: 300, V: 0, vrev: 20, incomplete: false, stats: "Boltzmann", area: 1e4, useTau: false, ltaun: -9, ltaup: -9,
    imat: "InGaN", ix: 0.15, ld: 0, ovP: {}, ovN: {}, showVac: false, tab: "summary", tempSel: ["Si", "Ge", "4H-SiC", "GaN"],
    swVar: "V", swOuts: ["W", "Emax"], swN: 60 };
  let S = loadState();
  let R = null, INP = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- controls wiring
  function segment(id, key, after) {
    const el = $(id);
    el.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      if (b.disabled) return;
      S[key] = b.dataset.v; syncSeg(id, key); if (after) after(); update();
    }));
  }
  function syncSeg(id, key) { $(id).querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === S[key])); }
  function pairRange(rid, nid, key, cast = parseFloat) {
    const r = $(rid), n = nid ? $(nid) : null;
    r.addEventListener("input", () => { S[key] = cast(r.value); if (n) n.value = r.value; update(); });
    if (n) n.addEventListener("change", () => {
      let v = cast(n.value); if (!Number.isFinite(v)) return;
      const lo = parseFloat(n.min), hi = parseFloat(n.max);
      if (Number.isFinite(lo)) v = Math.max(lo, v); if (Number.isFinite(hi)) v = Math.min(hi, v);
      S[key] = v; n.value = v; r.value = v; update();
    });
  }

  function fillSelect(id) {
    $(id).innerHTML = PN.LIBRARY_KEYS.map(k => `<option value="${k}">${k}</option>`).join("");
  }

  function buildOverrides(which) {
    const key = which === "p" ? "pmat" : "nmat", xkey = which === "p" ? "px" : "nx", ovk = which === "p" ? "ovP" : "ovN";
    const base = PN.getMaterial(S[key], S[xkey]);
    const box = $(which === "p" ? "ovPin" : "ovNin");
    const ov = S[ovk];
    box.innerHTML = `<div class="grid2">${OV_FIELDS.map(([f, lab, step, scale]) => {
      const v = ov[f] !== undefined ? ov[f] : (f === "Eg_shift" ? 0 : base[f]);
      return `<div><label for="ov${which}_${f}">${lab}</label><input type="number" id="ov${which}_${f}" step="${step}" value="${+(v / scale).toPrecision(5)}"></div>`;
    }).join("")}</div><div class="btnrow"><button class="btn" id="ov${which}Reset">Reset to library values</button></div>
    <p class="hint">${base.notes || ""}</p>`;
    OV_FIELDS.forEach(([f, , , scale]) => {
      $(`ov${which}_${f}`).addEventListener("change", e => {
        const v = parseFloat(e.target.value);
        const dflt = f === "Eg_shift" ? 0 : base[f];
        if (!Number.isFinite(v)) return;
        if (Math.abs(v * scale - dflt) < 1e-12 * Math.max(1, Math.abs(dflt))) delete S[ovk][f]; else S[ovk][f] = v * scale;
        update();
      });
    });
    $(`ov${which}Reset`).addEventListener("click", () => { S[ovk] = {}; buildOverrides(which); update(); });
  }

  function syncControls() {
    syncSeg("jtype", "jtype"); syncSeg("profile", "profile"); syncSeg("stats", "stats");
    const homo = S.jtype === "homo";
    if (!homo && S.profile === "graded") S.profile = "abrupt";
    $("profile").querySelector('[data-v="graded"]').disabled = !homo;
    syncSeg("profile", "profile");
    $("pmat").value = S.pmat; $("nmat").value = S.nmat; $("imat").value = S.imat;
    $("px").value = S.px; $("nx").value = S.nx; $("ix").value = S.ix;
    $("pxRow").hidden = !PN.ALLOYS[S.pmat]; $("nxRow").hidden = !PN.ALLOYS[S.nmat]; $("ixRow").hidden = !PN.ALLOYS[S.imat];
    $("imatBlock").hidden = homo || S.profile !== "pin";
    $("nmatBlock").hidden = homo;
    $("pmatLbl").textContent = homo ? "Material" : "p-side material";
    $("ovN").hidden = homo;
    $("abruptDoping").hidden = S.profile === "graded"; $("gradedDoping").hidden = S.profile !== "graded";
    $("pinRow").hidden = S.profile !== "pin";
    for (const [r, n, k] of [["ld", "ldn", "ld"], ["lNA", "lNAn", "lNA"], ["lND", "lNDn", "lND"], ["lgrad", "lgradn", "lgrad"], ["T", "Tn", "T"], ["V", "Vn", "V"]]) {
      $(r).value = S[k]; $(n).value = S[k];
    }
    $("vrev").value = S.vrev; $("V").min = -S.vrev;
    $("incomplete").checked = S.incomplete; $("area").value = S.area;
    $("useTau").checked = S.useTau; $("tauBox").hidden = !S.useTau;
    $("ltaun").value = S.ltaun; $("ltaup").value = S.ltaup; $("showVac").checked = S.showVac;
    buildOverrides("p"); buildOverrides("n");
  }

  function wire() {
    fillSelect("pmat"); fillSelect("nmat"); fillSelect("imat");
    $("imat").addEventListener("change", e => { S.imat = e.target.value; syncControls(); update(); });
    $("ix").addEventListener("input", e => { S.ix = +e.target.value; update(); });
    pairRange("ld", "ldn", "ld");
    segment("jtype", "jtype", () => { S.ovN = {}; syncControls(); });
    segment("profile", "profile", syncControls);
    segment("stats", "stats");
    $("pmat").addEventListener("change", e => { S.pmat = e.target.value; S.ovP = {}; syncControls(); update(); });
    $("nmat").addEventListener("change", e => { S.nmat = e.target.value; S.ovN = {}; syncControls(); update(); });
    $("px").addEventListener("input", e => { S.px = +e.target.value; S.ovP = {}; buildOverrides("p"); update(); });
    $("nx").addEventListener("input", e => { S.nx = +e.target.value; S.ovN = {}; buildOverrides("n"); update(); });
    pairRange("lNA", "lNAn", "lNA"); pairRange("lND", "lNDn", "lND"); pairRange("lgrad", "lgradn", "lgrad");
    pairRange("T", "Tn", "T"); pairRange("V", "Vn", "V");
    $("vrev").addEventListener("change", e => {
      const v = Math.max(1, +e.target.value || 20); S.vrev = v; $("V").min = -v; $("ivR").value = v; update();
    });
    $("incomplete").addEventListener("change", e => { S.incomplete = e.target.checked; update(); });
    $("area").addEventListener("change", e => { S.area = Math.max(1, +e.target.value || 1e4); update(); });
    $("useTau").addEventListener("change", e => { S.useTau = e.target.checked; $("tauBox").hidden = !S.useTau; update(); });
    pairRange("ltaun", null, "ltaun"); pairRange("ltaup", null, "ltaup");
    $("showVac").addEventListener("change", e => { S.showVac = e.target.checked; renderTab(); });
    $("tabs").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { S.tab = b.dataset.t; showTab(); saveState(); }));
    $("ivF").addEventListener("change", () => { $("ivF").dataset.auto = "0"; renderTab(); }); $("ivR").addEventListener("change", renderTab); $("ivLin").addEventListener("change", renderTab);
    ["libT", "libXa", "libXi"].forEach(id => $(id).addEventListener("input", renderTab));
    $("swVar").addEventListener("change", e => { S.swVar = e.target.value; setSweepRange(); renderTab(); saveState(); });
    ["swLo", "swHi", "swN"].forEach(id => $(id).addEventListener("change", () => { S.swN = +$("swN").value; renderTab(); }));
    $("themeBtn").addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark";
      try { localStorage.setItem("pnjunction.theme", document.documentElement.dataset.theme); } catch (e) { /* ignore */ }
      renderTab();
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderTab);
    $("dlJson").addEventListener("click", downloadJSON); $("dlCsv").addEventListener("click", downloadProfiles);
    $("dlSweep").addEventListener("click", () => SWEEP_CSV && download("PNJunction_sweep.csv", SWEEP_CSV, "text/csv"));
    $("dlLib").addEventListener("click", downloadLibrary);
    $("saveCfg").addEventListener("click", () => download("PNJunction_settings.json", JSON.stringify(S, null, 2), "application/json"));
    $("loadCfg").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { S = Object.assign({}, DEFAULTS, JSON.parse(t)); syncControls(); showTab(); update(); })
        .catch(err => alert("Could not read settings file: " + err.message));
      e.target.value = "";
    });
    $("resetCfg").addEventListener("click", () => { S = JSON.parse(JSON.stringify(DEFAULTS)); syncControls(); showTab(); update(); });
    window.addEventListener("resize", () => { clearTimeout(wire._t); wire._t = setTimeout(renderTab, 150); });
  }

  // ---------------------------------------------------------------- compute
  function buildInput() {
    const homo = S.jtype === "homo";
    const pm = PN.getMaterial(S.pmat, S.px, S.ovP);
    const nm = homo ? pm : PN.getMaterial(S.nmat, S.nx, S.ovN);
    const profile = homo ? S.profile : (S.profile === "pin" ? "pin" : "abrupt");
    const im = profile === "pin" ? (homo ? pm : PN.getMaterial(S.imat, S.ix)) : null;
    return { p_mat: pm, n_mat: nm, i_mat: im, d: 10 ** S.ld * 1e-4, NA: 10 ** S.lNA, ND: 10 ** S.lND, T: S.T, V: S.V,
      profile, grad: 10 ** S.lgrad, incomplete: S.incomplete, stats: S.stats,
      area: S.area * 1e-8, tau_n: S.useTau ? 10 ** S.ltaun : null, tau_p: S.useTau ? 10 ** S.ltaup : null };
  }
  let pending = false;
  function update() {
    if (pending) return; pending = true;
    requestAnimationFrame(() => { pending = false; compute(); });
  }
  function compute() {
    saveState();
    $("NAval").innerHTML = sci(10 ** S.lNA) + " cm⁻³"; $("NDval").innerHTML = sci(10 ** S.lND) + " cm⁻³";
    $("gradVal").textContent = sci(10 ** S.lgrad) + " cm⁻⁴"; $("Tval").textContent = `${S.T} K`;
    $("Vval").textContent = `${S.V >= 0 ? "+" : ""}${(+S.V).toFixed(2)} V`;
    $("pxVal").textContent = (+S.px).toFixed(2); $("nxVal").textContent = (+S.nx).toFixed(2); $("ixVal").textContent = (+S.ix).toFixed(2);
    $("dVal").textContent = sci(10 ** S.ld, 3) + " µm";
    $("taunVal").textContent = sci(10 ** S.ltaun) + " s"; $("taupVal").textContent = sci(10 ** S.ltaup) + " s";
    const homo = S.jtype === "homo";
    $("ovPsum").textContent = `Edit ${homo ? "material" : "p-side"} parameters`;
    $("ovNsum").textContent = "Edit n-side parameters";
    INP = buildInput();
    try { R = PN.solve(INP); }
    catch (err) { $("warnings").innerHTML = `<div class="alert"><b>Error:</b> could not solve this configuration (${err.message}).</div>`; return; }
    const pm = INP.p_mat, nm = INP.n_mat;
    const pinMode = INP.profile === "pin";
    $("title").textContent = pinMode
      ? (homo ? `${pm.label} p–i–n diode` : `p-${pm.label} / i-${INP.i_mat.label} / n-${nm.label} p–i–n heterostructure`)
      : (homo ? `${pm.label} homojunction` : `p-${pm.label} / n-${nm.label} heterojunction`);
    $("subtitle").textContent = `${{ graded: "Linearly graded", abrupt: "Abrupt", pin: `p–i–n (d = ${sci(INP.d * UM)} µm)` }[INP.profile]} profile · T = ${S.T} K · V = ${S.V >= 0 ? "+" : ""}${(+S.V).toFixed(3)} V (${S.V > 0 ? "forward" : S.V < 0 ? "reverse" : "equilibrium"}) · ${S.stats} statistics · ${S.incomplete ? "incomplete" : "complete"} ionization`;
    $("warnings").innerHTML = R.warnings.map(w => `<div class="alert" role="status"><b>⚠ Note</b>${w}</div>`).join("");
    if (!$("ivF").value || $("ivF").dataset.auto !== "0") { $("ivF").value = Math.min(Math.max(R.Vbi, 0.2), 7).toFixed(2); }
    if (!$("ivR").value) $("ivR").value = S.vrev;
    renderTab();
  }

  // ---------------------------------------------------------------- tabs
  function showTab() {
    $("tabs").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.t === S.tab));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + S.tab));
    renderTab();
  }
  function renderTab() {
    if (!R) return;
    ({ summary: renderSummary, band: renderBand, es: renderES, carriers: renderCarriers, ivcv: renderIVCV,
      temp: renderTemp, sweep: renderSweep, lib: renderLib, eq: () => {} })[S.tab]();
  }

  function card(k, v, unit) { return `<div class="card"><div class="k">${k}</div><div class="v">${v}<small>${unit}</small></div></div>`; }
  function renderSummary() {
    const r = R, pm = INP.p_mat, nm = INP.n_mat, T = INP.T, fp = r.fp, fn = r.fn;
    $("cards").innerHTML = [
      card("Built-in voltage V<sub>bi</sub>", r.Vbi.toFixed(4), "V"), card("Depletion width W", sci(r.W * UM, 4), "µm"),
      card("Peak field |E|<sub>max</sub>", sci(r.Emax / 1e3, 4), "kV/cm"), card("Junction capacitance", sci(r.C_area * 1e9, 4), "nF/cm²"),
      card("x<sub>p</sub> (p-side)", sci(r.xp * UM, 4), "µm"), card("x<sub>n</sub> (n-side)", sci(r.xn * UM, 4), "µm"),
      card("Current density J", sci(r.J.J, 3), "A/cm²"), card("Est. breakdown V<sub>BR</sub>", sci(r.V_br, 4), "V"),
    ].join("");
    const pinMode = INP.profile === "pin", im = INP.i_mat;
    const pinInfo = pinMode ? `<div class="info"><b>Intrinsic layer</b> (${im.label}, d = ${sci(r.d * UM, 4)} µm): uniform field |E<sub>i</sub>| = ${sci(Math.abs(r.E_i) / 1e3, 4)} kV/cm, voltage across i-layer V<sub>i</sub> = ${f4(r.Vi)} V of V<sub>bi</sub> − V = ${f4(r.Veff)} V. Depletion width W = x<sub>p</sub> + d + x<sub>n</sub>.${S.jtype === "hetero" ? ` Offsets: p/i ΔE<sub>c</sub> = ${r.dEc_pi.toFixed(3)} eV, ΔE<sub>v</sub> = ${r.dEv_pi.toFixed(3)} eV; i/n ΔE<sub>c</sub> = ${r.dEc_in.toFixed(3)} eV, ΔE<sub>v</sub> = ${r.dEv_in.toFixed(3)} eV (each = later layer − earlier layer).` : ""}</div>` : "";
    $("offsets").innerHTML = pinInfo + (S.jtype === "hetero" && !pinMode
      ? `<div class="info"><b>Anderson band offsets</b> (flat band, n relative to p): ΔE<sub>c</sub> = E<sub>c</sub>(n) − E<sub>c</sub>(p) = ${sign4(r.dEc).slice(0, -1)} eV, ΔE<sub>v</sub> = E<sub>v</sub>(n) − E<sub>v</sub>(p) = ${sign4(r.dEv).slice(0, -1)} eV. Interface states and polarization charges are not included.</div>` : "");
    const rows = [
      ["Material", pm.label, nm.label],
      ["Dopant", `${pm.acceptor} (ΔE<sub>a</sub> = ${pm.Ea.toFixed(3)} eV)`, `${nm.donor} (ΔE<sub>d</sub> = ${nm.Ed.toFixed(3)} eV)`],
      ["Doping (cm⁻³)", sci(r.NA_eff), sci(r.ND_eff)],
      ["Ionized fraction", (100 * fp.ion_frac).toFixed(2) + " %", (100 * fn.ion_frac).toFixed(2) + " %"],
      ["E<sub>g</sub> (eV)", f4(pm.Eg(T)), f4(nm.Eg(T))],
      ["χ (eV)", pm.chi(T).toFixed(3), nm.chi(T).toFixed(3)],
      ["ε<sub>r</sub>", pm.eps_r.toFixed(2), nm.eps_r.toFixed(2)],
      ["N<sub>c</sub> / N<sub>v</sub> (cm⁻³)", `${sci(pm.Nc(T))} / ${sci(pm.Nv(T))}`, `${sci(nm.Nc(T))} / ${sci(nm.Nv(T))}`],
      ["Intrinsic density n<sub>i</sub> (cm⁻³)", sci(r.ni_p), sci(r.ni_n)],
      ["E<sub>i</sub> − E<sub>v</sub> (eV)", f4(fp.Ei_Ev), f4(fn.Ei_Ev)],
      ["E<sub>F</sub> − E<sub>v</sub> (eV)", f4(fp.EF_Ev), f4(fn.EF_Ev)],
      ["E<sub>c</sub> − E<sub>F</sub> (eV)", f4(fp.Ec_EF), f4(fn.Ec_EF)],
      ["E<sub>F</sub> − E<sub>i</sub> (eV)", sign4(fp.EF_Ei), sign4(fn.EF_Ei)],
      ["Majority carriers (cm⁻³)", "p = " + sci(fp.p, 4), "n = " + sci(fn.n, 4)],
      ["Minority carriers (cm⁻³)", "n = " + sci(fp.n, 4), "p = " + sci(fn.p, 4)],
      ["Work function Φ (eV)", f4(r.phi_p), f4(r.phi_n)],
      ["Band-bending share (V)", f4(r.Vp), f4(r.Vn)],
      ["Minority diffusivity (cm²/s)", "D<sub>n</sub> = " + sci(r.Dn), "D<sub>p</sub> = " + sci(r.Dp)],
      ["Minority lifetime (s)", "τ<sub>n</sub> = " + sci(r.tau_n), "τ<sub>p</sub> = " + sci(r.tau_p)],
      ["Diffusion length (µm)", "L<sub>n</sub> = " + sci(r.Ln * UM), "L<sub>p</sub> = " + sci(r.Lp * UM)],
      ["Debye length (nm)", sci(r.LDp * 1e7), sci(r.LDn * 1e7)],
      ["E<sub>crit</sub> (MV/cm)", (pm.E_crit / 1e6).toFixed(2), (nm.E_crit / 1e6).toFixed(2)],
    ];
    if (pinMode) {
      const iCol = { "Material": im.label, "Dopant": "none (ideal intrinsic)", "Doping (cm⁻³)": "0", "E<sub>g</sub> (eV)": f4(im.Eg(T)),
        "χ (eV)": im.chi(T).toFixed(3), "ε<sub>r</sub>": im.eps_r.toFixed(2), "N<sub>c</sub> / N<sub>v</sub> (cm⁻³)": `${sci(im.Nc(T))} / ${sci(im.Nv(T))}`,
        "Intrinsic density n<sub>i</sub> (cm⁻³)": sci(r.ni_i), "E<sub>i</sub> − E<sub>v</sub> (eV)": f4(im.Eg(T) / 2 + im.EiMid(T)),
        "Band-bending share (V)": f4(r.Vi), "E<sub>crit</sub> (MV/cm)": (im.E_crit / 1e6).toFixed(2) };
      rows.forEach(row => row.splice(2, 0, iCol[row[0]] ?? "—"));
    }
    $("sideTable").innerHTML = `<thead><tr><th>Quantity</th><th>p-side</th>${pinMode ? "<th>i-layer</th>" : ""}<th>n-side</th></tr></thead><tbody>${
      rows.map(([a, ...v]) => `<tr><td>${a}</td>${v.map(x => `<td class="num">${x}</td>`).join("")}</tr>`).join("")}</tbody>`;
    const j = r.J;
    $("jnote").innerHTML = `Saturation currents: J<sub>0</sub> (diffusion) = ${sci(j.J0)} A/cm² [electrons ${sci(j.J0n)}, holes ${sci(j.J0p)}], J<sub>gr0</sub> = ${sci(j.Jgr0)} A/cm². Device current I = ${sci(r.I)} A for an area of ${S.area} µm².`;
  }

  function renderBand() {
    const r = R, c = colors(), xu = r.x.map(v => v * UM);
    const ht = n => `${n}: %{y:.4f} eV<extra></extra>`;
    const tr = [
      line(xu, r.Ec, "E<sub>c</sub>", c.s[0], { ht: ht("Ec") }),
      line(xu, r.Ev, "E<sub>v</sub>", c.s[1], { ht: ht("Ev") }),
      line(xu, r.Ei, "E<sub>i</sub> (intrinsic)", c.neutral, { dash: "dash", ht: ht("Ei") }),
      line(xu, Array.from(r.EFn, v => Number.isFinite(v) ? v : null), "E<sub>Fn</sub> (electron quasi-Fermi)", c.s[2], { ht: ht("EFn") }),
      line(xu, Array.from(r.EFp, v => Number.isFinite(v) ? v : null), "E<sub>Fp</sub> (hole quasi-Fermi)", c.s[6], { dash: "dot", ht: ht("EFp") }),
    ];
    if (S.showVac) tr.push(line(xu, r.Evac, "E<sub>vac</sub>", c.neutral, { width: 1.5, ht: ht("Evac") }));
    const ann = [
      { x: xu[0], y: r.Ec[0], text: "<b>p</b>", showarrow: false, xanchor: "left", yanchor: "bottom", font: { size: 15, color: c.text2 } },
      { x: xu[xu.length - 1], y: r.Ec[r.Ec.length - 1], text: "<b>n</b>", showarrow: false, xanchor: "right", yanchor: "bottom", font: { size: 15, color: c.text2 } },
    ];
    plot("chBand", tr, { height: 520, ytitle: "Energy (eV)", shapes: depletionShapes(r), annotations: ann.concat(regionLabel(r)) });
  }

  function renderES() {
    const r = R, c = colors(), xu = r.x.map(v => v * UM), sh = depletionShapes(r);
    const graded = INP.profile === "graded";
    plot("chRho", [line(xu, Array.from(r.rho), "ρ/q", c.s[0], { shape: graded ? "linear" : "hv",
      extra: { fill: "tozeroy", fillcolor: c.s[0] + "26" }, ht: "ρ/q: %{y:.3e} cm⁻³<extra></extra>" })],
      { height: 260, ytitle: "cm⁻³", shapes: sh, showlegend: false, xtitle: "" });
    plot("chE", [line(xu, Array.from(r.E, v => v / 1e3), "E", c.s[1], { ht: "E: %{y:.4g} kV/cm<extra></extra>" })],
      { height: 260, ytitle: "kV/cm", shapes: sh, showlegend: false, xtitle: "" });
    plot("chPhi", [line(xu, Array.from(r.phi), "φ", c.s[2], { ht: "φ: %{y:.4f} V<extra></extra>" })],
      { height: 260, ytitle: "V", shapes: sh, showlegend: false, annotations: regionLabel(r) });
  }

  function renderCarriers() {
    const r = R, c = colors(), xu = r.x.map(v => v * UM);
    const di = r.d || 0;
    const dop = r.x.map(x => INP.profile === "graded" ? Math.abs(INP.grad * x) : (x < 0 ? r.NA_eff : x < di ? 0 : r.ND_eff));
    const ni = r.x.map(x => x < 0 ? r.ni_p : x < di ? r.ni_i : r.ni_n);
    const ht = n => `${n}: %{y:.3e} cm⁻³<extra></extra>`;
    plot("chCar", [
      line(xu, posOnly(r.n), "n (electrons)", c.s[0], { ht: ht("n") }),
      line(xu, posOnly(r.p), "p (holes)", c.s[1], { ht: ht("p") }),
      line(xu, posOnly(dop), "|N<sub>D</sub> − N<sub>A</sub>|", c.neutral, { dash: "dash", width: 1.5, ht: ht("|ND−NA|") }),
      line(xu, posOnly(ni), "n<sub>i</sub>", c.s[2], { dash: "dot", width: 1.5, ht: ht("ni") }),
    ], { height: 520, ytitle: "Concentration (cm⁻³)", logy: true, shapes: depletionShapes(r), annotations: regionLabel(r) });
    $("carNote").innerHTML = `Minority-carrier tails in the neutral regions decay with the diffusion lengths L<sub>n</sub> = ${sci(r.Ln * UM)} µm and L<sub>p</sub> = ${sci(r.Lp * UM)} µm (long-diode model). Values below ~10⁻³⁰⁰ cm⁻³ are not drawn.`;
  }

  const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  function renderIVCV() {
    const c = colors();
    const vf = Math.max(0.05, +$("ivF").value || 1), vr = Math.max(0.1, +$("ivR").value || S.vrev);
    const lin = $("ivLin").checked;
    const Vs = lin ? linspace(0, vf, 300) : linspace(-vr, vf, 400);
    const iv = PN.ivCurve(INP, Vs);
    const f = a => lin ? a : posOnly(a.map(Math.abs));
    const ht = n => `${n}: %{y:.3e} A/cm²<extra></extra>`;
    plot("chIV", [
      line(Vs, f(iv.J), "|J| total", c.s[0], { ht: ht("J") }),
      line(Vs, f(iv.Jdiff), "|J| diffusion (n = 1)", c.s[1], { dash: "dash", ht: ht("Jdiff") }),
      line(Vs, f(iv.Jgr), "|J| generation–recombination (n = 2)", c.s[2], { dash: "dot", ht: ht("Jgr") }),
    ], { height: 440, xtitle: "Bias V (V)", ytitle: lin ? "J (A/cm²)" : "|J| (A/cm²)", logy: !lin, shapes: [vmark(INP.V, c.neutral)] });
    const Vc = linspace(-vr, Math.min(0.9 * R.Vbi, vf), 300);
    const cv = PN.cvCurve(INP, Vc);
    plot("chC", [line(Vc, cv.C_area.map(v => v * 1e9), "C/A", c.s[0], { ht: "C/A: %{y:.4g} nF/cm²<extra></extra>" })],
      { height: 340, xtitle: "Bias V (V)", ytitle: "nF/cm²", showlegend: false });
    plot("chC2", [line(Vc, cv.inv_C2, "1/C²", c.s[1], { ht: "1/C²: %{y:.4e}<extra></extra>" })],
      { height: 340, xtitle: "Bias V (V)", ytitle: "cm⁴/F²", showlegend: false });
    $("cvNote").textContent = INP.profile === "pin"
      ? "In a p–i–n the i-layer sets a bias-independent floor W ≥ d, so C/A saturates near ε_i/d under reverse bias and 1/C² is not linear (Mott–Schottky does not apply directly)."
      : INP.profile === "abrupt"
      ? "For an abrupt junction 1/C² is linear in V; its V-axis intercept gives V_bi and its slope gives the lighter doping (Mott–Schottky analysis)."
      : "A linearly graded junction gives 1/C³ ∝ (V_bi − V), so 1/C² is curved.";
  }

  function renderTemp() {
    const c = colors();
    const chips = $("tempChips");
    if (!chips.childElementCount) {
      chips.innerHTML = PN.LIBRARY_KEYS.map(k => `<button class="chip" data-k="${k}">${k}</button>`).join("");
      chips.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
        const k = b.dataset.k; S.tempSel = S.tempSel.includes(k) ? S.tempSel.filter(x => x !== k) : [...S.tempSel, k];
        saveState(); renderTemp();
      }));
    }
    chips.querySelectorAll(".chip").forEach(b => b.classList.toggle("on", S.tempSel.includes(b.dataset.k)));
    const Ts = linspace(50, 900, 120);
    const sel = PN.LIBRARY_KEYS.filter(k => S.tempSel.includes(k));   // fixed order = fixed color per material
    const col = k => c.s[PN.LIBRARY_KEYS.indexOf(k)];
    const mats = sel.map(k => [k, PN.getMaterial(k, k === "AlGaN" ? 0.3 : 0.15)]);
    plot("chEgT", mats.map(([k, m]) => line(Ts, Ts.map(t => m.Eg(t)), m.label, col(k), { ht: `${m.label}: %{y:.4f} eV<extra></extra>` })),
      { height: 360, xtitle: "Temperature (K)", ytitle: "E<sub>g</sub> (eV)", shapes: [vmark(INP.T, c.neutral)] });
    plot("chNiT", mats.map(([k, m]) => line(Ts.map(t => 1000 / t), Ts.map(t => { const v = m.ni(t); return v > 1e-60 ? v : null; }), m.label, col(k),
      { ht: `${m.label}: %{y:.3e} cm⁻³<extra></extra>` })),
      { height: 360, xtitle: "1000 / T (K⁻¹)", ytitle: "n<sub>i</sub> (cm⁻³)", logy: true, shapes: [vmark(1000 / INP.T, c.neutral)] });

    const T2 = linspace(50, 900, 70);
    const pm = INP.p_mat, nm = INP.n_mat, out = { efp: [], efn: [], eip: [], ein: [], vbi: [], W: [] };
    for (const t of T2) {
      const a = PN.fermiLevel(pm, t, 0, R.NA_eff, INP.incomplete, INP.stats);
      const b = PN.fermiLevel(nm, t, R.ND_eff, 0, INP.incomplete, INP.stats);
      out.efp.push(a.EF_Ev); out.efn.push(b.EF_Ev); out.eip.push(a.Ei_Ev); out.ein.push(b.Ei_Ev);
      try { const rr = PN.solve(Object.assign({}, INP, { T: t, V: 0 }), { nPoints: 0 }); out.vbi.push(rr.Vbi); out.W.push(rr.W * UM); }
      catch (e) { out.vbi.push(null); out.W.push(null); }
    }
    const efPlot = (id, m, ef, ei) => plot(id, [
      line(T2, T2.map(t => m.Eg(t)), "E<sub>c</sub>", c.s[0], { ht: "Ec: %{y:.4f} eV<extra></extra>" }),
      line(T2, T2.map(() => 0), "E<sub>v</sub>", c.s[1], { ht: "Ev: %{y:.4f} eV<extra></extra>" }),
      line(T2, ei, "E<sub>i</sub>", c.neutral, { dash: "dash", ht: "Ei: %{y:.4f} eV<extra></extra>" }),
      line(T2, ef, "E<sub>F</sub>", c.s[2], { ht: "EF: %{y:.4f} eV<extra></extra>" }),
    ], { height: 360, xtitle: "Temperature (K)", ytitle: "Energy above E<sub>v</sub> (eV)", shapes: [vmark(INP.T, c.neutral)] });
    efPlot("chEFp", pm, out.efp, out.eip); efPlot("chEFn", nm, out.efn, out.ein);
    plot("chVbiT", [line(T2, out.vbi, "V<sub>bi</sub>", c.s[0], { ht: "Vbi: %{y:.4f} V<extra></extra>" })],
      { height: 320, xtitle: "Temperature (K)", ytitle: "V", showlegend: false, shapes: [vmark(INP.T, c.neutral)] });
    plot("chWT", [line(T2, out.W, "W", c.s[0], { ht: "W: %{y:.4g} µm<extra></extra>" })],
      { height: 320, xtitle: "Temperature (K)", ytitle: "µm", showlegend: false, shapes: [vmark(INP.T, c.neutral)] });
  }

  // ---------------------------------------------------------------- sweep
  const SW_OUTS = { Vbi: ["V_bi", "V"], W: ["W", "µm"], xp: ["x_p", "µm"], xn: ["x_n", "µm"], Emax: ["|E|max", "kV/cm"],
    C: ["C/A", "nF/cm²"], J: ["|J|", "A/cm²"], Vbr: ["V_BR", "V"] };
  const SW_VARS = { V: ["Bias V", "V", false], T: ["Temperature T", "K", false], NA: ["N_A", "cm⁻³", true],
    ND: ["N_D", "cm⁻³", true], grad: ["Grading a", "cm⁻⁴", true], d: ["i-layer thickness d", "µm", true] };
  let SWEEP_CSV = "";
  function setSweepRange() {
    const v = S.swVar;
    const rng = { V: [-S.vrev, 0], T: [100, 600], NA: [1e14, 1e19], ND: [1e14, 1e19], grad: [1e18, 1e24], d: [0.01, 100] }[v];
    $("swLo").value = rng[0]; $("swHi").value = rng[1];
  }
  function renderSweep() {
    const graded = INP.profile === "graded";
    const vars = graded ? ["V", "T", "grad"] : INP.profile === "pin" ? ["V", "T", "NA", "ND", "d"] : ["V", "T", "NA", "ND"];
    if (!vars.includes(S.swVar)) { S.swVar = "V"; setSweepRange(); }
    const sel = $("swVar");
    const want = vars.map(v => `<option value="${v}">${SW_VARS[v][0]} (${SW_VARS[v][1]})</option>`).join("");
    if (sel.dataset.sig !== want) { sel.innerHTML = want; sel.dataset.sig = want; }
    sel.value = S.swVar;
    if (!$("swLo").value) setSweepRange();
    $("swN").value = S.swN;
    const outBox = $("swOuts");
    if (!outBox.childElementCount) {
      outBox.innerHTML = Object.keys(SW_OUTS).map(k => `<button class="chip" data-k="${k}">${SW_OUTS[k][0]}</button>`).join("");
      outBox.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
        const k = b.dataset.k; S.swOuts = S.swOuts.includes(k) ? S.swOuts.filter(x => x !== k) : [...S.swOuts, k];
        saveState(); renderSweep();
      }));
    }
    outBox.querySelectorAll(".chip").forEach(b => b.classList.toggle("on", S.swOuts.includes(b.dataset.k)));

    const [vname, vunit, logx] = SW_VARS[S.swVar];
    let lo = +$("swLo").value, hi = +$("swHi").value;
    const n = Math.min(400, Math.max(5, S.swN | 0));
    if (logx) { lo = Math.max(lo, 1); hi = Math.max(hi, lo * 1.0001); }
    const xs = logx ? linspace(Math.log10(lo), Math.log10(hi), n).map(v => 10 ** v) : linspace(lo, hi, n);
    const outs = Object.keys(SW_OUTS).filter(k => S.swOuts.includes(k));
    const res = Object.fromEntries(outs.map(o => [o, []]));
    for (const xv of xs) {
      let rr = null;
      try { rr = PN.solve(Object.assign({}, INP, { [S.swVar]: S.swVar === "d" ? xv * 1e-4 : xv }), { nPoints: 0 }); } catch (e) { /* skip */ }
      const vals = rr ? { Vbi: rr.Vbi, W: rr.W * UM, xp: rr.xp * UM, xn: rr.xn * UM, Emax: rr.Emax / 1e3,
        C: rr.C_area * 1e9, J: Math.abs(rr.J.J), Vbr: rr.V_br } : {};
      for (const o of outs) res[o].push(vals[o] ?? null);
    }
    const c = colors(), box = $("swCharts");
    box.innerHTML = outs.map(o => `<div class="panel"><h3>${SW_OUTS[o][0]} (${SW_OUTS[o][1]})</h3><div class="chart" id="sw_${o}"></div></div>`).join("");
    for (const o of outs) {
      const ht = `${SW_OUTS[o][0]}: %{y:.4g} ${SW_OUTS[o][1]}<extra></extra>`;
      plot("sw_" + o, [Object.assign(line(xs, o === "J" ? posOnly(res[o]) : res[o], SW_OUTS[o][0], c.s[0], { ht }),
        { mode: "lines+markers", marker: { size: 5, color: c.s[0] } })],
        { height: 300, xtitle: `${vname} (${vunit})`, ytitle: SW_OUTS[o][1], logx, logy: o === "J", showlegend: false, hovermode: "closest" });
    }
    SWEEP_CSV = [[`${vname} (${vunit})`, ...outs.map(o => `${SW_OUTS[o][0]} (${SW_OUTS[o][1]})`)].join(","),
      ...xs.map((x, i) => [x, ...outs.map(o => res[o][i])].join(","))].join("\n");
  }

  // ---------------------------------------------------------------- library
  let LIB_ROWS = [];
  function renderLib() {
    const T = Math.min(900, Math.max(50, +$("libT").value || 300)), xa = +$("libXa").value, xi = +$("libXi").value;
    $("libXaV").textContent = xa.toFixed(2); $("libXiV").textContent = xi.toFixed(2);
    LIB_ROWS = PN.materialTable(T, xa, xi);
    const cols = [["Material", "Material"], ["Structure", "Structure"], ["Gap", "Gap"], ["Eg", "E<sub>g</sub> (eV)", 4],
      ["chi", "χ (eV)", 3], ["eps_r", "ε<sub>r</sub>", 3], ["Nc", "N<sub>c</sub> (cm⁻³)", 3], ["Nv", "N<sub>v</sub> (cm⁻³)", 3],
      ["ni", "n<sub>i</sub> (cm⁻³)", 3], ["mun", "μ<sub>n</sub> (cm²/Vs)", 3], ["mup", "μ<sub>p</sub> (cm²/Vs)", 3],
      ["donor", "Donor (ΔE<sub>d</sub> eV)"], ["acceptor", "Acceptor (ΔE<sub>a</sub> eV)"], ["Ecrit", "E<sub>crit</sub> (MV/cm)", 3],
      ["vsat", "v<sub>sat</sub> (cm/s)", 3], ["BFOM", "Baliga FOM (×Si)", 3], ["JFOM", "Johnson FOM (×Si)", 3], ["notes", "Notes"]];
    $("libTable").innerHTML = `<thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}</tr></thead><tbody>${
      LIB_ROWS.map(r => `<tr>${cols.map(([k, , d]) => d ? `<td class="num">${sci(r[k], d)}</td>`
        : `<td${k === "notes" ? ' style="min-width:260px;color:var(--text-2)"' : ""}>${r[k]}</td>`).join("")}</tr>`).join("")}</tbody>`;
    const c = colors(), xs = linspace(0, 1, 101);
    plot("chAlloy", [
      line(xs, xs.map(x => PN.ALLOYS.AlGaN(x).Eg(T)), "Al<sub>x</sub>Ga<sub>1−x</sub>N", c.s[0], { ht: "AlGaN: %{y:.3f} eV<extra></extra>" }),
      line(xs, xs.map(x => PN.ALLOYS.InGaN(x).Eg(T)), "In<sub>x</sub>Ga<sub>1−x</sub>N", c.s[1], { ht: "InGaN: %{y:.3f} eV<extra></extra>" }),
    ], { height: 340, xtitle: "Mole fraction x", ytitle: "E<sub>g</sub> (eV)" });
  }

  // ---------------------------------------------------------------- downloads
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function downloadJSON() {
    const out = {};
    for (const k in R) if (typeof R[k] === "number" || typeof R[k] === "string") out[k] = R[k];
    Object.assign(out, { fp: R.fp, fn: R.fn, J: R.J, warnings: R.warnings.map(w => w.replace(/<[^>]+>/g, "")),
      inputs: { p_material: INP.p_mat.label, n_material: INP.n_mat.label,
        i_material: INP.i_mat ? INP.i_mat.label : null, i_thickness_cm: INP.profile === "pin" ? INP.d : null, NA: INP.NA, ND: INP.ND, grad: INP.grad,
        T: INP.T, V: INP.V, profile: INP.profile, incomplete: INP.incomplete, stats: INP.stats, area_cm2: INP.area,
        overrides_p: S.ovP, overrides_n: S.ovN } });
    download("PNJunction_results.json", JSON.stringify(out, null, 2), "application/json");
  }
  function downloadProfiles() {
    const keys = ["rho", "E", "phi", "Ec", "Ev", "Ei", "EFn", "EFp", "Evac", "n", "p"];
    const head = "x_um,rho_over_q_cm-3,E_V_per_cm,phi_V,Ec_eV,Ev_eV,Ei_eV,EFn_eV,EFp_eV,Evac_eV,n_cm-3,p_cm-3";
    const lines = R.x.map((x, i) => [x * UM, ...keys.map(k => Number.isFinite(R[k][i]) ? R[k][i] : "")].join(","));
    download("PNJunction_profiles.csv", [head, ...lines].join("\n"), "text/csv");
  }
  function downloadLibrary() {
    const keys = Object.keys(LIB_ROWS[0] || {});
    const esc = v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v;
    download("PNJunction_material_library.csv", [keys.join(","), ...LIB_ROWS.map(r => keys.map(k => esc(r[k])).join(","))].join("\n"), "text/csv");
  }

  // ---------------------------------------------------------------- boot
  try { const th = localStorage.getItem("pnjunction.theme"); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* ignore */ }
  wire(); syncControls(); $("ivR").value = S.vrev; setSweepRange(); showTab(); compute();
  window.PNJ = { get state() { return S; }, get result() { return R; } };   // for debugging
})();
