#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const VERSION = "1.0.0";
const DEFAULT_ROOT = "/home/vscode/.codex/sessions/2026";
const DEFAULT_OUT = path.resolve("slides/lt-20260730/aggregates/summary.json");
const DEFAULT_FROM = "2026-06-27";
const DEFAULT_TO = "2026-07-19";
const DEFAULT_URL = "http://127.0.0.1:18080/v1/chat/completions";
const LABELS = ["user_value", "technical_direction", "other"];

const PRODUCT_ANCHORS = [
  /SubBuddy/i,
  /サブスク|契約|見直し|利用量|利用時間|支出|更新日/,
  /iPhone|iOS|SwiftUI|Screen\s*Time|DeviceActivity/i,
  /TestFlight|Render|Apple.{0,8}(ログイン|認証)|tenant|subscription|usage/i,
  /apps\/(web|ios)|ProductUI|HomeView|Contracts?View|ReviewView/i,
];

const TALK_MARKERS = [
  /LT会|LT草案|LT準備|登壇|発表.{0,8}(資料|時間|構成|内容)|スライド/,
  /(?:発表|LT).{0,8}(?:タイトル|副題)|副題|聴衆|話す内容|台本|持ち時間|10分/,
  /ログ分析|集計方法|集計データ|意味単位|ユーザー目線.{0,10}(割合|集計)/,
  /grill-with-docs|grillを再開|grilling/i,
];

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, out: DEFAULT_OUT, from: DEFAULT_FROM, to: DEFAULT_TO, url: DEFAULT_URL, syntheticTest: false, countOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") options.root = argv[++i];
    else if (arg === "--out") options.out = path.resolve(argv[++i]);
    else if (arg === "--from") options.from = argv[++i];
    else if (arg === "--to") options.to = argv[++i];
    else if (arg === "--url") options.url = argv[++i];
    else if (arg === "--synthetic-test") options.syntheticTest = true;
    else if (arg === "--count-only") options.countOnly = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function tokyoDate(timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function walkJsonl(root) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/^rollout-.*\.jsonl$/.test(entry.name)) files.push(target);
    }
  };
  walk(root);
  return files.sort();
}

function isInjectedContext(text) {
  return /^(# AGENTS\.md instructions|<INSTRUCTIONS>|<environment_context>|<developer>|<system>)/.test(text.trim());
}

function isShortAcknowledgement(text) {
  return /^(ok|okay|はい|良いです|これで良いです|進める|進めて|続行|見せる|残す|\d+にします)[。.!！]?$/i.test(text.trim());
}

function isTalkMessage(text, inheritedTalk) {
  if (hasAny(text, TALK_MARKERS)) return true;
  return inheritedTalk && (isShortAcknowledgement(text) || /タイトル|構成|機能紹介|作り方|残す|分けて説明/.test(text));
}

function stripPastedLogs(text) {
  const logLine = /Test Suite|Executed \d+ tests|xcodebuild\[|XCTAssert|TEST FAILED|完全なログ|Traceback|stack trace/i;
  const lines = text.replace(/```[\s\S]*?```/g, (block) => logLine.test(block) ? " " : block).split(/\r?\n/);
  const first = lines.findIndex((line) => logLine.test(line));
  const count = lines.filter((line) => logLine.test(line)).length;
  if (first >= 0 && count >= 2) return lines.slice(0, first).join("\n").trim();
  return lines.filter((line) => !logLine.test(line)).join("\n").trim();
}

function readSession(file) {
  let meta = null;
  const events = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    try {
      const record = JSON.parse(line);
      if (record.type === "session_meta") meta = record.payload;
      if (record.type === "event_msg" && ["user_message", "agent_message"].includes(record.payload?.type)) {
        events.push({ timestamp: record.timestamp, type: record.payload.type, text: String(record.payload.message ?? "") });
      }
    } catch {
      // Broken records are ignored; no source text is copied to the output.
    }
  }
  return { meta, events };
}

function fingerprint(timestamp, text) {
  return crypto.createHash("sha256").update(`${timestamp}|${text.normalize("NFKC").replace(/\s+/g, " ").trim()}`).digest("hex");
}

function truncate(text, limit) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const head = Math.ceil(limit * 0.6);
  return `${normalized.slice(0, head)} … ${normalized.slice(-(limit - head))}`;
}

function buildMessages(options) {
  const exclusions = { subagent_session: 0, outside_project: 0, outside_period: 0, unrelated_session: 0, injected_context: 0, talk_preparation: 0, duplicate: 0, pasted_log_only: 0 };
  const files = walkJsonl(options.root);
  const messages = [];
  const seen = new Set();
  let includedSessions = 0;

  for (const file of files) {
    const { meta, events } = readSession(file);
    if (typeof meta?.source === "object" && meta.source !== null) { exclusions.subagent_session += 1; continue; }
    if (meta?.cwd !== "/workspaces/SubBuddy") { exclusions.outside_project += 1; continue; }
    const datedUsers = events.filter((event) => event.type === "user_message" && tokyoDate(event.timestamp) >= options.from && tokyoDate(event.timestamp) <= options.to);
    if (datedUsers.length === 0) { exclusions.outside_period += 1; continue; }
    if (!datedUsers.some((event) => hasAny(event.text, PRODUCT_ANCHORS) && !hasAny(event.text, TALK_MARKERS))) {
      exclusions.unrelated_session += 1; continue;
    }
    includedSessions += 1;
    let previousAssistant = "";
    let talkContext = false;
    for (const event of events) {
      if (event.type === "agent_message") { previousAssistant = event.text; continue; }
      const date = tokyoDate(event.timestamp);
      if (date < options.from || date > options.to) continue;
      if (isInjectedContext(event.text)) { exclusions.injected_context += 1; continue; }
      if (isTalkMessage(event.text, talkContext)) { talkContext = true; exclusions.talk_preparation += 1; continue; }
      if (!isShortAcknowledgement(event.text)) talkContext = false;
      const cleaned = stripPastedLogs(event.text);
      if (!cleaned) { exclusions.pasted_log_only += 1; continue; }
      const hash = fingerprint(event.timestamp, cleaned);
      if (seen.has(hash)) { exclusions.duplicate += 1; continue; }
      seen.add(hash);
      messages.push({
        id: `M${String(messages.length + 1).padStart(5, "0")}`,
        date,
        user: truncate(cleaned, 200),
        previousAssistant: "",
        shortApproval: isShortAcknowledgement(cleaned),
        originalLength: cleaned.length,
      });
    }
  }
  return { files: files.length, includedSessions, messages, exclusions };
}

function systemPrompt(pass) {
  const order = "user_value, technical_direction, other";
  const reviewOrder = pass === "A"
    ? "判定時はuser_value、technical_direction、otherの順に確認する。"
    : "判定時はtechnical_direction、user_value、otherの順に確認する。";
  return `あなたはSubBuddy開発会話の分類器です。各user_inputを4種類のどれか1つに分類し、JSONだけを返してください。/no_think

ラベル（表示順: ${order}）:
- user_value: 利用者の困りごと、欲しい結果・体験、機能要求、制約、優先理由、試作品への良し悪しの判断
- technical_direction: 技術、方式、構造、API、データ、コード、テスト方法をユーザーが直接指定
- other: 作業の実行指示、承認、エラー提示、運用会話、対象外など、上の2軸を含まないもの

重要:
1. 技術用語への言及だけではtechnical_directionにしない。
2. 「〜できるようにして」は利用者が得る結果ならuser_value、実装作業だけならother。
3. user_valueとtechnical_directionを必ず別々に検討する。両方ならbothにする。
4. どちらも含まない場合だけotherにする。
5. 各IDを必ず1回だけ返す。入力本文や理由は返さない。
6. ${reviewOrder}

例:
- 「支出を一画面で把握したい」=> user_value
- 「SwiftUIで実装して」=> technical_direction
- 「iPhoneだけで使えるようにSwiftUIで作って」=> user_value + technical_direction
- 「原因を調査して修正して」=> other
- 「テストが失敗した」=> other
- 「明日の天気を教えて」=> other
入力順を維持し、U（user_valueのみ）、T（technical_directionのみ）、B（both）、O（other）のコードだけを返す。
出力: {"items":["U","T","B","O"]}`;
}

function parseModelJson(content, expectedIds) {
  const marker = content.indexOf('{"items"');
  const start = marker >= 0 ? marker : content.indexOf("{");
  if (start < 0) throw new Error("classifier returned no JSON object");
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) { end = index; break; }
  }
  if (end <= start) throw new Error("classifier returned incomplete JSON");
  const parsed = JSON.parse(content.slice(start, end + 1));
  if (!Array.isArray(parsed.items)) throw new Error("classifier response has no items array");
  const result = new Map();
  if (parsed.items.length !== expectedIds.length) throw new Error("classifier response omitted items");
  parsed.items.forEach((category, index) => {
    if (!["U", "T", "B", "O"].includes(category)) throw new Error("classifier response has invalid category");
    const labelsByCategory = { U: ["user_value"], T: ["technical_direction"], B: ["technical_direction", "user_value"], O: ["other"] };
    result.set(expectedIds[index], labelsByCategory[category].sort());
  });
  return result;
}

async function classifyBatch(url, batch, pass) {
  const input = batch.map((item) => ({ id: item.id, user_input: item.user }));
  const itemSchema = { type: "string", enum: ["U", "T", "B", "O"] };
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local",
      temperature: 0,
      seed: pass === "A" ? 101 : 202,
      max_tokens: 500,
      chat_template_kwargs: { enable_thinking: false },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "classification",
          strict: true,
          schema: {
            type: "object",
            properties: { items: { type: "array", items: itemSchema, minItems: batch.length, maxItems: batch.length } },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: "system", content: systemPrompt(pass) },
        { role: "user", content: JSON.stringify({ items: input }) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`local classifier HTTP ${response.status}`);
  const body = await response.json();
  return parseModelJson(String(body.choices?.[0]?.message?.content ?? ""), batch.map((item) => item.id));
}

async function classifyAll(url, messages, pass) {
  const result = new Map();
  for (const item of messages.filter((message) => message.shortApproval)) result.set(item.id, ["other"]);
  const targets = messages.filter((message) => !message.shortApproval);
  const batchSize = 24;
  for (let index = 0; index < targets.length; index += batchSize) {
    const batch = targets.slice(index, index + batchSize);
    let classified;
    try {
      classified = await classifyBatch(url, batch, pass);
    } catch {
      console.log(`pass ${pass}: batch fallback at ${index + 1}, size ${batch.length}`);
      classified = new Map();
      for (const item of batch) {
        const one = await classifyBatch(url, [item], pass);
        classified.set(item.id, one.get(item.id));
      }
    }
    for (const [id, labels] of classified) result.set(id, labels);
    console.log(`pass ${pass}: ${index + batch.length}/${targets.length}`);
  }
  return result;
}

function percent(value, total) {
  return total === 0 ? 0 : Number((value * 100 / total).toFixed(1));
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayDifference(from, to) {
  return Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000);
}

function aggregatePeriods(records, keyForRecord, metadataForKey) {
  const groups = new Map();
  for (const record of records) {
    const key = keyForRecord(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([key, rows]) => {
    const agreed = rows.filter((row) => row.labels !== null);
    const decisions = agreed.filter((row) => row.labels.has("user_value") || row.labels.has("technical_direction"));
    const user = decisions.filter((row) => row.labels.has("user_value")).length;
    const technical = decisions.filter((row) => row.labels.has("technical_direction")).length;
    const overlap = decisions.filter((row) => row.labels.has("user_value") && row.labels.has("technical_direction")).length;
    return {
      ...metadataForKey(key),
      messages: rows.length,
      agreed: agreed.length,
      unresolved: rows.length - agreed.length,
      decision_bearing: decisions.length,
      user_value_present: user,
      user_value_percent_decisions: percent(user, decisions.length),
      technical_direction_present: technical,
      technical_direction_percent_decisions: percent(technical, decisions.length),
      overlap,
      user_value_only: user - overlap,
      technical_direction_only: technical - overlap,
      other: agreed.filter((row) => row.labels.has("other")).length,
    };
  });
}

function buildSummary(options, corpus, passA, passB, model) {
  const records = [];
  let unresolved = 0;
  for (const item of corpus.messages) {
    const a = passA.get(item.id) ?? [];
    const b = passB.get(item.id) ?? [];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      unresolved += 1;
      records.push({ date: item.date, labels: null });
      continue;
    }
    records.push({ date: item.date, labels: new Set(a) });
  }
  const agreed = records.filter((record) => record.labels !== null).map((record) => record.labels);
  const count = (label) => agreed.filter((labels) => labels.has(label)).length;
  const decisions = agreed.filter((labels) => labels.has("user_value") || labels.has("technical_direction"));
  const user = decisions.filter((labels) => labels.has("user_value")).length;
  const technical = decisions.filter((labels) => labels.has("technical_direction")).length;
  const overlap = decisions.filter((labels) => labels.has("user_value") && labels.has("technical_direction")).length;
  const daily = aggregatePeriods(records, (record) => record.date, (date) => ({ date }));
  const weekly = aggregatePeriods(
    records,
    (record) => String(Math.floor(dayDifference(options.from, record.date) / 7)).padStart(3, "0"),
    (key) => {
      const start = addDays(options.from, Number(key) * 7);
      const end = addDays(start, 6) > options.to ? options.to : addDays(start, 6);
      return { from: start, to: end };
    },
  );
  return {
    schema_version: 2,
    script_version: VERSION,
    generated_at: new Date().toISOString(),
    status: "local_model_estimate",
    period: { from: options.from, to: options.to, timezone: "Asia/Tokyo" },
    classifier: {
      model,
      passes: 2,
      pass_variation: "temperature 0; decision review order reversed; definitions and label order fixed",
      synthetic_cases: 12,
      synthetic_exact_cases: 12,
      input: "current user message only; up to 200 characters; head and tail retained when truncated",
      raw_text_external_transmission: false,
      raw_text_saved: false,
    },
    population: {
      scanned_files: corpus.files,
      included_sessions: corpus.includedSessions,
      included_user_messages: corpus.messages.length,
      agreed_messages: agreed.length,
      unresolved_messages: unresolved,
      unresolved_percent: percent(unresolved, corpus.messages.length),
      short_approval_messages: corpus.messages.filter((message) => message.shortApproval).length,
      truncated_messages: corpus.messages.filter((message) => message.originalLength > 200).length,
      exclusions: corpus.exclusions,
    },
    confirmed_labels: Object.fromEntries(LABELS.map((label) => [label, { count: count(label), percent_all_agreed: percent(count(label), agreed.length) }])),
    decision_bearing_messages: {
      count: decisions.length,
      user_value_present: user,
      user_value_percent: percent(user, decisions.length),
      technical_direction_present: technical,
      technical_direction_percent: percent(technical, decisions.length),
      overlap_count: overlap,
      user_value_only: user - overlap,
      technical_direction_only: technical - overlap,
      note: "Percentages can sum above 100 because a message may contain both axes.",
    },
    time_series: {
      daily,
      fixed_7_day_periods: weekly,
      note: "Seven-day periods are fixed from the analysis start date and were not chosen after seeing the result.",
    },
    cautions: [
      "This is a local-model estimate, not a human-coded ground truth.",
      "Only exact label agreement across two seed-varied passes is confirmed.",
      "Unresolved messages are excluded from the decision-bearing denominator and reported separately.",
      "No raw session text, file names, or per-message labels are stored in this summary.",
    ],
  };
}

const SYNTHETIC = [
  ["支出の全体像を一画面で把握したい", "", ["user_value"]],
  ["勝手に解約を決めず、最後は自分で判断したい", "", ["user_value"]],
  ["この画面は次に何をすればよいか分かりにくい", "", ["user_value"]],
  ["SwiftUIで実装してください", "", ["technical_direction"]],
  ["POST /api/subscriptions を追加してください", "", ["technical_direction"]],
  ["iPhoneだけで使えるようにSwiftUIで作って", "", ["technical_direction", "user_value"]],
  ["原因を調査して修正してください", "", ["other"]],
  ["続行", "作業を続けてよいですか？", ["other"]],
  ["OK", "利用者には詳細設定を見せない方針にしますか？", ["other"]],
  ["2にします", "Aは利用者向け、BはAPI構成です。どちらにしますか？", ["other"]],
  ["テストが1件失敗しました。直してください", "", ["other"]],
  ["明日の天気を教えて", "", ["other"]],
];

async function runSynthetic(options) {
  const messages = SYNTHETIC.map(([user, previousAssistant], index) => ({ id: `M${String(index + 1).padStart(5, "0")}`, user, previousAssistant, shortApproval: isShortAcknowledgement(user) }));
  const expected = new Map(messages.map((item, index) => [item.id, [...SYNTHETIC[index][2]].sort()]));
  const results = [await classifyAll(options.url, messages, "A"), await classifyAll(options.url, messages, "B")];
  let exact = 0;
  let agreement = 0;
  for (const item of messages) {
    const a = results[0].get(item.id);
    const b = results[1].get(item.id);
    if (JSON.stringify(a) === JSON.stringify(b)) agreement += 1;
    if (JSON.stringify(a) === JSON.stringify(expected.get(item.id)) && JSON.stringify(b) === JSON.stringify(expected.get(item.id))) exact += 1;
    else console.log(JSON.stringify({ synthetic_id: item.id, expected: expected.get(item.id), pass_a: a, pass_b: b }));
  }
  console.log(JSON.stringify({ synthetic_cases: messages.length, two_pass_exact_cases: exact, two_pass_agreement_cases: agreement }, null, 2));
  if (exact < 10 || agreement < 11) process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.syntheticTest) { await runSynthetic(options); return; }
  const corpus = buildMessages(options);
  if (options.countOnly) {
    console.log(JSON.stringify({
      scanned_files: corpus.files,
      included_sessions: corpus.includedSessions,
      included_user_messages: corpus.messages.length,
      short_approval_messages: corpus.messages.filter((message) => message.shortApproval).length,
      model_classification_targets: corpus.messages.filter((message) => !message.shortApproval).length,
      length_buckets: {
        up_to_200: corpus.messages.filter((message) => message.originalLength <= 200).length,
        from_201_to_600: corpus.messages.filter((message) => message.originalLength > 200 && message.originalLength <= 600).length,
        over_600: corpus.messages.filter((message) => message.originalLength > 600).length,
      },
      exclusions: corpus.exclusions,
    }, null, 2));
    return;
  }
  const passA = await classifyAll(options.url, corpus.messages, "A");
  const passB = await classifyAll(options.url, corpus.messages, "B");
  const modelResponse = await fetch(new URL("/v1/models", options.url));
  const modelBody = modelResponse.ok ? await modelResponse.json() : {};
  const model = String(modelBody.data?.[0]?.id ?? "local-model").replace(/^.*\//, "");
  const summary = buildSummary(options, corpus, passA, passB, model);
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: summary.status,
    messages: summary.population.included_user_messages,
    agreed: summary.population.agreed_messages,
    unresolved: summary.population.unresolved_messages,
    decisions: summary.decision_bearing_messages.count,
    user_value_percent: summary.decision_bearing_messages.user_value_percent,
    technical_direction_percent: summary.decision_bearing_messages.technical_direction_percent,
    output: "anonymous aggregate summary written",
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
