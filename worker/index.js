// Entry point delegating fetch to src/index and adding cron support
import worker, { MyDurableObject } from "../src/index.js";
import { renderPdf } from "./utils/renderPdf.js";
import { sendEmail } from "./utils/sendEmail.js";

async function sendWeeklyStaffReport(env) {
  const rawList = await env.STAFF_EMAILS?.get("staff_list");
  if (!rawList) return;

  let emails = [];
  try {
    emails = JSON.parse(rawList);
  } catch (err) {
    console.error("Failed to parse staff_list", err);
    return;
  }
  if (!Array.isArray(emails) || emails.length === 0) return;

  const reportUrl = `https://school-embed-site.workers.dev/reports/values?period=week&token=${env.STAFF_REPORT_SECRET}`;
  const pdf = await renderPdf(env, reportUrl);

  for (const email of emails) {
    try {
      await sendEmail({
        to: email,
        subject: "Weekly Values Report",
        body: "Please find attached this week’s values report.",
        attachment: {
          name: "Values-Weekly.pdf",
          data: pdf,
        },
      });
    } catch (err) {
      console.error("Email send failed", email, err);
    }
  }
}

export { MyDurableObject };
export default {
  fetch: worker.fetch,
  scheduled: async (event, env, ctx) => {
    ctx.waitUntil(sendWeeklyStaffReport(env));
  },
};
