/* PNJunction physics core (JavaScript port of the Python `pnjunction` package).
 * Units: cm, V, eV, s. Junction at x = 0, p-side x < 0. Energy reference: EF(p-bulk) = 0.
 * Forward bias V > 0. Heterojunctions: Anderson electron-affinity rule. */
"use strict";
const PN = (() => {
  const Q = 1.602176634e-19, KB = 8.617333262e-5, EPS0 = 8.8541878128e-14, NC300 = 2.509e19;
  const G_D = 2, G_A = 4;

  // ------------------------------------------------------------------ materials
  function makeMaterial(p) {
    const m = Object.assign({ notes: "", x: null, Eg_shift: 0 }, p);
    m.Eg = T => m.Eg0 - m.alpha * T * T / (T + m.beta) + m.Eg_shift;
    m.chi = T => m.chi300 + 0.5 * (m.Eg(300) - m.Eg(T));
    m.Nc = T => NC300 * Math.pow(m.me_dos, 1.5) * Math.pow(T / 300, 1.5);
    m.Nv = T => NC300 * Math.pow(m.mh_dos, 1.5) * Math.pow(T / 300, 1.5);
    m.ni = T => Math.sqrt(m.Nc(T) * m.Nv(T)) * Math.exp(-m.Eg(T) / (2 * KB * T));
    m.EiMid = T => 0.5 * KB * T * Math.log(m.Nv(T) / m.Nc(T));
    m.eps = () => m.eps_r * EPS0;
    const ct = (pr, N, T, g) => (pr[0] + (pr[1] - pr[0]) / (1 + Math.pow(Math.max(N, 1) / pr[2], pr[3]))) * Math.pow(T / 300, -g);
    m.mobN = (N, T) => ct(m.mu_n, N, T, m.gamma_n);
    m.mobP = (N, T) => ct(m.mu_p, N, T, m.gamma_p);
    m.label = m.x === null ? m.name : `${m.name} (x=${m.x.toFixed(2)})`;
    return m;
  }
  const RAW = {
    "Si": { name: "Si", Eg0: 1.1695, alpha: 4.73e-4, beta: 636, chi300: 4.05, eps_r: 11.7, me_dos: 1.08, mh_dos: 1.15,
      mu_n: [52.2, 1417, 9.68e16, 0.68], mu_p: [44.9, 470.5, 2.23e17, 0.719], gamma_n: 2.5, gamma_p: 2.2,
      Ed: 0.045, Ea: 0.045, donor: "P", acceptor: "B", E_crit: 3.0e5, vsat: 1.0e7, tau_n: 1e-6, tau_p: 1e-6,
      structure: "Diamond cubic", gap_type: "Indirect" },
    "Ge": { name: "Ge", Eg0: 0.7437, alpha: 4.774e-4, beta: 235, chi300: 4.00, eps_r: 16.0, me_dos: 0.55, mh_dos: 0.37,
      mu_n: [150, 3900, 2.6e17, 0.56], mu_p: [100, 1900, 1.0e17, 0.50], gamma_n: 1.66, gamma_p: 2.33,
      Ed: 0.012, Ea: 0.0104, donor: "P", acceptor: "B", E_crit: 1.0e5, vsat: 6.0e6, tau_n: 1e-6, tau_p: 1e-6,
      structure: "Diamond cubic", gap_type: "Indirect" },
    "4H-SiC": { name: "4H-SiC", Eg0: 3.296, alpha: 6.5e-4, beta: 1300, chi300: 3.70, eps_r: 9.66, me_dos: 0.77, mh_dos: 1.0,
      mu_n: [40, 950, 1.94e17, 0.61], mu_p: [15.9, 125, 1.76e19, 0.34], gamma_n: 2.4, gamma_p: 2.15,
      Ed: 0.065, Ea: 0.20, donor: "N", acceptor: "Al", E_crit: 2.5e6, vsat: 2.0e7, tau_n: 1e-7, tau_p: 1e-7,
      structure: "Hexagonal (4H)", gap_type: "Indirect",
      notes: "Electron affinity reported 3.1–3.8 eV; Ed is the hexagonal/cubic-site average." },
    "GaN": { name: "GaN", Eg0: 3.510, alpha: 9.09e-4, beta: 830, chi300: 4.10, eps_r: 8.9, me_dos: 0.20, mh_dos: 1.50,
      mu_n: [55, 1000, 2.0e17, 1.0], mu_p: [3, 170, 3.0e17, 2.0], gamma_n: 1.5, gamma_p: 1.5,
      Ed: 0.020, Ea: 0.17, donor: "Si", acceptor: "Mg", E_crit: 3.3e6, vsat: 2.5e7, tau_n: 1e-9, tau_p: 1e-9,
      structure: "Wurtzite", gap_type: "Direct",
      notes: "Polarization charge at heterointerfaces not included. Mg is deep — use incomplete ionization." },
    "AlN": { name: "AlN", Eg0: 6.25, alpha: 1.799e-3, beta: 1462, chi300: 2.19, eps_r: 8.5, me_dos: 0.30, mh_dos: 3.5,
      mu_n: [20, 300, 1.0e17, 1.0], mu_p: [1, 14, 1.0e18, 1.0], gamma_n: 1.5, gamma_p: 1.5,
      Ed: 0.28, Ea: 0.51, donor: "Si", acceptor: "Mg", E_crit: 1.2e7, vsat: 1.4e7, tau_n: 1e-9, tau_p: 1e-9,
      structure: "Wurtzite", gap_type: "Direct" },
    "InN": { name: "InN", Eg0: 0.78, alpha: 2.45e-4, beta: 624, chi300: 5.98, eps_r: 15.3, me_dos: 0.07, mh_dos: 0.60,
      mu_n: [30, 3000, 1.0e17, 0.7], mu_p: [3, 220, 2.5e17, 0.7], gamma_n: 1.5, gamma_p: 1.5,
      Ed: 0.005, Ea: 0.06, donor: "Si", acceptor: "Mg", E_crit: 1.2e6, vsat: 1.8e7, tau_n: 1e-9, tau_p: 1e-9,
      structure: "Wurtzite", gap_type: "Direct" },
    "Diamond": { name: "Diamond", Eg0: 5.48, alpha: 1.0e-4, beta: 1000, chi300: 0.50, eps_r: 5.7, me_dos: 1.87, mh_dos: 0.80,
      mu_n: [10, 1000, 2.0e17, 0.6], mu_p: [2, 2016, 3.25e17, 0.73], gamma_n: 1.5, gamma_p: 2.8,
      Ed: 0.57, Ea: 0.37, donor: "P", acceptor: "B", E_crit: 1.0e7, vsat: 2.5e7, tau_n: 1e-9, tau_p: 1e-9,
      structure: "Diamond cubic", gap_type: "Indirect",
      notes: "Electron affinity depends on surface termination (H ≈ −1.3 eV, O ≈ +1.7 eV); 0.5 eV is a bulk-like placeholder. Deep dopants — use incomplete ionization." },
    "c-BN": { name: "c-BN", Eg0: 6.40, alpha: 1.0e-4, beta: 1000, chi300: 0.50, eps_r: 7.1, me_dos: 1.20, mh_dos: 1.00,
      mu_n: [10, 825, 1.0e17, 0.6], mu_p: [5, 500, 1.0e17, 0.6], gamma_n: 1.5, gamma_p: 1.5,
      Ed: 0.24, Ea: 0.19, donor: "Si", acceptor: "Be", E_crit: 8.0e6, vsat: 1.0e7, tau_n: 1e-9, tau_p: 1e-9,
      structure: "Zinc blende", gap_type: "Indirect",
      notes: "Least-characterized entry: χ, effective masses, mobilities and E_crit are estimates." },
  };
  const BASE = {};
  for (const k in RAW) BASE[k] = makeMaterial(RAW[k]);

  const CB_RATIO = 0.7;
  const lerp = (a, b, x) => (1 - x) * a + x * b;
  const llerp = (a, b, x) => Math.exp(lerp(Math.log(a), Math.log(b), x));
  function alloy(name, endKey, x, bow) {
    x = Math.min(1, Math.max(0, x));
    const g = RAW["GaN"], e = RAW[endKey];
    const Eg0 = lerp(g.Eg0, e.Eg0, x) - bow * x * (1 - x);
    const alpha = lerp(g.alpha, e.alpha, x), beta = lerp(g.beta, e.beta, x);
    const Eg300 = Eg0 - alpha * 90000 / (300 + beta);
    const chi = g.chi300 - CB_RATIO * (Eg300 - BASE["GaN"].Eg(300));
    const sc = 1 / (1 + 8 * x * (1 - x));
    const mu = (a, b) => [llerp(a[0], b[0], x) * sc, llerp(a[1], b[1], x) * sc, llerp(a[2], b[2], x), lerp(a[3], b[3], x)];
    return makeMaterial({ name, Eg0, alpha, beta, chi300: chi, eps_r: lerp(g.eps_r, e.eps_r, x),
      me_dos: lerp(g.me_dos, e.me_dos, x), mh_dos: lerp(g.mh_dos, e.mh_dos, x), mu_n: mu(g.mu_n, e.mu_n),
      mu_p: mu(g.mu_p, e.mu_p), gamma_n: 1.5, gamma_p: 1.5, Ed: lerp(g.Ed, e.Ed, x), Ea: lerp(g.Ea, e.Ea, x),
      donor: "Si", acceptor: "Mg", E_crit: llerp(g.E_crit, e.E_crit, x), vsat: lerp(g.vsat, e.vsat, x),
      tau_n: 1e-9, tau_p: 1e-9, structure: "Wurtzite", gap_type: "Direct", x,
      notes: `Vegard's law with bowing b = ${bow} eV; χ from a ${CB_RATIO * 100}% conduction-band share of the gap offset to GaN; polarization not included.` });
  }
  const ALLOYS = { "AlGaN": x => alloy("AlGaN", "AlN", x, 1.0), "InGaN": x => alloy("InGaN", "InN", x, 1.4) };
  const LIBRARY_KEYS = ["Si", "Ge", "4H-SiC", "GaN", "Diamond", "c-BN", "AlGaN", "InGaN"];
  function getMaterial(key, x = 0.3, overrides = null) {
    const base = ALLOYS[key] ? ALLOYS[key](x) : BASE[key];
    if (!overrides) return base;
    const raw = {};
    for (const k in base) if (typeof base[k] !== "function" && k !== "label") raw[k] = base[k];
    for (const k in overrides) if (overrides[k] !== null && overrides[k] !== undefined && !Number.isNaN(overrides[k])) raw[k] = overrides[k];
    return makeMaterial(raw);
  }

  // ------------------------------------------------------------------ statistics
  function fdHalf(eta) {          // Aymerich-Humet approximation of normalized F_1/2
    if (eta < -60) return Math.exp(eta);
    const v = eta ** 4 + 50 + 33.6 * eta * (1 - 0.68 * Math.exp(-0.17 * (eta + 1) ** 2));
    return 1 / (Math.exp(-eta) + 0.75 * Math.sqrt(Math.PI) * Math.pow(v, -0.375));
  }
  const occ = (eta, stats) => stats === "Fermi-Dirac" ? fdHalf(eta) : Math.exp(Math.max(-700, Math.min(700, eta)));
  function carriers(m, T, EFmEv, stats) {
    const kT = KB * T, Eg = m.Eg(T);
    return [m.Nc(T) * occ((EFmEv - Eg) / kT, stats), m.Nv(T) * occ(-EFmEv / kT, stats)];
  }
  function ionized(m, T, ef, Nd, Na, inc) {
    if (!inc) return [Nd, Na];
    const kT = KB * T, Eg = m.Eg(T), cl = v => Math.max(-700, Math.min(700, v));
    return [Nd / (1 + G_D * Math.exp(cl((ef - (Eg - m.Ed)) / kT))), Na / (1 + G_A * Math.exp(cl((m.Ea - ef) / kT)))];
  }
  function fermiLevel(m, T, Nd, Na, inc, stats) {
    const Eg = m.Eg(T);
    const f = ef => {
      const [n, p] = carriers(m, T, ef, stats), [nd, na] = ionized(m, T, ef, Nd, Na, inc);
      return Math.log(p + nd + 1e-300) - Math.log(n + na + 1e-300);
    };
    let lo = -3, hi = Eg + 3;                      // f decreasing in EF
    for (let i = 0; i < 200 && hi - lo > 1e-13; i++) { const mid = 0.5 * (lo + hi); if (f(mid) > 0) lo = mid; else hi = mid; }
    const ef = 0.5 * (lo + hi);
    const [n, p] = carriers(m, T, ef, stats), [nd, na] = ionized(m, T, ef, Nd, Na, inc);
    const kT = KB * T, Ei = Eg / 2 + m.EiMid(T);
    return { EF_Ev: ef, Ec_EF: Eg - ef, EF_Ei: ef - Ei, Ei_Ev: Ei, n, p, Nd_ion: nd, Na_ion: na,
      ion_frac: Nd > 0 ? nd / Nd : Na > 0 ? na / Na : 1,
      degenerate: ef < 3 * kT || ef > Eg - 3 * kT, intrinsic_like: m.ni(T) > 0.1 * Math.max(Nd, Na, 1) };
  }

  // ------------------------------------------------------------------ junction
  function sides(inp, NA, ND) {
    NA = NA ?? inp.NA; ND = ND ?? inp.ND;
    const T = inp.T, pm = inp.p_mat, nm = inp.n_mat;
    const fp = fermiLevel(pm, T, 0, NA, inp.incomplete, inp.stats);
    const fn = fermiLevel(nm, T, ND, 0, inp.incomplete, inp.stats);
    return { fp, fn, phi_p: pm.chi(T) + pm.Eg(T) - fp.EF_Ev, phi_n: nm.chi(T) + fn.Ec_EF };
  }
  const isPin = inp => inp.profile === "pin";
  const dI = inp => (isPin(inp) ? inp.d : 0);              // intrinsic-layer thickness [cm]
  const iMat = inp => inp.i_mat || inp.p_mat;
  function abruptWidths(inp, Veff) {
    const ep = inp.p_mat.eps(), en = inp.n_mat.eps(), NA = inp.NA, ND = inp.ND;
    if (isPin(inp) && inp.d > 0) {
      // ideal (charge-free) i-layer: Veff = a*xp^2 + b*xp with NA*xp = ND*xn
      const ei = iMat(inp).eps();
      const a = Q * NA / 2 * (1 / ep + NA / (en * ND)), b = Q * NA * inp.d / ei;
      const xp = 2 * Veff / (b + Math.sqrt(b * b + 4 * a * Veff));   // stable root
      return [xp, xp * NA / ND];
    }
    const xn = Math.sqrt(2 * ep * en * NA * Veff / (Q * ND * (ep * NA + en * ND)));
    return [xn * ND / NA, xn];
  }
  function gradedSolution(inp, V) {
    V = V ?? inp.V;
    const a = inp.grad, eps = inp.p_mat.eps(), kT = KB * inp.T;
    let W = 1e-5, vbi = 0.5;
    for (let i = 0; i < 200; i++) {
      const Ne = Math.max(a * W / 2, 1), s = sides(inp, Ne, Ne);
      vbi = s.phi_p - s.phi_n;
      const Wn = Math.cbrt(12 * eps * Math.max(vbi - V, kT) / (Q * a));
      if (Math.abs(Wn - W) < 1e-6 * W) { W = Wn; break; }
      W = 0.5 * (W + Wn);
    }
    return [vbi, W];
  }
  function builtIn(inp) {
    if (inp.profile === "graded") return gradedSolution(inp)[0];
    const s = sides(inp); return s.phi_p - s.phi_n;
  }
  function diffusion(inp, NA, ND) {
    const kT = KB * inp.T;
    const tn = inp.tau_n || inp.p_mat.tau_n, tp = inp.tau_p || inp.n_mat.tau_p;
    const Dn = inp.p_mat.mobN(NA, inp.T) * kT, Dp = inp.n_mat.mobP(ND, inp.T) * kT;
    return { Ln: Math.sqrt(Dn * tn), Lp: Math.sqrt(Dp * tp), Dn, Dp, tn, tp };
  }
  function currentDensity(inp, V, Vbi) {
    const kT = KB * inp.T;
    let fp, fn, xp, xn, NAe, NDe;
    if (inp.profile === "graded") {
      const [, W] = gradedSolution(inp, V), Ne = inp.grad * W / 2, s = sides(inp, Ne, Ne);
      fp = s.fp; fn = s.fn; xp = xn = W / 2; NAe = NDe = Ne;
    } else {
      const s = sides(inp); fp = s.fp; fn = s.fn;
      const vbi = Vbi ?? (s.phi_p - s.phi_n);
      [xp, xn] = abruptWidths(inp, Math.max(vbi - V, 2 * kT)); NAe = inp.NA; NDe = inp.ND;
    }
    const d = diffusion(inp, NAe, NDe);
    const J0n = Q * d.Dn * fp.n / d.Ln, J0p = Q * d.Dp * fn.p / d.Lp, J0 = J0n + J0p;
    const Jgr0 = Q * (inp.p_mat.ni(inp.T) * xp + iMat(inp).ni(inp.T) * dI(inp) + inp.n_mat.ni(inp.T) * xn) / (2 * Math.sqrt(d.tn * d.tp));
    const cl = v => Math.max(-700, Math.min(700, v));
    const Jdiff = J0 * Math.expm1(cl(V / kT)), Jgr = Jgr0 * Math.expm1(cl(V / (2 * kT)));
    return { J: Jdiff + Jgr, Jdiff, Jgr, J0, J0n, J0p, Jgr0 };
  }
  function breakdown(inp, Vbi) {
    const pm = inp.p_mat, nm = inp.n_mat;
    let Veff;
    if (inp.profile === "graded") {
      const a = inp.grad, eps = pm.eps(), W = Math.sqrt(8 * eps * pm.E_crit / (Q * a));
      Veff = Q * a * W ** 3 / (12 * eps);
    } else if (isPin(inp)) {
      // all fields scale with D = q NA xp; breakdown when any layer reaches its own E_crit
      const im = iMat(inp), ep = pm.eps(), en = nm.eps(), ei = im.eps(), NA = inp.NA, ND = inp.ND;
      const Dc = Math.min(pm.E_crit * ep, im.E_crit * ei, nm.E_crit * en);
      const xp = Dc / (Q * NA), xn = xp * NA / ND;
      Veff = Q * NA * xp * xp / (2 * ep) + Dc * inp.d / ei + Q * ND * xn * xn / (2 * en);
    } else {
      const ep = pm.eps(), en = nm.eps(), NA = inp.NA, ND = inp.ND;
      const k = 2 * Q * NA * ND * ep / (en * (ep * NA + en * ND));
      Veff = Math.min(nm.E_crit ** 2 / k, (pm.E_crit * ep / en) ** 2 / k);
    }
    return Veff - Vbi;
  }

  function solve(inp, opts = {}) {
    const nPts = opts.nPoints ?? 1200;
    const T = inp.T, V = inp.V, kT = KB * T, pm = inp.p_mat, nm = inp.n_mat;
    const warnings = [];
    let Vbi, W, fp, fn, phi_p, phi_n, NAe, NDe;
    if (inp.profile === "graded") {
      [Vbi, W] = gradedSolution(inp);
      const Ne = inp.grad * W / 2; ({ fp, fn, phi_p, phi_n } = sides(inp, Ne, Ne)); NAe = NDe = Ne;
    } else {
      ({ fp, fn, phi_p, phi_n } = sides(inp)); Vbi = phi_p - phi_n; NAe = inp.NA; NDe = inp.ND;
    }
    let Veff = Vbi - V;
    if (Veff < 2 * kT) {
      warnings.push(`Forward bias V = ${V.toFixed(3)} V is at/above V<sub>bi</sub> − 2kT; the depletion approximation breaks down (high injection). Results are clamped.`);
      Veff = 2 * kT;
    }
    const ep = pm.eps(), en = nm.eps();
    const pin = isPin(inp), im = iMat(inp), ei = im.eps(), di = dI(inp);
    let xp, xn, Emax, Vp, Vn, Vi = 0, C;
    if (inp.profile === "graded") {
      W = Math.cbrt(12 * ep * Veff / (Q * inp.grad)); xp = xn = W / 2;
      Emax = Q * inp.grad * W * W / (8 * ep); Vp = Vn = Veff / 2; C = ep / W;
    } else if (pin) {
      [xp, xn] = abruptWidths(inp, Veff); W = xp + di + xn;
      const D = Q * inp.NA * xp;                       // displacement field (continuous)
      Emax = D / Math.min(ep, en, di > 0 ? ei : Infinity);
      Vp = Q * inp.NA * xp * xp / (2 * ep); Vi = D * di / ei; Vn = Veff - Vp - Vi;
      C = 1 / (xp / ep + di / ei + xn / en);
    } else {
      [xp, xn] = abruptWidths(inp, Veff); W = xp + xn;
      Emax = Math.max(Q * inp.ND * xn / en, Q * inp.NA * xp / ep);
      Vn = ep * inp.NA * Veff / (ep * inp.NA + en * inp.ND); Vp = Veff - Vn;
      C = 1 / (xp / ep + xn / en);
    }
    const xe = di + xn;                                 // n-side depletion edge
    const res = { Vbi, Veff, W, xp, xn, d: di, Emax, Vp, Vn, Vi, C_area: C, C: C * inp.area, phi_p, phi_n,
      dEc: pm.chi(T) - nm.chi(T), dEv: (pm.chi(T) + pm.Eg(T)) - (nm.chi(T) + nm.Eg(T)),
      fp, fn, ni_p: pm.ni(T), ni_n: nm.ni(T), NA_eff: NAe, ND_eff: NDe, warnings };
    if (pin) Object.assign(res, { ni_i: im.ni(T), E_i: Q * inp.NA * xp / ei,
      dEc_pi: pm.chi(T) - im.chi(T), dEv_pi: (pm.chi(T) + pm.Eg(T)) - (im.chi(T) + im.Eg(T)),
      dEc_in: im.chi(T) - nm.chi(T), dEv_in: (im.chi(T) + im.Eg(T)) - (nm.chi(T) + nm.Eg(T)) });
    const d = diffusion(inp, NAe, NDe);
    Object.assign(res, { Ln: d.Ln, Lp: d.Lp, Dn: d.Dn, Dp: d.Dp, tau_n: d.tn, tau_p: d.tp });
    res.LDp = Math.sqrt(ep * kT / (Q * Math.max(fp.p, 1)));
    res.LDn = Math.sqrt(en * kT / (Q * Math.max(fn.n, 1)));
    res.V_br = breakdown(inp, Vbi);
    res.J = currentDensity(inp, V, Vbi);
    res.I = res.J.J * inp.area;

    if (nPts > 0) {
      const pad = pin ? Math.max(0.6 * (xp + xn), 0.15 * W) : 0.6 * W, x0 = -(xp + pad), x1 = xe + pad;
      const xs = [];
      for (let i = 0; i < nPts; i++) xs.push(x0 + (x1 - x0) * i / (nPts - 1));
      xs.push(-xp, 0, xn, -1e-15 * W);
      if (pin) xs.push(di, xe, di - 1e-15 * W);
      xs.sort((a, b) => a - b);
      const N = xs.length;
      const A = k => new Float64Array(N);
      const rho = A(), E = A(), phi = A(), Ec = A(), Ev = A(), Ei = A(), Evac = A(), EFn = A(), EFp = A(), n = A(), p = A();
      const bz = Math.expm1(Math.max(-700, Math.min(700, V / kT)));
      for (let i = 0; i < N; i++) {
        const x = xs[i], m = x < 0 ? pm : x < di ? im : nm;
        if (inp.profile === "graded") {
          const a = inp.grad;
          if (Math.abs(x) <= W / 2) {
            rho[i] = a * x; E[i] = Q * a / (2 * ep) * (x * x - W * W / 4);
            phi[i] = -(Q * a / (2 * ep)) * (x ** 3 / 3 - W * W * x / 4 - W ** 3 / 12);
          } else phi[i] = x > 0 ? Veff : 0;
        } else {
          if (x >= -xp && x < 0) {
            rho[i] = -inp.NA; E[i] = -Q * inp.NA * (x + xp) / ep; phi[i] = Q * inp.NA * (x + xp) ** 2 / (2 * ep);
          } else if (x >= 0 && x < di) {
            rho[i] = 0; E[i] = -Q * inp.NA * xp / ei; phi[i] = Vp + Q * inp.NA * xp * x / ei;
          } else if (x >= di && x <= xe) {
            rho[i] = inp.ND; E[i] = -Q * inp.ND * (xe - x) / en; phi[i] = Veff - Q * inp.ND * (xe - x) ** 2 / (2 * en);
          } else phi[i] = x > xe ? Veff : 0;
        }
        Evac[i] = phi_p - phi[i]; Ec[i] = Evac[i] - m.chi(T); Ev[i] = Ec[i] - m.Eg(T);
        Ei[i] = 0.5 * (Ec[i] + Ev[i]) + m.EiMid(T);
        EFp[i] = x <= xe ? 0 : NaN; EFn[i] = x >= -xp ? V : NaN;
        if (x >= -xp && x <= xe) {
          n[i] = carriers(m, T, V - Ev[i], inp.stats)[0]; p[i] = carriers(m, T, -Ev[i], inp.stats)[1];
        } else if (x < -xp) {
          n[i] = fp.n * (1 + bz * Math.exp((x + xp) / d.Ln)); p[i] = fp.p;
        } else {
          p[i] = fn.p * (1 + bz * Math.exp(-(x - xe) / d.Lp)); n[i] = fn.n;
        }
      }
      Object.assign(res, { x: xs, rho, E, phi, Ec, Ev, Ei, Evac, EFn, EFp, n, p });
    }

    if (W < 3 * Math.max(res.LDp, res.LDn))
      warnings.push("Depletion width is comparable to the Debye length — the depletion approximation is only qualitative here.");
    for (const [side, f, m] of [["p", fp, pm], ["n", fn, nm]]) {
      if (f.degenerate) warnings.push(`${side}-side is (near-)degenerate (E<sub>F</sub> within 3kT of the band edge); switch statistics to Fermi–Dirac for accuracy.`);
      if (f.intrinsic_like) warnings.push(`${side}-side: n<sub>i</sub> = ${m.ni(T).toExponential(2)} cm⁻³ is >10 % of the doping — approaching intrinsic behaviour.`);
      if (inp.incomplete && f.ion_frac < 0.5) warnings.push(`${side}-side: only ${(100 * f.ion_frac).toFixed(1)} % of dopants are ionized (freeze-out). Depletion charge still uses the full dopant density (DC).`);
    }
    if (V < 0 && -V >= res.V_br) warnings.push(`Reverse bias exceeds the estimated avalanche breakdown voltage (${res.V_br.toPrecision(3)} V).`);
    return res;
  }

  function ivCurve(inp, Vs) {
    const out = { V: Vs, J: [], Jdiff: [], Jgr: [] };
    for (const v of Vs) { const j = currentDensity(inp, v); out.J.push(j.J); out.Jdiff.push(j.Jdiff); out.Jgr.push(j.Jgr); }
    return out;
  }
  function cvCurve(inp, Vs) {
    const kT = KB * inp.T, C = [];
    if (inp.profile === "graded") for (const v of Vs) C.push(inp.p_mat.eps() / gradedSolution(inp, v)[1]);
    else {
      const vbi = builtIn(inp);
      const di = dI(inp), ei = iMat(inp).eps();
      for (const v of Vs) { const [xp, xn] = abruptWidths(inp, Math.max(vbi - v, 2 * kT)); C.push(1 / (xp / inp.p_mat.eps() + di / ei + xn / inp.n_mat.eps())); }
    }
    return { V: Vs, C_area: C, inv_C2: C.map(c => 1 / (c * c)) };
  }
  function materialTable(T, xa, xi) {
    const si = BASE["Si"];
    return LIBRARY_KEYS.map(k => {
      const m = getMaterial(k, k === "AlGaN" ? xa : xi);
      const mun = m.mobN(1e15, T);
      return { Material: m.label, Structure: m.structure, Gap: m.gap_type, Eg: m.Eg(T), chi: m.chi(T), eps_r: m.eps_r,
        Nc: m.Nc(T), Nv: m.Nv(T), ni: m.ni(T), mun, mup: m.mobP(1e15, T),
        donor: `${m.donor} (${m.Ed.toFixed(3)})`, acceptor: `${m.acceptor} (${m.Ea.toFixed(3)})`,
        Ecrit: m.E_crit / 1e6, vsat: m.vsat,
        BFOM: m.eps_r * mun * m.E_crit ** 3 / (si.eps_r * si.mobN(1e15, 300) * si.E_crit ** 3),
        JFOM: m.E_crit * m.vsat / (si.E_crit * si.vsat), notes: m.notes };
    });
  }

  return { Q, KB, EPS0, LIBRARY_KEYS, ALLOYS, getMaterial, fermiLevel, fdHalf, solve, ivCurve, cvCurve,
    builtIn, materialTable };
})();
if (typeof module !== "undefined") module.exports = PN;
