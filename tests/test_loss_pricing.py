"""
Pytest-Gates fuer Task loss-pricing: taegliche Verlust-/Schwund-Erfassung mit
Post-Harvest-Loss-KPI (js/loss.js) sowie Tages-/Saisonpreise je Produkt
(js/pricing.js).

Prueft Existenz, gueltige JS-Syntax (node --check), Pflichtfunktionen,
Integer-only-Berechnung (kein parseFloat/toFixed auf KPI- oder Preiswerten)
sowie die deterministische KPI- und Preislogik per echter Node-Subprocess-
Ausfuehrung (require der Module).
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

LOSS_PATH = JS_DIR / "loss.js"
PRICING_PATH = JS_DIR / "pricing.js"
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

def test_loss_file_exists():
    assert LOSS_PATH.exists(), "js/loss.js fehlt."


def test_pricing_file_exists():
    assert PRICING_PATH.exists(), "js/pricing.js fehlt."


# ---------------------------------------------------------------------------
# Syntax (node --check)
# ---------------------------------------------------------------------------

def test_loss_js_syntax_valid():
    _node_check(LOSS_PATH)


def test_pricing_js_syntax_valid():
    _node_check(PRICING_PATH)


# ---------------------------------------------------------------------------
# loss.js: Pflichtfunktionen und Struktur
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"function\s+recordLoss\s*\(",
        r"function\s+listLossEntries\s*\(",
        r"function\s+sumLossWeightKg\s*\(",
        r"function\s+sumPurchaseWeightKg\s*\(",
        r"function\s+computePostHarvestLossKpiPromille\s*\(",
        r"AgriLoss",
    ],
)
def test_loss_contains_required_functions(pattern):
    content = _read(LOSS_PATH)
    assert re.search(pattern, content), f"js/loss.js: Muster nicht gefunden: {pattern}"


def test_loss_references_product_date_weight_and_optional_reason():
    content = _read(LOSS_PATH)
    for term in ("productId", "date", "weightKg", "reason"):
        assert term in content, f"js/loss.js: Pflichtfeld/-begriff fehlt: {term}"


def test_loss_kpi_avoids_division_by_zero():
    content = _read(LOSS_PATH)
    assert re.search(r"totalPurchaseKg\s*<=\s*0", content) or re.search(
        r"if\s*\(\s*totalPurchaseKg\s*===?\s*0", content
    ), "js/loss.js: computePostHarvestLossKpiPromille muss Division durch 0 abfangen (kein Ankaufsvolumen)."


def test_loss_no_parsefloat_or_tofixed_on_money_or_kpi():
    content = _read(LOSS_PATH)
    assert "parseFloat" not in content, (
        "js/loss.js darf kein parseFloat verwenden (Integer-only KPI-/Geldwerte)."
    )
    assert "toFixed" not in content, (
        "js/loss.js darf kein toFixed verwenden (Integer-only KPI-/Geldwerte)."
    )


def test_loss_has_no_network_calls():
    content = _read(LOSS_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/loss.js darf keine fetch()-Aufrufe enthalten."
    assert "XMLHttpRequest" not in content, "js/loss.js darf kein XMLHttpRequest verwenden."


# ---------------------------------------------------------------------------
# pricing.js: Pflichtfunktionen und Struktur
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"function\s+recordPriceEntry\s*\(",
        r"function\s+listPriceEntries\s*\(",
        r"function\s+getValidPriceEntry\s*\(",
        r"function\s+getCurrentPricePerKg\s*\(",
        r"AgriPricing",
    ],
)
def test_pricing_contains_required_functions(pattern):
    content = _read(PRICING_PATH)
    assert re.search(pattern, content), f"js/pricing.js: Muster nicht gefunden: {pattern}"


def test_pricing_supports_daily_and_season_price_types():
    content = _read(PRICING_PATH)
    assert "'daily'" in content, "js/pricing.js: kein Bezug auf Preistyp 'daily' gefunden."
    assert "'season'" in content, "js/pricing.js: kein Bezug auf Preistyp 'season' gefunden."


def test_pricing_no_parsefloat_or_tofixed_on_money():
    content = _read(PRICING_PATH)
    assert "parseFloat" not in content, (
        "js/pricing.js darf kein parseFloat verwenden (Integer-only Preiswerte)."
    )
    assert "toFixed" not in content, (
        "js/pricing.js darf kein toFixed verwenden (Integer-only Preiswerte)."
    )


def test_pricing_has_no_network_calls():
    content = _read(PRICING_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/pricing.js darf keine fetch()-Aufrufe enthalten."
    assert "XMLHttpRequest" not in content, "js/pricing.js darf kein XMLHttpRequest verwenden."


# ---------------------------------------------------------------------------
# Funktionale Verifikation per Node-Subprocess (echte Ausfuehrung)
# ---------------------------------------------------------------------------

def test_post_harvest_loss_kpi_deterministic_integer_via_node():
    assert MODELS_PATH.exists(), "js/models.js wird von js/loss.js benoetigt."
    script = textwrap.dedent(
        """
        const AgriLoss = require('./loss.js');

        AgriLoss.resetLossEntries();
        AgriLoss.recordLoss({
          productId: 'product_cacao', qualityGrade: 'A', weightKg: 30,
          date: '2026-07-05', reason: 'moisissure'
        });
        AgriLoss.recordLoss({
          productId: 'product_cacao', qualityGrade: 'B', weightKg: 20,
          date: '2026-07-20'
        });
        AgriLoss.recordLoss({
          productId: 'product_cacao', qualityGrade: 'A', weightKg: 999,
          date: '2026-06-01'
        });

        const purchases = [
          { productId: 'product_cacao', date: '2026-07-01', weightKg: 500 },
          { productId: 'product_cacao', date: '2026-07-15', weightKg: 500 },
          { productId: 'product_cacao', date: '2026-06-10', weightKg: 999 }
        ];

        const lossEntries = AgriLoss.listLossEntries();

        const kpiFullPeriod = AgriLoss.computePostHarvestLossKpiPromille(
          lossEntries, purchases, 'product_cacao', '2026-07-01', '2026-07-31'
        );
        const kpiNoVolume = AgriLoss.computePostHarvestLossKpiPromille(
          lossEntries, [], 'product_cacao', '2026-07-01', '2026-07-31'
        );
        const kpiRepeat = AgriLoss.computePostHarvestLossKpiPromille(
          lossEntries, purchases, 'product_cacao', '2026-07-01', '2026-07-31'
        );

        console.log(JSON.stringify({
          kpiFullPeriod: kpiFullPeriod,
          isIntKpi: Number.isInteger(kpiFullPeriod),
          kpiNoVolume: kpiNoVolume,
          kpiRepeat: kpiRepeat,
          entryCount: lossEntries.length
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    # 50 kg Schwund (30+20) / 1000 kg Ankaufsvolumen im Zeitraum 07-01..07-31
    # -> Promille = round(50 / 1000 * 1000) = 50
    assert data["kpiFullPeriod"] == 50, f"Erwarteter KPI 50 Promille, erhalten: {data['kpiFullPeriod']}"
    assert data["isIntKpi"] is True, "Der Post-Harvest-Loss-KPI muss ein Integer (Promille) sein."
    assert data["kpiNoVolume"] == 0, "Ohne Ankaufsvolumen im Zeitraum muss der KPI 0 sein (keine Division durch 0)."
    assert data["kpiRepeat"] == 50, "Die KPI-Berechnung muss deterministisch sein (gleiche Eingabe -> gleiches Ergebnis)."
    assert data["entryCount"] == 3


def test_pricing_returns_correct_daily_and_season_price_via_node():
    assert MODELS_PATH.exists(), "js/models.js wird von js/pricing.js benoetigt."
    script = textwrap.dedent(
        """
        const AgriPricing = require('./pricing.js');

        AgriPricing.resetPriceEntries();
        AgriPricing.recordPriceEntry({
          productId: 'product_cacao', qualityGrade: 'A', priceType: 'season',
          pricePerKg: 250, currency: 'XOF', date: '2026-01-01'
        });
        AgriPricing.recordPriceEntry({
          productId: 'product_cacao', qualityGrade: 'A', priceType: 'season',
          pricePerKg: 275, currency: 'XOF', date: '2026-06-01'
        });
        AgriPricing.recordPriceEntry({
          productId: 'product_cacao', qualityGrade: 'A', priceType: 'daily',
          pricePerKg: 300, currency: 'XOF', date: '2026-07-10'
        });

        const priceOnDailyDate = AgriPricing.getCurrentPricePerKg('product_cacao', 'A', '2026-07-10');
        const priceAfterDailyDate = AgriPricing.getCurrentPricePerKg('product_cacao', 'A', '2026-07-11');
        const priceBeforeAnySeason = AgriPricing.getCurrentPricePerKg('product_cacao', 'A', '2025-12-31');
        const priceMidSeason = AgriPricing.getCurrentPricePerKg('product_cacao', 'A', '2026-03-15');

        console.log(JSON.stringify({
          priceOnDailyDate: priceOnDailyDate,
          isIntDaily: Number.isInteger(priceOnDailyDate),
          priceAfterDailyDate: priceAfterDailyDate,
          priceBeforeAnySeason: priceBeforeAnySeason,
          priceMidSeason: priceMidSeason
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["priceOnDailyDate"] == 300, (
        f"Am Datum des Tagespreises muss der Tagespreis (300) gelten, erhalten: {data['priceOnDailyDate']}"
    )
    assert data["isIntDaily"] is True, "Der zurueckgegebene Preis muss ein Integer sein."
    assert data["priceAfterDailyDate"] == 275, (
        f"Nach dem Tagespreis-Datum muss der zuletzt gueltige Saisonpreis (275) gelten, "
        f"erhalten: {data['priceAfterDailyDate']}"
    )
    assert data["priceBeforeAnySeason"] is None, (
        "Vor jedem erfassten Saisonpreis darf kein Preis gefunden werden (None)."
    )
    assert data["priceMidSeason"] == 250, (
        f"Innerhalb der ersten Saison muss deren Preis (250) gelten, erhalten: {data['priceMidSeason']}"
    )


def test_loss_and_pricing_load_together_via_node():
    script = textwrap.dedent(
        """
        const AgriLoss = require('./loss.js');
        const AgriPricing = require('./pricing.js');
        console.log(JSON.stringify({
          lossOk: typeof AgriLoss.recordLoss === 'function'
            && typeof AgriLoss.computePostHarvestLossKpiPromille === 'function',
          pricingOk: typeof AgriPricing.recordPriceEntry === 'function'
            && typeof AgriPricing.getCurrentPricePerKg === 'function'
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["lossOk"] is True
    assert data["pricingOk"] is True
