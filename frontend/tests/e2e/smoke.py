#!/usr/bin/env python3
"""End-to-end smoke + accessibility test for the public frontend.

For every public page it:
  1. loads the page and records console errors / page errors,
  2. opens each dropdown (native select + custom combobox) once,
  3. opens each modal trigger once and closes it,
  4. runs axe-core and reports serious/critical violations
     (missing labels, focus traps, colour contrast, ...).

Usage:
    python3 tests/e2e/smoke.py --base-url http://localhost:5173

Requires: playwright (chromium) and `npm ci` (axe-core comes from node_modules).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
AXE = ROOT / "node_modules" / "axe-core" / "axe.min.js"
SHOTS = ROOT / "tests" / "e2e" / "screenshots"

PAGES = ["/intro", "/login"]

# axe rules we treat as failures; everything else is reported as a warning.
BLOCKING_IMPACTS = {"serious", "critical"}


async def check_page(page, base_url: str, path: str) -> list[str]:
    failures: list[str] = []
    console: list[str] = []
    page.on(
        "console",
        lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None,
    )
    page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

    await page.goto(f"{base_url}{path}", wait_until="networkidle")

    # 1. every native dropdown gets opened / exercised once
    selects = await page.query_selector_all("select")
    for sel in selects:
        if await sel.is_disabled():
            continue
        options = await sel.query_selector_all("option")
        if len(options) > 1:
            await sel.select_option(index=1)
            await sel.select_option(index=0)

    # 2. every custom combobox trigger gets opened once
    combos = await page.query_selector_all('[role="combobox"]')
    for combo in combos:
        if await combo.is_disabled():
            continue
        await combo.click()
        await page.wait_for_timeout(120)
        await page.keyboard.press("Escape")

    # 3. every modal trigger gets opened and closed once
    for name in ("How it fits together",):
        trigger = page.get_by_role("button", name=name)
        if await trigger.count():
            await trigger.first.click()
            dialog = page.get_by_role("dialog")
            await dialog.wait_for(state="visible", timeout=3000)
            await page.keyboard.press("Escape")
            await dialog.wait_for(state="hidden", timeout=3000)

    SHOTS.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(SHOTS / f"{path.strip('/') or 'root'}.png"))

    # 4. accessibility scan
    if not AXE.exists():
        raise SystemExit(f"axe-core not found at {AXE} — run `npm ci` first.")
    await page.add_script_tag(path=str(AXE))
    result = await page.evaluate(
        "async () => await window.axe.run(document, "
        "{ resultTypes: ['violations'] })"
    )
    for v in result["violations"]:
        targets = ", ".join(n["target"][0] for n in v["nodes"][:3])
        line = f"[a11y:{v['impact']}] {path} {v['id']} — {v['help']} ({targets})"
        if v["impact"] in BLOCKING_IMPACTS:
            failures.append(line)
        else:
            print(f"  warning {line}")

    for entry in console:
        failures.append(f"[console] {path} {entry}")

    return failures


async def main(base_url: str) -> int:
    failures: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        for path in PAGES:
            page = await context.new_page()
            print(f"checking {path}")
            failures += await check_page(page, base_url, path)
            await page.close()
        await browser.close()

    if failures:
        print("\nFAILED:")
        for f in failures:
            print(f"  {f}")
        return 1
    print("\nAll pages rendered cleanly with no blocking accessibility violations.")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:5173")
    sys.exit(asyncio.run(main(ap.parse_args().base_url)))
