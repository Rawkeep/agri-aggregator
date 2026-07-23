"""
Pytest-Gates fuer Task ui-integration: index.html, App-Shell (js/app.js)
und druckoptimiertes Styling (css/style.css).

Prueft Existenz der Artefakte, gueltige JS-Syntax von js/app.js (node
--check), dass index.html alle Fachmodule ausschliesslich lokal per
relativem Pfad per <script>-Tag einbindet (kein externer <script>/<link>
auf http(s)-CDN, kein fetch zu externen Domains), dass alle geforderten
UI-Bereiche/Elemente (Ankauf, Beleg, Bestand, Verkauf mit Margen-Anzeige,
Verlust-/Schwund mit Post-Harvest-Loss-KPI, Preispflege, CSV-Import/
-Export, Sprachumschalter FR/EN) per ID/Textmuster vorhanden sind, dass
css/style.css eine @media print-Regel fuer den Auszahlungsbeleg enthaelt
und dass js/app.js bei Sprachwechsel sichtbare Texte ueber js/i18n.js
(AgriI18n) aktualisiert.
"""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
JS_DIR = PROJECT_ROOT / "js"
CSS_DIR = PROJECT_ROOT / "css"

INDEX_HTML_PATH = PROJECT_ROOT / "index.html"
APP_JS_PATH = JS_DIR / "app.js"
STYLE_CSS_PATH = CSS_DIR / "style.css"

REQUIRED_MODULE_FILES = [
    "models.js",
    "storage.js",
    "i18n.js",
    "purchase.js",
    "receipt.js",
    "inventory.js",
    "sales.js",
    "loss.js",
    "pricing.js",
    "csv.js",
]


def _read(path):
    assert path.exists(), f"Datei fehlt: {path}"
    return path.read_text(encoding="utf-8")


def _node_path():
    node = shutil.which("node")
    assert node is not None, "node ist nicht im PATH verfuegbar (fuer node --check benoetigt)."
    return node


def _node_check(path):
    node = _node_path()
    result = subprocess.run(
        [node, "--check", str(path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"node --check fehlgeschlagen fuer {path}:\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}"
    )


def _extract_tag_attrs(content, tag, attr):
    pattern = re.compile(
        r"<" + tag + r"\b[^>]*\b" + attr + r"\s*=\s*[\"']([^\"']*)[\"'][^>]*>",
        re.IGNORECASE,
    )
    return pattern.findall(content)


# ---------------------------------------------------------------------------
# Existenz
# ---------------------------------------------------------------------------


def test_index_html_exists():
    assert INDEX_HTML_PATH.exists(), "index.html fehlt."


def test_app_js_exists():
    assert APP_JS_PATH.exists(), "js/app.js fehlt."


def test_style_css_exists():
    assert STYLE_CSS_PATH.exists(), "css/style.css fehlt."


# ---------------------------------------------------------------------------
# Syntax
# ---------------------------------------------------------------------------


def test_app_js_syntax_valid():
    _node_check(APP_JS_PATH)


# ---------------------------------------------------------------------------
# index.html: lokale Modul-Einbindung, keine externen Requests/CDN
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("module_file", REQUIRED_MODULE_FILES)
def test_index_includes_module_script_locally(module_file):
    content = _read(INDEX_HTML_PATH)
    pattern = re.compile(
        r"<script[^>]+src\s*=\s*[\"'](\./)?js/" + re.escape(module_file) + r"[\"'][^>]*>",
        re.IGNORECASE,
    )
    assert pattern.search(content), (
        f"index.html: js/{module_file} ist nicht per lokalem <script src=...> eingebunden."
    )


def test_index_includes_app_js_script():
    content = _read(INDEX_HTML_PATH)
    pattern = re.compile(r"<script[^>]+src\s*=\s*[\"'](\./)?js/app\.js[\"'][^>]*>", re.IGNORECASE)
    assert pattern.search(content), "index.html: js/app.js ist nicht per lokalem <script src=...> eingebunden."


def test_index_includes_local_stylesheet():
    content = _read(INDEX_HTML_PATH)
    pattern = re.compile(r"<link[^>]+href\s*=\s*[\"'](\./)?css/style\.css[\"'][^>]*>", re.IGNORECASE)
    assert pattern.search(content), "index.html: css/style.css ist nicht per lokalem <link href=...> eingebunden."


def test_index_has_no_external_script_src():
    content = _read(INDEX_HTML_PATH)
    srcs = _extract_tag_attrs(content, "script", "src")
    for src in srcs:
        assert not re.match(r"^https?://", src, re.IGNORECASE), (
            f"index.html: externer <script src> nicht erlaubt (offline-first): {src}"
        )
        assert "cdn" not in src.lower(), f"index.html: CDN-Referenz nicht erlaubt: {src}"


def test_index_has_no_external_link_href():
    content = _read(INDEX_HTML_PATH)
    hrefs = _extract_tag_attrs(content, "link", "href")
    for href in hrefs:
        assert not re.match(r"^https?://", href, re.IGNORECASE), (
            f"index.html: externer <link href> nicht erlaubt (offline-first): {href}"
        )
        assert "cdn" not in href.lower(), f"index.html: CDN-Referenz nicht erlaubt: {href}"


def test_index_has_no_fetch_or_xhr_calls():
    content = _read(INDEX_HTML_PATH)
    assert "fetch(" not in content, "index.html darf keine fetch()-Aufrufe enthalten (offline-first)."
    assert "XMLHttpRequest" not in content, "index.html darf kein XMLHttpRequest verwenden (offline-first)."


def test_app_js_has_no_network_calls():
    content = _read(APP_JS_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/app.js darf keine fetch()-Aufrufe enthalten (offline-first)."
    assert "XMLHttpRequest" not in content, "js/app.js darf kein XMLHttpRequest verwenden (offline-first)."


# ---------------------------------------------------------------------------
# index.html: geforderte UI-Bereiche/Elemente (Textmuster/ID-Check)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "element_id",
    [
        # Ankaufserfassung
        "view-purchase",
        "purchase-form",
        "purchase-farmer-id",
        "purchase-product-id",
        "purchase-quality-grade",
        "purchase-weight-kg",
        "purchase-price-per-kg",
        # Auszahlungsbeleg / Druck
        "agri-payout-receipt-root",
        "btn-print-receipt",
        # Bestandsuebersicht
        "view-inventory",
        "inventory-table",
        "inventory-table-body",
        # Verkaufsbuchung mit Margen-Anzeige
        "view-sales",
        "sale-form",
        "sale-margin-display",
        "sale-margin-amount",
        # Verlust-/Schwund-Erfassung mit Post-Harvest-Loss-KPI
        "view-loss",
        "loss-form",
        "loss-kpi-panel",
        "loss-kpi-value",
        "btn-compute-loss-kpi",
        # Preispflege (Tages-/Saisonpreise)
        "view-pricing",
        "pricing-form",
        "pricing-price-type",
        # Stammdaten-Import/-Export
        "view-csv",
        "btn-export-farmers-csv",
        "farmer-csv-file-input",
        "btn-import-farmers-csv",
        "btn-export-buyers-csv",
        "buyer-csv-file-input",
        "btn-import-buyers-csv",
        # Sprachumschalter FR/EN
        "language-switcher",
        "lang-switch-fr",
        "lang-switch-en",
    ],
)
def test_index_contains_required_element_id(element_id):
    content = _read(INDEX_HTML_PATH)
    pattern = re.compile(r"id\s*=\s*[\"']" + re.escape(element_id) + r"[\"']")
    assert pattern.search(content), f"index.html: erwartetes Element mit id='{element_id}' fehlt."


def test_index_language_switcher_has_fr_and_en_targets():
    content = _read(INDEX_HTML_PATH)
    assert re.search(r"data-lang\s*=\s*[\"']fr[\"']", content), (
        "index.html: Sprachumschalter-Ziel fuer 'fr' fehlt (data-lang=\"fr\")."
    )
    assert re.search(r"data-lang\s*=\s*[\"']en[\"']", content), (
        "index.html: Sprachumschalter-Ziel fuer 'en' fehlt (data-lang=\"en\")."
    )


def test_index_sale_view_shows_margin_label():
    content = _read(INDEX_HTML_PATH)
    assert re.search(r"data-i18n\s*=\s*[\"']margin[\"']", content), (
        "index.html: Margen-Anzeige im Verkaufsbereich fehlt (data-i18n=\"margin\")."
    )


def test_index_loss_view_shows_post_harvest_kpi_label():
    content = _read(INDEX_HTML_PATH)
    assert re.search(r"data-i18n\s*=\s*[\"']postHarvestLossKpi[\"']", content), (
        "index.html: Post-Harvest-Loss-KPI-Anzeige fehlt (data-i18n=\"postHarvestLossKpi\")."
    )


def test_index_pricing_view_covers_daily_and_season():
    content = _read(INDEX_HTML_PATH)
    assert re.search(r"value\s*=\s*[\"']daily[\"']", content), (
        "index.html: Tagespreis-Option (value=\"daily\") in der Preispflege fehlt."
    )
    assert re.search(r"value\s*=\s*[\"']season[\"']", content), (
        "index.html: Saisonpreis-Option (value=\"season\") in der Preispflege fehlt."
    )


# ---------------------------------------------------------------------------
# css/style.css: druckoptimierte @media print-Regel fuer den Auszahlungsbeleg
# ---------------------------------------------------------------------------


def test_style_css_has_print_media_rule():
    content = _read(STYLE_CSS_PATH)
    assert re.search(r"@media\s+print\s*{", content), (
        "css/style.css: keine @media print-Regel gefunden."
    )


def test_style_css_print_rule_targets_payout_receipt():
    content = _read(STYLE_CSS_PATH)
    match = re.search(r"@media\s+print\s*{(.*)}\s*$", content, re.DOTALL)
    assert match, "css/style.css: @media print-Block konnte nicht extrahiert werden."
    block = match.group(1)
    assert "agri-payout-receipt-root" in block, (
        "css/style.css: @media print-Regel muss sich auf #agri-payout-receipt-root beziehen."
    )


def test_style_css_has_no_external_references():
    content = _read(STYLE_CSS_PATH)
    assert not re.search(r"@import\s+url\(\s*[\"']?https?://", content, re.IGNORECASE), (
        "css/style.css darf keine externen @import-Regeln enthalten (offline-first)."
    )
    assert "cdn" not in content.lower(), "css/style.css darf keine CDN-Referenz enthalten."


# ---------------------------------------------------------------------------
# js/app.js: Modul-Einbindung und i18n-gesteuerte Sprachumschaltung
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "global_name",
    [
        "AgriModels",
        "AgriStorage",
        "AgriI18n",
        "AgriPurchase",
        "AgriReceipt",
        "AgriInventory",
        "AgriSales",
        "AgriLoss",
        "AgriPricing",
        "AgriCsv",
    ],
)
def test_app_js_references_module(global_name):
    content = _read(APP_JS_PATH)
    assert global_name in content, f"js/app.js: kein Bezug auf Modul {global_name} gefunden."


def test_app_js_updates_texts_via_i18n_on_language_switch():
    content = _read(APP_JS_PATH)
    assert re.search(r"AgriI18n\(\)\.setLanguage\(|AgriI18n\.setLanguage\(", content), (
        "js/app.js: Sprachwechsel muss AgriI18n.setLanguage(...) aufrufen."
    )
    assert re.search(r"AgriI18n\(\)\.t\(|AgriI18n\.t\(", content), (
        "js/app.js: sichtbare Texte muessen ueber AgriI18n.t(...) uebersetzt werden."
    )
    assert "data-i18n" in content, (
        "js/app.js: es muss ueber [data-i18n]-Elemente iteriert werden, um Texte zu aktualisieren."
    )
    assert "querySelectorAll" in content, (
        "js/app.js: es wird erwartet, dass alle [data-i18n]-Elemente per querySelectorAll erfasst werden."
    )


def test_app_js_wires_language_switcher_click_handlers():
    content = _read(APP_JS_PATH)
    assert "language-switcher" in content, (
        "js/app.js: kein Bezug auf #language-switcher gefunden."
    )
    assert "data-lang" in content, "js/app.js: kein Bezug auf data-lang-Attribute gefunden."


def test_app_js_handles_receipt_printing():
    content = _read(APP_JS_PATH)
    assert "AgriReceipt" in content and (
        "printPayoutReceipt" in content or "buildPayoutReceiptHtml" in content
    ), "js/app.js: kein Bezug auf den Auszahlungsbeleg (AgriReceipt) gefunden."


def test_app_js_handles_post_harvest_loss_kpi():
    content = _read(APP_JS_PATH)
    assert "computePostHarvestLossKpiPromille" in content, (
        "js/app.js: Post-Harvest-Loss-KPI-Berechnung (AgriLoss.computePostHarvestLossKpiPromille) wird nicht aufgerufen."
    )


def test_app_js_handles_sale_margin():
    content = _read(APP_JS_PATH)
    assert re.search(r"sale\.margin|\.margin\b", content), (
        "js/app.js: die Margen-Anzeige beim Verkauf (sale.margin) wird nicht befuellt."
    )


def test_app_js_handles_csv_import_export():
    content = _read(APP_JS_PATH)
    for fn in [
        "exportFarmersToCsv",
        "importFarmersFromCsv",
        "exportBuyersToCsv",
        "importBuyersFromCsv",
    ]:
        assert fn in content, f"js/app.js: CSV-Funktion {fn} wird nicht verwendet."


def test_app_js_does_not_duplicate_amount_computation():
    content = _read(APP_JS_PATH)
    assert "Math.round(weightKg" not in content, (
        "js/app.js darf die Betragsberechnung nicht duplizieren (gehoert in js/models.js)."
    )
