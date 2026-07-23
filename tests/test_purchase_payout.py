"""
Pytest-Gates fuer Task purchase-payout: Ankaufserfassung (js/purchase.js)
und PDF-/Druck-Auszahlungsbeleg (js/receipt.js).

Prueft Existenz, gueltige JS-Syntax (node --check), Pflichtfunktionen,
Integrer-only-Berechnung (kein parseFloat/toFixed auf Geldbetraege in
js/purchase.js) sowie die deterministische Betragsberechnung und den
Beleginhalt per echter Node-Subprocess-Ausfuehrung (require der Module).
"""

import json
import re
import shutil
import subprocess
import textwrap
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
JS_DIR = PROJECT_ROOT / "js"

PURCHASE_PATH = JS_DIR / "purchase.js"
RECEIPT_PATH = JS_DIR / "receipt.js"
MODELS_PATH = JS_DIR / "models.js"
I18N_PATH = JS_DIR / "i18n.js"


def _read(path):
    assert path.exists(), f"Datei fehlt: {path}"
    return path.read_text(encoding="utf-8")


def _node_path():
    node = shutil.which("node")
    assert node is not None, "node ist nicht im PATH verfuegbar (fuer node --check/-e benoetigt)."
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


def _run_node_script(script):
    node = _node_path()
    result = subprocess.run(
        [node, "-e", script],
        capture_output=True,
        text=True,
        cwd=str(JS_DIR),
    )
    assert result.returncode == 0, (
        f"node-Skript fehlgeschlagen:\nstdout: {result.stdout}\nstderr: {result.stderr}"
    )
    return result.stdout.strip()


# ---------------------------------------------------------------------------
# Existenz
# ---------------------------------------------------------------------------

def test_purchase_file_exists():
    assert PURCHASE_PATH.exists(), "js/purchase.js fehlt."


def test_receipt_file_exists():
    assert RECEIPT_PATH.exists(), "js/receipt.js fehlt."


# ---------------------------------------------------------------------------
# Syntax (node --check)
# ---------------------------------------------------------------------------

def test_purchase_js_syntax_valid():
    _node_check(PURCHASE_PATH)


def test_receipt_js_syntax_valid():
    _node_check(RECEIPT_PATH)


# ---------------------------------------------------------------------------
# purchase.js: Pflichtfunktionen und Struktur
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"function\s+computeTotalAmount\s*\(",
        r"function\s+findFarmerById\s*\(",
        r"function\s+createPurchaseFromInput\s*\(",
        r"function\s+recordPurchase\s*\(",
        r"AgriPurchase",
    ],
)
def test_purchase_contains_required_functions(pattern):
    content = _read(PURCHASE_PATH)
    assert re.search(pattern, content), f"js/purchase.js: Muster nicht gefunden: {pattern}"


def test_purchase_references_farmer_stammsatz():
    content = _read(PURCHASE_PATH)
    assert re.search(r"farmerId", content), "js/purchase.js: kein Bezug auf farmerId (Farmer-Referenz) gefunden."
    assert re.search(r"farmers", content), "js/purchase.js: kein Bezug auf den Farmer-Stammsatz (farmers) gefunden."


def test_purchase_references_quality_grade_and_weight_and_price():
    content = _read(PURCHASE_PATH)
    for term in ("qualityGrade", "weightKg", "pricePerKg"):
        assert term in content, f"js/purchase.js: Pflichtfeld/-begriff fehlt: {term}"


def test_purchase_no_parsefloat_or_tofixed_on_money():
    content = _read(PURCHASE_PATH)
    assert "parseFloat" not in content, (
        "js/purchase.js darf kein parseFloat verwenden (Integer-only-Geldbetraege)."
    )
    assert "toFixed" not in content, (
        "js/purchase.js darf kein toFixed verwenden (Integer-only-Geldbetraege)."
    )


def test_purchase_uses_integer_multiplication_via_models():
    content = _read(PURCHASE_PATH)
    assert re.search(r"computeAmount\s*\(\s*weightKg\s*,\s*pricePerKg\s*\)", content), (
        "js/purchase.js: computeTotalAmount muss weightKg/pricePerKg per Integer-"
        "Multiplikation (AgriModels.computeAmount) deterministisch verrechnen."
    )


def test_purchase_has_no_network_calls():
    content = _read(PURCHASE_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/purchase.js darf keine fetch()-Aufrufe enthalten."
    assert "XMLHttpRequest" not in content, "js/purchase.js darf kein XMLHttpRequest verwenden."


# ---------------------------------------------------------------------------
# receipt.js: Pflichtfunktionen, Druck-/PDF-Faehigkeit, FR/EN-Labels
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"function\s+buildPayoutReceiptHtml\s*\(",
        r"function\s+printPayoutReceipt\s*\(",
        r"AgriReceipt",
    ],
)
def test_receipt_contains_required_functions(pattern):
    content = _read(RECEIPT_PATH)
    assert re.search(pattern, content), f"js/receipt.js: Muster nicht gefunden: {pattern}"


def test_receipt_uses_window_print_without_external_pdf_lib():
    content = _read(RECEIPT_PATH)
    assert "window.print(" in content, "js/receipt.js: window.print() wird fuer die Druck-/PDF-Erzeugung benoetigt."
    forbidden_markers = ["http://", "https://", "cdn.", "jspdf", "pdfmake", "pdf-lib"]
    lowered = content.lower()
    for marker in forbidden_markers:
        assert marker not in lowered, (
            f"js/receipt.js darf keine externen Ressourcen/Bibliotheken verwenden (gefunden: {marker})."
        )


def test_receipt_has_print_optimized_css():
    content = _read(RECEIPT_PATH)
    assert "@media print" in content, "js/receipt.js: es fehlt druckoptimiertes CSS (@media print)."


def test_receipt_contains_farmer_product_weight_amount_fields():
    content = _read(RECEIPT_PATH)
    for term in ("farmerName", "productName", "weightKg", "totalAmount", "qualityGrade"):
        assert term in content, f"js/receipt.js: Pflichtfeld fehlt: {term}"


def test_receipt_uses_i18n_labels():
    content = _read(RECEIPT_PATH)
    assert "AgriI18n" in content, "js/receipt.js: es muss js/i18n.js (AgriI18n) fuer FR/EN-Labels genutzt werden."
    for key in ("payoutReceipt", "farmer", "product", "weight", "qualityGrade", "price"):
        assert key in content, f"js/receipt.js: i18n-Schluessel fehlt: {key}"


def test_receipt_has_no_network_calls():
    content = _read(RECEIPT_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/receipt.js darf keine fetch()-Aufrufe enthalten."
    assert "XMLHttpRequest" not in content, "js/receipt.js darf kein XMLHttpRequest verwenden."


# ---------------------------------------------------------------------------
# Funktionale Verifikation per Node-Subprocess (echte Ausfuehrung)
# ---------------------------------------------------------------------------

def test_compute_total_amount_deterministic_integer_via_node():
    assert MODELS_PATH.exists(), "js/models.js wird von js/purchase.js benoetigt."
    script = textwrap.dedent(
        """
        const AgriPurchase = require('./purchase.js');
        const results = {
          a: AgriPurchase.computeTotalAmount(12.5, 250),
          b: AgriPurchase.computeTotalAmount(7.333, 100),
          c: AgriPurchase.computeTotalAmount(1, 1000),
          isIntA: Number.isInteger(AgriPurchase.computeTotalAmount(12.5, 250)),
          repeat: AgriPurchase.computeTotalAmount(12.5, 250) === AgriPurchase.computeTotalAmount(12.5, 250)
        };
        console.log(JSON.stringify(results));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["a"] == 3125, f"Erwarteter Gesamtbetrag 3125, erhalten: {data['a']}"
    assert data["b"] == 733, f"Erwarteter Gesamtbetrag 733, erhalten: {data['b']}"
    assert data["c"] == 1000, f"Erwarteter Gesamtbetrag 1000, erhalten: {data['c']}"
    assert data["isIntA"] is True, "computeTotalAmount muss einen Integer liefern."
    assert data["repeat"] is True, "computeTotalAmount muss deterministisch sein (gleiche Eingabe -> gleiches Ergebnis)."


def test_create_purchase_from_input_validates_farmer_reference_via_node():
    script = textwrap.dedent(
        """
        const AgriPurchase = require('./purchase.js');
        const farmers = [{ id: 'farmer_1', name: 'Aya Mensah' }];
        const purchase = AgriPurchase.createPurchaseFromInput({
          farmerId: 'farmer_1',
          productId: 'product_cacao',
          qualityGrade: 'A',
          weightKg: 10,
          pricePerKg: 200,
          currency: 'XOF',
          date: '2026-07-20'
        }, farmers);

        let unknownFarmerRejected = false;
        try {
          AgriPurchase.createPurchaseFromInput({
            farmerId: 'farmer_unknown',
            productId: 'product_cacao',
            qualityGrade: 'A',
            weightKg: 10,
            pricePerKg: 200,
            currency: 'XOF',
            date: '2026-07-20'
          }, farmers);
        } catch (err) {
          unknownFarmerRejected = true;
        }

        console.log(JSON.stringify({
          totalAmount: purchase.totalAmount,
          qualityGrade: purchase.qualityGrade,
          unknownFarmerRejected: unknownFarmerRejected
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["totalAmount"] == 2000, f"Erwarteter Gesamtbetrag 2000, erhalten: {data['totalAmount']}"
    assert data["qualityGrade"] == "A"
    assert data["unknownFarmerRejected"] is True, (
        "createPurchaseFromInput muss unbekannte farmerId ablehnen (Referenz auf Farmer-Stammsatz)."
    )


def test_build_payout_receipt_html_contains_required_fields_via_node():
    assert I18N_PATH.exists(), "js/i18n.js wird von js/receipt.js benoetigt."
    script = textwrap.dedent(
        """
        const AgriReceipt = require('./receipt.js');
        const purchase = {
          farmerId: 'farmer_1',
          productId: 'product_cacao',
          qualityGrade: 'B',
          weightKg: 25,
          pricePerKg: 300,
          currency: 'XOF',
          date: '2026-07-20',
          totalAmount: 7500
        };
        const farmer = { id: 'farmer_1', name: 'Kossi Adjo' };
        const product = { id: 'product_cacao', name: 'Cacao' };

        const htmlFr = AgriReceipt.buildPayoutReceiptHtml(purchase, farmer, product, 'fr');
        const htmlEn = AgriReceipt.buildPayoutReceiptHtml(purchase, farmer, product, 'en');

        console.log(JSON.stringify({
          frHasTitle: htmlFr.indexOf('Recu de paiement') !== -1,
          enHasTitle: htmlEn.indexOf('Payout Receipt') !== -1,
          frHasFarmerLabel: htmlFr.indexOf('Agriculteur') !== -1,
          enHasFarmerLabel: htmlEn.indexOf('Farmer') !== -1,
          hasFarmerName: htmlFr.indexOf('Kossi Adjo') !== -1,
          hasProductName: htmlFr.indexOf('Cacao') !== -1,
          hasWeight: htmlFr.indexOf('25') !== -1,
          hasQualityGrade: htmlFr.indexOf('>B<') !== -1,
          hasTotalAmount: htmlFr.indexOf('7500') !== -1,
          hasPrintCss: htmlFr.indexOf('@media print') !== -1
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    for key, value in data.items():
        assert value is True, f"js/receipt.js: erwarteter Beleginhalt fehlt ({key})."


def test_purchase_and_receipt_load_together_via_node():
    script = textwrap.dedent(
        """
        const AgriPurchase = require('./purchase.js');
        const AgriReceipt = require('./receipt.js');
        console.log(JSON.stringify({
          purchaseOk: typeof AgriPurchase.computeTotalAmount === 'function',
          receiptOk: typeof AgriReceipt.buildPayoutReceiptHtml === 'function'
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["purchaseOk"] is True
    assert data["receiptOk"] is True
