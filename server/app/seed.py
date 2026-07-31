"""Seed the database with the identities, profiles, and alerts shown in the
design mock, so the whole Phase 1 flow is exercisable out of the box.

Run:  uv run python -m app.seed        (wipes and reseeds — dev convenience)
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from app.database import Base, SessionLocal, engine
from app.models import (
    Alert,
    AuditLog,
    EmailTemplate,
    NotificationSubscription,
    Place,
    Profile,
    User,
)
from app.reference import PLACES, STANDARD_PROFILES, country_meta
from app.security import hash_password

NOW = datetime.now(timezone.utc)
TODAY = date.today()

# Every seeded identity shares this password so username/password sign-in is
# testable out of the box (email is the username). Dev convenience only.
DEV_PASSWORD = "swan1234"


def _place(name_fragment: str) -> dict:
    for p in PLACES:
        if name_fragment.lower() in p["name"].lower():
            meta = country_meta(p["country"])
            return {
                "name": f"{p['name']} ({p['code']})",
                "code": p["code"],
                "country": p["country"],
                "country_name": meta["name"],
                "flag": meta["flag"],
                "lat": p["lat"],
                "lng": p["lng"],
            }
    raise KeyError(name_fragment)


def loc(name_fragment: str, modes: list[str], flow: str = "both") -> dict:
    return {**_place(name_fragment), "modes": modes, "flow": flow, "scope": "point"}


# Interior points for the countries used by nationwide seed alerts. The web app
# holds the full 54-country table (web/src/lib/countries.ts); the seed only needs
# the handful it references, and deliberately does not average the gazetteer —
# that's ports only, so the centroid would land offshore.
# Note the ordering: (lat, lng) here, matching the LocationBlock fields. The
# web table uses [lng, lat] because that's what MapLibre/GeoJSON take.
_COUNTRY_CENTRE: dict[str, tuple[float, float]] = {
    "NG": (9.1, 8.7),
    "ZA": (-29.0, 24.7),
}


def country_loc(country: str, modes: list[str], flow: str = "both") -> dict:
    """A whole-country location block — elections, national strikes, currency
    controls. The dashboard paints the country polygon for these instead of
    relying on a single pin."""
    meta = country_meta(country)
    lat, lng = _COUNTRY_CENTRE[country]
    return {
        "name": meta["name"],
        "code": f"{country}-NATIONWIDE",
        "country": country,
        "country_name": meta["name"],
        "flag": meta["flag"],
        "lat": lat,
        "lng": lng,
        "modes": modes,
        "flow": flow,
        "scope": "country",
    }


def reset(db) -> None:
    db.query(AuditLog).delete()
    db.query(EmailTemplate).delete()
    db.query(NotificationSubscription).delete()
    db.query(Alert).delete()
    db.query(User).delete()
    db.query(Profile).delete()
    db.query(Place).delete()
    db.commit()


def seed_places(db) -> None:
    for p in PLACES:
        db.add(
            Place(
                code=p["code"],
                name=p["name"],
                country=p["country"],
                lat=p["lat"],
                lng=p["lng"],
                aliases=p.get("aliases", []),
            )
        )
    db.commit()


def seed_profiles(db) -> None:
    for name, cfg in STANDARD_PROFILES.items():
        db.add(
            Profile(
                name=name,
                countries=cfg["countries"],
                embeds_rights_manager=cfg["embeds_rights_manager"],
            )
        )
    db.commit()


def seed_users(db) -> dict[str, User]:
    users = {
        # Default demo identity (created first => default login). Field
        # Contributor: can publish only in Côte d'Ivoire, everything else routes
        # to approval. Matches the My-profile screen exactly.
        "awa": User(
            email="a.kouassi@aglgroup.com",
            name="Awa Kouassi",
            initials="AK",
            job_title="Operations Supervisor",
            branch="Abidjan branch",
            role_label="Field Contributor",
            home_country="CI",
            home_country_name="Côte d'Ivoire",
            phone="+225 07 44 12 09",
            locale="fr",
            timezone="Africa/Abidjan",
            avatar_gold=True,
            can_create=True,
            internal_pub_countries=["CI"],
            profiles=[],
        ),
        # West-Africa publisher — holds the WEST-AFRICA profile, so the approval
        # queue shows the 3 pending WEST-AFRICA submissions (mock screen 04).
        "diallo": User(
            email="c.diallo@aglgroup.com",
            name="C. Diallo",
            initials="CD",
            job_title="Regional Operations Manager",
            branch="Abidjan hub",
            role_label="Country/Region Publisher",
            home_country="CI",
            home_country_name="Côte d'Ivoire",
            phone="+225 07 10 00 01",
            locale="fr",
            timezone="Africa/Abidjan",
            can_create=True,
            internal_pub_countries=[],
            external_pub_countries=["CI"],
            profiles=["WEST-AFRICA"],
        ),
        "nunes": User(
            email="m.nunes@aglgroup.com", name="M. Nunes", initials="MN",
            job_title="Port Operations", branch="Beira office",
            home_country="MZ", home_country_name="Mozambique", locale="pt",
            timezone="Africa/Maputo", can_create=True,
            internal_pub_countries=["MZ"], profiles=["SOUTHERN-AFRICA"],
        ),
        "traore": User(
            email="y.traore@aglgroup.com", name="Y. Traoré", initials="YT",
            job_title="Terminal Supervisor", branch="Abidjan terminal",
            home_country="CI", home_country_name="Côte d'Ivoire", locale="fr",
            timezone="Africa/Abidjan", can_create=True, internal_pub_countries=["CI"],
        ),
        "mensah": User(
            email="e.mensah@aglgroup.com", name="E. Mensah", initials="EM",
            job_title="Port Agent", branch="Tema office",
            home_country="GH", home_country_name="Ghana", locale="en",
            timezone="Africa/Accra", can_create=True, internal_pub_countries=[],
        ),
        "naidoo": User(
            email="s.naidoo@aglgroup.com", name="S. Naidoo", initials="SN",
            job_title="Marine Coordinator", branch="Durban office",
            home_country="ZA", home_country_name="South Africa", locale="en",
            timezone="Africa/Johannesburg", can_create=True,
            internal_pub_countries=["ZA"], profiles=["SOUTHERN-AFRICA"],
        ),
        "otieno": User(
            email="j.otieno@aglgroup.com", name="J. Otieno", initials="JO",
            job_title="Rail Freight Lead", branch="Mombasa office",
            home_country="KE", home_country_name="Kenya", locale="en",
            timezone="Africa/Nairobi", can_create=True,
            internal_pub_countries=["KE"], profiles=["EAST-AFRICA"],
        ),
        "farouk": User(
            email="h.farouk@aglgroup.com", name="H. Farouk", initials="HF",
            job_title="Trade Compliance", branch="Cairo office",
            home_country="EG", home_country_name="Egypt", locale="en",
            timezone="Africa/Cairo", can_create=True, internal_pub_countries=["EG"],
        ),
        "mwansa": User(
            email="k.mwansa@aglgroup.com", name="K. Mwansa", initials="KM",
            job_title="Corridor Manager", branch="Lubumbashi office",
            home_country="CD", home_country_name="DRC", locale="fr",
            timezone="Africa/Lubumbashi", can_create=True, internal_pub_countries=["CD"],
        ),
        # Self-registered account awaiting validation — demonstrates the login
        # registration flow and the admin's "Pending" filter. Zero rights.
        "newbie": User(
            email="t.mwangi@aglgroup.com", name="Tabitha Mwangi", initials="TM",
            job_title="", branch="", role_label="Awaiting activation",
            home_country="", home_country_name="", locale="en", timezone="UTC",
            status="pending", can_create=False, is_rights_manager=False,
            internal_pub_countries=[], external_pub_countries=[], profiles=[],
        ),
        # Global rights manager for the admin flows.
        "admin": User(
            email="rights.manager@aglgroup.com", name="R. Manager", initials="RM",
            job_title="Rights Administrator", branch="HQ",
            role_label="Rights Manager", home_country="CI",
            home_country_name="Côte d'Ivoire", locale="en", timezone="UTC",
            can_create=True, is_rights_manager=True, profiles=["WORLD"],
        ),
    }
    pw = hash_password(DEV_PASSWORD)
    for u in users.values():
        u.password_hash = pw
        db.add(u)
    db.commit()
    for u in users.values():
        db.refresh(u)
    return users


def seed_subscriptions(db, u: dict[str, User]) -> None:
    """A few demo subscriptions so the broadcast fan-out and the Profile editor
    show something out of the box (zone / type / criticality combinations)."""
    subs = [
        NotificationSubscription(
            user_id=u["admin"].id, name="All submissions across the network",
            events=["submitted"], min_severity="info",
        ),
        NotificationSubscription(
            user_id=u["diallo"].id, name="West Africa — watch and above",
            events=["published", "submitted"], profiles=["WEST-AFRICA"], min_severity="watch",
        ),
        NotificationSubscription(
            user_id=u["awa"].id, name="Published in Côte d'Ivoire",
            events=["published"], countries=["CI"], min_severity="info",
        ),
        NotificationSubscription(
            user_id=u["naidoo"].id, name="Southern Africa congestion & weather (warning+)",
            events=["published", "closed"], profiles=["SOUTHERN-AFRICA"],
            categories=["Congestion", "Weather"], min_severity="warning",
        ),
    ]
    for s in subs:
        db.add(s)
    db.commit()


def _dt(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours, minutes=minutes)


def seed_alerts(db, u: dict[str, User]) -> None:
    def add(**kw):
        db.add(Alert(**kw))

    # ---- Published (live feed + map markers) ----
    add(
        title="Cyclone Fenella — Port of Beira closure expected within 72h",
        description="Category 3 system tracking toward the Sofala coast. Landfall near Beira forecast within 72 hours; sustained winds and 4–6 m storm surge expected.",
        category="Weather", sub_category="Cyclone", severity="critical",
        status="published", visibility="internal",
        valid_from=TODAY, valid_to=None,
        impacts="Berthing suspended from 15 Jul. 6 scheduled calls affected; reefer capacity at terminal limited to 48h autonomy. Beira–Machipanda corridor at risk of washouts.",
        action_plan="Divert transhipment to Durban / Dar es Salaam. Pre-position generator fuel at Beira warehouse. Hold export trucking from Harare until corridor reassessment.",
        locations=[loc("Beira", ["sea", "road"], "both")],
        urls=["https://gdacs.org/", "https://www.nhc.noaa.gov/"],
        author_id=u["nunes"].id, published_at=_dt(hours=6), submitted_at=_dt(hours=7),
    )
    # Nationwide scope: the whole country is the affected area, not one site.
    add(
        title="Presidential election — nationwide movement restrictions, Nigeria",
        description="Federal election scheduled 22 Aug. Movement restrictions announced for polling day and the preceding night, with a heightened security posture through the results period.",
        category="Political", sub_category="Election", severity="warning",
        status="published", visibility="internal",
        valid_from=TODAY, valid_to=TODAY + timedelta(days=24),
        impacts="Inter-state road haulage suspended 21–22 Aug nationwide. Apapa and Tin Can gate operations reduced; customs at limited staffing through the results period. Domestic air freight schedules thinned.",
        action_plan="Bring forward inland deliveries to 20 Aug. Hold outbound trucking over polling weekend. Confirm bonded storage cover in Lagos and Kano. Daily security review until results are declared.",
        locations=[country_loc("NG", ["road", "rail", "air"], "both")],
        urls=["https://www.inecnigeria.org/"],
        author_id=u["traore"].id, published_at=_dt(hours=7), submitted_at=_dt(hours=9),
    )
    add(
        title="Anchorage queue at 19 vessels — Abidjan terminal",
        description="Average berth wait 4.2 days and rising; reefer plug availability tight through next week.",
        category="Congestion", sub_category="Anchorage queue", severity="warning",
        status="published", visibility="internal",
        valid_from=TODAY, valid_to=TODAY + timedelta(days=8),
        impacts="Vessel bunching after weekend swell; 3 services rescheduled. Reefer plugs near capacity.",
        action_plan="Prioritise reefer discharge. Advise clients of 3–4 day delay on imports. Nightly berth planning call.",
        locations=[loc("Abidjan", ["sea"], "import")],
        author_id=u["traore"].id, published_at=_dt(hours=8), submitted_at=_dt(hours=9),
    )
    add(
        title="Customs go-slow at Kasumbalesa border crossing",
        description="Truck queues exceeding 12 km on the Zambian side; clearance times tripled.",
        category="Strike", sub_category="Customs", severity="warning",
        status="published", visibility="internal",
        valid_from=TODAY - timedelta(days=1), valid_to=None,
        impacts="Copperbelt export lanes delayed 2–3 days. Bonded warehouse space filling in Lubumbashi.",
        action_plan="Stagger truck dispatch. Use Kazungula alternative where feasible. Daily liaison with customs.",
        locations=[loc("Kasumbalesa", ["road"], "both")],
        author_id=u["mwansa"].id, published_at=_dt(days=1, hours=2), submitted_at=_dt(days=1, hours=3),
    )
    add(
        title="Heavy swell advisory — Durban anchorage",
        description="Pilotage may be suspended in 3–4 m swell windows; monitor berthing schedules.",
        category="Weather", sub_category="Swell", severity="watch",
        status="published", visibility="internal",
        valid_from=TODAY - timedelta(days=1), valid_to=TODAY + timedelta(days=2),
        impacts="Intermittent pilotage suspension likely 14–17 Jul; knock-on berth slippage.",
        action_plan="Build schedule buffer. Confirm pilot windows each tide. Hold reefer gate-in if berthing slips.",
        locations=[loc("Durban", ["sea"], "both")],
        author_id=u["naidoo"].id, published_at=_dt(days=1, hours=5), submitted_at=_dt(days=1, hours=6),
    )
    add(
        title="Planned maintenance — Mombasa SGR freight window reduced",
        description="Night freight paths cut 30% during track works; expect 1–2 day rail backlog.",
        category="Infrastructure", sub_category="Rail works", severity="watch",
        status="published", visibility="internal",
        valid_from=TODAY, valid_to=TODAY + timedelta(days=6),
        impacts="Reduced SGR slots 14–20 Jul; ICD Nairobi evacuation slows, yard dwell up.",
        action_plan="Pre-clear priority boxes. Add road shuttle for time-critical cargo. Advise inland clients.",
        locations=[loc("Mombasa", ["rail"], "both")],
        author_id=u["otieno"].id, published_at=_dt(days=3), submitted_at=_dt(days=3, hours=1),
    )
    add(
        title="Suez Canal transit fee revision effective 1 Aug",
        description="Average +7% on container transits; surcharge guidance to follow from carriers.",
        category="Regulatory", sub_category="Tariff", severity="info",
        status="published", visibility="internal_external",
        external_variant={"mode": "identical"},
        valid_from=TODAY + timedelta(days=18), valid_to=None,
        impacts="Transit cost uplift on Asia–Europe strings touching AGL forwarding; margin review needed.",
        action_plan="Update rate cards from 1 Aug. Notify affected clients. Model Cape routing break-even.",
        locations=[loc("Suez", ["sea"], "both")],
        author_id=u["farouk"].id, published_at=_dt(days=4), submitted_at=_dt(days=4, hours=1),
    )

    # ---- Extra published alerts (round the map out to a fuller network) ----
    extras = [
        ("Reduced gate hours — Maputo container terminal", "Congestion", "Port congestion",
         "watch", "Maputo", ["sea"], "both", 2),
        ("Fuel shortage affecting drayage — Dakar", "Infrastructure", "Power",
         "watch", "Dakar", ["road"], "both", 2),
        ("Yard congestion building — Douala terminal", "Congestion", "Port congestion",
         "warning", "Douala", ["sea"], "import", 3),
        ("Berth dredging notice — Dar es Salaam", "Infrastructure", "Port equipment",
         "info", "Dar es Salaam", ["sea"], "both", 5),
        ("Sanitary inspection tightened — Maputo", "Health", "Port health measure",
         "info", "Maputo", ["sea"], "both", 6),
        ("Weekend curfew easing — Abidjan access roads", "Security", "Civil unrest",
         "info", "Abidjan", ["road"], "both", 6),
        ("Rail slot reallocation — Mombasa corridor", "Infrastructure", "Rail works",
         "info", "Mombasa", ["rail"], "export", 6),
        ("Swell easing forecast — Durban", "Weather", "Swell",
         "info", "Durban", ["sea"], "both", 4),
    ]
    for title, cat, sub, sev, place, modes, flow, days in extras:
        add(
            title=title, description=title + ".", category=cat, sub_category=sub,
            severity=sev, status="published", visibility="internal",
            valid_from=TODAY - timedelta(days=1), valid_to=TODAY + timedelta(days=10),
            impacts="Operational impact under assessment; see description.",
            action_plan="Monitor and advise affected clients; escalate if severity rises.",
            locations=[loc(place, modes, flow)],
            author_id=u["nunes"].id, published_at=_dt(days=days),
            submitted_at=_dt(days=days, hours=1),
        )

    # ---- Submitted (approval queue, WEST-AFRICA perimeter — 3 pending) ----
    add(
        title="Truckers' strike announced — Apapa port access, Lagos",
        description="The Lagos truckers' union has called an indefinite strike over new e-call-up fees, effective 16 Jul. Access roads to Apapa and Tin Can Island terminals are expected to be blocked from 05:00. Port authority negotiations scheduled 15 Jul.",
        category="Strike", sub_category="Road transport", severity="warning",
        status="submitted", visibility="internal",
        valid_from=TODAY, valid_to=None,
        impacts="Gate-in/gate-out trucking suspended from 16 Jul. Expect 3–5 day dwell increase on imports; export cut-offs at risk for 4 sailings.",
        action_plan="Reroute urgent deliveries via Tin Can Island rail shuttle. Advance client pickups before 16 Jul. Daily status call 08:00 WAT.",
        locations=[loc("Apapa", ["sea", "road"], "both")],
        author_id=u["awa"].id, submitted_at=_dt(hours=2),
    )
    add(
        title="Berth waiting time rising — Tema, Ghana",
        description="Median berth wait up to 3.1 days after crane downtime; vessel bunching expected midweek.",
        category="Congestion", sub_category="Port congestion", severity="info",
        status="submitted", visibility="internal",
        valid_from=TODAY, valid_to=TODAY + timedelta(days=9),
        impacts="Import dwell rising; two services rescheduled. Reefer monitoring stepped up.",
        action_plan="Prioritise reefer and time-critical discharge. Advise clients of midweek delay.",
        locations=[loc("Tema", ["sea"], "import")],
        author_id=u["mensah"].id, submitted_at=_dt(hours=5),
    )
    add(
        title="New transit bond requirement — Abidjan corridor",
        description="Revised transit bond guarantee required for northbound corridor cargo from 20 Jul.",
        category="Regulatory", sub_category="Transit bond", severity="watch",
        status="submitted", visibility="internal",
        valid_from=TODAY + timedelta(days=6), valid_to=None,
        impacts="Additional guarantee cost and paperwork on Mali/Burkina transit lanes; clearance slower initially.",
        action_plan="Brief forwarding desk. Pre-arrange bonds with broker. Notify corridor clients this week.",
        locations=[loc("Abidjan", ["road"], "export")],
        author_id=u["traore"].id, submitted_at=_dt(days=1),
    )

    # ---- A private draft for Awa (template reuse story) ----
    add(
        title="Seasonal port congestion — draft",
        description="Reusable template for recurring seasonal congestion at Abidjan.",
        category="Congestion", sub_category="Port congestion", severity="watch",
        status="draft", visibility="internal",
        valid_from=TODAY, valid_to=None,
        impacts="Template — fill in per-season impact.",
        action_plan="Template — fill in per-season action plan.",
        locations=[loc("Abidjan", ["sea"], "import")],
        author_id=u["awa"].id,
    )

    db.commit()


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        reset(db)
        seed_places(db)
        seed_profiles(db)
        users = seed_users(db)
        seed_subscriptions(db, users)
        seed_alerts(db, users)
        counts = {
            "places": db.query(Place).count(),
            "profiles": db.query(Profile).count(),
            "users": db.query(User).count(),
            "alerts": db.query(Alert).count(),
            "subscriptions": db.query(NotificationSubscription).count(),
        }
        print(f"Seeded: {counts}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
