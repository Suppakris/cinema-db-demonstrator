// Replace the first seven placeholder catalog entries with source-checked films and posters.
// Review scores are snapshots checked on 2026-10-11. Default behavior rolls back.
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

const movies = [
  { id: 1, title: "Dune: Part Two", date: "2024-03-01", duration: 166, rating: "PG-13", poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg", imdb: "8.4", rt: "92%", imdbUrl: "https://www.imdb.com/title/tt15239678/", rtUrl: "https://www.rottentomatoes.com/m/dune_part_two" },
  { id: 2, title: "Oppenheimer", date: "2023-07-21", duration: 180, rating: "R", poster: "https://image.tmdb.org/t/p/w500/ptpr0kGAckfQkJeJIt8st5dglvd.jpg", imdb: "8.2", rt: "93%", imdbUrl: "https://www.imdb.com/title/tt15398776/", rtUrl: "https://www.rottentomatoes.com/m/oppenheimer_2023" },
  { id: 3, title: "Barbie", date: "2023-07-21", duration: 114, rating: "PG-13", poster: "https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", imdb: "6.8", rt: "88%", imdbUrl: "https://www.imdb.com/title/tt1517268/", rtUrl: "https://www.rottentomatoes.com/m/barbie" },
  { id: 4, title: "Spider-Man: Across the Spider-Verse", date: "2023-06-02", duration: 140, rating: "PG", poster: "https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg", imdb: "8.5", rt: "95%", imdbUrl: "https://www.imdb.com/title/tt9362722/", rtUrl: "https://www.rottentomatoes.com/m/spider_man_across_the_spider_verse" },
  { id: 5, title: "Godzilla Minus One", date: "2023-11-03", duration: 124, rating: "PG-13", poster: "https://image.tmdb.org/t/p/w500/hkxxMIGaiCTmrEArK7J56JTKUlB.jpg", imdb: "7.6", rt: "99%", imdbUrl: "https://www.imdb.com/title/tt23289160/", rtUrl: "https://www.rottentomatoes.com/m/godzilla_minus_one" },
  { id: 6, title: "Top Gun: Maverick", date: "2022-05-27", duration: 130, rating: "PG-13", poster: "https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg", imdb: "8.2", rt: "96%", imdbUrl: "https://www.imdb.com/title/tt1745960/", rtUrl: "https://www.rottentomatoes.com/m/top_gun_maverick" },
  { id: 7, title: "How to Make Millions Before Grandma Dies", date: "2024-04-04", duration: 125, rating: "TV-PG", poster: "https://resizing.flixster.com/n2K60ncZxHrAskp83Y2CPp5Z1hE%3D/68x102/v2/https%3A//resizing.flixster.com/n4s66mb-CWrud-4WOKqxAS_6V4U%3D/ems.cHJkLWVtcy1hc3NldHMvbW92aWVzLzBkM2U1YmUwLTQxYmItNDU5OS05MWViLTE2YTU2MDQzZjYzNS5qcGc%3D", imdb: "7.9", rt: "98%", imdbUrl: "https://www.imdb.com/title/tt31392609/", rtUrl: "https://www.rottentomatoes.com/m/how_to_make_millions_before_grandma_dies" },
];

async function main(options = {}) {
  const isProduction = options.productionTarget ?? productionTarget;
  const apply = options.apply ?? process.argv.includes("--apply");
  const refresh = options.refresh ?? process.argv.includes("--refresh");
  const silent = options.silent ?? false;
  if (isProduction && ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"].some((key) => !process.env[key])) {
    throw new Error("The Vercel production database settings are incomplete; configure DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME first.");
  }
  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }, connectTimeout: 10000,
  });
  try {
    const [[dbInfo]] = await db.query("SELECT DATABASE() AS dbName, @@hostname AS hostName");
    if (!dbInfo.dbName) throw new Error("No database is selected.");
    const host = process.env.DB_HOST || "";
    if (isProduction ? /localhost|127\.0\.0\.1/i.test(host) : !/localhost|127\.0\.0\.1/i.test(host)) {
      throw new Error(isProduction ? "--production requires a non-local production host." : "Local mode is restricted to localhost; use --production for the production env file.");
    }
    await db.beginTransaction();
    const [sources] = await db.query("SELECT Source_ID AS id, Source_Code AS code FROM review_source WHERE Source_Code IN ('IMDB','ROTTEN_TOMATOES')");
    const imdbId = sources.find((s) => s.code === "IMDB")?.id;
    const rtId = sources.find((s) => s.code === "ROTTEN_TOMATOES")?.id;
    if (!imdbId || !rtId) throw new Error("IMDb and Rotten Tomatoes review sources are required.");

    if (process.argv.includes("--audit")) {
      const [rows] = await db.query(
        "SELECT m.Movie_ID AS id, m.Title AS title, m.Poster_Image AS posterImage, m.Original_Release_Date AS releaseDate, m.Movie_Duration AS runtime, s.Source_Code AS source, r.Raw_Score AS score, r.Source_URL AS sourceUrl, r.Updated_At AS updatedAt FROM movie m JOIN movie_review r ON r.Movie_ID=m.Movie_ID JOIN review_source s ON s.Source_ID=r.Source_ID WHERE m.Movie_ID BETWEEN 1 AND 7 ORDER BY m.Movie_ID, s.Source_Code",
      );
      const [[totals]] = await db.query("SELECT COUNT(*) AS totalMovies, SUM(Title LIKE 'Demo Movie %') AS remainingPlaceholders FROM movie");
      await db.rollback();
      if (rows.length !== 14 || rows.some((row) => !row.sourceUrl || !row.posterImage)) throw new Error("Expected seven movies with posters and fourteen source-linked review snapshots.");
      const audit = { database: dbInfo.dbName, totalMovies: Number(totals.totalMovies), remainingPlaceholders: Number(totals.remainingPlaceholders), realFilmReviewRows: rows };
      if (!silent) console.log(JSON.stringify(audit, null, 2));
      return audit;
    }

    for (const movie of movies) {
      const [[current]] = await db.execute("SELECT Title AS title FROM movie WHERE Movie_ID=?", [movie.id]);
      if (!current || (current.title !== `Demo Movie ${String(movie.id).padStart(2, "0")}` && !(refresh && current.title === movie.title))) {
        throw new Error(`Movie ${movie.id} is not the expected demo placeholder; refusing to overwrite.`);
      }
      const [[reviewCount]] = await db.execute("SELECT COUNT(*) AS n FROM movie_review WHERE Movie_ID=? AND Source_ID IN (?,?)", [movie.id, imdbId, rtId]);
      if (Number(reviewCount.n) !== 2) throw new Error(`Movie ${movie.id} must have exactly two review rows.`);
      if (apply) {
        await db.execute("UPDATE movie SET Title=?, Original_Release_Date=?, Movie_Duration=?, Age_Rating=?, Poster_Image=? WHERE Movie_ID=?", [movie.title, movie.date, movie.duration, movie.rating, movie.poster, movie.id]);
        await db.execute("UPDATE movie_review SET Raw_Score=?, Normalized_Score=?, Source_URL=?, Updated_At=UTC_TIMESTAMP() WHERE Movie_ID=? AND Source_ID=?", [movie.imdb, Number(movie.imdb) * 10, movie.imdbUrl, movie.id, imdbId]);
        await db.execute("UPDATE movie_review SET Raw_Score=?, Normalized_Score=?, Source_URL=?, Updated_At=UTC_TIMESTAMP() WHERE Movie_ID=? AND Source_ID=?", [movie.rt, Number.parseInt(movie.rt, 10), movie.rtUrl, movie.id, rtId]);
      }
    }
    const [preview] = await db.query("SELECT Movie_ID AS id, Title AS title FROM movie WHERE Movie_ID BETWEEN 1 AND 7 ORDER BY Movie_ID");
    if (apply) await db.commit(); else await db.rollback();
    const result = { database: dbInfo.dbName, mode: apply ? "APPLY" : "DRY RUN (ROLLBACK)", films: preview };
    if (!silent) {
      console.log(`${apply ? "Applied" : "Dry run; rolled back"} ${movies.length} real film records on the ${isProduction ? "production" : "local"} database.`);
      console.log(preview.map((m) => `${m.id}: ${m.title}`).join("\n"));
    }
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

if (standalone) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = main;
