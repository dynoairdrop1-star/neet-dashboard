// Vercel serverless function: sends the daily reminders automatically.
// A free cron service (cron-job.org) calls this URL every 15 minutes.
// At the times set in SCHEDULE (IST) it sends that reminder, with a different Borahae message & BTS chibi banner for each weekday.
//
// Environment Variables needed in Vercel:
//   ONESIGNAL_REST_API_KEY  -> OneSignal > Settings > Keys & IDs
//   CRON_SECRET             -> any long random text you choose

const APP_ID = process.env.ONESIGNAL_APP_ID || "1ca8032a-78c1-44ee-b597-9c84271b6565";
const SITE = "https://neet-dashboard-three.vercel.app";

// Times in India time (HH:MM, use multiples of 15 minutes)
const SCHEDULE = {
  morning: "07:00",
  medicine: "08:00",
  evening: "18:00",
  night: "22:00",
};

const TITLES = {
  morning: "☀️ Good Morning, Moon! (with JK)",
  medicine: "💊 Medicine Time with Jin",
  evening: "📚 Evening Revision with RM & Suga",
  night: "🌙 Good Night with V & BTS 💜",
};

// 7-Day BTS Member Chibi Banners (Monday = index 0 ... Sunday = index 6)
const BTS_BANNER_FILES = [
  "bts-mon.png", // Monday - RM
  "bts-tue.png", // Tuesday - Jin
  "bts-wed.png", // Wednesday - Suga
  "bts-thu.png", // Thursday - J-Hope
  "bts-fri.png", // Friday - Jimin
  "bts-sat.png", // Saturday - V
  "bts-sun.png"  // Sunday - Jungkook
];

// 7 messages per type, Monday first ... Sunday last (Borahae NEET Edition)
const MESSAGES = {
  morning: [
    "Monday RM morning! Naye hafte ki shuruaat. Plan banao aur chal padho 🚀📘",
    "Tuesday Jin morning! Aaj ka din tumhara hai. Pehle sabse mushkil chapter se shuru karo 💪🦙",
    "Wednesday Suga morning! Subah ka dimaag tez hota hai. Biology diagrams yaad kar lo 🧬🎧",
    "Thursday Hobi morning! Chhota target banao aur aaj hi poora karo 🎯🐿️",
    "Friday Jimin morning! Kal se behtar aaj. Ek chapter aur aage badho ✨🐥",
    "Saturday Taehyung morning! Weekend hai par NEET chhutti nahi leta. 2 ghante focus 📚🐻",
    "Sunday Jungkook morning! Golden Sunday, mock test aur revision se record todo 🐰🌟"
  ],
  medicine: [
    "Monday: RM yaad dila raha hai—medicine aur multivitamins paani ke saath lo 💧",
    "Tuesday: Jin ka reminder! Medicine ka time ho gaya, paani ke saath lena mat bhoolna 🦙",
    "Wednesday: Suga health pehle. Medicine le li na? 🌿",
    "Thursday: Hobi says chhota sa reminder: medicine aur multivitamins time! 💊",
    "Friday: Jimin warning! Medicine time! Phir full focus ke sath padhai par wapas 🐥",
    "Saturday: Taehyung check—medicine li ya nahi? Abhi le lo bas 1 minute 💜",
    "Sunday: Jungkook Sunday routine: medicine aur paani. Tum best kar rahe ho! 🐰"
  ],
  evening: [
    "Monday RM: Din khatam hone se pehle ek chapter aur revision ho jaye 🌇📘",
    "Tuesday Jin: Shaam ho gayi. Aaj ke notes ek baar palat lo 📝🦙",
    "Wednesday Suga: Lo-fi beats ke sath ek chhota mock test ya 20 MCQ ho jaye? 🎯🎧",
    "Thursday Hobi: Chai peeke wapas aa jao. Ek aur energetic session baaki hai ☕🐿️",
    "Friday Jimin: Aaj jo padha wo ek baar yaad karo. Wahi true revision hai 🧠🐥",
    "Saturday Taehyung: Shaam ka time kamzor topics ke liye best hai. We purple you! 📚🐻",
    "Sunday Jungkook: Aaj ka target revision ho gaya? Thoda aur, tum kar sakte ho! 💪🐰"
  ],
  night: [
    "Monday RM: Naye hafte ka pehla din poora. Rest well & recharge ✨📘",
    "Tuesday Jin: Aaj ka din accha raha. Phone side mein rakho aur chain se so jao 🌙🦙",
    "Wednesday Suga: Neend bhi taiyari ka hissa hai. Good night, sweet dreams 😴🎧",
    "Thursday Hobi: Kal ke liye bas 5 chapter ka plan sochke aaram se so jao 🌠🐿️",
    "Friday Jimin: Tum thak gaye ho par haare nahi. Peaceful sleep lo 💤🐥",
    "Saturday Taehyung: Raat ko screen band, subah fresh dimaag ke sath uthenge 🌙🐻",
    "Sunday Jungkook: Good night Moon! Kal ek naya hafta, naya mauka ✨🐰"
  ],
};

async function sendOne(type, restKey, dayIndex) {
  // Select daily BTS chibi banner based on weekday (dayIndex: 0 = Mon, 6 = Sun)
  const dailyBanner = SITE + "/" + BTS_BANNER_FILES[dayIndex];

  const body = {
    app_id: APP_ID,
    // Only people who switched this reminder on (tag = 1)
    filters: [{ field: "tag", key: type, relation: "=", value: "1" }],
    headings: { en: TITLES[type] },
    contents: { en: MESSAGES[type][dayIndex] },
    chrome_web_image: dailyBanner,
    chrome_web_icon: SITE + "/moon.png",
    ttl: 3600,
  };

  const r = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: (restKey.startsWith("os_") ? "Key " : "Basic ") + restKey },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { type, status: r.status, bannerUsed: dailyBanner, data };
}

module.exports = async (req, res) => {
  const restKey = (process.env.ONESIGNAL_REST_API_KEY || "").trim();
  const secret = process.env.CRON_SECRET;
  if (!restKey || !secret) return res.status(500).json({ error: "Missing environment variables" });
  if (req.query.key !== secret) return res.status(401).json({ error: "Unauthorized" });

  // India time now
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const dayIndex = (ist.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  let h = ist.getUTCHours();
  let m = Math.round(ist.getUTCMinutes() / 15) * 15;
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  const slot = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");

  // Test mode: /api/send?key=SECRET&test=night  -> sends that reminder right now
  const test = req.query.test;
  let types;
  if (test) {
    if (!MESSAGES[test]) return res.status(400).json({ error: "test must be one of: " + Object.keys(MESSAGES).join(", ") });
    types = [test];
  } else {
    types = Object.keys(SCHEDULE).filter((t) => SCHEDULE[t] === slot);
  }

  const results = [];
  for (const t of types) {
    try { results.push(await sendOne(t, restKey, dayIndex)); }
    catch (e) { results.push({ type: t, error: String(e) }); }
  }
  res.status(200).json({ slot, dayIndex, sent: types, results });
};
