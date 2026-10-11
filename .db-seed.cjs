// Adds a synthetic, repeatable year of cinema activity for the Analytics page.
// Default is a rollback-only preview. Run with --apply to commit the new demo rows.
const fs = require("node:fs");
const mysql = require("mysql2/promise");
const standalone = require.main === module;
const productionTarget = standalone && process.argv.includes("--production");
const vercelRuntime = standalone && process.argv.includes("--vercel-env");

const envFile = productionTarget ? ".env.production.local" : ".env.local";
for (const line of standalone && !vercelRuntime ? fs.readFileSync(envFile, "utf8").split(/\r?\n/) : []) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match || (!productionTarget && process.env[match[1]])) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env[match[1]] = value;
}

const demoEmail = (n) => `analytics-demo-seed-${String(n).padStart(3, "0")}@example.test`;
const sqlDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const sqlDateTime = (date, time) => `${date} ${time}:00`;
const bangkokDateParts = () => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
}).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
const nthWeekday = (year, month, weekday, nth) => {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((weekday - firstDay + 7) % 7) + (nth - 1) * 7;
};
const hash = (a, b, c) => (a * 7919 + b * 104729 + c * 15485863 + 97) % 2147483647;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

async function main(options = {}) {
  const isProduction = options.productionTarget ?? productionTarget;
  const applying = options.apply ?? process.argv.includes("--apply");
  const silent = options.silent ?? false;
  if (isProduction && ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"].some((key) => !process.env[key])) {
    throw new Error("The Vercel production database settings are incomplete; configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME first.");
  }
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000,
  });
  try {
    const [[databaseRow]] = await db.query("SELECT DATABASE() AS name");
    if (!databaseRow.name) throw new Error("No database is selected.");
    const host = process.env.DB_HOST || "";
    if (isProduction ? /localhost|127\.0\.0\.1/i.test(host) : !/localhost|127\.0\.0\.1/i.test(host)) {
      throw new Error(isProduction ? "--production requires a non-local production host." : "Local mode is restricted to localhost; use --production for the production env file.");
    }
    await db.beginTransaction();

    const [[today]] = await db.query("SELECT DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), '%Y-%m-%d') AS bangkokDate");
    const [movies] = await db.query("SELECT Movie_ID AS id, Movie_Duration AS duration FROM movie ORDER BY Movie_ID");
    const [theaters] = await db.query("SELECT th.Theater_ID AS id, th.Branch_ID AS branchId, th.Theater_Type_ID AS typeId FROM theater th ORDER BY th.Theater_ID");
    const [seats] = await db.query("SELECT Seat_ID AS id, Theater_ID AS theaterId, Seat_Type_ID AS typeId FROM seat ORDER BY Theater_ID, Seat_Row, Seat_Column");
    const [seatTypes] = await db.query("SELECT Seat_Type_ID AS id, Seat_Type_Name AS name FROM seat_type ORDER BY Seat_Type_ID");
    const [slots] = await db.query("SELECT Day_Time_Slot_ID AS id, Slot_Code AS code FROM day_time_slot");
    const [priceRows] = await db.query("SELECT Branch_ID AS branchId, Theater_Type_ID AS typeId, Seat_Type_ID AS seatTypeId, Day_Time_Slot_ID AS slotId, Price_ID AS id, Price_Amount AS amount FROM price");
    const [languages] = await db.query("SELECT Language_ID AS id, Language_Code AS code FROM language WHERE Language_Code IN ('th','en') ORDER BY Language_ID");
    const [cards] = await db.query("SELECT mc.Card_ID AS id, mt.Tier_Type AS type FROM member_card mc JOIN membership_tier mt ON mt.Tier_ID=mc.Tier_ID WHERE mc.Card_Status='ACTIVE' AND mc.Expiry_Date >= CURRENT_DATE ORDER BY mc.Card_ID");
    const [redemptions] = await db.query("SELECT Card_ID AS cardId, Movie_ID AS movieId FROM member_pass_redemption");
    const [methods] = await db.query("SELECT Payment_Method_ID AS id FROM payment_method ORDER BY Payment_Method_ID LIMIT 1");
    const [providers] = await db.query("SELECT Provider_Account_ID AS id FROM payment_provider_account ORDER BY Provider_Account_ID LIMIT 1");
    const [existingShowtimes] = await db.query("SELECT Showtime_ID AS id, Theater_ID AS theaterId, Movie_ID AS movieId, DATE_FORMAT(Start_Time,'%Y-%m-%d %H:%i:%s') AS startTime, Showtime_Status AS status FROM showtime");
    const [existingCustomers] = await db.query("SELECT Customer_ID AS id, Email AS email FROM customer WHERE Email LIKE 'analytics-demo-seed-%@example.test'");
    const [existingPayments] = await db.query("SELECT Idempotency_Key AS keyValue FROM payment WHERE Idempotency_Key LIKE 'analytics-demo-%'");

    if (!movies.length || !theaters.length || !seats.length || !priceRows.length || !cards.length || !methods.length || !providers.length) {
      throw new Error("Required movie, theater, seat, price, membership, or payment records are missing.");
    }
    const thaiLanguage = languages.find((row) => row.code === "th");
    const englishLanguage = languages.find((row) => row.code === "en");
    const standardTypeId = seatTypes.find((row) => /standard|normal/i.test(row.name))?.id;
    const weekdaySlot = slots.find((row) => row.code === "WEEKDAY_EVENING")?.id;
    const weekendSlot = slots.find((row) => row.code === "WEEKEND_AFTERNOON")?.id;
    if (!thaiLanguage || !englishLanguage || !standardTypeId || !weekdaySlot || !weekendSlot) {
      throw new Error("Expected Thai/English languages, standard seats, and weekday/weekend pricing slots are required.");
    }

    const seatsByTheater = new Map();
    for (const seat of seats.filter((row) => Number(row.typeId) === Number(standardTypeId))) {
      if (!seatsByTheater.has(Number(seat.theaterId))) seatsByTheater.set(Number(seat.theaterId), []);
      seatsByTheater.get(Number(seat.theaterId)).push(Number(seat.id));
    }
    const priceByKey = new Map(priceRows.map((row) => [`${row.branchId}|${row.typeId}|${row.seatTypeId}|${row.slotId}`, row]));
    const oldShowtimeByKey = new Map(existingShowtimes.map((row) => [`${row.theaterId}|${row.startTime}`, row]));
    const existingCustomerByEmail = new Map(existingCustomers.map((row) => [row.email, Number(row.id)]));
    const existingPaymentKeys = new Set(existingPayments.map((row) => row.keyValue));
    const passCards = cards.filter((row) => row.type === "M_PASS").map((row) => Number(row.id));
    const genCards = cards.filter((row) => row.type === "M_GEN").map((row) => Number(row.id));
    const redeemed = new Set(redemptions.map((row) => `${row.cardId}|${row.movieId}`));
    const movieCount = Math.min(12, movies.length);
    const todayParts = bangkokDateParts();
    const cutoff = today.bangkokDate || sqlDate(todayParts.year, todayParts.month - 1, todayParts.day);
    const sessions = [];
    let monthIndex = 0;

    for (let offset = 11; offset >= 0; offset--) {
      const first = new Date(Date.UTC(todayParts.year, todayParts.month - 1 - offset, 1));
      const year = first.getUTCFullYear(), month = first.getUTCMonth();
      const dates = [
        { day: nthWeekday(year, month, 3, 2), weekend: false, time: "18:30", slotId: weekdaySlot },
        { day: nthWeekday(year, month, 6, 4), weekend: true, time: "14:00", slotId: weekendSlot },
      ];
      for (const sessionDate of dates) {
        const date = sqlDate(year, month, sessionDate.day);
        if (date >= cutoff) continue;
        for (let theaterIndex = 0; theaterIndex < theaters.length; theaterIndex++) {
          const theater = theaters[theaterIndex];
          const movie = movies[(monthIndex * 5 + theaterIndex * 2 + (sessionDate.weekend ? 3 : 0)) % movieCount];
          const seatList = seatsByTheater.get(Number(theater.id)) || [];
          const price = priceByKey.get(`${theater.branchId}|${theater.typeId}|${standardTypeId}|${sessionDate.slotId}`);
          if (!seatList.length || !price) continue;
          const startTime = sqlDateTime(date, sessionDate.time);
          const key = `${theater.id}|${startTime}`;
          const existing = oldShowtimeByKey.get(key);
          if (existing && !(existing.status === "COMPLETED" && Number(existing.movieId) === Number(movie.id))) continue;
          const seed = hash(monthIndex + 1, Number(theater.id), sessionDate.weekend ? 1 : 0);
          let attendance = (sessionDate.weekend ? 22 : 8) + (seed % (sessionDate.weekend ? 20 : 12));
          if (month === 11 || month === 3) attendance = Math.round(attendance * 1.18);
          attendance = clamp(attendance, 4, Math.min(50, seatList.length));
          const orderCount = Math.max(2, Math.ceil(attendance / (sessionDate.weekend ? 5 : 4)));
          sessions.push({ monthIndex, theaterIndex, theater, movie, seatList, price, date, time: sessionDate.time, startTime, slotId: sessionDate.slotId, weekend: sessionDate.weekend, attendance, orderCount, marker: `${date.replaceAll("-", "")}-${theater.id}-${sessionDate.weekend ? "sat" : "wed"}` });
        }
      }
      monthIndex++;
    }

    const newCustomerEmails = [];
    for (let index = 1; index <= 64; index++) if (!existingCustomerByEmail.has(demoEmail(index))) newCustomerEmails.push(demoEmail(index));
    if (newCustomerEmails.length) {
      const values = newCustomerEmails.map((email, index) => [
        `Demo Guest ${String(index + 1).padStart(2, "0")}`, "Analytics", email,
        `+668${String(index + 1).padStart(8, "0")}`,
      ]);
      await db.query("INSERT INTO customer (Customer_FirstName, Customer_LastName, Email, Phone) VALUES ?", [values]);
    }
    const [customers] = await db.query("SELECT Customer_ID AS id, Email AS email FROM customer WHERE Email LIKE 'analytics-demo-seed-%@example.test' ORDER BY Email");
    const customerByEmail = new Map(customers.map((row) => [row.email, Number(row.id)]));

    const showtimeRows = [];
    const newShowtimeKeys = new Set();
    for (const session of sessions) {
      const key = `${session.theater.id}|${session.startTime}`;
      const existing = oldShowtimeByKey.get(key);
      if (existing) { session.showtimeId = Number(existing.id); continue; }
      if (newShowtimeKeys.has(key)) throw new Error(`Duplicate generated showtime: ${key}`);
      newShowtimeKeys.add(key);
      session.showtimeStart = showtimeRows.length;
      const duration = Number(session.movie.duration);
      const end = new Date(Date.parse(`${session.date}T${session.time}:00Z`) + duration * 60000);
      const endTime = `${end.toISOString().slice(0, 10)} ${end.toISOString().slice(11, 19)}`;
      showtimeRows.push([session.startTime, endTime, "COMPLETED", Number(session.movie.id), Number(session.theater.id), Number(thaiLanguage.id), Number(englishLanguage.id)]);
    }
    if (showtimeRows.length) {
      await db.query("INSERT INTO showtime (Start_Time, End_Time, Showtime_Status, Movie_ID, Theater_ID, Audio_Language_ID, Subtitle_Language_ID) VALUES ?", [showtimeRows]);
      const [insertedShowtimes] = await db.query("SELECT Showtime_ID AS id, Theater_ID AS theaterId, Movie_ID AS movieId, DATE_FORMAT(Start_Time,'%Y-%m-%d %H:%i:%s') AS startTime FROM showtime WHERE Showtime_Status='COMPLETED' AND Start_Time IN (?)", [sessions.filter((session) => session.showtimeId == null).map((session) => session.startTime)]);
      const insertedByKey = new Map(insertedShowtimes.map((row) => [`${row.theaterId}|${row.startTime}`, Number(row.id)]));
      for (const session of sessions) if (session.showtimeId == null) {
        session.showtimeId = insertedByKey.get(`${session.theater.id}|${session.startTime}`);
        if (!session.showtimeId) throw new Error(`Inserted showtime could not be read back: ${session.startTime}`);
      }
    }

    const bookingRows = [], ticketRows = [], paymentRows = [], redemptionRows = [];
    const plannedPayments = new Set(existingPaymentKeys);
    let totalBookingMarker = 0;
    for (const session of sessions) {
      const markerPrefix = `analytics-demo-${session.marker}`;
      if (Array.from(plannedPayments).some((key) => key.startsWith(markerPrefix))) continue;
      const sizes = Array(session.orderCount).fill(Math.floor(session.attendance / session.orderCount));
      for (let remainder = session.attendance % session.orderCount, i = 0; remainder > 0; remainder--, i = (i + 1) % sizes.length) sizes[i]++;
      let seatOffset = 0;
      for (let orderIndex = 0; orderIndex < sizes.length; orderIndex++) {
        const idempotencyKey = `${markerPrefix}-${orderIndex + 1}`;
        if (plannedPayments.has(idempotencyKey)) { seatOffset += sizes[orderIndex]; continue; }
        const monthSeed = hash(session.monthIndex + 1, Number(session.theater.id), orderIndex + (session.weekend ? 10 : 0));
        const customerId = customerByEmail.get(demoEmail(monthSeed % 64 + 1));
        if (!customerId) throw new Error("Synthetic customer pool could not be resolved.");
        const bookingDate = new Date(Date.parse(`${session.date}T12:00:00Z`) - (1 + monthSeed % 5) * 86400000);
        const bookingDateTime = `${bookingDate.toISOString().slice(0, 10)} ${String(10 + (monthSeed % 9)).padStart(2, "0")}:${String((monthSeed * 7) % 60).padStart(2, "0")}:00`;
        const bookingIndex = bookingRows.length;
        bookingRows.push([bookingDateTime, "CONFIRMED", "DEMO_ANALYTICS", customerId, session.showtimeId]);
        let total = 0;
        let memberCardId = null;
        let passCardId = null;
        const membershipRoll = monthSeed % 100;
        if (membershipRoll < 34 && genCards.length) memberCardId = genCards[monthSeed % genCards.length];
        else if (membershipRoll < 49 && passCards.length) {
          for (let attempt = 0; attempt < passCards.length; attempt++) {
            const candidate = passCards[(monthSeed + attempt) % passCards.length];
            if (!redeemed.has(`${candidate}|${session.movie.id}`)) { passCardId = candidate; redeemed.add(`${candidate}|${session.movie.id}`); break; }
          }
        }
        for (let ticketIndex = 0; ticketIndex < sizes[orderIndex]; ticketIndex++) {
          const seatId = session.seatList[seatOffset + ticketIndex];
          const usePass = ticketIndex === 0 && passCardId != null;
          const sold = usePass ? 0 : Number(session.price.amount);
          total += sold;
          ticketRows.push([bookingIndex, Number(seatId), Number(session.showtimeId), Number(session.theater.id), Number(session.price.id), sold, null, usePass ? passCardId : memberCardId]);
        }
        if (passCardId != null) {
          const passDate = bookingDateTime;
          redemptionRows.push([passCardId, Number(session.movie.id), Number(session.showtimeId), passDate]);
        }
        const paymentDateTime = new Date(Date.parse(`${bookingDateTime.replace(" ", "T")}Z`) + (20 + monthSeed % 160) * 60000).toISOString().replace("T", " ").slice(0, 19);
        paymentRows.push([total, paymentDateTime, "SUCCESS", bookingIndex, Number(methods[0].id), Number(providers[0].id), idempotencyKey, `DEMO-${idempotencyKey.slice(-35)}`]);
        plannedPayments.add(idempotencyKey);
        seatOffset += sizes[orderIndex];
        totalBookingMarker++;
      }
    }

    if (ticketRows.length > sessions.reduce((sum, session) => sum + session.seatList.length, 0)) throw new Error("Generated tickets exceed seat inventory.");
    for (const session of sessions) {
      if (session.attendance > session.seatList.length) throw new Error(`Generated attendance exceeds hall ${session.theater.id} capacity.`);
    }

    if (bookingRows.length) {
      await db.query("INSERT INTO booking (Booking_DateTime, Booking_Status, Channel_Type, Customer_ID, Showtime_ID) VALUES ?", [bookingRows]);
      const [[firstBooking]] = await db.query("SELECT LAST_INSERT_ID() AS id");
      const firstBookingId = Number(firstBooking.id);
      for (const ticket of ticketRows) ticket[0] = firstBookingId + ticket[0];
      for (const payment of paymentRows) payment[3] = firstBookingId + payment[3];
      await db.query("INSERT INTO ticket (Booking_ID, Seat_ID, Showtime_ID, Theater_ID, Price_ID, Sold_Price, Promotion_ID, Member_Card_ID) VALUES ?", [ticketRows]);
      await db.query("INSERT INTO payment (Paid_Amount, Payment_DateTime, Payment_Status, Booking_ID, Payment_Method_ID, Provider_Account_ID, Idempotency_Key, Provider_Transaction_ID) VALUES ?", [paymentRows]);
      if (redemptionRows.length) await db.query("INSERT INTO member_pass_redemption (Card_ID, Movie_ID, Showtime_ID, Redeemed_At) VALUES ?", [redemptionRows]);
    }

    const plan = { database: databaseRow.name, mode: applying ? "APPLY" : "DRY RUN (ROLLBACK)", generatedShowtimes: showtimeRows.length, seededCustomers: newCustomerEmails.length, newBookings: bookingRows.length, newTickets: ticketRows.length, passRedemptions: redemptionRows.length, expectedMonths: [...new Set(sessions.map((session) => session.date.slice(0, 7)))].length };
    if (applying) await db.commit();
    else await db.rollback();
    if (!silent) console.log(JSON.stringify(plan, null, 2));
    return plan;
  } catch (error) {
    await db.rollback().catch(() => {});
    if (!silent) console.error(`Analytics seed ${applying ? "failed" : "preview failed"}: ${error.code || error.name || "unknown error"}: ${error.message || ""}`);
    throw error;
  } finally {
    await db.end();
  }
}

if (standalone) main().catch(() => { process.exitCode = 1; });
module.exports = main;
