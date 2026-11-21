// Look after the lesson catalogue in Neon. Needs DATABASE_URL.
//   npx tsx scripts/lesson-catalogue.ts list [topic words]   newest 30 lessons
//   npx tsx scripts/lesson-catalogue.ts show <id>            one lesson in full
//   npx tsx scripts/lesson-catalogue.ts retire <id> <reason> stop serving a bad lesson
//   npx tsx scripts/lesson-catalogue.ts stats                lessons saved, reused and money saved
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL to the Neon feynman database");
const sql = neon(url);
const [cmd = "list", ...rest] = process.argv.slice(2);

if (cmd === "list") {
  const like = `%${rest.join(" ").toLowerCase()}%`;
  console.table(await sql`
    select id, shared, level, topic, idea, served, round(cost_usd, 4) as usd, created_at::date as made, retired_at is not null as retired
    from lessons where lower(topic) like ${like} order by id desc limit 30`);
} else if (cmd === "show") {
  console.log(JSON.stringify((await sql`select * from lessons where id = ${Number(rest[0])}`)[0], null, 2));
} else if (cmd === "retire") {
  const [id, ...why] = rest;
  await sql`update lessons set retired_at = now(), retired_reason = ${why.join(" ") || "Retired by hand"} where id = ${Number(id)}`;
  console.log(`Lesson ${id} retired.`);
} else if (cmd === "stats") {
  console.table(await sql`
    select count(*) as lessons, count(*) filter (where shared) as shared, coalesce(sum(served), 0) as reused,
           round(coalesce(sum(served * cost_usd), 0), 2) as usd_saved, round(coalesce(sum(cost_usd), 0), 2) as usd_spent
    from lessons`);
} else {
  console.log("Use list, show, retire or stats.");
}
