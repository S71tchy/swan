# SWAN — Strategic Warning & Alert Network
## Platform Specification Book

| | |
|---|---|
| **Document** | Functional & Technical Specification |
| **Version** | 0.1 (Draft) |
| **Status** | For internal review |
| **Owner** | AGL — Africa Global Logistics |
| **Classification** | Internal |

---

## Table of Contents

1. [Vision & Objectives](#1-vision--objectives)
2. [Scope & Phasing](#2-scope--phasing)
3. [Personas & User Roles](#3-personas--user-roles)
4. [Rights & Permissions Model](#4-rights--permissions-model)
5. [Phase 1 — Core Alert Platform](#5-phase-1--core-alert-platform)
6. [Phase 2 — Data Layer Framework](#6-phase-2--data-layer-framework)
7. [Phase 2 — Intelligence Layers](#7-phase-2--intelligence-layers)
8. [Phase 2 — AI & Predictive Services](#8-phase-2--ai--predictive-services)
9. [Phase 3 — External Client Portal & Expansion](#9-phase-3--external-client-portal--expansion)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [External API & Data Source Catalogue](#11-external-api--data-source-catalogue)
12. [UI, Branding & Design System](#12-ui-branding--design-system)
13. [Glossary](#13-glossary)

---

## 1. Vision & Objectives

### 1.1 Vision

SWAN (Strategic Warning & Alert Network) is a geospatial supply chain risk intelligence platform. Its purpose is to detect, assess, validate, and communicate events that threaten the continuity of logistics operations across **all modes of transport** — sea, air, road, rail, and warehousing — before those events become disruptions.

SWAN combines two complementary sources of intelligence:

- **Human intelligence (HUMINT layer)** — operational staff on the ground create, validate, and enrich alerts with local knowledge, business impact assessments, and reactive action plans.
- **Machine intelligence (SIGINT layer)** — automated data feeds (weather, news, vessel & port activity, health alerts) continuously monitored, correlated, and scored by AI services that surface early-warning signals and draft alerts for human validation.

The platform is intentionally architected in **layers**: a stable core (map, alerting, workflow, rights) onto which independent intelligence layers can be added over time without re-architecting.

### 1.2 Objectives

| # | Objective | Measure of success |
|---|---|---|
| O1 | Centralize disruption awareness on a single live world map | 100% of network-relevant events visible in one interface |
| O2 | Reduce time-to-awareness of disruptive events | Median detection-to-publication time < 2 hours (Phase 2 target: < 15 min for automated signals) |
| O3 | Standardize impact assessment & reactive action plans | Every published alert carries an impact statement and action plan |
| O4 | Anticipate rather than react | ≥ 30% of Phase 2 alerts published *before* operational impact occurs |
| O5 | Govern publication through auditable, location-based rights | Zero unauthorized publications; full audit trail |
| O6 | Prepare a client-facing intelligence product | Phase 3 external portal fed from the same alert pipeline |

### 1.3 Guiding Principles

1. **Human-in-the-loop by default.** Automated signals accelerate awareness; accountable humans decide what is published. Only narrowly defined, officially sourced signal types may auto-publish (see §8.7).
2. **Multimodal from day one.** Every event, signal, and impact model must be expressible across sea, air, road, rail, and warehouse operations. No layer may assume a single transport mode.
3. **Layered extensibility.** Every intelligence layer conforms to one common signal contract (§6.2). Adding a new layer is configuration plus a connector — never a schema redesign.
4. **Publication is a governed act.** Rights are granted per location (country/region) and per channel (internal/external), managed through named profiles.
5. **Everything is auditable.** Creation, edits, approvals, publications, and automated decisions are logged with actor, timestamp, and rationale.

---

## 2. Scope & Phasing

### 2.1 Phase Overview

| Phase | Name | Content | Outcome |
|---|---|---|---|
| **1** | Core Alert Platform | Interactive world map, manual alert lifecycle (create → save → submit → approve → publish → close), templates, categorization, rights management, email notifications | Fully operational internal alerting tool |
| **2** | Intelligence & Prediction | Data layer framework, four intelligence layers (Weather, News, Vessels & Ports, Health), AI services (NLP enrichment, correlation engine, risk scoring, predictive warnings), signal review queue | Sensing platform: machine-detected signals validated by humans |
| **3** | External Portal & Expansion | Client-facing portal, client subscriptions & notification preferences, external publication workflow with content adaptation, additional layers (e.g., geopolitical/security, labor action, customs/regulatory), public API | Client-facing intelligence product & ecosystem |

### 2.2 Phase 1 Scope

**In scope**

- Interactive world map dashboard with clustered event markers and location search
- Alert creation form with mandatory/optional fields, file & URL attachments, picture upload
- Reusable alert templates ("saved drafts" usable as starting points)
- Categorization: category, sub-category, industry, client tagging
- Time & location model: validity window, multiple locations per alert, transport mode(s), flow direction (import / export / both)
- Impact statement & global reactive action plan (mandatory before submission)
- Publication workflow: Save (private draft) / Submit (for approval) / Publish (direct, if rights allow) / Cancel
- Approval queue for users holding publication rights in the alert's location(s)
- Internal vs. external publication flag (external delivery mechanism itself is Phase 3; Phase 1 records the intent and stores the external variant)
- User rights management: my profile, user search, standard rights profiles, rights duplication/import
- Email notification engine with per-user subscription rules (by area and by profile, for published and submitted alerts separately)

**Out of scope for Phase 1**

- Any automated data ingestion
- AI services
- Client-facing interfaces
- Mobile native apps (responsive web only)

### 2.3 Phase 2 Scope

All four intelligence layers are delivered in Phase 2, reflecting SWAN's multimodal mandate — weather affects every mode, news covers every mode, vessels & ports cover sea (and intermodal knock-on effects), and health alerts affect workforce and cross-border movement across all modes.

**In scope**

- Signal ingestion framework (connectors, normalization, deduplication, geocoding)
- Common Signal Schema and Signal Review Queue
- Layer 1: Weather & Natural Hazards
- Layer 2: News & Media Monitoring
- Layer 3: Vessels & Ports (maritime + intermodal impact propagation)
- Layer 4: Health & Epidemic Alerts
- AI services: NLP pipeline, correlation engine, disruption risk scoring, predictive warnings, auto-drafting of alerts
- Map layer toggles (per-layer visibility, severity filtering, time slider)
- Asset & lane registry (ports, corridors, warehouses, client lanes) to contextualize risk scoring

**Out of scope for Phase 2**

- Client-facing delivery (Phase 3)
- Fully autonomous publication beyond the narrow auto-publish class (§8.7)

### 2.4 Phase 3 Scope (Outline)

- External client portal (web) with client-scoped alert visibility
- Client notification preferences (email, webhook, digest)
- External content adaptation workflow (publish as-is / publish with modification / internal only)
- Public REST API for client system integration
- Additional intelligence layers: geopolitical & security incidents, strikes & labor action, customs & regulatory changes, cyber incidents affecting logistics infrastructure
- Analytics module: disruption history, hotspot analysis, layer performance (precision/recall of signals)

---

## 3. Personas & User Roles

| Persona | Description | Primary needs |
|---|---|---|
| **Field Contributor** | Operational staff (branch, port office, warehouse) who witnesses events | Fast alert creation, templates, mobile-friendly form |
| **Country/Region Publisher** | Manager with publication rights for a geography | Approval queue, quality control, edit-before-publish |
| **Network Intelligence Analyst** (Phase 2) | Central or regional analyst monitoring automated signals | Signal review queue, correlation view, one-click promote-to-alert |
| **Rights Manager** | Administers users, rights, and standard profiles | User search, profile definition, rights duplication |
| **Executive Viewer** | Consumes the map and alert feed; publishes nothing | Filterable map, severity overview, email digests |
| **Client User** (Phase 3) | External customer subscribed to lanes/geographies | Curated external alerts, notification preferences |

Roles are not hard-coded titles; they emerge from the rights model in §4. A single user may combine several personas (e.g., a contributor who is also a publisher for one country).

---

## 4. Rights & Permissions Model

### 4.1 Rights Dimensions

Every user account carries rights along four dimensions:

| Dimension | Values | Meaning |
|---|---|---|
| **Creation** | boolean | May create and save draft alerts |
| **Internal Publication** | list of countries and/or profiles | May approve & publish internal alerts for those locations |
| **External Publication** | list of countries and/or profiles | May approve & publish external (client-facing) alert variants for those locations |
| **Client scope** | list of clients | May tag and publish alerts referencing those clients |
| **Rights Manager** | boolean | May edit other users' rights and manage standard profiles |

### 4.2 Standard Rights Profiles

A **profile** is a named, centrally managed bundle of location rights (e.g., `WORLD`, `WEST-AFRICA`, `SOUTHERN-AFRICA`, `MAGHREB`). Assigning a profile grants its full country list; updating the profile updates every holder simultaneously.

Rules:

- Profiles are created, updated, and deleted only by users with the Rights Manager flag.
- A profile may be built by cloning an existing profile and adding/removing countries.
- A profile can optionally embed the Rights Manager flag ("Add right to manage user's rights").
- Users may hold a profile **or** an explicit country list **or** both; effective rights are the union.

### 4.3 Rights Administration Functions

| Function | Description | Access |
|---|---|---|
| **My Profile** | View own identity block (name, job title, email, culture/locale, country, phone), activity stats (alerts created, last alert), notification rules, and own rights matrix. Edit own rights only if Rights Manager. | All users |
| **Search User** | Search by first/last name, job title, country code, profile, or any rights dimension; open a user to view/edit their rights (edit requires Rights Manager) | All users (view), Rights Managers (edit) |
| **Define Standard Rights Profiles** | Create / update / delete profiles | Rights Managers only |
| **Import rights** | Copy another user's full rights matrix onto the current user | Rights Managers |
| **Duplicate rights** | Push the current user's rights matrix onto another user | Rights Managers |

### 4.4 Editing Rules & Safeguards

- The rights editor presents four columns — Creation, Internal Publication, External Publication, Clients — with a profile selector at the top ("standard rights perimeter") and per-country pickers below.
- All edits are staged and only persisted on **Save**; **Cancel** discards.
- A user without self-edit rights sees their matrix read-only and is instructed to contact a Rights Manager.
- Every rights change is written to the audit log: actor, target user, before/after diff, timestamp.
- Deleting a profile requires confirmation and reports the number of affected users before commit.

### 4.5 Notification Subscriptions

Each user manages two independent subscription rules, each with an activation toggle:

1. **Published & closed alerts** — notified by email when an alert is published or closed in a chosen area (country/city) or profile perimeter.
2. **Submitted alerts** — notified by email when an alert awaiting approval is submitted in a chosen area or profile perimeter (relevant to publishers).

Phase 2 adds a third rule: **Automated signals above severity threshold** (per layer, per area). Phase 3 adds client-facing channels.

---

## 5. Phase 1 — Core Alert Platform

### 5.1 Map Dashboard

The home screen is a full-width interactive world map.

**Components**

| Component | Behaviour |
|---|---|
| Location search bar | Type-ahead country/city search; selecting recenters and zooms the map |
| Event markers | Numbered cluster badges at country/city level showing count of active alerts; click expands to alert list |
| Side menu | Home, Create Alert (+), Search Alerts, User Rights Management, Settings |
| Create Alert button | Prominent header button and side-menu shortcut — both routes open the same creation form |
| Alert detail panel | Clicking an alert opens a panel: title, picture, description, category, locations, transport modes, flows, validity window, impact, action plan, attachments, URLs, author, status history |

**Map display rule.** An alert appears on the map when — and only when — the current date falls inside its validity window `[From, To]`. An empty `To` date means "until further notice"; the alert remains visible until explicitly closed or an end date is set.

### 5.2 Alert Data Model

| Field | Type | Mandatory | Notes |
|---|---|---|---|
| `id` | UUID | system | |
| `title` | string (200) | ✔ | |
| `picture` | image upload or URL | – | One primary visual |
| `description` | rich text | ✔ | |
| `urls[]` | list of URLs | – | Source/reference links |
| `attachments[]` | files | – | PDF, images, docs; virus-scanned |
| `category` | enum | ✔ | e.g., Weather, Strike, Congestion, Security, Regulatory, Health, Infrastructure, Accident |
| `sub_category` | enum (dependent) | ✔ | Filtered by category |
| `industry` | enum | – | Affected vertical(s) |
| `clients[]` | list | – | Requires client-scope rights to publish |
| `valid_from` | date | ✔ | Date the alert appears on the map — **not** necessarily the event date |
| `valid_to` | date | – | Blank if unknown; alert stays live |
| `locations[]` | list of location blocks | ✔ (≥1) | See below |
| `impacts` | rich text | ✔ | Business impact statement |
| `global_reactive_action_plan` | rich text | ✔ | What the network should do |
| `status` | enum | system | Draft / Submitted / Published / Rejected / Closed / Expired |
| `origin` | enum | system | `human` (Phase 1) / `signal` (Phase 2) |
| `visibility` | enum | system | Internal / Internal+External |

**Location block** (repeatable; "+ Location(s)" adds another):

| Field | Type | Mandatory | Notes |
|---|---|---|---|
| `location` | geo entity | ✔ | Country, city, port, airport, or corridor |
| `transport_modes[]` | multi-select | ✔ | Sea, Air, Road, Rail, Warehouse/Terminal |
| `flow` | radio | ✔ | Import / Export / Both |

**Validity-date semantics (important).** `valid_from` controls *map appearance*, not the event date. To announce next month's event one week ahead, the author sets `valid_from` to the desired publication-visibility date. The event's own timing belongs in the description and, from Phase 2, in the structured `event_start`/`event_end` fields of the underlying signal.

### 5.3 Templates

- **Save** stores the alert as a private draft, listed under "Template information" at the top of the creation form.
- Drafts are visible only to their author and can be reopened, edited, and submitted later, or used as reusable templates for recurring alert types (e.g., seasonal port congestion).
- Phase 2 introduces shared, admin-curated templates per category.

### 5.4 Alert Lifecycle & Workflow

```
                 ┌─────────┐
        Cancel ─►│ (none)  │
                 └─────────┘
┌────────┐ Save ┌────────┐ Submit ┌───────────┐ Approve  ┌───────────┐
│ Editing├─────►│ Draft  ├───────►│ Submitted ├─────────►│ Published │
└───┬────┘      └────────┘        └─────┬─────┘          └─────┬─────┘
    │ Publish (rights holder)           │ Reject               │ Close / valid_to reached
    └───────────────────────────────────┼──────────────────────▼
                                        ▼                ┌───────────┐
                                  ┌──────────┐           │  Closed / │
                                  │ Rejected │           │  Expired  │
                                  └──────────┘           └───────────┘
```

**Button logic on the creation form** (after all mandatory fields are valid):

| Button | Shown when | Effect |
|---|---|---|
| **Cancel** | always | Leave without saving |
| **Save** | always | Store private draft; nobody else sees it |
| **Submit** | author lacks publication rights for ≥1 selected location | Route to approval queue of users holding rights for those locations |
| **Publish** | author holds publication rights for **all** selected locations | Immediate publication (subject to the confirmation dialogs below) |

**Publication confirmations**

1. **Content confirmation pop-up** — "Please confirm all information is correct" (single confirm/cancel).
2. **External publication pop-up** — "To provide our customers more insight, this alert will be published both internally and externally. Do you agree?" with three choices:
   - **Yes** — internal and external variants are identical.
   - **Yes with modification** — opens the external-variant editor; the author adapts wording/attachments for client consumption before publication.
   - **No** — internal publication only.

In Phase 1 the external variant is stored and flagged; actual client delivery activates in Phase 3. This preserves the editorial workflow and builds a back-catalogue of client-ready content.

**Approval queue.** Users with publication rights in a location see submitted alerts for that location, with actions: **Internal publication** (triggers the same two pop-ups), **Reject with comment** (returns to author as Rejected → editable back to Draft), **Edit then publish**.

### 5.5 Search & Administration of Alerts

- Full-text and faceted search: status, category, location, transport mode, client, author, date range, origin.
- Authors can close their own published alerts; publishers can close any alert within their location rights.
- Closing an alert removes it from the map immediately and notifies subscribers of the closure.

### 5.6 Notifications (Phase 1)

- Transactional emails: alert published / closed / submitted (per §4.5 subscriptions), submission received, approval decision to author.
- Emails render title, category, severity-relevant fields, locations, validity window, impact summary, and a deep link.
- Locale-aware templates (EN/FR at minimum, per user `culture`).

---

## 6. Phase 2 — Data Layer Framework

### 6.1 Architecture Overview

```
┌───────────────────────────── EXTERNAL SOURCES ─────────────────────────────┐
│  Weather APIs   News/GDELT   AIS & Port APIs   WHO/ProMED   (future: ...)  │
└──────┬──────────────┬───────────────┬───────────────┬──────────────────────┘
       ▼              ▼               ▼               ▼
┌─────────────────────────── INGESTION CONNECTORS ───────────────────────────┐
│ per-source adapters · scheduling · rate limiting · retries · raw archive   │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌──────────────────────────── NORMALIZATION ─────────────────────────────────┐
│ map to Common Signal Schema · geocoding · unit conversion · language detect │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌────────────────────────── ENRICHMENT (AI) ─────────────────────────────────┐
│ NLP: classify, extract entities, summarize · dedupe/cluster · severity     │
│ scoring · asset-lane matching · correlation across layers                  │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌──────────────────────────── SIGNAL STORE ──────────────────────────────────┐
│ signals + clusters + scores · full lineage to raw payloads                 │
└───────┬──────────────────────────┬──────────────────────────────────────────┘
        ▼                          ▼
┌──────────────────┐   ┌───────────────────────────┐
│ MAP LAYERS       │   │ SIGNAL REVIEW QUEUE       │
│ (toggle per      │   │ analyst triage → promote  │──► Alert workflow (§5.4)
│  layer/severity) │   │ to alert / dismiss / merge│
└──────────────────┘   └───────────────────────────┘
```

Every layer is a self-contained module implementing the same four contracts: **Connector** (fetch), **Normalizer** (to Common Signal Schema), **Enricher hooks** (layer-specific scoring inputs), **Renderer config** (map symbology). New layers register through configuration; the core pipeline is layer-agnostic.

### 6.2 Common Signal Schema

| Field | Type | Description |
|---|---|---|
| `signal_id` | UUID | |
| `layer` | enum | weather / news / vessel_port / health / … |
| `source` | string | Provider + feed identifier |
| `source_ref` | string | Provider's native ID / URL |
| `ingested_at` | timestamp | |
| `event_start` / `event_end` | timestamp | Actual event timing (may be forecast) |
| `geo` | GeoJSON | Point, polygon, or corridor geometry |
| `locations[]` | resolved entities | Country, city, port (UN/LOCODE), airport (IATA), corridor ID |
| `transport_modes[]` | enum list | Sea / Air / Road / Rail / Warehouse — inferred or source-declared |
| `category` / `sub_category` | enum | Mapped to the alert taxonomy (§5.2) |
| `headline` | string | Short human-readable summary (AI-generated if absent) |
| `body` | text | Normalized description |
| `raw_payload_ref` | pointer | Link to archived original |
| `severity_source` | float 0–1 | Severity as declared/derived from the source |
| `severity_swan` | float 0–1 | SWAN risk score (§8.4) |
| `confidence` | float 0–1 | Source reliability × extraction confidence |
| `cluster_id` | UUID | Deduplication/correlation cluster |
| `status` | enum | New / Under review / Promoted / Dismissed / Expired / Auto-published |
| `language` | ISO 639-1 | Original language |

### 6.3 Geocoding & Reference Data

- **Gazetteer**: countries, admin regions, cities, plus logistics entities — seaports (UN/LOCODE), airports (IATA/ICAO), border crossings, rail terminals, road corridors.
- **Asset & Lane Registry**: AGL's own network — offices, warehouses, concessions, terminals, and recurring client lanes (origin → destination + mode). Signals are matched against this registry to compute *network relevance* (§8.4). Maintained by administrators; importable from CSV.

### 6.4 Signal Review Queue

The analyst's working surface:

- Filterable list (layer, severity, confidence, geography, mode, status) with map preview.
- Cluster view: correlated signals grouped, with the AI-drafted composite summary.
- Actions per signal/cluster:
  - **Promote to alert** — opens the Phase 1 creation form pre-filled (title, description, category, locations, modes, validity window, source URLs). The normal rights workflow then applies. `origin = signal`; lineage retained.
  - **Dismiss** (with reason code — feeds model retraining, §8.8).
  - **Merge** into an existing alert (adds sources & may raise severity).
  - **Watch** — keep monitoring; escalate if score rises past threshold.
- SLA targets: severity ≥ 0.8 signals surfaced to on-duty analysts within 5 minutes of ingestion (push notification + email).

---

## 7. Phase 2 — Intelligence Layers

Each layer below specifies: sources, cadence, normalization highlights, mode mapping, severity inputs, and rendering.

### 7.1 Layer 1 — Weather & Natural Hazards

| Aspect | Specification |
|---|---|
| **Sources** | Open-Meteo / NOAA GFS-ECMWF forecasts; national met-service warnings (CAP feeds); GDACS (floods, earthquakes, cyclones); tropical cyclone tracks (JTWC/NHC) |
| **Cadence** | Forecast grids: 4×/day; official warnings & GDACS: 15-min polling / webhook where available |
| **Normalization** | CAP alerts map near-1:1 to schema; forecast grids are scanned only against Asset & Lane Registry cells to avoid noise |
| **Mode mapping** | Wind/swell → Sea (port closures, berthing); visibility/storms → Air; rainfall/flood → Road & Rail (corridor washouts); all → Warehouse (structural/flood risk) |
| **Severity inputs** | Official warning level, hazard intensity percentile vs. climatology, forecast lead time, overlap area with registry assets |
| **Rendering** | Polygon overlays (warning areas), cyclone track lines with cone, hazard icons; color ramp per severity |
| **Auto-publish candidate** | Official national warnings ≥ "Orange/Amber" intersecting a registry asset (see §8.7) |

### 7.2 Layer 2 — News & Media Monitoring

| Aspect | Specification |
|---|---|
| **Sources** | GDELT 2.0 (15-min global news graph); curated RSS list (trade press: Lloyd's List-class, port authorities, ministries); NewsAPI-class aggregator for headline coverage; official social accounts of port/rail/road authorities (via their feeds) |
| **Cadence** | 15-min batch (GDELT) + near-real-time RSS polling |
| **Normalization** | Language detection → machine translation to EN for processing (original preserved); article → single signal; multi-article clustering by story |
| **NLP tasks** | Relevance classification (logistics-disruption vs. noise), event-type classification to taxonomy, named-entity & geo extraction, date extraction (event vs. publication date), summarization (headline + 3-sentence brief) |
| **Mode mapping** | Inferred from event type + entities (e.g., "dockworkers strike" → Sea+Warehouse; "railway derailment" → Rail) |
| **Severity inputs** | Event-type base weight, source credibility tier, corroboration count (independent sources in cluster), geographic proximity to registry assets, sentiment/escalation language score |
| **Rendering** | Point markers with story-cluster badge count; click = composite summary with source list |
| **Auto-publish** | Never. News signals always require human validation |

### 7.3 Layer 3 — Vessels & Ports

| Aspect | Specification |
|---|---|
| **Sources** | AIS provider (Spire, MarineTraffic, or Kpler-class — commercial selection in §11); port-call & congestion datasets (provider or computed); port authority notices (NOTAM-equivalents, navigation warnings); optionally client vessel lists |
| **Cadence** | AIS positions: 5–15 min for watched vessels/zones; port statistics: hourly aggregation; notices: 15-min polling |
| **Computed indicators** | **Port congestion index** — vessels at anchor vs. berth, median waiting time vs. 90-day baseline per port; **Queue anomaly** — anchorage count z-score > 2; **ETA drift** — watched vessel ETA slipping > 24 h vs. schedule; **Corridor disruption** — canal/strait transit counts vs. baseline (Suez, Panama, Bab-el-Mandeb, Bosphorus, Cape route) |
| **Mode mapping** | Primary: Sea. **Intermodal propagation**: a congested port raises baseline risk on connected road/rail corridors and warehouse capacity in the registry (graph propagation, §8.5) |
| **Severity inputs** | Congestion index level & slope, number of registry lanes touching the port, client vessels affected, alternative-port availability |
| **Rendering** | Port status dots (green/amber/red by congestion index), anchorage heat, watched-vessel positions with track, corridor status bands |
| **Auto-publish** | Never for computed indicators; official navigation warnings may qualify under §8.7 rules |

### 7.4 Layer 4 — Health & Epidemic Alerts

| Aspect | Specification |
|---|---|
| **Sources** | WHO Disease Outbreak News; ProMED-mail; Africa CDC / ECDC / US CDC travel & outbreak notices; national health ministry feeds where available |
| **Cadence** | Hourly polling |
| **Normalization** | Disease, location(s), case counts/trend, WHO grading; text → structured via NLP with human-verifiable extraction confidence |
| **Mode mapping** | All modes via workforce availability; Air & Sea specifically via sanitary controls, port health measures, crew-change restrictions; Road via border-crossing health checks |
| **Severity inputs** | WHO/authority grading, transmissibility class, proximity to registry assets & workforce concentrations, historical restriction likelihood for that disease class |
| **Rendering** | Country/region shading + outbreak markers with grade badge |
| **Auto-publish** | Never. Health alerts always human-validated given reputational sensitivity |

### 7.5 Map Layer Controls (Phase 2 UI)

- Layer toggle panel: each layer on/off, severity threshold slider, "registry-relevant only" filter (default ON).
- Time slider: past 7 days ↔ forecast horizon (weather up to +7 d, cyclone tracks up to +5 d).
- Published human alerts (Phase 1 markers) always render above signal layers; a signal promoted to an alert is visually linked (same cluster glyph) to avoid double-counting.

---

## 8. Phase 2 — AI & Predictive Services

### 8.1 Service Map

| Service | Purpose | Consumes | Produces |
|---|---|---|---|
| **NLP Pipeline** | Understand unstructured text | News, health, notices | Classified, geocoded, summarized signals |
| **Deduplication & Clustering** | One event = one cluster | All signals | `cluster_id`, canonical composite |
| **Correlation Engine** | Link related events across layers | Clusters | Cross-layer incident graphs |
| **Risk Scoring** | Uniform severity for triage | Signals + registry | `severity_swan`, `confidence` |
| **Impact Propagation** | Intermodal knock-on estimation | Incidents + network graph | Derived risk on lanes/assets |
| **Predictive Warnings** | Anticipate disruptions | Historical + live indicators | Forecast signals with lead time |
| **Alert Drafting** | Accelerate human publication | Promoted clusters | Pre-filled alert drafts |

### 8.2 NLP Pipeline

Stages (all model outputs carry confidence scores; low-confidence extractions are flagged in the review queue rather than silently accepted):

1. **Language ID & translation** — detect language; translate to English for processing; store original.
2. **Relevance filter** — binary classifier: *logistics-disruption-relevant?* Trained initially on a labelled seed set (public disruption news vs. general news), then continuously on analyst promote/dismiss decisions (§8.8). Target: ≥ 0.9 recall at ≥ 0.6 precision (queue tolerates some noise; missing events is worse).
3. **Event classification** — multi-label mapping onto the alert taxonomy (category/sub-category).
4. **Entity & geo extraction** — organizations, vessels, infrastructure, place names → gazetteer resolution (UN/LOCODE, IATA); ambiguity resolved by context ranking.
5. **Temporal extraction** — distinguish *publication* date from *event* date(s); populate `event_start`/`event_end`.
6. **Summarization** — headline (≤ 120 chars) + 3-sentence brief, factual register, no speculation; source URLs always attached.

Implementation note: stages 2–6 are well suited to a hosted LLM with structured (JSON-schema) outputs plus a light fine-tuned classifier for stage 2 at volume; the spec is model-agnostic and requires only the stated contracts and quality targets.

### 8.3 Deduplication & Clustering

- **Blocking**: candidate pairs limited to same layer-week-geography buckets.
- **Similarity**: embedding cosine similarity on headline+body, plus structured feature match (event type, location, event date window).
- **Decision**: pair score > θ_high → same cluster; θ_low–θ_high → analyst "possible duplicate" hint; < θ_low → distinct.
- Each cluster maintains a **canonical composite**: best headline, merged source list, max severity, union of locations, corroboration count.
- Cross-layer clustering is *not* performed here (a storm and a port queue are different signals); linking related events across layers is the Correlation Engine's job.

### 8.4 Risk Scoring Model

Every signal receives `severity_swan` ∈ [0,1]:

```
severity_swan = clamp( W_e·E + W_x·X + W_p·P + W_c·C + W_t·T )

E  Event intensity      — normalized source severity (warning level, congestion
                          z-score, WHO grade, event-type base weight)
X  Network exposure     — registry match: count & criticality of AGL assets,
                          lanes, and tagged clients within the impact geometry
P  Propagation factor   — modelled knock-on breadth across modes (§8.5)
C  Corroboration        — independent-source count & source-tier quality (news);
                          fixed at 1.0 for official single-source feeds
T  Temporal urgency     — proximity of event_start (imminent > distant) and
                          expected duration
```

- Weights `W_*` are configured per layer (e.g., weather leans on E and T; news leans on C and X) and versioned; every stored score records the weight-set version for reproducibility.
- `confidence` is computed separately (source reliability tier × extraction confidence) and displayed alongside severity — a high-severity/low-confidence signal is a *verify first* case, and the queue UI makes that distinction visually explicit.
- Severity bands: **Info** < 0.4 ≤ **Watch** < 0.6 ≤ **Warning** < 0.8 ≤ **Critical**.

### 8.5 Correlation Engine & Impact Propagation

**Correlation.** A rules-plus-graph service linking clusters across layers into **incidents**:

- Spatial-temporal join: clusters whose geometries and event windows overlap.
- Causal rule library, e.g. `cyclone(area) → port_congestion(ports in area, lag 0–5 d)`, `strike(port) → congestion(port) → ETA_drift(vessels bound for port)`, `outbreak(region) → border_delay(crossings of region)`.
- Output: incident graph (nodes = clusters, edges = typed relations with confidence), rendered in the review queue as a mini-map + timeline.

**Impact propagation.** The registry is held as a graph (assets, ports, corridors, lanes; edges = physical/operational connectivity). When an incident lands on a node, risk propagates along edges with per-edge damping (e.g., port → connected rail corridor at 0.6, → alternate port at −0.2 capacity relief). Result: *derived risk* per lane/asset, powering a "Network Impact" panel: *"Incident X touches 3 corridors and 2 warehouses; lanes A→B (Sea+Rail) at Warning."*

### 8.6 Predictive Warnings

Forecast signals (`origin = prediction`) generated ahead of impact:

| Predictor | Method | Horizon | Output example |
|---|---|---|---|
| **Port congestion forecast** | Gradient-boosted regression on congestion index series + inbound AIS pressure + seasonality + weather forecast features | 3–7 days | "Port of X congestion index expected to reach Red (0.85 ± 0.07) within 4 days" |
| **Weather impact lead** | Deterministic: forecast/warning geometry × registry intersection | up to 7 days | "Cyclone track intersects Port Y in 72 h; historical closure likelihood 78%" |
| **ETA cascade** | Per-lane ETA drift projection from vessel positions + congestion forecast | voyage-length | "5 watched vessels on lane A→B projected > 48 h late" |
| **Disruption analogue** | Similarity retrieval over historical incidents ("last 3 comparable strikes at this port lasted 6–10 days") | contextual | Duration & impact range attached to live incidents |

Rules: predictions always display method, confidence interval, and feature attribution (top drivers); they render with a distinct dashed/ghost symbology; they never auto-publish; accuracy is tracked per predictor (MAE, calibration) and reported monthly (§8.8).

### 8.7 Automation Policy & Auto-Publish Class

Default: **no automated publication.** A narrow exception class exists to meet the < 15 min awareness target for unambiguous, officially sourced hazards:

An auto-publish rule may be enabled only when **all** hold:
1. Source is an official authority feed (national met service CAP, GDACS, navigation authority).
2. Signal type has a fixed, pre-approved template (no free-text generation in the published alert).
3. Severity ≥ Warning **and** geometry intersects the Asset & Lane Registry.
4. The rule is explicitly enabled per source-type by a Rights Manager, with a named accountable owner.
5. Published alert is labelled **"Automated — pending analyst review"** and enters a mandatory 4-hour review SLA; analysts may amend or retract.

Everything else — all news, all health, all computed indicators, all predictions — flows through human validation.

### 8.8 Learning Loop & Model Governance

- Every analyst action (promote / dismiss+reason / merge / severity override) is captured as labelled training data.
- Quarterly retraining cycle for classifiers; weight-set reviews for the scoring model with before/after backtesting on the archived signal store.
- **Layer scorecard** (monthly): signal volume, precision proxy (promotion rate), recall proxy (human alerts that had *no* prior machine signal — "missed events"), median detection-to-publication lead time, predictor accuracy.
- Model registry: every model/weight-set versioned; every signal stores the versions that scored it (full reproducibility).
- Bias & noise guardrails: per-country volume normalization in the news layer (media coverage density must not masquerade as risk density); source-tier list reviewed quarterly.

---

## 9. Phase 3 — External Client Portal & Expansion

*(Outline — to be detailed in a Phase 3 addendum.)*

- **Client portal**: authenticated web portal; clients see only external-variant alerts matching their subscriptions (geographies, lanes, modes, categories).
- **External publication activation**: the Phase 1 "Yes / Yes with modification / No" workflow now delivers to the portal, email, and webhooks.
- **Client notification preferences**: immediate vs. daily digest; channel selection; severity threshold.
- **Public API**: read-only REST API (OAuth2 client-credentials) exposing external alerts for client TMS/ERP integration.
- **New intelligence layers**: geopolitical & security incidents, strikes & labor action (structured), customs & regulatory changes, cyber incidents affecting logistics infrastructure.
- **Analytics module**: disruption heat maps, per-lane risk history, incident post-mortems, layer scorecards exposed to management.

---

## 10. Non-Functional Requirements

| Domain | Requirement |
|---|---|
| **Availability** | Core platform 99.5% (Phase 1), 99.9% incl. ingestion (Phase 2). Ingestion degradation must never take down the map/alerting core |
| **Performance** | Map initial load < 3 s on 4G; alert publication propagation to map < 30 s; signal ingestion-to-queue < 5 min (poll-bound sources) |
| **Scalability** | Design for 5,000 internal users, 50,000 signals/day post-filtering, 10 years of signal history online |
| **Security** | SSO (SAML/OIDC) against group IdP; RBAC per §4; TLS 1.2+; encryption at rest; OWASP ASVS L2 |
| **Audit** | Immutable audit log for alerts, rights changes, automated decisions; retained ≥ 5 years |
| **Data protection** | User personal data limited to directory attributes; GDPR-aligned retention & DSR support; no personal data in signal payloads beyond public news content |
| **Localization** | UI in EN & FR at launch; user-level locale; date/number formatting per locale |
| **Accessibility** | WCAG 2.1 AA for the internal web app |
| **Compatibility** | Evergreen Chrome/Edge/Firefox/Safari; responsive down to 768 px (tablet); Phase 3 revisits mobile |
| **Observability** | Per-connector health dashboards, dead-letter queues, alerting on feed silence (a *silent* feed is itself an operational incident) |
| **Licensing compliance** | Each external source's terms tracked in the source register (§11); redistribution restrictions enforced at the external-publication boundary (e.g., raw AIS positions must not appear in client-facing alerts unless licensed) |

---

## 11. External API & Data Source Catalogue

*Commercial selection to be finalized during Phase 2 procurement; candidates listed for evaluation.*

| Layer | Candidate | Type | Cost model | Key evaluation criteria |
|---|---|---|---|---|
| Weather | Open-Meteo | Forecast API | Free / low-cost commercial | Coverage, CAP alignment, SLA |
| Weather | NOAA / ECMWF feeds | Model output | Free / license | Resolution, latency |
| Weather/Hazard | GDACS | Multi-hazard alerts | Free | Event coverage, latency |
| Weather/Hazard | National met CAP feeds | Official warnings | Free | Per-country availability & reliability |
| News | GDELT 2.0 | Global news graph | Free | Volume handling, latency, noise rate |
| News | NewsAPI-class aggregator | Headlines API | Subscription | Source list, licensing for internal display |
| News | Curated RSS (trade press, authorities) | RSS | Free/subscription | Editorial quality |
| Vessels/Ports | Spire Maritime | AIS + analytics | Commercial | Coverage (satellite AIS), API limits, redistribution terms |
| Vessels/Ports | MarineTraffic | AIS + port calls | Commercial | Port-call data quality, pricing tiers |
| Vessels/Ports | Kpler / port-congestion datasets | Analytics | Commercial | Congestion methodology transparency |
| Health | WHO Disease Outbreak News | Official feed | Free | Structured availability |
| Health | ProMED-mail | Curated reports | Free/donation | Parsing complexity |
| Health | Africa CDC / ECDC / CDC notices | Official feeds | Free | Regional coverage (Africa priority) |
| Geocoding | UN/LOCODE, IATA, OSM/Nominatim or commercial geocoder | Reference | Free/commercial | Logistics-entity coverage |

Each onboarded source gets a **source register entry**: owner, license terms, redistribution rights, cost, SLA, reliability tier (feeds the confidence model), and a kill-switch.

---

## 12. UI, Branding & Design System

Aligned with the AGL graphic charter:

| Token | Value | Usage |
|---|---|---|
| **AGL Blue** | `#1B365F` (Pantone 534C) | Primary UI chrome, headers, text emphasis, primary buttons |
| **AGL Yellow** | `#EED58E` (Pantone 7403C) | Accents, section underlines, highlights |
| **White** | `#FFFFFF` | Backgrounds, reversed text |
| AGL Orange | `#ED8C00` | Data viz / map layers only |
| AGL Dark Orange | `#CF4527` | Critical severity on maps/charts only |
| AGL Grey | `#B2B4BE` | Neutral chart elements, disabled states |
| AGL Turquoise | `#00A6C1` | Data viz / secondary map layers only |
| Black 100% | `#2C2A29` | Charts only |

Rules carried from the charter:

- **Secondary colours are never used for text** — they are reserved for graphs, maps, shapes, and decorative elements. Severity colour-coding on the map therefore uses the secondary palette; all labels remain AGL Blue/near-black/white.
- Logo placement follows the charter's exclusion-zone rules; SWAN screens use approved logo assets only, unmodified.
- Tints (70/50/20%) of primary and secondary colours are available for fills, congestion heat ramps, and severity bands.
- Suggested severity ramp: Info = AGL Grey · Watch = AGL Yellow · Warning = AGL Orange · Critical = AGL Dark Orange.

Typography, iconography, and component library details to be specified with the design team in a dedicated UI kit annex during Phase 1 build.

---

## 13. Glossary

| Term | Definition |
|---|---|
| **Alert** | Human-validated (or narrowly auto-published) event notice, published to the map with impact & action plan |
| **Signal** | Machine-ingested raw or enriched event candidate from an intelligence layer |
| **Cluster** | Group of signals judged to describe the same real-world event |
| **Incident** | Cross-layer graph of correlated clusters describing one evolving situation |
| **Layer** | Self-contained intelligence module (source connectors + normalization + rendering) |
| **Registry** | Asset & Lane Registry: AGL's network entities and recurring client lanes |
| **Profile** | Named bundle of location rights, centrally managed |
| **Promotion** | Analyst action converting a signal/cluster into a draft alert |
| **Validity window** | `[valid_from, valid_to]` controlling an alert's presence on the map |
| **Severity (SWAN)** | Composite 0–1 risk score (§8.4); banded Info/Watch/Warning/Critical |
| **Confidence** | Reliability estimate combining source tier and extraction quality |

---

*End of document — SWAN Specification Book v0.1*
