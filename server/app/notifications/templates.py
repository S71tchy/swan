"""Notification template catalog + default EN/FR copy.

Each template has a stable `key`; the DB (EmailTemplate) can override subject/body
per locale, otherwise these defaults are used. Bodies use `{{token}}` placeholders
substituted at send time (see render.py). Keep the token set in each catalog entry
in sync with what the corresponding service function provides.
"""
from __future__ import annotations

LOCALES = ["en", "fr"]

# Token groups reused across several templates.
_ALERT_TOKENS = [
    "recipient_name", "title", "category", "sub_category", "severity",
    "locations", "valid_from", "valid_to", "impact", "action_plan",
    "author", "alert_url", "approvals_url", "app_url",
]

# Ordered catalog. `kind`: "broadcast" (subscription-driven) or "transactional"
# (always sent to a specific person). `tokens` drives the admin editor's palette.
CATALOG: list[dict] = [
    {
        "key": "alert_published", "kind": "broadcast",
        "label": "Alert published",
        "description": "Sent to subscribers when an alert is published in their zone.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_closed", "kind": "broadcast",
        "label": "Alert closed",
        "description": "Sent to subscribers when a published alert is closed.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_submitted", "kind": "broadcast",
        "label": "Alert submitted for approval",
        "description": "Sent to publishers subscribed to a zone when an alert is submitted.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "submission_received", "kind": "transactional",
        "label": "Submission received (to author)",
        "description": "Confirms to the author that their alert entered the approval queue.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_approved", "kind": "transactional",
        "label": "Alert approved & published (to author)",
        "description": "Tells the author their submitted alert was approved and published.",
        "tokens": _ALERT_TOKENS,
    },
    {
        "key": "alert_rejected", "kind": "transactional",
        "label": "Alert rejected (to author)",
        "description": "Tells the author their alert was rejected, with the reviewer's comment.",
        "tokens": _ALERT_TOKENS + ["comment"],
    },
    {
        "key": "user_registered", "kind": "transactional",
        "label": "New registration (to Rights Managers)",
        "description": "Notifies every Rights Manager that a new account is awaiting validation.",
        "tokens": ["recipient_name", "new_user_name", "new_user_email", "admin_url", "app_url"],
    },
    {
        "key": "registration_ack", "kind": "transactional",
        "label": "Registration acknowledgement (to registrant)",
        "description": "Confirms to a new registrant that their request was received.",
        "tokens": ["recipient_name", "app_url"],
    },
    {
        "key": "account_activated", "kind": "transactional",
        "label": "Account activated (to registrant)",
        "description": "Tells a registrant their account was validated and they can sign in.",
        "tokens": ["recipient_name", "role", "login_url", "app_url"],
    },
]

CATALOG_BY_KEY = {t["key"]: t for t in CATALOG}


def _alert_body_en(closing: str) -> str:
    return (
        "Hi {{recipient_name}},\n\n"
        "{{title}}\n"
        "Severity: {{severity}}  ·  Category: {{category}} / {{sub_category}}\n"
        "Locations: {{locations}}\n"
        "Valid: {{valid_from}} → {{valid_to}}\n"
        "Author: {{author}}\n\n"
        "Impact\n{{impact}}\n\n"
        "Action plan\n{{action_plan}}\n\n"
        f"{closing}\n{{{{alert_url}}}}\n\n— SWAN"
    )


def _alert_body_fr(closing: str) -> str:
    return (
        "Bonjour {{recipient_name}},\n\n"
        "{{title}}\n"
        "Gravité : {{severity}}  ·  Catégorie : {{category}} / {{sub_category}}\n"
        "Lieux : {{locations}}\n"
        "Validité : {{valid_from}} → {{valid_to}}\n"
        "Auteur : {{author}}\n\n"
        "Impact\n{{impact}}\n\n"
        "Plan d'action\n{{action_plan}}\n\n"
        f"{closing}\n{{{{alert_url}}}}\n\n— SWAN"
    )


# (key, locale) -> {subject, body}
DEFAULTS: dict[tuple[str, str], dict[str, str]] = {
    ("alert_published", "en"): {
        "subject": "[SWAN] {{severity}} · {{title}}",
        "body": _alert_body_en("View on the network map:"),
    },
    ("alert_published", "fr"): {
        "subject": "[SWAN] {{severity}} · {{title}}",
        "body": _alert_body_fr("Voir sur la carte du réseau :"),
    },
    ("alert_closed", "en"): {
        "subject": "[SWAN] Closed · {{title}}",
        "body": _alert_body_en("This alert has been closed and removed from the map:"),
    },
    ("alert_closed", "fr"): {
        "subject": "[SWAN] Clôturée · {{title}}",
        "body": _alert_body_fr("Cette alerte a été clôturée et retirée de la carte :"),
    },
    ("alert_submitted", "en"): {
        "subject": "[SWAN] Awaiting approval · {{title}}",
        "body": _alert_body_en("An alert in your zone needs review in the approval queue:").replace(
            "{{alert_url}}", "{{approvals_url}}"
        ),
    },
    ("alert_submitted", "fr"): {
        "subject": "[SWAN] En attente d'approbation · {{title}}",
        "body": _alert_body_fr("Une alerte de votre zone attend une revue dans la file d'approbation :").replace(
            "{{alert_url}}", "{{approvals_url}}"
        ),
    },
    ("submission_received", "en"): {
        "subject": "[SWAN] Submitted for approval · {{title}}",
        "body": _alert_body_en("Your alert was submitted and is now awaiting a publisher's approval:"),
    },
    ("submission_received", "fr"): {
        "subject": "[SWAN] Soumise pour approbation · {{title}}",
        "body": _alert_body_fr("Votre alerte a été soumise et attend l'approbation d'un publieur :"),
    },
    ("alert_approved", "en"): {
        "subject": "[SWAN] Published · {{title}}",
        "body": _alert_body_en("Good news — your alert was approved and is now published:"),
    },
    ("alert_approved", "fr"): {
        "subject": "[SWAN] Publiée · {{title}}",
        "body": _alert_body_fr("Bonne nouvelle — votre alerte a été approuvée et est publiée :"),
    },
    ("alert_rejected", "en"): {
        "subject": "[SWAN] Changes requested · {{title}}",
        "body": (
            "Hi {{recipient_name}},\n\n"
            "Your alert \"{{title}}\" was returned for changes.\n\n"
            "Reviewer comment\n{{comment}}\n\n"
            "It's editable again as a draft — update and resubmit:\n{{alert_url}}\n\n— SWAN"
        ),
    },
    ("alert_rejected", "fr"): {
        "subject": "[SWAN] Modifications demandées · {{title}}",
        "body": (
            "Bonjour {{recipient_name}},\n\n"
            "Votre alerte « {{title}} » a été renvoyée pour modification.\n\n"
            "Commentaire du relecteur\n{{comment}}\n\n"
            "Elle est de nouveau modifiable en brouillon — corrigez et resoumettez :\n{{alert_url}}\n\n— SWAN"
        ),
    },
    ("user_registered", "en"): {
        "subject": "[SWAN] New account awaiting validation · {{new_user_name}}",
        "body": (
            "Hi {{recipient_name}},\n\n"
            "A new account has self-registered and needs review:\n\n"
            "  Name: {{new_user_name}}\n  Email: {{new_user_email}}\n\n"
            "It currently has no rights. Configure and validate it in Rights administration:\n"
            "{{admin_url}}\n\n— SWAN"
        ),
    },
    ("user_registered", "fr"): {
        "subject": "[SWAN] Nouveau compte à valider · {{new_user_name}}",
        "body": (
            "Bonjour {{recipient_name}},\n\n"
            "Un nouveau compte s'est enregistré et attend une revue :\n\n"
            "  Nom : {{new_user_name}}\n  E-mail : {{new_user_email}}\n\n"
            "Il n'a aucun droit pour l'instant. Configurez-le et validez-le dans l'administration des droits :\n"
            "{{admin_url}}\n\n— SWAN"
        ),
    },
    ("registration_ack", "en"): {
        "subject": "[SWAN] Welcome — your account is pending validation",
        "body": (
            "Hi {{recipient_name}},\n\n"
            "Thanks for registering for SWAN. Your account has been created and is "
            "awaiting validation by a Rights Manager. You'll receive an email once it's "
            "activated and you can start using the platform.\n\n{{app_url}}\n\n— SWAN"
        ),
    },
    ("registration_ack", "fr"): {
        "subject": "[SWAN] Bienvenue — votre compte est en attente de validation",
        "body": (
            "Bonjour {{recipient_name}},\n\n"
            "Merci de votre inscription à SWAN. Votre compte a été créé et attend la "
            "validation d'un gestionnaire des droits. Vous recevrez un e-mail dès qu'il "
            "sera activé et que vous pourrez utiliser la plateforme.\n\n{{app_url}}\n\n— SWAN"
        ),
    },
    ("account_activated", "en"): {
        "subject": "[SWAN] Your account is now active",
        "body": (
            "Hi {{recipient_name}},\n\n"
            "Your SWAN account has been validated and is now active"
            " (role: {{role}}). You can sign in here:\n{{login_url}}\n\n— SWAN"
        ),
    },
    ("account_activated", "fr"): {
        "subject": "[SWAN] Votre compte est désormais actif",
        "body": (
            "Bonjour {{recipient_name}},\n\n"
            "Votre compte SWAN a été validé et est désormais actif"
            " (rôle : {{role}}). Connectez-vous ici :\n{{login_url}}\n\n— SWAN"
        ),
    },
}


def default_template(key: str, locale: str) -> dict[str, str]:
    """Default {subject, body} for (key, locale), falling back to English."""
    return DEFAULTS.get((key, locale)) or DEFAULTS.get((key, "en")) or {"subject": "", "body": ""}
