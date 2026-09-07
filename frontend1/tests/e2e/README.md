# E2E smoke + accessibility

Runs against a live dev server:

```bash
npm ci
pip install playwright && python -m playwright install --with-deps chromium
npm run dev &            # http://localhost:5173
python3 tests/e2e/smoke.py --base-url http://localhost:5173
```

It loads every public page, exercises each dropdown/combobox and modal once,
fails on console/page errors, and fails on serious or critical axe-core
violations (labels, focus traps, contrast).
