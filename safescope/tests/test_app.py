import unittest
from unittest.mock import MagicMock
import app

class SafetyTests(unittest.TestCase):
    def test_allowed_base_url(self):
        self.assertEqual(app.validate("http://demo.testfire.net"), "http://demo.testfire.net")
    def test_blank_rejected(self):
        with self.assertRaises(ValueError): app.validate("")
    def test_external_hosts_rejected(self):
        for value in ("https://example.com","http://demo.testfire.net.evil.test","http://user@demo.testfire.net","http://demo.testfire.net:8080"):
            with self.subTest(value=value), self.assertRaises(ValueError): app.validate(value)
    def test_query_and_fragment_rejected(self):
        with self.assertRaises(ValueError): app.validate("http://demo.testfire.net/?x=1")
        with self.assertRaises(ValueError): app.validate("http://demo.testfire.net/#x")
    def test_redirects_disabled(self):
        session=MagicMock(); app.request_safe(session,"http://demo.testfire.net/","HEAD")
        self.assertFalse(session.request.call_args.kwargs["allow_redirects"])
    def test_cross_host_request_rejected(self):
        with self.assertRaises(ValueError): app.request_safe(MagicMock(),"https://example.org/","GET")
    def test_health_has_no_autoscan(self):
        result=app.app.test_client().get("/api/health")
        self.assertEqual(result.status_code,200); self.assertFalse(result.json["scan_on_load"])
    def test_external_scan_rejected(self):
        result=app.app.test_client().post("/api/scan",json={"target":"https://example.org"})
        self.assertEqual(result.status_code,400)
    def test_report_escapes_html(self):
        data={"target":"http://demo.testfire.net","findings":[{"vulnerability_name":"<script>x</script>","severity":"Low","affected_url":"http://demo.testfire.net/","evidence":"<img>","explanation":"x","confidence":"High","remediation":"y"}]}
        response=app.app.test_client().post("/api/report/html",json={"report":data})
        self.assertEqual(response.status_code,200)
        self.assertNotIn("<script>x</script>",response.get_data(as_text=True))

if __name__=="__main__": unittest.main()
