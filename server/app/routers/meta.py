"""Reference data + dashboard stats."""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import email_policy, schemas
from app.database import get_db
from app.deps import get_current_user
from app.enums import CATEGORIES, INDUSTRIES, ROLES, Flow, Severity, TransportMode
from app.models import Alert, Category, Industry, Place, User, Zone
from app.reference import COUNTRY_CATALOGUE, STANDARD_PROFILES, country_meta
from app.notifications.templates import CATALOG
from app.rights import pending_alerts_in_perimeter

router = APIRouter(tags=["meta"])


@router.get("/meta/taxonomy")
def taxonomy(db: Session = Depends(get_db)):
    """Category tree, modes, flows, severities, industries for the create form.

    Categories and industries come from their tables, which Rights Managers edit
    under Settings → Reference data. The code lists are the fallback for an
    unseeded database only: an empty table would leave the create form with no
    category to pick and therefore no way to raise an alert at all, which is the
    same failure mode an empty `places` table has.

    Modes, flows and severities stay in code on purpose — those are true enums
    with behaviour hanging off them (map colours, subscription thresholds,
    filter vocabulary), not labels.
    """
    rows = db.query(Category).order_by(Category.position, Category.name).all()
    categories = {c.name: list(c.sub_categories or []) for c in rows} or CATEGORIES
    industry_rows = db.query(Industry).order_by(Industry.position, Industry.name).all()
    industries = [i.name for i in industry_rows] or INDUSTRIES
    return {
        "categories": categories,
        "industries": industries,
        "modes": [m.value for m in TransportMode],
        "flows": [f.value for f in Flow],
        "severities": [s.value for s in Severity],
        "profiles": list(STANDARD_PROFILES.keys()),
        "roles": ROLES,
    }


@router.get("/meta/notification-triggers", response_model=list[schemas.NotificationTrigger])
def notification_triggers(_: User = Depends(get_current_user)):
    """Everything a subscription can be built from, derived from the template
    catalog. The editor used to hard-code three events, which is why the other
    six triggers had no way to be turned on or off."""
    return [
        schemas.NotificationTrigger(
            event=t["event"], label=t["label"], description=t["description"],
            audience=t["audience"], filters=list(t["filters"]),
        )
        for t in CATALOG
    ]


@router.get("/meta/zones", response_model=list[schemas.ZoneRow])
def zones(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Zones offered on the create-alert form.

    Readable by anyone who can file an alert; editing them is Rights-Manager
    work under Settings. Geometry ships with the list because the form previews
    the shape on its map, and zones are few and small -- unlike alert pictures,
    which is why the feed is careful and this list is not.
    """
    rows = db.query(Zone).order_by(Zone.name).all()
    return [
        schemas.ZoneRow(
            code=z.code, name=z.name, kind=z.kind,
            countries=list(z.countries or []),
            country_names=[country_meta(c)["name"] for c in (z.countries or [])],
            geometry=z.geometry or {}, lat=z.lat, lng=z.lng, radius_m=z.radius_m,
            aliases=list(z.aliases or []), notes=z.notes or "", usage=0,
        )
        for z in rows
    ]


@router.get("/meta/registration-policy", response_model=schemas.RegistrationPolicy)
def registration_policy(db: Session = Depends(get_db)):
    """Whether self-registration is restricted to corporate addresses.

    Unauthenticated, because the login screen shows the hint before anyone has
    signed in — so it returns a boolean and *not* the blocked list. The list is
    internal configuration; an anonymous caller has no business enumerating it,
    and the refusal message on POST /auth/register already names the one domain
    that actually mattered to them.
    """
    return schemas.RegistrationPolicy(corporate_only=bool(email_policy.active_rules(db)))


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
