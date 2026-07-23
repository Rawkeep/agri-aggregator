"""
Pytest-Gates fuer Task csv-master: CSV-Import/-Export fuer Farmer- und
Abnehmer-Stammdaten (js/csv.js), Persistenz ueber die Storage-Schicht
(js/storage.js).

Prueft Existenz, gueltige JS-Syntax (node --check), Pflichtfunktionen,
exakte Spaltenreihenfolge/-namen fuer den Farmer-Export sowie einen
Export-Import-Roundtrip (inkl. Sonderzeichen wie Komma und
Anfuehrungszeichen im Feld 'kulturen') per echter Node-Subprocess-
Ausfuehrung (require der Module). Zusaetzlich wird sichergestellt, dass
js/csv.js keine externen Requests/Bibliotheken verwendet.
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

CSV_PATH = JS_DIR / "csv.js"
MODELS_PATH = JS_DIR / "models.js"
STORAGE_PATH = JS_DIR / "storage.js"

EXPECTED_FARMER_HEADER = "farmer_id,name,telefon,dorf,h3_zelle,kulturen,flaeche_ha,zahlweg"


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

def test_csv_file_exists():
    assert CSV_PATH.exists(), "js/csv.js fehlt."


# ---------------------------------------------------------------------------
# Syntax (node --check)
# ---------------------------------------------------------------------------

def test_csv_js_syntax_valid():
    _node_check(CSV_PATH)


# ---------------------------------------------------------------------------
# csv.js: Pflichtfunktionen und Struktur
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "pattern",
    [
        r"function\s+exportFarmersToCsv\s*\(",
        r"function\s+importFarmersFromCsv\s*\(",
        r"function\s+parseFarmersFromCsv\s*\(",
        r"function\s+exportBuyersToCsv\s*\(",
        r"function\s+importBuyersFromCsv\s*\(",
        r"function\s+parseCsv\s*\(",
        r"AgriCsv",
    ],
)
def test_csv_contains_required_functions(pattern):
    content = _read(CSV_PATH)
    assert re.search(pattern, content), f"js/csv.js: Muster nicht gefunden: {pattern}"


def test_csv_farmer_columns_exact_order_in_source():
    content = _read(CSV_PATH)
    assert re.search(
        r"farmer_id[\s\S]{0,40}name[\s\S]{0,40}telefon[\s\S]{0,40}dorf[\s\S]{0,40}"
        r"h3_zelle[\s\S]{0,40}kulturen[\s\S]{0,40}flaeche_ha[\s\S]{0,40}zahlweg",
        content,
    ), "js/csv.js: FARMER_CSV_COLUMNS muss exakt farmer_id,name,telefon,dorf,h3_zelle,kulturen,flaeche_ha,zahlweg (in dieser Reihenfolge) enthalten."


def test_csv_uses_storage_layer_for_import():
    content = _read(CSV_PATH)
    assert re.search(r"saveFarmer", content), (
        "js/csv.js: importFarmersFromCsv muss die Datensaetze ueber die Storage-Schicht "
        "(AgriStorage.saveFarmer) persistieren."
    )
    assert re.search(r"saveBuyer", content), (
        "js/csv.js: importBuyersFromCsv muss die Datensaetze ueber die Storage-Schicht "
        "(AgriStorage.saveBuyer) persistieren."
    )


def test_csv_escaping_handles_quotes_commas_newlines():
    content = _read(CSV_PATH)
    assert re.search(r'""', content), (
        "js/csv.js: doppeltes Anfuehrungszeichen als Escape fuer literales "
        "Anfuehrungszeichen im Feld nicht gefunden."
    )
    assert re.search(r"[\",\\n\\r]", content), (
        "js/csv.js: Erkennung von Komma/Anfuehrungszeichen/Zeilenumbruch fuer das "
        "CSV-Escaping nicht gefunden."
    )


def test_csv_has_no_network_calls_or_external_libraries():
    content = _read(CSV_PATH)
    assert not re.search(r"\bfetch\s*\(", content), "js/csv.js darf keine fetch()-Aufrufe enthalten."
    assert "XMLHttpRequest" not in content, "js/csv.js darf kein XMLHttpRequest verwenden."
    forbidden_markers = ["http://", "https://", "cdn.", "csv-parse", "papaparse", "xlsx", "require('http"]
    lowered = content.lower()
    for marker in forbidden_markers:
        assert marker not in lowered, f"js/csv.js darf keine externen Ressourcen/Bibliotheken verwenden (gefunden: {marker})."
    external_requires = re.findall(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)", content)
    for module_name in external_requires:
        assert module_name.startswith("./") or module_name.startswith("../"), (
            f"js/csv.js darf nur lokale Module per require() einbinden, keine externe Bibliothek: {module_name}"
        )


# ---------------------------------------------------------------------------
# Funktionale Verifikation per Node-Subprocess (echte Ausfuehrung)
# ---------------------------------------------------------------------------

_LOCAL_STORAGE_SHIM = """
global.localStorage = (function () {
  var store = {};
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem: function (key, value) {
      store[key] = String(value);
    },
    removeItem: function (key) {
      delete store[key];
    }
  };
})();
"""


def test_export_farmers_header_exact_columns_via_node():
    assert MODELS_PATH.exists(), "js/models.js wird von js/csv.js benoetigt."
    script = textwrap.dedent(
        """
        const AgriCsv = require('./csv.js');
        const csvText = AgriCsv.exportFarmersToCsv([]);
        console.log(JSON.stringify({ header: csvText.split(/\\r\\n|\\n/)[0], columns: AgriCsv.FARMER_CSV_COLUMNS }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["header"] == EXPECTED_FARMER_HEADER, (
        f"Erwarteter Farmer-CSV-Header '{EXPECTED_FARMER_HEADER}', erhalten: {data['header']}"
    )
    assert data["columns"] == EXPECTED_FARMER_HEADER.split(","), (
        f"AgriCsv.FARMER_CSV_COLUMNS entspricht nicht der geforderten Reihenfolge: {data['columns']}"
    )


def test_farmer_export_import_roundtrip_with_special_characters_via_node():
    assert STORAGE_PATH.exists(), "js/storage.js wird von js/csv.js fuer den Import benoetigt."
    script = _LOCAL_STORAGE_SHIM + textwrap.dedent(
        """
        const AgriCsv = require('./csv.js');
        const AgriStorage = require('./storage.js');

        const original = [
          {
            id: 'farmer_1',
            name: 'Kofi Mensah',
            phone: '+22890000001',
            village: 'Kpalime',
            h3Cell: '891f1d48177ffff',
            crops: 'Cacao, Café \"Bio\"',
            areaHa: 2.5,
            paymentMethod: 'mobile_money'
          },
          {
            id: 'farmer_2',
            name: 'Aissatou Bello',
            phone: '+2348030000002',
            village: 'Ibadan',
            h3Cell: '891f1d4819bffff',
            crops: 'Cashew\\nMaize',
            areaHa: 1.2,
            paymentMethod: 'cash'
          }
        ];

        const csvText = AgriCsv.exportFarmersToCsv(original);

        AgriCsv.importFarmersFromCsv(csvText)
          .then(function () {
            return AgriStorage.listFarmers();
          })
          .then(function (farmers) {
            farmers.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
            console.log(JSON.stringify({ csvText: csvText, farmers: farmers }));
          })
          .catch(function (err) {
            console.error(err && err.stack ? err.stack : String(err));
            process.exit(1);
          });
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)

    assert '"Cacao, Café ""Bio"""' in data["csvText"], (
        "js/csv.js: das Feld 'kulturen' mit Komma und Anfuehrungszeichen wurde nicht korrekt escaped/exportiert."
    )

    original = [
        {
            "id": "farmer_1",
            "name": "Kofi Mensah",
            "phone": "+22890000001",
            "village": "Kpalime",
            "h3Cell": "891f1d48177ffff",
            "crops": 'Cacao, Café "Bio"',
            "areaHa": 2.5,
            "paymentMethod": "mobile_money"
        },
        {
            "id": "farmer_2",
            "name": "Aissatou Bello",
            "phone": "+2348030000002",
            "village": "Ibadan",
            "h3Cell": "891f1d4819bffff",
            "crops": "Cashew\nMaize",
            "areaHa": 1.2,
            "paymentMethod": "cash"
        }
    ]

    imported = data["farmers"]
    assert len(imported) == len(original), (
        f"Erwartete {len(original)} importierte Farmer-Datensaetze, erhalten: {len(imported)}"
    )
    for expected, actual in zip(original, imported):
        for field in ("id", "name", "phone", "village", "h3Cell", "crops", "areaHa", "paymentMethod"):
            assert actual.get(field) == expected[field], (
                f"Roundtrip-Abweichung bei Feld '{field}' fuer {expected['id']}: "
                f"erwartet {expected[field]!r}, erhalten {actual.get(field)!r}"
            )


def test_buyer_export_import_roundtrip_via_node():
    script = _LOCAL_STORAGE_SHIM + textwrap.dedent(
        """
        const AgriCsv = require('./csv.js');
        const AgriStorage = require('./storage.js');

        const original = [
          { id: 'buyer_1', name: 'Marche Central SA', type: 'supermarket', phone: '+2280001', contact: 'Ama, \"Achats\"' },
          { id: 'buyer_2', name: 'AgroExport SARL', type: 'exporter', phone: '+2340002', contact: 'Chidi' }
        ];

        const csvText = AgriCsv.exportBuyersToCsv(original);

        AgriCsv.importBuyersFromCsv(csvText)
          .then(function () {
            return AgriStorage.listBuyers();
          })
          .then(function (buyers) {
            buyers.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
            console.log(JSON.stringify({ header: csvText.split(/\\r\\n|\\n/)[0], buyers: buyers }));
          })
          .catch(function (err) {
            console.error(err && err.stack ? err.stack : String(err));
            process.exit(1);
          });
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)

    assert data["header"].split(",")[0] == "buyer_id", "js/csv.js: Buyer-CSV muss mit buyer_id beginnen."
    assert "name" in data["header"], "js/csv.js: Buyer-CSV muss eine name-Spalte enthalten."

    buyers = data["buyers"]
    assert len(buyers) == 2, f"Erwartete 2 importierte Buyer-Datensaetze, erhalten: {len(buyers)}"
    assert buyers[0]["id"] == "buyer_1" and buyers[0]["name"] == "Marche Central SA"
    assert buyers[0]["type"] == "supermarket"
    assert buyers[0]["contact"] == 'Ama, "Achats"', (
        f"Roundtrip-Abweichung bei Buyer-Feld 'contact': erhalten {buyers[0]['contact']!r}"
    )
    assert buyers[1]["id"] == "buyer_2" and buyers[1]["type"] == "exporter"


def test_csv_and_storage_load_together_via_node():
    script = textwrap.dedent(
        """
        const AgriCsv = require('./csv.js');
        console.log(JSON.stringify({
          exportFarmersOk: typeof AgriCsv.exportFarmersToCsv === 'function',
          importFarmersOk: typeof AgriCsv.importFarmersFromCsv === 'function',
          exportBuyersOk: typeof AgriCsv.exportBuyersToCsv === 'function',
          importBuyersOk: typeof AgriCsv.importBuyersFromCsv === 'function'
        }));
        """
    )
    stdout = _run_node_script(script)
    data = json.loads(stdout)
    assert data["exportFarmersOk"] is True
    assert data["importFarmersOk"] is True
    assert data["exportBuyersOk"] is True
    assert data["importBuyersOk"] is True
