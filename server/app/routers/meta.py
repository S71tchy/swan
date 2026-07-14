"""Reference data + dashboard stats."""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.deps import get_current_user
from app.enums import CATEGORIES, INDUSTRIES, Flow, Severity, TransportMode
from app.models import Alert, User
from app.reference import PLACES, STANDARD_PROFILES, country_meta, place_label
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


@router.get("/meta/places")
def places(q: str = Query(default="")):
    """Geocoder stub: type-ahead over the gazetteer for the location picker."""
    ql = q.strip().lower()
    out = []
    for p in PLACES:
        if ql and ql not in p["name"].lower() and ql not in p["country"].lower():
            continue
        meta = country_meta(p["country"])
        out.append(
            {
                "name": p["name"],
                "code": p["code"],
                "country": p["country"],
                "country_name": meta["name"],
                "flag": meta["flag"],
                "lat": p["lat"],
                "lng": p["lng"],
                "label": place_label(p),
            }
        )
    return out


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
