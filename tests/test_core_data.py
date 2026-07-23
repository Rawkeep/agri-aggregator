"""
Pytest-Gates fuer Task core-data: Datenmodell, Storage-Layer, i18n-Basis.

Prueft js/models.js, js/storage.js, js/i18n.js auf Existenz, Pflicht-
Textmuster (Funktions-/Objektnamen), gueltige JS-Syntax (node --check) und
auf die im Auftrag geforderten Struktur-Eigenschaften (FR/EN-Eintraege je
Kernbegriff, kein Netzwerkzugriff im Storage-Layer).
"""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
JS_DIR = PROJECT_ROOT / "js"

MODELS_PATH = JS_DIR / "models.js"
STORAGE_PATH = JS_DIR / "storage.js"
I18N_PATH = JS_DIR / "i18n.js"

CORE_TERMS = [
    "farmer",
    "product",
    "weight",
    "qualityGrade",
    "price",
    "stock",
    "sale",
    "margin",
    "loss",
    "payoutReceipt",
    "dailyPrice",
    "seasonPrice",
    "buyer",
]


def _read(path):
    assert path.exists(), f"Datei fehlt: {path}"
    return path.read_text(encoding="utf-8")


def _node_check(path):
    node = shutil.which("node")
    assert node is not None, "node ist nicht im PATH verfuegbar (fuer node --check benoetigt)."
    result = subprocess.run(
        [node, "--check", str(path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"node --check fehlgeschlagen fuer {path}:\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}"
    )


# ---------------------------------------------------------------------------
# Existenz
# ---------------------------------------------------------------------------

def test_models_file_exists():
    assert MODELS_PATH.exists(), "js/models.js fehlt."


def test_storage_file_exists():
    assert STORAGE_PATH.exists(), "js/storage.js fehlt."


def test_i18n_file_exists():
    assert I18N_PATH.exists(), "js/i18n.js fehlt."


# ---------------------------------------------------------------------------
# Syntax (node --check)
# ---------------------------------------------------------------------------

def test_models_js_syntax_valid():
    _node_check(MODELS_PATH)


def test_storage_js_syntax_valid():
    _node_check(STORAGE_PATH)


def test_i18n_js_syntax_valid():
    _node_check(I18N_PATH)


# ---------------------------------------------------------------------------
# models.js: geforderte Entitaeten/Factory-Funktionen und Validierung
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"createFarmer",
        r"createBuyer",
        r"createProduct",
        r"createPurchase",
        r"createSale",
        r"createLossEntry",
        r"createPriceEntry",
    ],
)
def test_models_contains_entity_factories(pattern):
    content = _read(MODELS_PATH)
    assert re.search(pattern, content), f"js/models.js: Muster nicht gefunden: {pattern}"


def test_models_validates_quality_grade_abc():
    content = _read(MODELS_PATH)
    assert "'A'" in content and "'B'" in content and "'C'" in content, (
        "js/models.js: Qualitaetsstufen A/B/C nicht gefunden."
    )
    assert re.search(r"[Qq]uality[Gg]rade", content), (
        "js/models.js: kein Bezug auf Qualitaetsstufe (qualityGrade) gefunden."
    )


def test_models_money_as_integer_no_float():
    content = _read(MODELS_PATH)
    assert "Number.isInteger" in content, (
        "js/models.js: Geldbetraege muessen ueber Number.isInteger validiert werden "
        "(Integer in kleinster Waehrungseinheit, kein Float)."
    )
    assert re.search(r"price\s*[Pp]er\s*[Kk]g|pricePerKg", content), (
        "js/models.js: kein Preis-pro-kg-Feld gefunden."
    )


def test_models_weight_is_number():
    content = _read(MODELS_PATH)
    assert re.search(r"weightKg", content), "js/models.js: kein weightKg-Feld gefunden."


# ---------------------------------------------------------------------------
# storage.js: CRUD-Funktionen je Entitaet, IndexedDB/localStorage, kein
# Netzwerkzugriff
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "func_name",
    [
        "saveFarmer",
        "listFarmers",
        "saveBuyer",
        "listBuyers",
        "saveProduct",
        "listProducts",
        "savePurchase",
        "listPurchases",
        "saveSale",
        "listSales",
        "saveLossEntry",
        "listLossEntries",
        "savePriceEntry",
        "listPriceEntries",
    ],
)
def test_storage_contains_crud_functions(func_name):
    content = _read(STORAGE_PATH)
    assert re.search(r"function\s+" + func_name + r"\s*\(", content) or re.search(
        func_name + r"\s*:", content
    ), f"js/storage.js: erwartete Funktion fehlt: {func_name}"


def test_storage_uses_indexeddb_and_localstorage_fallback():
    content = _read(STORAGE_PATH)
    assert "indexedDB" in content, "js/storage.js: kein Bezug auf indexedDB gefunden."
    assert "localStorage" in content, "js/storage.js: kein localStorage-Fallback gefunden."


def test_storage_returns_promises():
    content = _read(STORAGE_PATH)
    assert "Promise" in content, "js/storage.js: CRUD-Funktionen sollen Promise-basiert sein."


def test_storage_has_no_network_calls():
    content = _read(STORAGE_PATH)
    assert "fetch(" not in content, "js/storage.js darf keine fetch()-Aufrufe enthalten (offline-first)."
    assert "XMLHttpRequest" not in content, (
        "js/storage.js darf kein XMLHttpRequest verwenden (offline-first)."
    )
    assert not re.search(r"\bfetch\s*\(", content), (
        "js/storage.js darf keine fetch()-Aufrufe enthalten (offline-first)."
    )


def test_models_and_i18n_have_no_network_calls():
    for path in (MODELS_PATH, I18N_PATH):
        content = _read(path)
        assert "fetch(" not in content, f"{path.name} darf keine fetch()-Aufrufe enthalten."
        assert "XMLHttpRequest" not in content, f"{path.name} darf kein XMLHttpRequest verwenden."


# ---------------------------------------------------------------------------
# i18n.js: Woerterbuch FR/EN, t(), setLanguage/getLanguage, localStorage-
# Persistenz
# ---------------------------------------------------------------------------

def test_i18n_contains_required_functions():
    content = _read(I18N_PATH)
    for pattern in [r"\bt\s*=\s*function", r"function\s+t\s*\(", r"\bt\s*:\s*function", r"\bt\s*:\s*t\b"]:
        if re.search(pattern, content):
            break
    else:
        assert re.search(r"\bt\s*\(\s*key", content), "js/i18n.js: Uebersetzungsfunktion t(key, lang) nicht gefunden."
    assert re.search(r"function\s+setLanguage\s*\(", content), (
        "js/i18n.js: setLanguage(lang) nicht gefunden."
    )
    assert re.search(r"function\s+getLanguage\s*\(", content), (
        "js/i18n.js: getLanguage() nicht gefunden."
    )


def test_i18n_persists_language_in_local_storage():
    content = _read(I18N_PATH)
    assert "localStorage" in content, "js/i18n.js: Sprachwahl muss in localStorage persistiert werden."


@pytest.mark.parametrize("term", CORE_TERMS)
def test_i18n_term_has_fr_and_en_entry(term):
    content = _read(I18N_PATH)
    match = re.search(re.escape(term) + r"\s*:\s*\{([^}]*)\}", content)
    assert match, f"js/i18n.js: kein Eintrag fuer Kernbegriff '{term}' gefunden."
    block = match.group(1)
    assert re.search(r"\bfr\s*:", block), f"js/i18n.js: kein FR-Eintrag fuer '{term}'."
    assert re.search(r"\ben\s*:", block), f"js/i18n.js: kein EN-Eintrag fuer '{term}'."


def test_i18n_supports_fr_and_en_languages():
    content = _read(I18N_PATH)
    assert "'fr'" in content and "'en'" in content, (
        "js/i18n.js: beide Sprachen 'fr' und 'en' muessen unterstuetzt werden."
    )
