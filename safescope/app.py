from flask import Flask, jsonify, render_template, request, send_file
from urllib.parse import urlparse, urljoin
from datetime import datetime, timezone
from html import escape
import io, json, re, threading
import requests
from requests.exceptions import RequestException

app=Flask(__name__); app.config["MAX_CONTENT_LENGTH"]=16384
HOST="demo.testfire.net"; LOCK=threading.Lock(); HISTORY=[]; TIMEOUT=(2.5,4)
PATHS=["/robots.txt","/sitemap.xml","/login.jsp","/bank/","/bank/main.jsp","/bank/login.aspx","/search.jsp","/feedback.jsp","/images/","/favicon.ico","/does-not-exist-safescope"]
SECURITY_HEADERS={"content-security-policy":("Content-Security-Policy","Medium"),"strict-transport-security":("Strict-Transport-Security","Medium"),"x-content-type-options":("X-Content-Type-Options","Medium"),"x-frame-options":("X-Frame-Options","Medium"),"referrer-policy":("Referrer-Policy","Low"),"permissions-policy":("Permissions-Policy","Low")}
def validate(raw):
 if not isinstance(raw,str) or not raw.strip(): raise ValueError("Enter the authorized training URL manually.")
 p=urlparse(raw.strip())
 if p.scheme not in ("http","https") or p.hostname!=HOST or p.username or p.password: raise ValueError("Scope locked: only demo.testfire.net is allowed.")
 if p.port not in (None,80,443) or p.query or p.fragment: raise ValueError("Custom ports, query strings, and fragments are not allowed.")
 return p.scheme+"://"+HOST
def request_safe(s,url,method):
 p=urlparse(url)
 if p.hostname!=HOST or p.scheme not in ("http","https") or method not in ("GET","HEAD"): raise ValueError("Out-of-scope request blocked")
 return s.request(method,url,headers={"User-Agent":"SafeScope-TrainingScanner/1.0"},timeout=TIMEOUT,allow_redirects=False,stream=True)
def make(name,severity,url,evidence,explanation,confidence,remediation):
 return dict(vulnerability_name=name,severity=severity,affected_url=url,evidence=evidence,explanation=explanation,confidence=confidence,remediation=remediation)
def run_scan(raw):
 base=validate(raw); s=requests.Session(); s.trust_env=False; findings=[]; visited=[]; root=base+"/"
 r=request_safe(s,root,"GET")
 try:
  headers=dict(r.headers); body=r.raw.read(300000,decode_content=True).decode(r.encoding or "utf-8","replace"); visited.append(dict(url=root,status=r.status_code,method="GET"))
 finally:r.close()
 lower={k.lower() for k in headers}
 for key,(label,sev) in SECURITY_HEADERS.items():
  if key not in lower: findings.append(make("Missing security header: "+label,sev,root,"Response did not include "+label+".","Missing browser defense may increase exposure depending on application behavior.","High","Configure "+label+" for applicable routes and test compatibility."))
 if headers.get("Server"): findings.append(make("Server banner disclosed","Info",root,"Server: "+headers["Server"][:160],"Server banners reveal implementation details useful for fingerprinting.","High","Suppress unnecessary server-identifying response headers."))
 marker="SAFESCOPE_MARKER_7F31"; probe=base+"/search.jsp?query="+marker
 try:
  p=request_safe(s,probe,"GET")
  try:
   text=p.raw.read(180000,decode_content=True).decode(p.encoding or "utf-8","replace"); visited.append(dict(url=probe,status=p.status_code,method="GET"))
   if marker in text: findings.append(make("Reflected input marker","Low",probe,"Non-executable marker "+marker+" appeared in the response body.","Reflection does not prove XSS; inspect contextual encoding. No executable payload was used.","Medium","Apply context-aware output encoding and validate input."))
   if re.search(r"SQL syntax|SQLSTATE|ODBC SQL|mysql_fetch|ORA-\\d{5}|SQLite/JDBCDriver",text,re.I): findings.append(make("Possible SQL error disclosure","Medium",probe,"Response contains a database-error-like signature.","Database error text may disclose implementation details; this does not confirm SQL injection.","Low","Use parameterized queries and return generic client errors."))
  finally:p.close()
 except (RequestException,ValueError): pass
 for path in PATHS[:11]:
  url=base+path
  try:
   q=request_safe(s,url,"HEAD")
   try:
    visited.append(dict(url=url,status=q.status_code,method="HEAD"))
    if q.status_code in (301,302,303,307,308) and urlparse(urljoin(url,q.headers.get("Location",""))).hostname!=HOST: findings.append(make("External redirect observed","Medium",url,"Redirect destination was outside scope and was not followed.","Review whether redirect behavior can be influenced by user input.","Medium","Allow-list redirect destinations and never accept arbitrary redirect URLs."))
    if q.status_code in (200,204) and path in ("/robots.txt","/sitemap.xml"): findings.append(make("Public discovery file present","Info",url,"HEAD returned HTTP "+str(q.status_code),"Discovery files may expose route names; presence alone is not a vulnerability.","High","Review listed paths for sensitive internal resources."))
   finally:q.close()
  except (RequestException,ValueError):continue
 if not findings: findings=[make("No indicators detected by safe checks","Info",root,"Bounded checks produced no findings.","This is not proof the application is secure; coverage is intentionally limited.","High","Use an authorized comprehensive assessment for more assurance.")]
 return dict(target=base,started_at=datetime.now(timezone.utc).isoformat(),requests_made=len(visited),visited=visited,findings=findings,scope_note="Bounded GET/HEAD only; fixed paths; redirects not followed; no state-changing actions.")
@app.get("/")
def home(): return render_template("index.html")
@app.get("/api/health")
def health(): return jsonify(status="ready",scope=HOST,scan_on_load=False)
@app.post("/api/scan")
def scan():
 try: target=validate((request.get_json(silent=True) or {}).get("target",""))
 except ValueError as e:return jsonify(error=str(e)),400
 if not LOCK.acquire(False):return jsonify(error="A scan is already running."),429
 try:
  result=run_scan(target); HISTORY.insert(0,result); del HISTORY[10:]; return jsonify(result)
 except (RuntimeError,RequestException) as e:return jsonify(error="Safe scan could not complete: "+str(e)),502
 finally:LOCK.release()
@app.get("/api/history")
def history():return jsonify([dict(target=x["target"],started_at=x["started_at"],requests_made=x["requests_made"],finding_count=len(x["findings"])) for x in HISTORY])
@app.post("/api/report/<kind>")
def report(kind):
 if kind not in ("json","html"):return jsonify(error="Unsupported report type"),400
 data=(request.get_json(silent=True) or {}).get("report")
 if not isinstance(data,dict):
  return jsonify(error="Invalid report data"),400
 try:validate(data.get("target",""))
 except ValueError:return jsonify(error="Invalid report target"),400
 if kind=="json":return send_file(io.BytesIO(json.dumps(data,ensure_ascii=False,indent=2).encode()),mimetype="application/json",as_attachment=True,download_name="safescope-report.json")
 rows="".join("<tr>"+"".join("<td>"+escape(str(f.get(k,"")))+"</td>" for k in ("vulnerability_name","severity","affected_url","evidence","explanation","confidence","remediation"))+"</tr>" for f in data.get("findings",[]))
 doc="<!doctype html><html><meta charset='utf-8'><title>SafeScope Report</title><h1>SafeScope Scan Report</h1><p>Target: "+escape(data.get("target",""))+"</p><table border='1'><thead><tr><th>Finding</th><th>Severity</th><th>URL</th><th>Evidence</th><th>Explanation</th><th>Confidence</th><th>Remediation</th></tr></thead><tbody>"+rows+"</tbody></table></html>"
 return send_file(io.BytesIO(doc.encode()),mimetype="text/html",as_attachment=True,download_name="safescope-report.html")
if __name__=="__main__": app.run(host="127.0.0.1",port=8765,debug=False)
