import { launch } from "@cloudflare/playwright";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function authorized(request, env) {
  const expected = env.API_TOKEN;
  const supplied = request.headers.get("authorization") || "";
  return !!expected && supplied === `Bearer ${expected}`;
}

function validHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch { return false; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "QUREO Cloudflare Browser Worker", browser: "Cloudflare Browser Run" });
    }
    if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
    if (request.method !== "POST" || url.pathname !== "/run") {
      return json({ ok: false, error: "Not found. Use POST /run" }, 404);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }

    if (!body || !validHttpUrl(body.url)) return json({ ok: false, error: "A valid http/https url is required" }, 400);
    const steps = Array.isArray(body.steps) ? body.steps : [];
    if (steps.length > 30) return json({ ok: false, error: "Maximum 30 steps per run" }, 400);

    let browser;
    try {
      browser = await launch(env.BROWSER, { keep_alive: 120000 });
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await page.goto(body.url, { waitUntil: "domcontentloaded", timeout: 45000 });

      for (const step of steps) {
        if (!step || typeof step !== "object") throw new Error("Invalid step");
        if (step.action === "click" && typeof step.selector === "string") {
          await page.locator(step.selector).first().click();
        } else if (step.action === "fill" && typeof step.selector === "string" && typeof step.value === "string") {
          await page.locator(step.selector).first().fill(step.value);
        } else if (step.action === "type" && typeof step.selector === "string" && typeof step.value === "string") {
          await page.locator(step.selector).first().type(step.value);
        } else if (step.action === "wait" && Number.isFinite(step.ms)) {
          await page.waitForTimeout(Math.max(0, Math.min(step.ms, 10000)));
        } else if (step.action === "text" && typeof step.selector === "string") {
          // Text extraction step; value is returned in the result list.
        } else {
          throw new Error(`Unsupported or invalid action: ${String(step.action)}`);
        }
      }

      const extracted = [];
      for (const step of steps) {
        if (step.action === "text" && typeof step.selector === "string") {
          extracted.push({ selector: step.selector, text: await page.locator(step.selector).first().innerText().catch(() => "") });
        }
      }
      const result = {
        ok: true,
        final_url: page.url(),
        title: await page.title().catch(() => ""),
        text: await page.locator("body").innerText().catch(() => ""),
        extracted,
        screenshot_base64: body.screenshot ? Buffer.from(await page.screenshot({ fullPage: false })).toString("base64") : null
      };
      await context.close();
      await browser.close();
      return json(result);
    } catch (error) {
      try { await browser?.close(); } catch {}
      return json({ ok: false, error: String(error?.message || error) }, 502);
    }
  }
};
