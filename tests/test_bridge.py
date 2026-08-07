"""
Pytest-Gates fuer die Datenbruecke (Hofkette v1): js/bridge.js + js/hofkette.js.

Prueft Existenz, gueltige JS-Syntax (node --check), Einbindung in index.html
in korrekter Ladereihenfolge — und fuehrt eine FUNKTIONALE Pruefung ueber
Node aus (deterministische event_ids, ANKAUF-Herkunft partner:<farmerId>,
CSV-Round-Trip ueber das Hofkette-Kit).
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
JS_DIR = PROJECT_ROOT / "js"
BRIDGE_PATH = JS_DIR / "bridge.js"
HOFKETTE_PATH = JS_DIR / "hofkette.js"
KIT_PATH = (
    PROJECT_ROOT / "docs" / "daten-strategie" / "kits" / "hofkette" / "hofkette.js"
)
INDEX_PATH = PROJECT_ROOT / "index.html"

NODE = shutil.which("node")


def test_bridge_dateien_existieren():
    assert BRIDGE_PATH.is_file(), "js/bridge.js fehlt"
    assert HOFKETTE_PATH.is_file(), "js/hofkette.js fehlt"


def test_hofkette_kopie_ist_identisch_mit_dem_kit():
    # Kit-Prinzip: die App-Kopie darf nicht vom kanonischen Kit divergieren.
    assert KIT_PATH.is_file(), "kanonisches Kit fehlt"
    assert HOFKETTE_PATH.read_text() == KIT_PATH.read_text(), (
        "js/hofkette.js weicht vom Kit ab — Kopie aus "
        "docs/daten-strategie/kits/hofkette/ aktualisieren"
    )


@pytest.mark.skipif(NODE is None, reason="node nicht verfuegbar")
def test_bridge_syntax():
    for path in (BRIDGE_PATH, HOFKETTE_PATH):
        subprocess.run([NODE, "--check", str(path)], check=True)


def test_index_bindet_bridge_vor_app_ein():
    html = INDEX_PATH.read_text()
    assert 'src="js/hofkette.js"' in html
    assert 'src="js/bridge.js"' in html
    assert html.index("js/hofkette.js") < html.index("js/bridge.js") < html.index(
        'src="js/app.js"'
    ), "Ladereihenfolge: hofkette.js -> bridge.js -> app.js"
    assert 'id="btn-export-hofkette"' in html, "Export-Knopf fehlt im CSV-Tab"


NODE_FUNKTIONAL = """
const B = require(process.argv[1]);
const H = require(process.argv[2]);
const state = {
  products: [{ id: 'prod1', nameFr: 'mais', nameEn: 'maize' }],
  purchases: [{ id: 'p1', farmerId: 'farm7', productId: 'prod1',
    qualityGrade: 'A', weightKg: 500, pricePerKg: 150, currency: 'XOF',
    date: '2026-08-01', totalAmount: 75000 }],
  sales: [{ id: 's1', buyerId: 'buyer1', productId: 'prod1',
    qualityGrade: 'A', weightKg: 300, pricePerKg: 200, currency: 'XOF',
    date: '2026-08-03', totalAmount: 60000, costPerKg: null,
    costAmount: null, margin: null }]
};
const events = B.buildAllEvents(state);
const back = H.parseCsv(B.exportCsv(state));
const ank = events.find((e) => e.event_type === 'ANKAUF');
const sale = events.find((e) => e.event_type === 'VERKAUF');
console.log(JSON.stringify({
  count: events.length,
  roundTrip: JSON.stringify(back) === JSON.stringify(events),
  ankId: ank.event_id, ankOrigin: ank.origin, ankQty: ank.qty_x10,
  ankAmount: ank.amount_minor, saleLot: sale.lot_id
}));
"""


@pytest.mark.skipif(NODE is None, reason="node nicht verfuegbar")
def test_bridge_funktional():
    res = subprocess.run(
        [NODE, "-e", NODE_FUNKTIONAL, str(BRIDGE_PATH), str(HOFKETTE_PATH)],
        check=True,
        capture_output=True,
        text=True,
    )
    out = json.loads(res.stdout.strip())
    assert out["count"] == 2
    assert out["roundTrip"] is True, "CSV-Round-Trip verfaelscht die Belege"
    assert out["ankId"] == "agg-ank-p1", "event_id muss deterministisch sein"
    assert out["ankOrigin"] == "partner:farm7", "Herkunft muss den Farmer nennen"
    assert out["ankQty"] == 5000, "500 kg muessen als 5000 (x10) exportiert werden"
    assert out["ankAmount"] == 75000
    assert out["saleLot"] == "POOL-prod1-A", "Verkauf laeuft ueber die Pool-Charge"
