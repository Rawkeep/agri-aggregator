"""
Pytest-Gates fuer Task inventory-sales: Bestandsfuehrung (js/inventory.js)
und Verkaufsbuchung mit Margen-Anzeige (js/sales.js).

Prueft Existenz, gueltige JS-Syntax (node --check), Pflichtfunktionen,
Integer-only-Berechnung (kein parseFloat/toFixed auf Geldbetraege) sowie
die deterministische Bestands- und Margenlogik per echter Node-Subprocess-
Ausfuehrung (require der Module): Ankauf zweier Chargen unterschiedlicher
Preise, gewichteter Durchschnitts-Einstandspreis, Verkauf mit erwarteter
Integer-Marge sowie Ablehnung eines Verkaufs, der den verfuegbaren Bestand
uebersteigt.
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

INVENTORY_PATH = JS_DIR / "inventory.js"
SALES_PATH = JS_DIR / "sales.js"
MODELS_PATH = JS_DIR / "models.js"


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

def test_inventory_file_exists():
    assert INVENTORY_PATH.exists(), "js/inventory.js fehlt."


def test_sales_file_exists():
    assert SALES_PATH.exists(), "js/sales.js fehlt."


# ---------------------------------------------------------------------------
# Syntax (node --check)
# ---------------------------------------------------------------------------

def test_inventory_js_syntax_valid():
    _node_check(INVENTORY_PATH)


def test_sales_js_syntax_valid():
    _node_check(SALES_PATH)


# ---------------------------------------------------------------------------
# inventory.js: Pflichtfunktionen und Struktur
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"function\s+updateStockOnPurchase\s*\(",
        r"function\s+updateStockOnSale\s*\(",
        r"function\s+getStock\s*\(",
        r"function\s+getWeightedAverageCost\s*\(",
        r"AgriInventory",
    ],
)
def test_inventory_contains_required_functions(pattern):
    content = _read(INVENTORY_PATH)
    assert re.search(pattern, content), f"js/inventory.js: Muster nicht gefunden: {pattern}"


def test_inventory_tracks_per_product_and_quality_grade():
    content = _read(INVENTORY_PATH)
    assert re.search(r"productId", content), "js/inventory.js: kein Bezug auf productId gefunden."
    assert re.search(r"qualityGrade", content), "js/inventory.js: kein Bezug auf qualityGrade gefunden."


def test_inventory_rejects_oversell_with_error():
    content = _read(INVENTORY_PATH)
    assert re.search(r"throw new Error", content), (
        "js/inventory.js: updateStockOnSale muss bei unzureichendem Bestand eine Exception werfen."
    )


def test_inventory_uses_integer_rounding_for_weighted_average_cost():
    content = _read(INVENTORY_PATH)
    assert "Math.round" in content, (
        "js/inventory.js: der gewichtete Durchschnitts-Einstandspreis muss deterministisch "
        "per Math.round als Integer berechnet werden."
    )


def test_inventory_no_parsefloat_or_tofixed_on_money():
    content = _read(INVENTORY_PATH)
    assert "parseFloat" not in content, "js/inventory.js darf kein parseFloat verwenden (Integer-only-Geldbetraege)."
    assert "toFixed" not in content, "js/inventory.js darf kein toFixed verwenden (Integer-only-Geldbetraege)."


def test_inventory_has_no_network_calls():
    content = _read(INVENTORY_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/inventory.js darf keine fetch()-Aufrufe enthalten."
    assert "XMLHttpRequest" not in content, "js/inventory.js darf kein XMLHttpRequest verwenden."


# ---------------------------------------------------------------------------
# sales.js: Pflichtfunktionen und Margenlogik-Struktur
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"function\s+createSaleFromInput\s*\(",
        r"function\s+recordSale\s*\(",
        r"function\s+findBuyerById\s*\(",
        r"AgriSales",
    ],
)
def test_sales_contains_required_functions(pattern):
    content = _read(SALES_PATH)
    assert re.search(pattern, content), f"js/sales.js: Muster nicht gefunden: {pattern}"


def test_sales_reduces_stock_via_inventory():
    content = _read(SALES_PATH)
    assert re.search(r"updateStockOnSale", content), (
        "js/sales.js: ein Verkauf muss den Bestand ueber AgriInventory.updateStockOnSale reduzieren."
    )
    assert re.search(r"getWeightedAverageCost", content), (
        "js/sales.js: die Margen-Berechnung muss den gewichteten Durchschnitts-Einstandspreis "
        "ueber AgriInventory.getWeightedAverageCost beziehen."
    )


def test_sales_margin_formula_pattern():
    content = _read(SALES_PATH)
    pattern = (
        r"margin\s*=\s*saleAmount\s*-\s*Math\.round\(\s*data\.weightKg\s*\*\s*weightedAverageCost\s*\)"
    )
    assert re.search(pattern, content), (
        "js/sales.js: erwartete deterministische Margenformel "
        "'margin = saleAmount - (weightSold * weightedAverageCost)' (Integer) nicht gefunden."
    )


def test_sales_no_parsefloat_or_tofixed_on_money():
    content = _read(SALES_PATH)
    assert "parseFloat" not in content, "js/sales.js darf kein parseFloat verwenden (Integer-only-Geldbetraege)."
    assert "toFixed" not in content, "js/sales.js darf kein toFixed verwenden (Integer-only-Geldbetraege)."


def test_sales_has_no_network_calls():
    content = _read(SALES_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/sales.js darf keine fetch()-Aufrufe enthalten."
    assert "XMLHttpRequest" not in content, "js/sales.js darf kein XMLHttpRequest verwenden."


# ---------------------------------------------------------------------------
# Funktionale Verifikation per Node-Subprocess (echte Ausfuehrung)
# ---------------------------------------------------------------------------

def test_purchase_two_batches_then_sale_yields_expected_integer_margin_via_node():
    assert MODELS_PATH.exists(), "js/models.js wird von js/inventory.js und js/sales.js benoetigt."
    script = textwrap.dedent(
        """
        const AgriInventory = require('./inventory.js');
        const AgriSales = require('./sales.js');

        AgriInventory.resetStock();
        AgriInventory.updateStockOnPurchase('product_cacao', 'A', 100, 200);
        AgriInventory.updateStockOnPurchase('product_cacao', 'A', 50, 260);

        const stockBeforeSale = AgriInventory.getStock('product_cacao', 'A');
        const avgCost = AgriInventory.getWeightedAverageCost('product_cacao', 'A');

        const sale = AgriSales.createSaleFromInput({
          buyerId: 'buyer_1',
          productId: 'product_cacao',
          qualityGrade: 'A',
          weightKg: 80,
          pricePerKg: 300,
          currency: 'XOF',
          date: '2026-07-20'
        });

        const stockAfterSale = AgriInventory.getStock('product_cacao', 'A');

        console.log(JSON.stringify({
          weightBeforeSale: stockBeforeSale.weightKg,
          costBeforeSale: stockBeforeSale.costAmount,
          avgCost: avgCost,
          saleTotalAmount: sale.totalAmount,
          saleMargin: sale.margin,
          marginIsInteger: Number.isInteger(sale.margin),
          weightAfterSale: stockAfterSale.weightKg
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["weightBeforeSale"] == 150, f"Erwartetes Gesamtgewicht 150 kg, erhalten: {data['weightBeforeSale']}"
    assert data["costBeforeSale"] == 33000, f"Erwarteter Gesamteinstandswert 33000, erhalten: {data['costBeforeSale']}"
    assert data["avgCost"] == 220, f"Erwarteter gewichteter Durchschnitts-Einstandspreis 220, erhalten: {data['avgCost']}"
    assert data["saleTotalAmount"] == 24000, f"Erwarteter Verkaufsbetrag 24000, erhalten: {data['saleTotalAmount']}"
    assert data["saleMargin"] == 6400, f"Erwartete Marge 6400, erhalten: {data['saleMargin']}"
    assert data["marginIsInteger"] is True, "Die Marge muss ein Integer sein."
    assert data["weightAfterSale"] == 70, f"Erwarteter Restbestand 70 kg, erhalten: {data['weightAfterSale']}"


def test_sale_exceeding_available_stock_is_rejected_via_node():
    script = textwrap.dedent(
        """
        const AgriInventory = require('./inventory.js');
        const AgriSales = require('./sales.js');

        AgriInventory.resetStock();
        AgriInventory.updateStockOnPurchase('product_mais', 'B', 10, 150);

        let salesRejectOversell = false;
        try {
          AgriSales.createSaleFromInput({
            buyerId: 'buyer_1',
            productId: 'product_mais',
            qualityGrade: 'B',
            weightKg: 25,
            pricePerKg: 200,
            currency: 'XOF',
            date: '2026-07-20'
          });
        } catch (err) {
          salesRejectOversell = true;
        }

        let inventoryRejectOversell = false;
        try {
          AgriInventory.updateStockOnSale('product_mais', 'B', 25);
        } catch (err) {
          inventoryRejectOversell = true;
        }

        const stockAfter = AgriInventory.getStock('product_mais', 'B');

        console.log(JSON.stringify({
          salesRejectOversell: salesRejectOversell,
          inventoryRejectOversell: inventoryRejectOversell,
          stockUnchanged: stockAfter.weightKg === 10
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["salesRejectOversell"] is True, (
        "js/sales.js: ein Verkauf, der den verfuegbaren Bestand uebersteigt, muss abgelehnt werden."
    )
    assert data["inventoryRejectOversell"] is True, (
        "js/inventory.js: updateStockOnSale muss bei unzureichendem Bestand eine Exception werfen."
    )
    assert data["stockUnchanged"] is True, "Bestand darf bei abgelehntem Verkauf nicht veraendert werden."


def test_inventory_and_sales_load_together_via_node():
    script = textwrap.dedent(
        """
        const AgriInventory = require('./inventory.js');
        const AgriSales = require('./sales.js');
        console.log(JSON.stringify({
          inventoryOk: typeof AgriInventory.updateStockOnPurchase === 'function'
            && typeof AgriInventory.updateStockOnSale === 'function'
            && typeof AgriInventory.getStock === 'function'
            && typeof AgriInventory.getWeightedAverageCost === 'function',
          salesOk: typeof AgriSales.createSaleFromInput === 'function'
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["inventoryOk"] is True
    assert data["salesOk"] is True
