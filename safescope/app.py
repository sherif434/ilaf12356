from flask import Flask, jsonify, request, send_file
from urllib.parse import urlparse, urljoin
from datetime import datetime, timezone
from html import escape
import io, json, re, threading
import requests
from requests.exceptions import RequestException

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16384
HOST = "demo.testfire.net"
LOCK = threading.Lock()
HISTORY = []
TIMEOUT = (2.5, 4)
MAX_BODY = 300_000
PATHS = ["/robots.txt", "/sitemap.xml", "/login.jsp", "/bank/", "/bank/main.jsp",
         "/bank/login.aspx", "/search.jsp", "/feedback.jsp", "/images/",
         "/favicon.ico", "/does-not-exist-safescope"]
SECURITY_HEADERS = {
    "content-security-policy": ("Content-Security-Policy", "Medium"),
    "strict-transport-security": ("Strict-Transport-Security", "Medium"),
    "x-content-type-options": ("X-Content-Type-Options", "Medium"),
    "x-frame-options": ("X-Frame-Options", "Medium"),
    "referrer-policy": ("Referrer-Policy", "Low"),
    "permissions-policy": ("Permissions-Policy", "Low"),
}

def validate(raw):
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("Enter the authorized training URL manually.")
    p = urlparse(raw.strip())
    if p.scheme not in ("http", "https") or p.hostname != HOST or p.username or p.password:
        raise ValueError("Scope locked: only demo.testfire.net is allowed.")
    try:
        port = p.port
    except ValueError:
        raise ValueError("Invalid port.")
    if port not in (None, 80, 443) or p.query or p.fragment or p.path not in ("", "/"):
        raise ValueError("Only the base URL is allowed; custom ports, paths, query strings, and fragments are blocked.")
    return p.scheme + "://" + HOST

def request_safe(session, url, method):
    p = urlparse(url)
    if p.hostname != HOST or p.scheme not in ("http", "https") or method not in ("GET", "HEAD"):
        raise ValueError("Out-of-scope request blocked")
    return session.request(method, url, headers={"User-Agent": "SafeScope-TrainingScanner/1.1"},
                           timeout=TIMEOUT, allow_redirects=False, stream=True)

def make(name, severity, url, evidence, explanation, confidence, remediation):
    return {"vulnerability_name": name, "severity": severity, "affected_url": url,
            "evidence": evidence, "explanation": explanation, "confidence": confidence,
            "remediation": remediation}

def bounded_text(response, limit):
    raw = response.raw.read(limit, decode_content=True)
    return raw.decode(response.encoding or "utf-8", "replace")

def run_scan(raw):
    base = validate(raw)
    session = requests.Session()
    session.trust_env = False
    findings, visited = [], []
    root = base + "/"
    response = request_safe(session, root, "GET")
    try:
        headers = dict(response.headers)
        body = bounded_text(response, MAX_BODY)
        visited.append({"url": root, "status": response.status_code, "method": "GET"})
    finally:
        response.close()
    lower = {k.lower() for k in headers}
    for key, (label, severity) in SECURITY_HEADERS.items():
        if key not in lower:
            findings.append(make("Missing security header: " + label, severity, root,
                "Response did not include " + label + ".",
                "Missing browser defense may increase exposure depending on application behavior.",
                "High", "Configure " + label + " for applicable routes and test compatibility."))
    if headers.get("Server"):
        findings.append(make("Server banner disclosed", "Info", root,
            "Server: " + headers["Server"][:160],
            "Server banners reveal implementation details useful for fingerprinting.",
            "High", "Suppress unnecessary server-identifying response headers."))
    marker = "SAFESCOPE_MARKER_7F31"
    probe = base + "/search.jsp?query=" + marker
    try:
        response = request_safe(session, probe, "GET")
        try:
            text = bounded_text(response, 180_000)
            visited.append({"url": probe, "status": response.status_code, "method": "GET"})
            if marker in text:
                findings.append(make("Reflected input marker", "Low", probe,
                    "Non-executable marker " + marker + " appeared in the response body.",
                    "Reflection does not prove XSS; inspect contextual encoding. No executable payload was used.",
                    "Medium", "Apply context-aware output encoding and validate input."))
            if re.search(r"SQL syntax|SQLSTATE|ODBC SQL|mysql_fetch|ORA-\d{5}|SQLite/JDBCDriver", text, re.I):
                findings.append(make("Possible SQL error disclosure", "Medium", probe,
                    "Response contains a database-error-like signature.",
                    "Database error text may disclose implementation details; this does not confirm SQL injection.",
                    "Low", "Use parameterized queries and return generic client errors."))
        finally:
            response.close()
    except (RequestException, ValueError):
        pass
    for path in PATHS:
        url = base + path
        try:
            response = request_safe(session, url, "HEAD")
            try:
                visited.append({"url": url, "status": response.status_code, "method": "HEAD"})
                if response.status_code in (301, 302, 303, 307, 308):
                    destination = urlparse(urljoin(url, response.headers.get("Location", "")))
                    if destination.hostname != HOST:
                        findings.append(make("External redirect observed", "Medium", url,
                            "Redirect destination was outside scope and was not followed.",
                            "Review whether redirect behavior can be influenced by user input.",
                            "Medium", "Allow-list redirect destinations and never accept arbitrary redirect URLs."))
                if response.status_code in (200, 204) and path in ("/robots.txt", "/sitemap.xml"):
                    findings.append(make("Public discovery file present", "Info", url,
                        "HEAD returned HTTP " + str(response.status_code),
                        "Discovery files may expose route names; presence alone is not a vulnerability.",
                        "High", "Review listed paths for sensitive internal resources."))
            finally:
                response.close()
        except (RequestException, ValueError):
            continue
    if not findings:
        findings = [make("No indicators detected by safe checks", "Info", root,
            "Bounded checks produced no findings.",
            "This is not proof the application is secure; coverage is intentionally limited.",
            "High", "Use an authorized comprehensive assessment for more assurance.")]
    return {"target": base, "started_at": datetime.now(timezone.utc).isoformat(),
            "requests_made": len(visited), "visited": visited, "findings": findings,
            "scope_note": "Bounded GET/HEAD only; fixed paths; redirects not followed; no state-changing actions."}

@app.after_request
def security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response

@app.get("/")
def home():
    return send_file("index.html")

@app.get("/api/health")
def health():
    return jsonify(status="ready", scope=HOST, scan_on_load=False)

@app.post("/api/scan")
def scan():
    try:
        payload = request.get_json(silent=True) or {}
        target = validate(payload.get("target", ""))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    if not LOCK.acquire(False):
        return jsonify(error="A scan is already running."), 429
    try:
        result = run_scan(target)
        HISTORY.insert(0, result)
        del HISTORY[10:]
        return jsonify(result)
    except (RequestException, ValueError) as exc:
        app.logger.warning("Safe scan failed: %s", type(exc).__name__)
        return jsonify(error="Safe scan could not complete. Check connectivity and try again."), 502
    except Exception:
        app.logger.exception("Unexpected scanner failure")
        return jsonify(error="Unexpected scanner error. Check the local server log."), 500
    finally:
        LOCK.release()

@app.get("/api/history")
def history():
    return jsonify([{"target": item["target"], "started_at": item["started_at"],
                     "requests_made": item["requests_made"], "finding_count": len(item["findings"])}
                    for item in HISTORY])

@app.post("/api/report/<kind>")
def report(kind):
    if kind not in ("json", "html"):
        return jsonify(error="Unsupported report type"), 400
    data = (request.get_json(silent=True) or {}).get("report")
    if not isinstance(data, dict):
        return jsonify(error="Invalid report data"), 400
    try:
        validate(data.get("target", ""))
    except ValueError:
        return jsonify(error="Invalid report target"), 400
    if not isinstance(data.get("findings"), list) or len(data["findings"]) > 500:
        return jsonify(error="Invalid findings list"), 400
    if kind == "json":
        content = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        return send_file(io.BytesIO(content), mimetype="application/json", as_attachment=True,
                         download_name="safescope-report.json")
    fields = ("vulnerability_name", "severity", "affected_url", "evidence",
              "explanation", "confidence", "remediation")
    rows = "".join("<tr>" + "".join("<td>" + escape(str(f.get(key, ""))[:4000]) + "</td>"
                    for key in fields) + "</tr>" for f in data["findings"] if isinstance(f, dict))
    doc = ("<!doctype html><html lang='en'><meta charset='utf-8'><title>SafeScope Report</title>"
           "<h1>SafeScope Scan Report</h1><p>Target: " + escape(str(data.get("target", ""))) +
           "</p><table border='1'><thead><tr><th>Finding</th><th>Severity</th><th>URL</th>"
           "<th>Evidence</th><th>Explanation</th><th>Confidence</th><th>Remediation</th></tr></thead>"
           "<tbody>" + rows + "</tbody></table></html>")
    return send_file(io.BytesIO(doc.encode("utf-8")), mimetype="text/html", as_attachment=True,
                     download_name="safescope-report.html")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False)
