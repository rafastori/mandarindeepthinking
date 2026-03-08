import sys
import importlib.util

spec = importlib.util.spec_from_file_location("export_pdf", "api/export-pdf.py")
export_pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export_pdf)

data = {
    "overview": {"totalTimeMinutes": 100, "globalAccuracy": 80, "totalSessions": 5, "dailyGoalPercent": 100},
    "difficultWords": [{"word": "test", "errorCount": 5}],
    "sessions": [{"date": "2026-03-01", "totalMinutes": 20, "correct": 10, "wrong": 2}]
}

try:
    pdf_bytes = export_pdf.generate_stats_pdf(data)
    with open('test_stats.pdf', 'wb') as f:
        # Check if it's already bytes
        if isinstance(pdf_bytes, str):
            f.write(pdf_bytes.encode('latin1'))
            print("Was string. Saved using latin1.")
        else:
            f.write(pdf_bytes)
            print("Was bytes. Saved directly.")
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
