// Vercel serverless function: sends the daily reminders automatically.
// A free cron service (cron-job.org) calls this URL every 15 minutes.
// At the times set in SCHEDULE (IST) it sends that reminder, with a different message for each weekday.
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
  morning: "☀️ Good Morning!",
  medicine: "💊 Medicine Time",
  evening: "📚 Good Evening!",
  night: "🌙 Good Night",
};

const BANNERS = {
  morning: SITE + "/banner-morning.png",
  medicine: SITE + "/banner-medicine.png",
  evening: SITE + "/banner-evening.png",
  night: SITE + "/banner-night.png",
};

// 7 messages per type, Monday first ... Sunday last
const MESSAGES = {
  morning: [
    "Naye hafte ki shuruaat. Plan banao aur chal padho 🚀",
    "Aaj ka din tumhara hai. Pehle sabse mushkil chapter se shuru karo 💪",
    "Subah ka dimaag sabse tez hota hai. Biology ke diagrams yaad kar lo 🧬",
    "Chhota target banao aur aaj hi poora karo 🎯",
    "Kal se behtar aaj. Ek chapter aur aage badho ✨",
    "Weekend ka din hai, par NEET chhutti nahi leta. 2 ghante focus 📚",
    "Naya din, nayi shuruaat. Paani piyo aur padhai shuru karo 📖",
  ],
  medicine: [
    "Medicine aur multivitamins paani ke saath le lo.",
    "Medicine ka time ho gaya. Paani ke saath lena mat bhoolna 💧",
    "Health pehle. Medicine le li?",
    "Chhota sa reminder: medicine aur multivitamins 🌿",
    "Medicine time! Phir padhai par wapas.",
    "Medicine li ya nahi? Abhi le lo, bas 1 minute 💊",
    "Roz ki aadat: medicine aur paani. Tum kar rahe ho, badhiya!",
  ],
  evening: [
    "Din khatam hone se pehle ek chapter aur 🌇",
    "Shaam ho gayi. Aaj ke notes ek baar palat lo 📝",
    "Ek chhota mock test ya 20 MCQ ho jaye? 🎯",
    "Chai peeke wapas aa jao. Ek aur session baaki hai ☕",
    "Aaj jo padha wo ek baar yaad karo. Wahi revision hai 🧠",
    "Shaam ka time kamzor topics ke liye best hai 📚",
    "Aaj ka revision ho gaya? Thoda aur, tum kar sakte ho 💪",
  ],
  night: [
    "Naye hafte ka pehla din poora. Rest well ✨",
    "Aaj ka din accha raha. Phone side mein rakho aur so jao 🌙",
    "Neend bhi taiyari ka hissa hai. Good night 😴",
    "Kal ke liye bas 5 chapter ka plan sochke so jao 🌠",
    "Tum thak gaye ho, par haare nahi. Aaram karo 💤",
    "Raat ko screen band, subah ko fresh dimaag 🌙",
    "Good night! Kal ek naya din, naya mauka ✨",
  ],
};

async function sendOne(type, restKey, dayIndex) {
  const body = {
    app_id: APP_ID,
    // Only people who switched this reminder on (tag = 1)
    filters: [{ field: "tag", key: type, relation: "=", value: "1" }],
    headings: { en: TITLES[type] },
    contents: { en: MESSAGES[type][dayIndex] },
    chrome_web_image: BANNERS[type],
    chrome_web_icon: SITE + "/moon.png",
    ttl: 3600,
  };
  const r = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Key " + restKey },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { type, status: r.status, data };
}

module.exports = async (req, res) => {
  const restKey = process.env.ONESIGNAL_REST_API_KEY;
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
