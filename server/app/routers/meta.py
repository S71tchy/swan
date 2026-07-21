"""Reference data + dashboard stats."""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.deps import get_current_user
from app.enums import CATEGORIES, INDUSTRIES, Flow, Severity, TransportMode
from app.models import Alert, Place, User
from app.reference import COUNTRY_CATALOGUE, STANDARD_PROFILES, country_meta
from app.rights import pending_alerts_in_perimeter

router = APIRouter(tags=["meta"])


@router.get("/meta/taxonomy")
def taxonomy():
    """Category tree, modes, flows, severities, industries for the create form."""
    return {
        "categories": CATEGORIES,
        "industries": INDUSTRIES,
        "modes": [m.value for m in TransportMode],
        "flows": [f.value for f in Flow],
        "severities": [s.value for s in Severity],
        "profiles": list(STANDARD_PROFILES.keys()),
    }


@router.get("/meta/countries")
def countries(_: User = Depends(get_current_user)):
    """The supported country universe — for the create-form location picker and
    other non-admin surfaces (the admin equivalent is /admin/countries)."""
    return [
        {"code": code, "name": meta["name"], "flag": meta["flag"]}
        for code, meta in COUNTRY_CATALOGUE.items()
    ]


@router.get("/meta/places")
def places(
    q: str = Query(default=""),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Type-ahead over the location master (`places` table) for the picker.

    Matches on name, LOCODE, country code and any aliases. In Phase 2 this is
    the seam where a real geocoder is called; the master table then acts as the
    local cache/override layer."""
    ql = q.strip().lower()
    rows = db.query(Place).order_by(Place.name).all()

    def matches(p: Place) -> bool:
        if not ql:
            return True
        hay = [p.name.lower(), p.code.lower(), p.country.lower(), *[a.lower() for a in (p.aliases or [])]]
        return any(ql in h for h in hay)

    out = []
    for p in rows:
        if not matches(p):
            continue
        meta = country_meta(p.country)
        out.append(
            {
                "name": p.name,
                "code": p.code,
                "country": p.country,
                "country_name": meta["name"],
                "flag": meta["flag"],
                "lat": p.lat,
                "lng": p.lng,
                "label": f"{p.name} ({p.code})",
            }
        )
    return out[:40]


@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    published = db.query(Alert).filter(Alert.status == "published").all()
    live = [a for a in published if a.valid_from <= today and (a.valid_to is None or a.valid_to >= today)]

    sev = {"info": 0, "watch": 0, "warning": 0, "critical": 0}
    countries: set[str] = set()
    for a in live:
        sev[a.severity] = sev.get(a.severity, 0) + 1
        for loc in a.locations or []:
            if loc.get("country"):
                countries.add(loc["country"])

    return schemas.DashboardStats(
        active_alerts=len(live),
        severity=schemas.SeverityBreakdown(**sev),
        awaiting_your_approval=len(pending_alerts_in_perimeter(db, user)),
        countries_affected=len(countries),
        updated_at=datetime.now(timezone.utc),
    )
