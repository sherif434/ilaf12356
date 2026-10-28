# SafeScope — training-only web security dashboard

**GitHub Pages preview:** https://sherif434.github.io/ilaf12356/safescope/

The hosted page is a visual dashboard preview. GitHub Pages cannot run the Python scanning backend. For live scanning, run the project locally:

```powershell
cd safescope
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python app.py
```

Open http://127.0.0.1:8765. The Target URL field is intentionally blank. Manually enter `http://demo.testfire.net` and press Start scan when ready. No scan runs on page load.

## Scope and safety
- Backend accepts only `demo.testfire.net` and rejects other hosts, credentials, custom ports, query strings, and fragments.
- Fixed bounded path list; GET/HEAD only; no crawling, form submission, credentials, state-changing requests, or redirect following.
- Non-executable marker only for reflected input; database checks look only for passive error signatures. Neither alone confirms a vulnerability.
- The tool is a limited indicator scanner, not a full penetration test.

The full downloadable package includes the local Flask backend and automated tests. Never use this tool against a target without authorization.