export async function renderPdf(env, url) {
  if (!env.BROWSER) {
    throw new Error("BROWSER binding is not configured");
  }

  const pdf = await env.BROWSER.pdf({
    url,
    printBackground: true,
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  });

  return pdf;
}
