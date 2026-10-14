# PNJunction — standalone offline edition

`PNJunction.html` is the whole app in one 1.2 MB file. Double-click it to open it in Chrome, Edge, Firefox or Safari. You don't need to install anything or have an internet connection: the physics engine, the UI and the charting library (Plotly basic bundle) are all embedded.

## What's in it
It has the same features as the Python/Streamlit version, and the physics core gives the same numbers (relative difference < 1e-11 across homo-, hetero-, graded, freeze-out and Fermi–Dirac test cases).

- **Material library:** Si, Ge, 4H-SiC, GaN, Diamond, c-BN, AlₓGa₁₋ₓN, InₓGa₁₋ₓN, with editable per-side parameters.
- **Junction setup:** homojunction or heterojunction (Anderson model), with an abrupt, linearly graded (homojunction only) or **p–i–n** profile.
- **p–i–n:** adjustable i-layer thickness (10 nm–300 µm, ideal charge-free intrinsic layer). In heterojunction mode the i-layer can be its own material, so double heterostructures like p-AlGaN / i-InGaN / n-GaN work. The app reports the uniform i-layer field, the voltage split across p, i and n, the p/i and i/n band offsets, C ≈ ε/W, i-layer generation current and the breakdown estimate (≈ E_crit·d for a thick i-layer). You can also sweep the i-layer thickness d.
- **Inputs:** N_A, N_D (or grading a), temperature and bias.
- **Models:** complete or incomplete ionization, and Boltzmann or Fermi–Dirac statistics.
- **Tabs:** Summary, Band diagram, Electrostatics (ρ, E, φ), Carriers, I–V and C–V (Mott–Schottky), Temperature (Eg, nᵢ, freeze-out, V_bi(T), W(T)), Parametric sweep, Material library with figures of merit, and Equations.
- **Export:** results JSON, spatial-profile CSV, sweep CSV and library CSV. Each chart also saves as a PNG from its toolbar.
- **Settings:** save and load settings files. The last-used settings are remembered in the browser.
- **Theme:** light and dark.

## Rebuilding from source
```
src/physics.js     physics core (port of the Python pnjunction package)
src/ui.js          interface logic
src/template.html  layout and styles
vendor/            plotly-basic.min.js (MIT licence)
build.py           inlines everything into PNJunction.html
tests/pin_test.js  p–i–n physics checks (node tests/pin_test.js)
```
To rebuild, run `python build.py`.
