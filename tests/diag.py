"""深度诊断 dsh-invoke 侧边栏按钮注入情况。"""
import json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:3080/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    page = ctx.new_page()

    logs = []
    def on_console(msg):
        logs.append({"type": msg.type, "text": msg.text[:500]})
    page.on("console", on_console)

    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(5000)

    page.screenshot(path="/tmp/diag-viewport.png")
    page.screenshot(path="/tmp/diag-full.png", full_page=True)

    result = page.evaluate("""async () => {
      await new Promise(r => setTimeout(r, 2000));
      const sidebarBtn = document.getElementById('dsh-invoke-sidebar-btn');
      const panelRoot = document.getElementById('dsh-invoke-root');

      const allButtons = Array.from(document.querySelectorAll('button')).slice(0, 50).map((b, i) => ({
        idx: i,
        text: (b.textContent||'').trim().slice(0, 60),
        ariaLabel: b.getAttribute('aria-label'),
        cls: (b.className||'').toString().slice(0, 100),
        role: b.getAttribute('role'),
        id: b.id || null
      }));

      function isNewSessionButton(b) {
        const text = (b.textContent ?? '').trim();
        const label = (b.getAttribute('aria-label') ?? '').trim();
        const haystacks = [text, label].filter(Boolean);
        return haystacks.some(
          (s) => /new\\s*session/i.test(s) || s.includes('新会话')
        );
      }
      const anchorCandidates = Array.from(document.querySelectorAll('button')).map(b => ({
        text: (b.textContent||'').trim().slice(0,60),
        ariaLabel: b.getAttribute('aria-label'),
        match: isNewSessionButton(b)
      }));

      const mod = window.__ModuleLoader__;
      let bundleInfo = null;
      try {
        const r = await fetch('/plugins/dsh-invoke/client.js?_=' + Date.now(), {cache: 'no-store'});
        const t = await r.text();
        bundleInfo = {
          size: t.length,
          hasChineseAnchor: t.includes('新会话'),
          hasIsNewSessionButton: t.includes('isNewSessionButton'),
          hasInjectSidebar: t.includes('injectSidebarButton'),
          hasMutationObserver: t.includes('MutationObserver'),
          headFirst200: t.slice(0, 200)
        };
      } catch(e) { bundleInfo = { error: e.message }; }

      const containers = {};
      ['[data-sidebar]', '[class*="sidebar" i]', 'aside', 'nav'].forEach(s => {
        try { containers[s] = !!document.querySelector(s); } catch(e) { containers[s] = 'ERR:'+e.message }
      });

      let firstBtnInfo = null;
      const firstBtn = document.querySelector('button');
      if (firstBtn) {
        firstBtnInfo = {
          text: (firstBtn.textContent||'').trim().slice(0,80),
          parentCls: (firstBtn.parentElement?.className||'').toString().slice(0,120),
          grandCls: (firstBtn.parentElement?.parentElement?.className||'').toString().slice(0,120),
          greatCls: (firstBtn.parentElement?.parentElement?.parentElement?.className||'').toString().slice(0,120)
        };
      }

      return {
        sidebarBtnExists: !!sidebarBtn,
        sidebarBtnOuterHTML: sidebarBtn ? sidebarBtn.outerHTML.slice(0, 1000) : null,
        panelRootExists: !!panelRoot,
        allButtons,
        anchorCandidates: anchorCandidates.slice(0, 15),
        moduleLoader: typeof mod,
        moduleLoaderHasLoad: mod ? typeof mod.load : null,
        bundleInfo,
        containers,
        firstBtnInfo,
        url: location.href,
        title: document.title
      };
    }""")

    print("=== RESULT ===")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("=== CONSOLE LOGS ===")
    for log in logs:
        print(f"[{log['type']}] {log['text']}")

    browser.close()
