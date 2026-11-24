# EnergyPLAN Browser Lab

Run the original **EnergyPLAN 16.3** Windows executable in a web browser, change a small set of assumptions, and compare energy-system scenarios. The interface is in Danish and was built as an experimental workshop demonstration for **AI Agents in Research / Sustainable Energy Planning**.

**Live demonstration:** https://energyplan-futures-lab.lottea.chatgpt.site/

> **Validation status:** two complete browser calculations have been observed. Numerical agreement with a separate native Windows run has **not** been established. The supplied scenario produces three model warnings and is not a validated energy plan. This is an independent demonstration, not an official AAU web service.

## What you can do

- Change annual electricity demand, wind capacity in RES1, and photovoltaic capacity in RES3.
- Run the original EnergyPLAN calculation locally in the browser.
- Inspect corrected CO₂ emissions, direct CO₂ emissions, total fuel consumption, annual costs, and EnergyPLAN's own warnings.
- Compare scenarios while the page remains open.
- Download the scenario input, original result file, and a CSV of selected indicators.
- Open two clearly labelled, previously calculated examples without starting a new model run.

The website itself is **not an AI agent**. It does not call an LLM or require an OpenAI API key. Visitor calculations do not consume the site owner's AI tokens. An AI agent could later use the tool as part of a research workflow; that integration is not included here.

## Run locally

You need **Git**, **Python 3**, and a desktop browser. Chrome was used for the recorded browser tests. Node.js 22 or later is needed only for the repository checks below.

```sh
git clone https://github.com/lotteat/energyplan-browser-lab.git
cd energyplan-browser-lab
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

On Windows, use `py -3` in place of `python3` if needed. For a private repository, Git must be authenticated to an account with access.

Open **http://localhost:8000/**. On the first visit, the service worker may reload the page to enable the isolated browser environment. Open the page as a top-level tab, keep it visible during a run, and allow service workers.

There is no build step, dependency installation, local Wine installation, API key, or database setup. The runtime and example files are included. Opening `dist/index.html` directly through `file://` is not supported.

For a quick first look, select **“Se beregnede eksempler”**. To execute the model, choose a preset or edit the inputs and select **“Kør beregning”**.

## Inputs and outputs

| Form field | EnergyPLAN input | Unit | Allowed range |
| --- | --- | --- | --- |
| Annual electricity demand | `Input_el_demand_Twh` | TWh/year | 0.01–10 |
| Wind capacity · RES1 | `input_RES1_capacity` | MW | 0–5,000 |
| Solar PV capacity · RES3 | `input_RES3_capacity` | MW | 0–5,000 |

All other model assumptions come from the supplied scenario. A zero in RES1 describes that category only; it does not establish the absence of every wind category. Changing these three inputs is not sufficient to resolve every model warning.

The main CO₂ card reads `CO2-emission (corrected)`; `CO2-emission (total)` is shown separately. The other cards read `Fuel Consumption (total)` and `TOTAL ANNUAL COSTS`. Units are extracted from the result file. Missing values display as a dash rather than an invented zero.

Inputs are downloaded as UTF-16 LE with a byte-order mark. Result downloads preserve the original output bytes. The recorded example outputs use Windows-1252. CSV exports use semicolons and Danish decimal commas; text cells that could be interpreted as formulas are escaped.

## Where the demonstration scenario comes from

The baseline was selected from:

- Repository: [HyRES-FBK/moea](https://github.com/HyRES-FBK/moea).
- Pinned source commit: `5f5df07ebe31d269a8c92832f9f020fe1e5e833a`.
- File: [`EnergyPLAN163/energyPlan Data/Data/Aalborg2050.txt`](https://github.com/HyRES-FBK/moea/blob/5f5df07ebe31d269a8c92832f9f020fe1e5e833a/EnergyPLAN163/energyPlan%20Data/Data/Aalborg2050.txt).
- Stored baseline text: [`dist/model.json`](dist/model.json).

The file specifies **0.699 TWh/year** of basic electricity demand. It references profiles including `Aalborg El 2007.txt`, `Aalborg Fjernvarme 2007.txt`, and `Aalborg Fjernvarme 2050.txt`. The scenario's original author, publication date, and associated study have **not been verified** for this demonstration. Do not describe it as an approved current AAU reference, a current Aalborg forecast, or an adopted municipal plan.

“Reference” in the interface means the starting scenario chosen for comparison. It is not a claim of scientific validation.

### Changes when preparing a browser run

The bridge updates the three input fields listed above. It also replaces `Filnavn_AddExport` with the included `zero.txt`: the source case names an additional-export profile absent from the packaged files, while `input_AddExport_TWh` is zero. This substitution is explicit and does not change the specified annual additional-export quantity. It has not been independently validated against a native run.

The generated input is named `browser-scenario.txt`. When reproducing a browser result, use the **downloaded browser input**, not just the original GitHub scenario. The original executable and packaged distribution-file contents are not rewritten by the bridge.

## How it runs

The page creates a separate calculation iframe. Inside that iframe, **Boxedwine's multithreaded WebAssembly interpreter** runs **Wine 11**, which launches the original **EnergyPLAN 16.3** executable.

The program and model data are extracted into writable browser memory. The bridge writes the input file and invokes EnergyPLAN using its `-i` and `-ascii` command-line options. It waits for a nonempty result file to remain the same size for four seconds and checks that it contains recognisable EnergyPLAN output before returning the original bytes to the page.

The parent checks the message origin, iframe identity, and run ID. It parses selected indicators and releases the emulator iframe after a completed calculation. This output-detection mechanism is a practical completion check; it is not a formal proof that every possible output is complete.

Each visitor performs the calculation on their own device. Scenario history is held in page memory and is lost when the page is reloaded or closed. Download results you want to retain. The application has no account system, analytics integration, server-side model computation, or AI API integration.

## Recorded calculations and limits

The following complete calculations were observed on the deployed site in Chrome on **19 November 2026**. Both output files contain **8,784 hourly records**. The generated inputs differ only in `Input_el_demand_Twh`.

| Case | Electricity demand (TWh/year) | Corrected CO₂ (Mt) | Direct CO₂ (Mt) | Total fuel (TWh/year) | Annual costs (M DKK) | Observed browser time |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Reference | 0.699 | 0.533 | 0 | 2.31 | 3068 | 4 min 50 sec |
| +20% electricity demand | 0.8388 | 0.594 | 0 | 2.31 | 3068 | 4 min 57 sec |

These values document the supplied demonstration, not general EnergyPLAN behaviour. The price assumptions belong to the source dataset and are not a current cost forecast.

The actual input and output files are in [`dist/examples/`](dist/examples/). Their recording times and output SHA-256 checksums are in [`index.json`](dist/examples/index.json). Selecting an example loads a recorded result and does not execute a fresh calculation.

**Previously checked:** original executable identity; two completed browser runs; input sensitivity; parsing of the recorded results; warnings; and byte-preserving input/output downloads.

**Not established:** numerical equivalence with native Windows; scientific feasibility of the scenario; execution on a physical Mac, Safari, or a phone; and behaviour under 20–50 simultaneous users. Firefox has not received the same recorded end-to-end verification as Chrome.

### The three model warnings

Both recorded scenarios produce these warnings:

| EnergyPLAN warning | Interpretation |
| --- | --- |
| Grid stabilisation requirements are not fulfilled | The specified stabilising-production criterion is unmet in one or more hours. This is a model criterion, not a measured diagnosis of a real grid. |
| PP too small; critical import is needed | Available generation is insufficient and the required import exceeds the configured transmission capacity in one or more hours. |
| District heating boiler capacity too small | The specified district-heating system cannot cover the full heat demand at some peaks. |

See [EnergyPLAN 16.3 documentation, chapter 12](https://energyplan.eu/wp-content/uploads/2024/10/documentation.pdf). A completed run can still describe an infeasible scenario. Do not suppress warnings or relax constraints merely to make an example appear valid.

### Check numerical agreement with native EnergyPLAN

1. Run a scenario in the browser and download its input and full output.
2. Use EnergyPLAN **16.3**, the same executable, and the matching distributions and cost data from the packaged application.
3. Run the downloaded input through the native program, retaining the same simulation settings.
4. Compare warnings, annual indicators, and all hourly values. Document any exclusions for file names or timing fields and any justified numerical tolerance.

This comparison remains to be done. Passing the repository checks below does not replace it.

## Check the repository

With Node.js 22 or later:

```sh
node scripts/check.mjs
```

The check validates the runtime archive hashes, recorded output hashes, actual parser results, the single changed input parameter between examples, and JavaScript syntax. It runs without downloading dependencies or executing EnergyPLAN.

## Files

| Path | Purpose |
| --- | --- |
| `dist/index.html`, `dist/styles.css` | Danish interface and styling |
| `dist/app.js` | Form handling, execution lifecycle, comparisons, downloads |
| `dist/parser.js` | Result-field extraction and UTF-16 encoding |
| `dist/engine.html`, `dist/engine-bridge.js` | Emulator view and EnergyPLAN integration |
| `dist/model.json` | Source scenario text |
| `dist/engine/` | Boxedwine runtime, Wine filesystem parts, EnergyPLAN bundle |
| `dist/examples/` | Recorded inputs, outputs, and their metadata |
| `dist/licenses/` | Included third-party license texts |
| `scripts/check.mjs` | Offline repository checks |
| `THIRD_PARTY_NOTICES.md` | Component sources, versions, and licensing scope |

## Hosting and workshop use

Publish the complete **`dist/`** directory on a static host over **HTTPS**. All runtime files must remain available at their existing relative paths. Serve `.wasm` files as `application/wasm` and allow service workers and WebAssembly workers. The bundled `coi-serviceworker.js` supplies the cross-origin isolation headers needed for `SharedArrayBuffer`; the browser may reload once when it takes control. Restrictive hosting headers or embedding the site inside another page can prevent the runtime from starting.

The first runtime load transfers roughly **108 MB**. The two recorded example outputs total about **25 MB**. A new calculation can take five minutes or longer. Timing depends on the device, browser, network, and caching.

Twenty first-time runtime downloads total roughly 2.2 GB; fifty total roughly 5.4 GB. A shared workshop network may be the bottleneck even though calculations are independent. Starting with the recorded examples and staggering live runs can reduce the initial load. No concurrent-user capacity guarantee or hosting-cost estimate is provided.

If the page says the browser is not ready, check that it is served over HTTPS or `localhost`, that service workers are allowed, and that the page has reloaded after installation. If a calculation fails, inspect the run log and confirm that the runtime files were deployed. Keep a downloaded example result available for demonstrations.

## Sources and project snapshot

- [EnergyPLAN](https://energyplan.eu/) and [external invocation documentation](https://energyplan.eu/useful-resources/calling-energyplan-externally/).
- [Boxedwine build 140](https://boxedwine.org/builds/branches/master/builds/140/artifacts/build-140.zip), matching source commit `2f02aca8714222209b97f6f2d1b90cabce8ddf12`.
- [Wine 11 web-v41 filesystem](https://boxedwine.org/v2/41/TinyCore15Wine11.0-web.zip).
- Runtime source URLs and checksums: [`dist/engine/manifest.json`](dist/engine/manifest.json).

The application files in this export originate from deployed Site **version 10**, source commit `77bf278acf6c2dc3a5a6aad880f83d2833d1e29e`. The original hosting account configuration is not required to run this copy and is not included.

Original EnergyPLAN executable SHA-256:

```text
9f65cc0e69e5a715b52854fc1aebbfa8a00a6bbfd1118dd348ba293224fc07ae
```

Read [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before redistributing bundled software. This repository does not assign a single blanket license to software owned by its respective authors.
