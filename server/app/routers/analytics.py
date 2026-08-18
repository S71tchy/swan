"""Analytics — statistics across the whole alert corpus, not just what is live.

Three things here are deliberate.

**Never load whole Alert rows.** `Alert.picture_url` holds the illustration as an
inline `data:` URI, so a naive `db.query(Alert).all()` over the corpus pulls
megabytes of base64 into memory to count severities. Every query below selects an
explicit column projection instead, which is also exactly the set the drill-down
table and CSV need — the picture is never read on this screen at all.

**Aggregates are computed server-side.** The browser receives counts, not alerts.
That is what lets this screen cover a corpus of any size while the feed, which
inlines pictures, cannot.

**Visibility is split, and the split is the point.** Everyone may see the
*corpus* — published, closed and expired alerts, which is what the live feed
already shows them. Only Rights Managers see the *pipeline*: drafts, submissions,
rejections and per-author throughput. Draft work has never been visible to anyone
but its author in SWAN, and a statistics screen must not be the thing that
quietly changes that. `pipeline` is simply absent from the response for everyone
else, so there is no client-side gate to forget.

Dates: an alert is placed in the period it became *real* — `published_at` when it
has one, else `created_at`. A draft has never been published, so it can only be
dated by when it was written; mixing the two would otherwise leave the pipeline
counts unable to answer "how many drafts this month".
"""
from __future__ import annotations

import csv
import io
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import median

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.deps import get_current_user
from app.models import Alert, User
from app.reference import country_meta
from app.rights import is_rights_manager

router = APIRouter(prefix="/analytics", tags=["analytics"])

# What everyone may see aggregated: the alerts that reached the network. Drafts,
# submissions and rejections are pipeline, and are gated separately below.
CORPUS_STATUSES = ("published", "closed", "expired")

# Column projection — everything the aggregates, the table and the CSV need, and
# nothing else. Notably not `picture_url`; see the module docstring.
_COLUMNS = (
    Alert.id, Alert.title, Alert.status, Alert.severity, Alert.category,
    Alert.sub_category, Alert.industry, Alert.locations, Alert.author_id,
    Alert.created_at, Alert.submitted_at, Alert.published_at, Alert.closed_at,
    Alert.valid_from, Alert.valid_to,
)


class Row:
    """A projected alert row, with the derived bits every aggregate wants."""

    __slots__ = (
        "id", "title", "status", "severity", "category", "sub_category", "industry",
        "locations", "author_id", "created_at", "submitted_at", "published_at",
        "closed_at", "valid_from", "valid_to",
    )

    def __init__(self, r):
        (self.id, self.title, self.status, self.severity, self.category,
         self.sub_category, self.industry, self.locations, self.author_id,
         self.created_at, self.submitted_at, self.published_at, self.closed_at,
         self.valid_from, self.valid_to) = r

    @property
    def effective_at(self) -> datetime | None:
        """When this alert counts as having happened."""
        return self.published_at or self.created_at

    @property
    def effective_date(self) -> date | None:
        dt = self.effective_at
        return dt.date() if dt else None

    @property
    def countries(self) -> list[str]:
        # A zone block carries `countries` (Hormuz is IR + OM) instead of the
        # singular `country`, so both are read. Without the plural, alerts filed
        # on a zone would silently vanish from every country breakdown rather
        # than showing up as uncountried.
        out: list[str] = []
        for loc in self.locations or []:
            for raw in [loc.get("country"), *(loc.get("countries") or [])]:
                code = (raw or "").upper()
                if code:
                    out.append(code)
        return out

    @property
    def modes(self) -> list[str]:
        out: list[str] = []
        for loc in self.locations or []:
            for m in loc.get("modes") or []:
                if m not in out:
                    out.append(m)
        return out


# --------------------------------------------------------------------------- #
# Range + bucketing
# --------------------------------------------------------------------------- #
def _bucket_for(span_days: int) -> str:
    """Pick a bucket that yields a readable number of columns rather than a
    forest: roughly 6-30 points across any range."""
    if span_days <= 31:
        return "day"
    if span_days <= 200:
        return "week"
    return "month"


def _bucket_start(d: date, bucket: str) -> date:
    if bucket == "day":
        return d
    if bucket == "week":
        return d - timedelta(days=d.weekday())  # ISO weeks, Monday-anchored
    return d.replace(day=1)


def _bucket_steps(start: date, end: date, bucket: str) -> list[date]:
    """Every bucket in the range, including empty ones — a gap in the data is a
    quiet period, and dropping it would silently redraw the x-axis."""
    out: list[date] = []
    cur = _bucket_start(start, bucket)
    last = _bucket_start(end, bucket)
    while cur <= last:
        out.append(cur)
        if bucket == "day":
            cur += timedelta(days=1)
        elif bucket == "week":
            cur += timedelta(days=7)
        else:
            cur = (cur.replace(day=28) + timedelta(days=4)).replace(day=1)
    return out


def _resolve_range(date_from: date | None, date_to: date | None) -> tuple[date, date]:
    today = date.today()
    end = date_to or today
    start = date_from or (end - timedelta(days=179))  # ~6 months
    if start > end:
        start, end = end, start
    return start, end


# --------------------------------------------------------------------------- #
# Fetch + filter
# --------------------------------------------------------------------------- #
def _fetch(db: Session, statuses: tuple[str, ...]) -> list[Row]:
    q = db.query(*_COLUMNS).filter(Alert.status.in_(statuses))
    return [Row(r) for r in q.all()]


def _apply_filters(
    rows: list[Row],
    start: date,
    end: date,
    country: str | None,
    category: str | None,
    severity: str | None,
) -> list[Row]:
    country = (country or "").upper() or None
    out = []
    for r in rows:
        d = r.effective_date
        if d is None or d < start or d > end:
            continue
        if severity and r.severity != severity:
            continue
        if category and r.category != category:
            continue
        if country and country not in r.countries:
            continue
        out.append(r)
    return out


def _ranked(counter: Counter, limit: int = 12) -> list[schemas.NamedCount]:
    return [
        schemas.NamedCount(name=name, count=count)
        for name, count in counter.most_common(limit)
    ]


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
@router.get("/summary", response_model=schemas.AnalyticsSummary)
def summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    country: str | None = None,
    category: str | None = None,
    severity: str | None = None,
    bucket: str | None = Query(default=None, pattern="^(day|week|month)$"),
):
    start, end = _resolve_range(date_from, date_to)
    span = (end - start).days
    bucket = bucket or _bucket_for(span)
    manager = is_rights_manager(db, user)
    today = date.today()

    corpus = _fetch(db, CORPUS_STATUSES)
    rows = _apply_filters(corpus, start, end, country, category, severity)

    # Previous window of equal length, for the period-on-period delta. Without
    # it a total is a number with nothing to compare against.
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=span)
    prev = _apply_filters(corpus, prev_start, prev_end, country, category, severity)

    # Volume over time, split by severity — the lead chart.
    steps = _bucket_steps(start, end, bucket)
    by_bucket: dict[date, Counter] = {s: Counter() for s in steps}
    for r in rows:
        key = _bucket_start(r.effective_date, bucket)
        if key in by_bucket:
            by_bucket[key][r.severity or "info"] += 1
    series = [
        schemas.SeriesPoint(
            bucket=s.isoformat(),
            info=by_bucket[s].get("info", 0),
            watch=by_bucket[s].get("watch", 0),
            warning=by_bucket[s].get("warning", 0),
            critical=by_bucket[s].get("critical", 0),
            total=sum(by_bucket[s].values()),
        )
        for s in steps
    ]

    countries = Counter()
    for r in rows:
        for c in set(r.countries):  # one alert in two ports of a country counts once
            countries[c] += 1
    modes = Counter()
    for r in rows:
        for m in r.modes:
            modes[m] += 1

    live_now = sum(
        1
        for r in rows
        if r.status == "published"
        and r.valid_from
        and r.valid_from <= today
        and (r.valid_to is None or r.valid_to >= today)
    )

    # How long a published alert stayed up, in days. Open-ended alerts ("until
    # further notice") have no end and are counted separately rather than
    # silently treated as zero-length or as running to today.
    durations = [
        (r.closed_at.date() - r.published_at.date()).days
        for r in rows
        if r.published_at and r.closed_at
    ]

    payload = schemas.AnalyticsSummary(
        range=schemas.RangeInfo(
            start=start.isoformat(), end=end.isoformat(), bucket=bucket, days=span + 1
        ),
        totals=schemas.AnalyticsTotals(
            alerts=len(rows),
            previous_alerts=len(prev),
            live_now=live_now,
            published=sum(1 for r in rows if r.status == "published"),
            closed=sum(1 for r in rows if r.status == "closed"),
            expired=sum(1 for r in rows if r.status == "expired"),
            countries=len(countries),
            authors=len({r.author_id for r in rows}),
            open_ended=sum(1 for r in rows if r.published_at and r.valid_to is None),
            median_days_live=(median(durations) if durations else None),
        ),
        severity=schemas.SeverityBreakdown(
            info=sum(1 for r in rows if r.severity == "info"),
            watch=sum(1 for r in rows if r.severity == "watch"),
            warning=sum(1 for r in rows if r.severity == "warning"),
            critical=sum(1 for r in rows if r.severity == "critical"),
        ),
        series=series,
        by_category=_ranked(Counter(r.category for r in rows if r.category)),
        by_sub_category=_ranked(Counter(r.sub_category for r in rows if r.sub_category)),
        by_industry=_ranked(Counter(r.industry for r in rows if r.industry)),
        by_mode=_ranked(modes),
        by_country=[
            schemas.CountryCount(code=code, name=country_meta(code)["name"], count=count)
            for code, count in countries.most_common(12)
        ],
        pipeline=_pipeline(db, start, end, country, category, severity) if manager else None,
    )
    return payload


def _pipeline(
    db: Session,
    start: date,
    end: date,
    country: str | None,
    category: str | None,
    severity: str | None,
) -> schemas.PipelineStats:
    """Rights-Manager-only view of work in flight.

    Rejection rate is measured against alerts that *reached* a decision — a draft
    nobody submitted is not evidence about review quality — and is derived from
    current status, so an alert rejected then fixed and published counts as
    published. That understates historical rejections and is the honest reading
    of "how much is being turned back right now"; the audit log is where the full
    history lives if that is ever wanted.
    """
    rows = _apply_filters(
        _fetch(db, ("draft", "submitted", "rejected", "published", "closed", "expired")),
        start, end, country, category, severity,
    )
    counts = Counter(r.status for r in rows)
    decided = counts["published"] + counts["closed"] + counts["expired"] + counts["rejected"]

    latencies = [
        (r.published_at - r.submitted_at).total_seconds() / 3600
        for r in rows
        if r.published_at and r.submitted_at and r.published_at >= r.submitted_at
    ]
    # An alert published without ever being submitted was published directly by
    # someone holding the rights — the Submit-vs-Publish split, measured.
    published_rows = [r for r in rows if r.published_at]
    via_approval = sum(1 for r in published_rows if r.submitted_at)

    authors = Counter(r.author_id for r in rows)
    names = {
        u.id: u.name
        for u in db.query(User).filter(User.id.in_([a for a, _ in authors.most_common(8)])).all()
    }

    return schemas.PipelineStats(
        draft=counts["draft"],
        submitted=counts["submitted"],
        rejected=counts["rejected"],
        published=counts["published"],
        closed=counts["closed"],
        rejection_rate=(counts["rejected"] / decided) if decided else None,
        median_approval_hours=(median(latencies) if latencies else None),
        via_approval=via_approval,
        direct_publish=len(published_rows) - via_approval,
        top_authors=[
            schemas.NamedCount(name=names.get(aid, "Unknown"), count=n)
            for aid, n in authors.most_common(8)
        ],
    )


# --------------------------------------------------------------------------- #
# Drill-down rows + CSV
# --------------------------------------------------------------------------- #
def _visible_statuses(db: Session, user: User) -> tuple[str, ...]:
    if is_rights_manager(db, user):
        return ("draft", "submitted", "rejected", "published", "closed", "expired")
    return CORPUS_STATUSES


@router.get("/alerts", response_model=schemas.AnalyticsRows)
def rows(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    country: str | None = None,
    category: str | None = None,
    severity: str | None = None,
    limit: int = Query(default=200, le=1000),
):
    """The alerts behind the numbers. Capped, with `total` so the screen can say
    how much it is not showing rather than implying the table is the whole set."""
    start, end = _resolve_range(date_from, date_to)
    matched = _apply_filters(
        _fetch(db, _visible_statuses(db, user)), start, end, country, category, severity
    )
    matched.sort(key=lambda r: (r.effective_at is None, r.effective_at), reverse=True)
    return schemas.AnalyticsRows(
        total=len(matched),
        rows=[_row_out(r) for r in matched[:limit]],
    )


def _row_out(r: Row) -> schemas.AnalyticsRow:
    codes: list[str] = []
    for c in r.countries:
        if c not in codes:
            codes.append(c)
    return schemas.AnalyticsRow(
        id=r.id,
        title=r.title,
        status=r.status,
        severity=r.severity,
        category=r.category,
        sub_category=r.sub_category or "",
        industry=r.industry,
        countries=codes,
        modes=r.modes,
        effective_at=r.effective_at,
        published_at=r.published_at,
        closed_at=r.closed_at,
        valid_from=r.valid_from,
        valid_to=r.valid_to,
    )


@router.get("/export.csv", include_in_schema=False)
def export_csv(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    country: str | None = None,
    category: str | None = None,
    severity: str | None = None,
):
    """The filtered set as CSV — the whole thing, not the table's capped page.

    Same visibility rules as everywhere else here: a non-manager exports the
    corpus, a manager exports the pipeline too.
    """
    start, end = _resolve_range(date_from, date_to)
    matched = _apply_filters(
        _fetch(db, _visible_statuses(db, user)), start, end, country, category, severity
    )
    matched.sort(key=lambda r: (r.effective_at is None, r.effective_at), reverse=True)

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow([
        "id", "title", "status", "severity", "category", "sub_category", "industry",
        "countries", "modes", "effective_at", "published_at", "closed_at",
        "valid_from", "valid_to",
    ])
    for r in matched:
        w.writerow([
            r.id, r.title, r.status, r.severity, r.category, r.sub_category or "",
            r.industry or "", " ".join(dict.fromkeys(r.countries)), " ".join(r.modes),
            r.effective_at.isoformat() if r.effective_at else "",
            r.published_at.isoformat() if r.published_at else "",
            r.closed_at.isoformat() if r.closed_at else "",
            r.valid_from.isoformat() if r.valid_from else "",
            r.valid_to.isoformat() if r.valid_to else "",
        ])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return StreamingResponse(
        io.StringIO(buf.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="swan-alerts-{stamp}.csv"'},
    )
