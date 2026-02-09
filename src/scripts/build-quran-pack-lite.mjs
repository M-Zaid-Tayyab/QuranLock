import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { XMLParser } from "fast-xml-parser";

const DEFAULT_OUT = path.resolve(process.cwd(), "artifacts/quran-pack.db");
const ARABIC_URL =
  process.env.QURAN_ARABIC_URL ??
  "https://tanzil.net/res/text/uthmani/quran-uthmani.txt";
const TRANSLATION_URL =
  process.env.QURAN_TRANSLATION_URL ?? "https://tanzil.net/trans/en.sahih";
const METADATA_URL =
  process.env.QURAN_METADATA_URL ??
  "https://tanzil.net/res/text/metadata/quran-data.xml";

const OUT_PATH = process.env.QURAN_PACK_OUT ?? DEFAULT_OUT;

const fetchText = async (url, options) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "QuranLock/pack-builder",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  return res.text();
};

const readTextFile = async (filePath) => {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  return fs.readFile(resolved, "utf8");
};

const fetchArabicText = async () => {
  const fromFile = await readTextFile(process.env.QURAN_ARABIC_PATH);
  if (fromFile) return fromFile;
  return fetchText(ARABIC_URL);
};

const parseLines = (raw) => {
  const map = new Map();
  const order = [];
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parts = line.split("|");
      if (parts.length < 3) return;
      const sura = Number(parts[0]);
      const ayah = Number(parts[1]);
      const text = parts.slice(2).join("|").trim();
      if (!sura || !ayah) return;
      const key = `${sura}:${ayah}`;
      map.set(key, text);
      order.push({ sura, ayah, key });
    });
  return { map, order };
};

const parseMetadata = (raw) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });
  const xml = parser.parse(raw);
  const root = xml.quran ?? xml;
  const suraNodes = root.sura ?? root.suras?.sura ?? [];
  if (!suraNodes.length) {
    throw new Error("Unable to read sura metadata");
  }

  const suraByIndex = new Map();
  const pageStarts = [];

  const normalizedSuras = Array.isArray(suraNodes) ? suraNodes : [suraNodes];
  normalizedSuras.forEach((sura) => {
    const index = Number(sura.index);
    if (!index) return;
    suraByIndex.set(index, {
      name: sura.name ?? `Surah ${index}`,
      tname: sura.tname ?? sura.name ?? `Surah ${index}`,
    });
  });

  const pagesNode = root.pages?.page ?? root.page ?? [];
  const normalizedPages = Array.isArray(pagesNode) ? pagesNode : [pagesNode];
  normalizedPages.forEach((page) => {
    const pageIndex = Number(page.index);
    const sura = Number(page.sura);
    const aya = Number(page.aya);
    if (!pageIndex || !sura || !aya) return;
    pageStarts.push({ page: pageIndex, sura, aya });
  });

  return { suraByIndex, pageStarts };
};

const buildPages = ({ order, arabic, translation, suraByIndex, pageByKey }) => {
  const pages = new Map();
  order.forEach(({ sura, ayah, key }) => {
    const page = pageByKey.get(key);
    if (!page) return;
    const suraInfo = suraByIndex.get(sura);
    const pageEntry =
      pages.get(page) ??
      {
        page,
        surahName: suraInfo?.tname ?? `Surah ${sura}`,
        rangeLabel: "",
        verses: [],
      };
    pageEntry.verses.push({
      key,
      arabic: arabic.get(key) ?? "",
      translation: translation.get(key) ?? "",
    });
    pages.set(page, pageEntry);
  });

  pages.forEach((pageEntry) => {
    if (!pageEntry.verses.length) return;
    const first = pageEntry.verses[0].key;
    const last = pageEntry.verses[pageEntry.verses.length - 1].key;
    const [firstSura, firstAyah] = first.split(":").map(Number);
    const [lastSura, lastAyah] = last.split(":").map(Number);
    if (firstSura === lastSura) {
      pageEntry.surahName =
        suraByIndex.get(firstSura)?.tname ?? `Surah ${firstSura}`;
      pageEntry.rangeLabel = `Ayah ${firstAyah}-${lastAyah}`;
    } else {
      pageEntry.surahName =
        suraByIndex.get(firstSura)?.tname ?? `Surah ${firstSura}`;
      pageEntry.rangeLabel = `Ayah ${first} - ${last}`;
    }
  });

  return [...pages.values()].sort((a, b) => a.page - b.page);
};

const writeSqlite = (pages, outPath) => {
  const dir = path.dirname(outPath);
  return fs
    .mkdir(dir, { recursive: true })
    .then(() => {
      const db = new Database(outPath);
      db.exec("PRAGMA journal_mode = OFF;");
      db.exec("PRAGMA synchronous = OFF;");
      db.exec("DROP TABLE IF EXISTS pages;");
      db.exec(
        "CREATE TABLE pages (page_number INTEGER PRIMARY KEY, data TEXT NOT NULL);",
      );
      const stmt = db.prepare(
        "INSERT INTO pages (page_number, data) VALUES (?, ?)",
      );
      const insert = db.transaction((rows) => {
        rows.forEach((row) => {
          stmt.run(row.page, JSON.stringify(row));
        });
      });
      insert(pages);
      db.close();
    })
    .then(() => outPath);
};

const main = async () => {
  console.log("Downloading Quran sources…");
  const [arabicRaw, translationRaw, metadataRaw] = await Promise.all([
    fetchArabicText(),
    (async () => {
      const fromFile = await readTextFile(process.env.QURAN_TRANSLATION_PATH);
      if (fromFile) return fromFile;
      return fetchText(TRANSLATION_URL);
    })(),
    (async () => {
      const fromFile = await readTextFile(process.env.QURAN_METADATA_PATH);
      if (fromFile) return fromFile;
      return fetchText(METADATA_URL);
    })(),
  ]);

  const { map: arabic, order } = parseLines(arabicRaw);
  if (!order.length) {
    throw new Error("Arabic text download did not return expected format.");
  }
  const { map: translation } = parseLines(translationRaw);
  const { suraByIndex, pageStarts } = parseMetadata(metadataRaw);

  const pageByKey = new Map();
  const indexByKey = new Map(order.map((item, idx) => [item.key, idx]));
  const startPoints = pageStarts
    .map((start) => {
      const key = `${start.sura}:${start.aya}`;
      const orderIndex = indexByKey.get(key);
      if (orderIndex == null) return null;
      return { page: start.page, orderIndex };
    })
    .filter(Boolean)
    .sort((a, b) => a.page - b.page);

  if (!startPoints.length) {
    throw new Error(
      "Metadata file does not include page boundaries. Download quran-data.xml from Tanzil metadata with <pages>.",
    );
  }

  let currentStart = 0;
  for (let i = 0; i < order.length; i += 1) {
    const nextStart = startPoints[currentStart + 1];
    if (nextStart && i >= nextStart.orderIndex) {
      currentStart += 1;
    }
    const pageNumber = startPoints[currentStart].page;
    pageByKey.set(order[i].key, pageNumber);
  }

  const pages = buildPages({
    order,
    arabic,
    translation,
    suraByIndex,
    pageByKey,
  });

  if (!pages.length) {
    throw new Error("No pages were generated. Check metadata format.");
  }

  console.log(`Writing SQLite pack (${pages.length} pages)…`);
  const out = await writeSqlite(pages, OUT_PATH);
  console.log(`Done: ${out}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
