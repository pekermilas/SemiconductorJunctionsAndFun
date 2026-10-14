const PN = require('../src/physics.js');
let fails = 0; const ok = (c, msg) => { console.log((c ? "PASS " : "FAIL ") + msg); if (!c) fails++; };
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const si = PN.getMaterial("Si");
const base = { p_mat: si, n_mat: si, NA: 1e18, ND: 1e17, T: 300, V: -5, grad: 1e22, incomplete: false, stats: "Boltzmann", area: 1e-4 };
// 1. d -> 0 limit equals abrupt
const ab = PN.solve({ ...base, profile: "abrupt" }), p0 = PN.solve({ ...base, profile: "pin", d: 1e-12 });
ok(rel(p0.W, ab.W) < 1e-6 && rel(p0.Emax, ab.Emax) < 1e-6 && rel(p0.C_area, ab.C_area) < 1e-6 && rel(p0.V_br, ab.V_br) < 1e-4, `d→0 limit: W ${p0.W} vs ${ab.W}, Vbr ${p0.V_br} vs ${ab.V_br}`);
// 2. numerical Poisson consistency for homo and hetero PIN
function poisson(r, inp) {
  const x = r.x; let Dacc = 0, phi = 0, maxEerr = 0;
  const eps = xx => (xx < 0 ? inp.p_mat : xx < r.d ? (inp.i_mat || inp.p_mat) : inp.n_mat).eps();
  const Es = [0]; const phis = [0];
  for (let i = 1; i < x.length; i++) {
    const dx = x[i] - x[i - 1], xm = 0.5 * (x[i] + x[i - 1]);
    const rhom = r.rho[i] === r.rho[i - 1] ? r.rho[i] : (xm < 0 ? -inp.NA : xm < r.d ? 0 : xm <= r.d + r.xn ? inp.ND : 0);
    const inDep = xm >= -r.xp && xm <= r.d + r.xn;
    Dacc += PN.Q * (inDep ? rhom : 0) * dx;            // dD/dx = rho
    const E = -(-Dacc) / eps(x[i]);                      // E = D/eps with D from p-edge (negative)
    phi += -0.5 * ((Es[i - 1]) + (Dacc / eps(xm))) * dx; Es.push(Dacc / eps(xm));
  }
  return { Dend: Dacc };
}
for (const [label, inp] of [
  ["Si PIN", { ...base, profile: "pin", d: 1e-4 }],
  ["p-AlGaN/i-InGaN/n-GaN", { ...base, p_mat: PN.getMaterial("AlGaN", 0.2), i_mat: PN.getMaterial("InGaN", 0.15), n_mat: PN.getMaterial("GaN"), NA: 1e19, ND: 1e18, V: -2, profile: "pin", d: 0.1e-4 }]]) {
  const r = PN.solve(inp);
  // charge neutrality
  ok(rel(inp.NA * r.xp, inp.ND * r.xn) < 1e-12, `${label}: NA·xp = ND·xn`);
  // potential end value & continuity at interfaces
  const N = r.x.length, iEnd = N - 1;
  ok(rel(r.phi[iEnd], r.Veff) < 1e-9, `${label}: φ(right) = Vbi − V (${r.phi[iEnd].toFixed(4)} vs ${r.Veff.toFixed(4)})`);
  let maxJump = 0;
  for (let i = 1; i < N; i++) if (r.x[i] - r.x[i - 1] < 1e-12) maxJump = Math.max(maxJump, Math.abs(r.phi[i] - r.phi[i - 1]));
  ok(maxJump < 1e-6, `${label}: φ continuous across interfaces (max jump ${maxJump.toExponential(2)} V)`);
  // numerical E from dφ/dx vs analytic E inside i-layer
  const k = r.x.findIndex(v => v > r.d / 2);
  const Enum = -(r.phi[k + 1] - r.phi[k - 1]) / (r.x[k + 1] - r.x[k - 1]);
  ok(rel(Enum, r.E[k]) < 1e-6, `${label}: E = −dφ/dx in i-layer (${Enum.toExponential(4)} vs ${r.E[k].toExponential(4)})`);
  // D continuity at x=0 and x=d
  const im = inp.i_mat || inp.p_mat;
  const Dp0 = inp.p_mat.eps() * PN.Q * inp.NA * r.xp / inp.p_mat.eps(), Di = im.eps() * Math.abs(r.E_i);
  ok(rel(Di, Dp0) < 1e-12, `${label}: εE continuous at p/i interface`);
  // voltage sum
  ok(rel(r.Vp + r.Vi + r.Vn, r.Veff) < 1e-12 && r.Vn > 0, `${label}: Vp+Vi+Vn = Veff (Vi = ${r.Vi.toFixed(3)} V)`);
  // C from widths equals dQ/dV numerically
  const dv = 1e-4, a = PN.solve({ ...inp, V: inp.V - dv }, { nPoints: 0 }), b = PN.solve({ ...inp, V: inp.V + dv }, { nPoints: 0 });
  const Cnum = PN.Q * inp.NA * (a.xp - b.xp) / (2 * dv);
  ok(rel(Cnum, r.C_area) < 1e-5, `${label}: C = dQ/dV (${Cnum.toExponential(5)} vs ${r.C_area.toExponential(5)})`);
}
// 3. thick i-layer: C ≈ ε/d, breakdown ≈ Ecrit·d
const thick = PN.solve({ ...base, profile: "pin", d: 50e-4, NA: 1e19, ND: 1e19, V: -10 });
ok(rel(thick.C_area, si.eps() / 50e-4) < 0.01, `thick PIN: C ≈ ε/d (${thick.C_area.toExponential(3)} vs ${(si.eps() / 50e-4).toExponential(3)})`);
ok(rel(thick.V_br + thick.Vbi, si.E_crit * 50e-4) < 0.01, `thick PIN: V_BR + Vbi ≈ Ecrit·d (${(thick.V_br + thick.Vbi).toFixed(1)} vs ${(si.E_crit * 50e-4).toFixed(1)})`);
ok(rel(thick.Emax, (thick.Veff) / 50e-4) < 0.01, `thick PIN: E ≈ (Vbi−V)/d`);
// 4. Vbi unaffected by i-layer, CV and IV run
ok(rel(PN.builtIn({ ...base, profile: "pin", d: 1e-4 }), ab.Vbi) < 1e-12, "Vbi independent of i-layer (homo)");
const iv = PN.ivCurve({ ...base, profile: "pin", d: 1e-4 }, [-5, 0, 0.5]);
ok(iv.J[1] === 0 && iv.J[2] > 0 && iv.J[0] < 0, "I-V signs correct");
const ivT = PN.ivCurve({ ...base, profile: "pin", d: 10e-4 }, [-5]), ivt = PN.ivCurve({ ...base, profile: "pin", d: 1e-4 }, [-5]);
ok(Math.abs(ivT.J[0]) > Math.abs(ivt.J[0]), "thicker i-layer → larger generation current");
console.log(fails ? `${fails} FAILED` : "ALL PASS");
