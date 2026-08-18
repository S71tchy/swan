"""Notification template catalog + default EN/FR copy.

Each template has a stable `key`; the DB (EmailTemplate) can override subject/body
per locale, otherwise these defaults are used. Bodies use `{{token}}` placeholders
substituted at send time (see render.py). Keep the token set in each catalog entry
in sync with what the corresponding service function provides.
"""
from __future__ import annotations

LOCALES = ["en", "fr"]

# Token groups reused across several templates.
# The *_html / flags tokens render bundled circular country flags as inline
# images (see render.py); the plain `locations`/`countries` stay text-only.
_ALERT_TOKENS = [
    "recipient_name", "title", "category", "sub_category", "severity",
    "locations", "locations_html", "countries", "countries_html", "flags",
    "valid_from", "valid_to", "impact", "action_plan",
    "author", "alert_url", "approvals_url", "app_url",
]

# Ordered catalog. Every entry is a *trigger*, and this list is the single
# source of truth for what a user can subscribe to — `enums.NOTIFICATION_EVENTS`
# is derived from it, so adding a template here makes it subscribable without
# touching the subscription code or the editor UI. (It used to be a hard-coded
# list of three, repeated again in SubscriptionEditor.tsx; six of the nine
# triggers were unreachable as a result.)
#
#   event     stable name stored in NotificationSubscription.events
#   audience  who the mail is addressed to, which decides how recipients are
#             resolved: "zone" fans out to subscribers whose zone matches the
#             alert, "participant" goes to the one person the workflow names
#             (the author, the registrant), "managers" to Rights Managers.
#   filters   which subscription filters mean anything for this trigger. Empty
#             for the participant/manager triggers: "your alert was rejected" is
#             about your own item, so filtering it by zone would only ever drop
#             mail the recipient is expecting. The editor hides what isn't listed.
#   kind      the admin editor's existing label, unchanged.
CATALOG: list[dict] = [
    {
        "key": "alert_published", "event": "published", "audience": "zone",
        "filters": ['zone', 'category', 'severity'], "kind": "broadcast",
        "label": "Alert published",
        "description": "Sent to subscribers when an alert is published in their zone.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_closed", "event": "closed", "audience": "zone",
        "filters": ['zone', 'category', 'severity'], "kind": "broadcast",
        "label": "Alert closed",
        "description": "Sent to subscribers when a published alert is closed.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_submitted", "event": "submitted", "audience": "zone",
        "filters": ['zone', 'category', 'severity'], "kind": "broadcast",
        "label": "Alert submitted for approval",
        "description": "Sent to publishers subscribed to a zone when an alert is submitted.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "submission_received", "event": "submission_received", "audience": "participant",
        "filters": [], "kind": "transactional",
        "label": "Submission received (to author)",
        "description": "Confirms to the author that their alert entered the approval queue.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_approved", "event": "approved", "audience": "participant",
        "filters": [], "kind": "transactional",
        "label": "Alert approved & published (to author)",
        "description": "Tells the author their submitted alert was approved and published.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_rejected", "event": "rejected", "audience": "participant",
        "filters": [], "kind": "transactional",
        "label": "Alert rejected (to author)",
        "description": "Tells the author their alert was rejected, with the reviewer's comment.",
        "tokens": _ALERT_TOKENS + ["comment"],
    },
    {
        "key": "user_registered", "event": "user_registered", "audience": "managers",
        "filters": [], "kind": "transactional",
        "label": "New registration (to Rights Managers)",
        "description": "Notifies every Rights Manager that a new account is awaiting validation.",
        "tokens": ["recipient_name", "new_user_name", "new_user_email", "admin_url", "app_url"],
    },
    {
        "key": "registration_ack", "event": "registration_ack", "audience": "participant",
        "filters": [], "kind": "transactional",
        "label": "Registration acknowledgement (to registrant)",
        "description": "Confirms to a new registrant that their request was received.",
        "tokens": ["recipient_name", "app_url"],
    },
    {
        "key": "account_activated", "event": "account_activated", "audience": "participant",
        "filters": [], "kind": "transactional",
        "label": "Account activated (to registrant)",
        "description": "Tells a registrant their account was validated and they can sign in.",
        "tokens": ["recipient_name", "role", "login_url", "app_url"],
    },
]

CATALOG_BY_KEY = {t["key"]: t for t in CATALOG}
CATALOG_BY_EVENT = {t["event"]: t for t in CATALOG}

# Subscription event names, in catalog order.
EVENTS = [t["event"] for t in CATALOG]
# Triggers a *new* user is subscribed to by default. Everything addressed to
# them personally: once delivery is subscription-driven, an empty subscription
# list would mean nobody is ever told their own alert was rejected. Managers
# additionally get "user_registered" (see subscriptions.default_events).
DEFAULT_PARTICIPANT_EVENTS = [t["event"] for t in CATALOG if t["audience"] == "participant"]
MANAGER_EVENTS = [t["event"] for t in CATALOG if t["audience"] == "managers"]
ZONE_EVENTS = [t["event"] for t in CATALOG if t["audience"] == "zone"]


def event_filters(event: str) -> list[str]:
    """Which subscription filters apply to this trigger ([] = none do)."""
    entry = CATALOG_BY_EVENT.get(event)
    return list(entry["filters"]) if entry else []


def _alert_html(lang: str, intro: str, cta_label: str, cta_token: str = "alert_url") -> str:
    """Shared HTML body for the alert-centric templates. `intro` is a full HTML
    sentence; `cta_token` is the URL token the button links to."""
    if lang == "fr":
        hi = "Bonjour {{recipient_name}},"
        loc_l, val_l, auth_l, imp, act = "Lieux :", "Validité :", "Auteur :", "Impact", "Plan d'action"
    else:
        hi = "Hi {{recipient_name}},"
        loc_l, val_l, auth_l, imp, act = "Locations:", "Valid:", "Author:", "Impact", "Action plan"
    cta = '<a class="btn" href="{{' + cta_token + '}}">' + cta_label + "</a>"
    grey = '<span style="color:#6b7688;">'
    return (
        "<p>" + hi + "</p>"
        "<h2>{{flags}}&nbsp;{{title}}</h2>"
        "<p><strong>{{severity}}</strong> &middot; {{category}} / {{sub_category}}</p>"
        "<p>" + grey + loc_l + "</span><br>{{locations_html}}<br>"
        + grey + val_l + "</span> {{valid_from}} &rarr; {{valid_to}}<br>"
        + grey + auth_l + "</span> {{author}}</p>"
        "<p>" + intro + "</p>"
        "<h3>" + imp + "</h3><p>{{impact}}</p>"
        "<h3>" + act + "</h3><p>{{action_plan}}</p>"
        "<p>" + cta + "</p>"
    )


# (key, locale) -> {subject, body(HTML)}
DEFAULTS: dict[tuple[str, str], dict[str, str]] = {
    ("alert_published", "en"): {
        "subject": "[SWAN] {{severity}} · {{title}}",
        "body": _alert_html("en", "This alert is now live on the network map.", "View on the map"),
    },
    ("alert_published", "fr"): {
        "subject": "[SWAN] {{severity}} · {{title}}",
        "body": _alert_html("fr", "Cette alerte est désormais active sur la carte du réseau.", "Voir sur la carte"),
    },
    ("alert_closed", "en"): {
        "subject": "[SWAN] Closed · {{title}}",
        "body": _alert_html("en", "This alert has been <strong>closed</strong> and removed from the map.", "View on the map"),
    },
    ("alert_closed", "fr"): {
        "subject": "[SWAN] Clôturée · {{title}}",
        "body": _alert_html("fr", "Cette alerte a été <strong>clôturée</strong> et retirée de la carte.", "Voir sur la carte"),
    },
    ("alert_submitted", "en"): {
        "subject": "[SWAN] Awaiting approval · {{title}}",
        "body": _alert_html("en", "An alert in your zone is awaiting review in the approval queue.", "Open the approval queue", "approvals_url"),
    },
    ("alert_submitted", "fr"): {
        "subject": "[SWAN] En attente d'approbation · {{title}}",
        "body": _alert_html("fr", "Une alerte de votre zone attend une revue dans la file d'approbation.", "Ouvrir la file d'approbation", "approvals_url"),
    },
    ("submission_received", "en"): {
        "subject": "[SWAN] Submitted for approval · {{title}}",
        "body": _alert_html("en", "Your alert was submitted and is now awaiting a publisher's approval.", "View your alert"),
    },
    ("submission_received", "fr"): {
        "subject": "[SWAN] Soumise pour approbation · {{title}}",
        "body": _alert_html("fr", "Votre alerte a été soumise et attend l'approbation d'un publieur.", "Voir votre alerte"),
    },
    ("alert_approved", "en"): {
        "subject": "[SWAN] Published · {{title}}",
        "body": _alert_html("en", "Good news — your alert was <strong>approved</strong> and is now published.", "View on the map"),
    },
    ("alert_approved", "fr"): {
        "subject": "[SWAN] Publiée · {{title}}",
        "body": _alert_html("fr", "Bonne nouvelle — votre alerte a été <strong>approuvée</strong> et est publiée.", "Voir sur la carte"),
    },
    ("alert_rejected", "en"): {
        "subject": "[SWAN] Changes requested · {{title}}",
        "body": (
            "<p>Hi {{recipient_name}},</p>"
            "<p>Your alert <strong>“{{title}}”</strong> was returned for changes.</p>"
            "<h3>Reviewer comment</h3><blockquote>{{comment}}</blockquote>"
            "<p>It's editable again as a draft — update and resubmit.</p>"
            '<p><a class="btn" href="{{alert_url}}">Edit your draft</a></p>'
        ),
    },
    ("alert_rejected", "fr"): {
        "subject": "[SWAN] Modifications demandées · {{title}}",
        "body": (
            "<p>Bonjour {{recipient_name}},</p>"
            "<p>Votre alerte <strong>«&nbsp;{{title}}&nbsp;»</strong> a été renvoyée pour modification.</p>"
            "<h3>Commentaire du relecteur</h3><blockquote>{{comment}}</blockquote>"
            "<p>Elle est de nouveau modifiable en brouillon — corrigez et resoumettez.</p>"
            '<p><a class="btn" href="{{alert_url}}">Modifier le brouillon</a></p>'
        ),
    },
    ("user_registered", "en"): {
        "subject": "[SWAN] New account awaiting validation · {{new_user_name}}",
        "body": (
            "<p>Hi {{recipient_name}},</p>"
            "<p>A new account has self-registered and needs review:</p>"
            "<p><strong>{{new_user_name}}</strong><br>"
            '<span style="color:#6b7688;">{{new_user_email}}</span></p>'
            "<p>It currently has <strong>no rights</strong>. Configure and validate it in Rights administration.</p>"
            '<p><a class="btn" href="{{admin_url}}">Review the account</a></p>'
        ),
    },
    ("user_registered", "fr"): {
        "subject": "[SWAN] Nouveau compte à valider · {{new_user_name}}",
        "body": (
            "<p>Bonjour {{recipient_name}},</p>"
            "<p>Un nouveau compte s'est enregistré et attend une revue :</p>"
            "<p><strong>{{new_user_name}}</strong><br>"
            '<span style="color:#6b7688;">{{new_user_email}}</span></p>'
            "<p>Il n'a <strong>aucun droit</strong> pour l'instant. Configurez-le et validez-le dans l'administration des droits.</p>"
            '<p><a class="btn" href="{{admin_url}}">Examiner le compte</a></p>'
        ),
    },
    ("registration_ack", "en"): {
        "subject": "[SWAN] Welcome — your account is pending validation",
        "body": (
            "<p>Hi {{recipient_name}},</p>"
            "<p>Thanks for registering for SWAN. Your account has been created and is "
            "awaiting validation by a Rights Manager.</p>"
            "<p>You'll receive an email once it's activated and you can start using the platform.</p>"
        ),
    },
    ("registration_ack", "fr"): {
        "subject": "[SWAN] Bienvenue — votre compte est en attente de validation",
        "body": (
            "<p>Bonjour {{recipient_name}},</p>"
            "<p>Merci de votre inscription à SWAN. Votre compte a été créé et attend la "
            "validation d'un gestionnaire des droits.</p>"
            "<p>Vous recevrez un e-mail dès qu'il sera activé et que vous pourrez utiliser la plateforme.</p>"
        ),
    },
    ("account_activated", "en"): {
        "subject": "[SWAN] Your account is now active",
        "body": (
            "<p>Hi {{recipient_name}},</p>"
            "<p>Your SWAN account has been validated and is now <strong>active</strong> "
            "(role: {{role}}). You can sign in now.</p>"
            '<p><a class="btn" href="{{login_url}}">Sign in to SWAN</a></p>'
        ),
    },
    ("account_activated", "fr"): {
        "subject": "[SWAN] Votre compte est désormais actif",
        "body": (
            "<p>Bonjour {{recipient_name}},</p>"
            "<p>Votre compte SWAN a été validé et est désormais <strong>actif</strong> "
            "(rôle : {{role}}). Vous pouvez vous connecter.</p>"
            '<p><a class="btn" href="{{login_url}}">Se connecter à SWAN</a></p>'
        ),
    },
}


def default_template(key: str, locale: str) -> dict[str, str]:
    """Default {subject, body} for (key, locale), falling back to English."""
    return DEFAULTS.get((key, locale)) or DEFAULTS.get((key, "en")) or {"subject": "", "body": ""}
