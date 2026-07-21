#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const VERSION = "0.2.0";
const DEFAULT_ROOT = "/home/vscode/.codex/sessions/2026";
const DEFAULT_FROM = "2026-06-27";
const DEFAULT_TO = "2026-07-19";
const DEFAULT_OUT = path.resolve("slides/lt-20260730/aggregates");

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

const USER_PATTERNS = [
  /困|欲しい|ほしい|したい|できるよう|嬉しい|うれしい/,
  /使いやす|使いにく|分かりにく|わかりにく|迷わ|違和感|不安/,
  /ユーザー|利用者|本人|自分|他の人|一般の人/,
  /避けたい|しないで|してほしくない|勝手に|守りたい|制約/,
  /優先|理由|判断|体験|課題|目的|価値|必要なもの/,
  /だけで.{0,12}(使|完結)|前提にしたくない|試してもら/,
];

const TECH_PATTERNS = [
  /Next\.js|React|SwiftUI|TypeScript|JavaScript|Tailwind|Prisma|PostgreSQL|Zod/i,
  /DeviceActivity|FamilyControls|ManagedSettings|Screen\s*Time/i,
  /\bAPI\b|endpoint|route handler|database|\bDB\b|schema|migration|JSON|SQL|HTTP/i,
  /認証方式|データ構造|アーキテクチャ|テナント|クラウドDB|型定義|アルゴリズム/,
  /\.swift\b|\.tsx?\b|\.jsx?\b|\.json\b|\.ya?ml\b|\/api\//i,
  /XCTest|Playwright|Vitest|Jest|xcodebuild|npm run|git\s/i,
];

const WORK_PATTERNS = [
  /実装|修正|調査|確認|検証|レビュー|更新|作成|追加|削除|反映|再実行|コミット/,
  /進めて|続行|再開|直して|調べて|試して|テストして|ビルドして/,
  /エラー|失敗|不具合|原因|差分|ログ/,
];

const USER_SIGNAL_GROUPS = {
  problem: [/困|悩|問題|課題|把握できない|分からない|わからない|足りない/],
  desired_experience: [
    /欲しい|ほしい|したい|できるよう|嬉しい|うれしい|迷わず|だけで.{0,12}(使|完結)|試してもら/,
    /(?:画面|ホーム|一覧|契約|見直し|支出|利用状況|更新).{0,24}(?:表示|確認|把握|選べ|登録|削除|案内|分かる|わかる|できる)/,
    /(?:表示|確認|把握|選択|登録|削除|案内).{0,20}(?:画面|ホーム|一覧|契約|見直し|支出|利用状況)/,
  ],
  constraint: [/避けたい|しないで|してほしくない|したくない|勝手に|守りたい|制約|前提にしたくない/],
  priority_reason: [/優先|理由|まず.{0,20}(したい|進めたい|必要)|なぜなら|ために/],
  judgement_feedback: [/違和感|使いにく|分かりにく|わかりにく|迷う|不安|一般の人|ユーザーとして|利用者として|これで良い|良くない/],
};

const TECH_DIRECTIVE_PATTERNS = [
  /で実装|を使って|を使用|を採用|に統一|に変更|にする|で作|を指定|を定義/,
  /構成に|方式で|スキーマ|型定義|エンドポイント|マイグレーション|テスト方式/,
  /実装してください|追加してください|修正してください|作成してください|使うこと/,
];

const STRONG_TECH_SPEC_PATTERNS = [
  /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[-\w/:[\]]+/,
  /```(?:swift|typescript|tsx|javascript|json|sql|bash|sh)\b/i,
  /\b\w+\s*:\s*(?:string|number|boolean|null|Date)\b/,
  /XCTAssert\w*\s*\(|npm\s+run\s+\w+|xcodebuild\s+/i,
];

const CONCRETIZATION_PATTERNS = [
  /提案|機能|画面|導線|設計|構成|方式|アーキテクチャ|データ|API|認証/,
  /実装|修正|追加|更新|作成|反映|文書化|requirements|design|tasklist/i,
  /しました|作りました|変更しました|具体化|方針|計画/,
];

const ASSISTANT_RESULT_PATTERNS = {
  clarification: [/確認|質問|どちら|ですか|でしょうか/],
  feature_proposal: [/機能提案|機能|画面|導線|体験|オンボーディング/],
  technical_design: [/技術|設計|構成|方式|API|DB|認証|SwiftUI|Next\.js|アーキテクチャ/i],
  documentation: [/文書|ドキュメント|requirements|design|tasklist|AGENTS\.md/i],
  implementation: [/実装|修正|変更|追加|作成|反映|パッチ/],
  verification: [/検証|テスト|確認|レビュー|lint|build|型チェック/i],
  risk: [/リスク|注意|懸念|例外|安全|過剰|不十分|失敗/],
};

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    out: DEFAULT_OUT,
    selfTest: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") options.root = argv[++i];
    else if (arg === "--from") options.from = argv[++i];
    else if (arg === "--to") options.to = argv[++i];
    else if (arg === "--out") options.out = path.resolve(argv[++i]);
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help") {
      console.log(`Usage: node aggregate-sessions.mjs [options]\n\n` +
        `  --root PATH   Codex session root (default: ${DEFAULT_ROOT})\n` +
        `  --from DATE   First date in Asia/Tokyo (default: ${DEFAULT_FROM})\n` +
        `  --to DATE     Last date in Asia/Tokyo (default: ${DEFAULT_TO})\n` +
        `  --out PATH    Anonymous output directory\n` +
        `  --self-test   Run synthetic-data checks only`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function walkJsonl(root) {
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/^rollout-.*\.jsonl$/.test(entry.name)) files.push(target);
    }
  }
  walk(root);
  return files.sort();
}

function tokyoDate(timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function normalizedFingerprint(text) {
  return crypto.createHash("sha256").update(text.normalize("NFKC").replace(/\s+/g, " ").trim()).digest("hex");
}

function looksLikeLog(block) {
  const markers = [
    /TEST FAILED|Test Suite|Executed \d+ tests|xcodebuild\[/i,
    /\b(error|warning):|XCTAssert|stack trace|Exception|Traceback/i,
    /^\s*at\s+\S+.*\(.+:\d+:\d+\)/m,
    /Build failed|Command failed|exit code|完全なログ/i,
  ];
  const matched = markers.filter((pattern) => pattern.test(block)).length;
  return markers[0].test(block) || matched >= 2;
}

function stripPastedLogs(text) {
  let removedBlocks = 0;
  let cleaned = text.replace(/```[\s\S]*?```/g, (block) => {
    if (looksLikeLog(block)) {
      removedBlocks += 1;
      return " ";
    }
    return block;
  });
  let lines = cleaned.split(/\r?\n/);
  const firstStrongLogLine = lines.findIndex((line) => /Test Suite|Executed \d+ tests|xcodebuild\[|XCTAssert|TEST FAILED|完全なログ/i.test(line));
  const strongLogLineCount = lines.filter((line) => /Test Suite|Executed \d+ tests|xcodebuild\[|XCTAssert|TEST FAILED|完全なログ/i.test(line)).length;
  if (firstStrongLogLine >= 0 && strongLogLineCount >= 2) {
    const prefix = lines.slice(0, firstStrongLogLine).join("\n").trim();
    const prefixIsInstruction = /調べ|修正|確認|原因|対応|直して|してください|して。/.test(prefix);
    lines = prefixIsInstruction ? prefix.split(/\r?\n/) : [];
    removedBlocks += 1;
  }
  const kept = [];
  let logRun = [];
  const flush = () => {
    if (logRun.length >= 3 && looksLikeLog(logRun.join("\n"))) removedBlocks += 1;
    else kept.push(...logRun);
    logRun = [];
  };
  for (const line of lines) {
    if (/Test Suite|Executed \d+ tests|xcodebuild\[|XCTAssert|TEST FAILED|error:|完全なログ/i.test(line)) logRun.push(line);
    else {
      flush();
      kept.push(line);
    }
  }
  flush();
  cleaned = kept.join("\n").trim();
  return { text: cleaned, removedBlocks };
}

function isShortAcknowledgement(text) {
  return /^(ok|okay|はい|良いです|これで良いです|進める|進めて|続行)[。.!！]?$/i.test(text.trim());
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function isTalkMessage(text, inheritedTalk) {
  if (hasAny(text, TALK_MARKERS)) return true;
  return inheritedTalk && (isShortAcknowledgement(text) || /タイトル|構成|機能紹介|作り方|残す|分けて説明/.test(text));
}

function isInjectedContext(text) {
  return /^(# AGENTS\.md instructions|<INSTRUCTIONS>|<environment_context>|<developer>|<system>)/.test(text.trim());
}

function splitMeaningUnits(text) {
  const withoutQuoteMarkers = text
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "");
  const pieces = withoutQuoteMarkers
    .split(/(?:\r?\n){1,}|(?<=[。！？!?])\s+|[；;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return pieces.flatMap((piece) => {
    const technicalBoundary = piece.match(/^(.+?[。！？!?])\s*((?:Next\.js|React|SwiftUI|TypeScript|API|DB|Prisma|PostgreSQL).+)$/i);
    return technicalBoundary ? [technicalBoundary[1].trim(), technicalBoundary[2].trim()] : [piece];
  });
}

function scorePatterns(text, patterns) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function classifyUnit(text) {
  if (isShortAcknowledgement(text)) {
    return { category: "other", subtype: "acknowledgement", confidence: "low", scores: {} };
  }
  const scores = {
    user_perspective: scorePatterns(text, USER_PATTERNS),
    technical: scorePatterns(text, TECH_PATTERNS),
    development_work: scorePatterns(text, WORK_PATTERNS),
    other: 0,
  };
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let category = ordered[0][1] === 0 ? "other" : ordered[0][0];
  if (scores.technical > 0 && scores.technical >= scores.user_perspective && /指定|使って|実装|方式|構成|定義/.test(text)) {
    category = "technical";
  } else if (scores.user_perspective > 0 && /困|欲しい|ほしい|違和感|使いにく|分かりにく|したくない|判断理由/.test(text)) {
    category = "user_perspective";
  } else if (scores.development_work > 0 && scores.user_perspective === 0 && scores.technical === 0) {
    category = "development_work";
  }
  const winning = scores[category];
  const runnerUp = Math.max(...Object.entries(scores).filter(([key]) => key !== category).map(([, value]) => value));
  const confidence = winning >= 2 && winning - runnerUp >= 1 ? "high" : winning >= 1 ? "medium" : "low";
  let subtype = null;
  if (category === "user_perspective") {
    if (/困|課題|問題/.test(text)) subtype = "problem";
    else if (/違和感|使いにく|分かりにく|判断|迷わ/.test(text)) subtype = "judgement";
    else if (/避け|しないで|したくない|制約|守り/.test(text)) subtype = "constraint";
    else if (/優先|理由/.test(text)) subtype = "priority_reason";
    else subtype = "desired_experience";
  }
  return { category, subtype, confidence, scores };
}

function detectEvidenceSignals(text) {
  const userGroups = Object.entries(USER_SIGNAL_GROUPS)
    .filter(([, patterns]) => hasAny(text, patterns))
    .map(([group]) => group);
  const hasTechnicalTerm = hasAny(text, TECH_PATTERNS);
  const technicalPrescription = hasAny(text, STRONG_TECH_SPEC_PATTERNS) ||
    (hasTechnicalTerm && hasAny(text, TECH_DIRECTIVE_PATTERNS));
  const developmentWork = hasAny(text, WORK_PATTERNS);
  return {
    userPerspective: userGroups.length > 0,
    userGroups,
    technicalReference: hasTechnicalTerm || hasAny(text, STRONG_TECH_SPEC_PATTERNS),
    technicalPrescription,
    developmentWork,
  };
}

function classifyAssistant(text) {
  const results = [];
  for (const [category, patterns] of Object.entries(ASSISTANT_RESULT_PATTERNS)) {
    if (hasAny(text, patterns)) results.push(category);
  }
  return results;
}

function isConcreteAssistantResult(results, text) {
  return results.some((result) => ["feature_proposal", "technical_design", "documentation", "implementation"].includes(result)) &&
    hasAny(text, CONCRETIZATION_PATTERNS);
}

function readSession(file) {
  let meta = null;
  const events = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.type === "session_meta") meta = record.payload;
    if (record.type === "event_msg" && ["user_message", "agent_message"].includes(record.payload?.type)) {
      events.push({ timestamp: record.timestamp, type: record.payload.type, text: String(record.payload.message ?? "") });
    }
  }
  return { meta, events };
}

function buildCorpus(options) {
  const exclusions = {
    subagent_session: 0,
    outside_project: 0,
    outside_period: 0,
    injected_context: 0,
    talk_preparation: 0,
    unrelated_session: 0,
    duplicate: 0,
    pasted_log_blocks: 0,
    pasted_log_only: 0,
    empty_after_split: 0,
  };
  const files = walkJsonl(options.root);
  const sessions = [];
  const seen = new Set();

  for (const file of files) {
    const { meta, events } = readSession(file);
    if (typeof meta?.source === "object" && meta.source !== null) {
      exclusions.subagent_session += 1;
      continue;
    }
    if (meta?.cwd !== "/workspaces/SubBuddy") {
      exclusions.outside_project += 1;
      continue;
    }
    const userEvents = events.filter((event) => event.type === "user_message" && tokyoDate(event.timestamp) >= options.from && tokyoDate(event.timestamp) <= options.to);
    if (userEvents.length === 0) {
      exclusions.outside_period += 1;
      continue;
    }
    const sessionHasProductAnchor = userEvents.some((event) => hasAny(event.text, PRODUCT_ANCHORS) && !hasAny(event.text, TALK_MARKERS));
    if (!sessionHasProductAnchor) {
      exclusions.unrelated_session += 1;
      continue;
    }

    const session = { sourceFile: file, meta, turns: [] };
    let current = null;
    let talkContext = false;
    for (const event of events) {
      if (event.type === "user_message") {
        if (current) session.turns.push(current);
        current = { timestamp: event.timestamp, userText: event.text, assistantTexts: [], excluded: null };
      } else if (current) current.assistantTexts.push(event.text);
    }
    if (current) session.turns.push(current);

    session.turns = session.turns.filter((turn) => {
      const date = tokyoDate(turn.timestamp);
      if (date < options.from || date > options.to) return false;
      if (isInjectedContext(turn.userText)) {
        exclusions.injected_context += 1;
        return false;
      }
      const talk = isTalkMessage(turn.userText, talkContext);
      if (talk) {
        talkContext = true;
        exclusions.talk_preparation += 1;
        return false;
      }
      if (!isShortAcknowledgement(turn.userText)) talkContext = false;
      const fingerprint = `${turn.timestamp}|${normalizedFingerprint(turn.userText)}`;
      if (seen.has(fingerprint)) {
        exclusions.duplicate += 1;
        return false;
      }
      seen.add(fingerprint);
      const stripped = stripPastedLogs(turn.userText);
      exclusions.pasted_log_blocks += stripped.removedBlocks;
      if (!stripped.text) {
        exclusions.pasted_log_only += 1;
        return false;
      }
      turn.cleanedText = stripped.text;
      return true;
    });
    if (session.turns.length > 0) sessions.push(session);
  }

  sessions.sort((a, b) => a.turns[0].timestamp.localeCompare(b.turns[0].timestamp));
  const units = [];
  sessions.forEach((session, sessionIndex) => {
    session.anonymousId = `S${String(sessionIndex + 1).padStart(3, "0")}`;
    for (const [turnIndex, turn] of session.turns.entries()) {
      const assistantText = turn.assistantTexts.join("\n");
      const assistantResults = classifyAssistant(assistantText);
      const concrete = isConcreteAssistantResult(assistantResults, assistantText);
      const pieces = splitMeaningUnits(turn.cleanedText);
      if (pieces.length === 0) exclusions.empty_after_split += 1;
      for (const piece of pieces) {
        const classification = classifyUnit(piece);
        const evidence = detectEvidenceSignals(piece);
        units.push({
          id: `U${String(units.length + 1).padStart(5, "0")}`,
          sessionId: session.anonymousId,
          turnId: `${session.anonymousId}-T${String(turnIndex + 1).padStart(4, "0")}`,
          timestamp: turn.timestamp,
          text: piece,
          initialCategory: classification.category,
          finalCategory: classification.category,
          subtype: classification.subtype,
          confidence: classification.confidence,
          evidence,
          assistantResults,
          concrete,
        });
      }
    }
  });
  return { files, sessions, units, exclusions };
}

function percentage(value, total) {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(1));
}

function buildSummary(options, corpus) {
  const total = corpus.units.length;
  const assistantCounts = {};
  const countedTurns = new Set();
  for (const unit of corpus.units) {
    if (countedTurns.has(unit.turnId)) continue;
    countedTurns.add(unit.turnId);
    for (const result of unit.assistantResults) assistantCounts[result] = (assistantCounts[result] ?? 0) + 1;
  }
  const evidenceUser = corpus.units.filter((unit) => unit.evidence.userPerspective);
  const evidenceTechnical = corpus.units.filter((unit) => unit.evidence.technicalPrescription);
  const evidenceTechnicalReference = corpus.units.filter((unit) => unit.evidence.technicalReference);
  const evidenceBoth = corpus.units.filter((unit) => unit.evidence.userPerspective && unit.evidence.technicalPrescription);
  const evidenceUnion = corpus.units.filter((unit) => unit.evidence.userPerspective || unit.evidence.technicalPrescription);
  const evidenceWork = corpus.units.filter((unit) => unit.evidence.developmentWork);
  const evidenceNone = corpus.units.filter((unit) => !unit.evidence.userPerspective && !unit.evidence.technicalReference && !unit.evidence.developmentWork);
  const evidenceConverted = evidenceUser.filter((unit) => unit.concrete);
  const userGroupCounts = {};
  for (const unit of evidenceUser) {
    for (const group of unit.evidence.userGroups) userGroupCounts[group] = (userGroupCounts[group] ?? 0) + 1;
  }
  return {
    schema_version: 1,
    script_version: VERSION,
    generated_at: new Date().toISOString(),
    status: "automated_signal_analysis",
    period: { from: options.from, to: options.to, timezone: "Asia/Tokyo" },
    scope: { session_root: "local Codex sessions (path omitted)", project_cwd: "/workspaces/SubBuddy" },
    population: {
      scanned_files: corpus.files.length,
      included_sessions: corpus.sessions.length,
      included_user_messages: corpus.sessions.reduce((sum, session) => sum + session.turns.length, 0),
      meaning_units: total,
      exclusions: corpus.exclusions,
    },
    direct_conversion: {
      denominator: evidenceUser.length,
      converted_count: evidenceConverted.length,
      percent: percentage(evidenceConverted.length, evidenceUser.length),
      assistant_result_counts: assistantCounts,
    },
    automated_evidence: {
      method: "explicit expression signals; multi-label; unmatched units remain in the population",
      user_perspective_signal: {
        count: evidenceUser.length,
        percent_all_units: percentage(evidenceUser.length, total),
        groups: userGroupCounts,
      },
      technical_prescription_signal: {
        count: evidenceTechnical.length,
        percent_all_units: percentage(evidenceTechnical.length, total),
      },
      technical_reference_signal: {
        count: evidenceTechnicalReference.length,
        percent_all_units: percentage(evidenceTechnicalReference.length, total),
        note: "Includes technical terms mentioned as context; it is broader than an explicit technical prescription.",
      },
      overlap: {
        both_count: evidenceBoth.length,
        user_only_count: evidenceUser.length - evidenceBoth.length,
        technical_only_count: evidenceTechnical.length - evidenceBoth.length,
        union_count: evidenceUnion.length,
      },
      signal_balance: {
        denominator_signal_occurrences: evidenceUser.length + evidenceTechnical.length,
        user_perspective_percent: percentage(evidenceUser.length, evidenceUser.length + evidenceTechnical.length),
        technical_prescription_percent: percentage(evidenceTechnical.length, evidenceUser.length + evidenceTechnical.length),
        note: "A unit with both signals is counted once in each signal count.",
      },
      development_work_signal_count: evidenceWork.length,
      no_target_signal_count: evidenceNone.length,
      no_target_signal_percent_all_units: percentage(evidenceNone.length, total),
    },
    automated_rule_audit: {
      human_classification_required: false,
      synthetic_case_count: 24,
      note: "Synthetic checks verify rule behavior, not semantic accuracy for every real-world expression.",
    },
    cautions: [
      "The result measures explicit expressions, not hidden intent or full semantic meaning.",
      "No raw user or assistant text is stored in this summary.",
      "Direct conversion and assistant result types are same-turn expression-based estimates.",
      "Unmatched units remain visible and are not reassigned to support the talk's hypothesis.",
    ],
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(`Self-test failed: ${message}`);
}

function selfTest() {
  assert(tokyoDate("2026-06-26T15:00:00.000Z") === "2026-06-27", "Asia/Tokyo date conversion");
  assert(stripPastedLogs("直してください。\nTest Suite failed\nExecuted 2 tests\nTEST FAILED").text === "直してください。", "pasted log removal");
  assert(stripPastedLogs("Test Suite failed\nExecuted 2 tests\nTEST FAILED").text === "", "log-only removal");
  assert(splitMeaningUnits("支出を把握したい。\nNext.jsで一覧を実装して。").length === 2, "meaning-unit split");
  assert(classifyUnit("iPhoneだけで迷わず使いたい").category === "user_perspective", "user-perspective classification");
  assert(classifyUnit("SwiftUIとDeviceActivityで実装して").category === "technical", "technical classification");
  assert(classifyUnit("エラー原因を調べて修正して").category === "development_work", "development-work classification");
  assert(classifyUnit("OK").confidence === "low", "acknowledgement review selection");
  assert(isTalkMessage("スライド構成を直す", false), "talk exclusion");
  assert(isConcreteAssistantResult(["technical_design"], "認証方式とAPI設計を提案します"), "direct conversion");
  const signalCases = [
    ["支出の全体像を把握できず困っている", true, false],
    ["iPhoneだけで迷わず使いたい", true, false],
    ["勝手に解約を決めないでほしい", true, false],
    ["この画面は一般の人には分かりにくい", true, false],
    ["まず他の人が試せる状態を優先したい", true, false],
    ["ホーム画面で次に見直す契約を確認できる", true, false],
    ["契約一覧から不要な契約を削除できる", true, false],
    ["SwiftUIで実装してください", false, true],
    ["Next.jsを使って一覧を作成してください", false, true],
    ["POST /api/subscriptions を追加する", false, true],
    ["XCTAssertEqual(result, expected) を追加", false, true],
    ["エラー原因を調べて修正して", false, false],
    ["OK", false, false],
    ["明日続ける", false, false],
  ];
  for (const [text, expectedUser, expectedTechnical] of signalCases) {
    const actual = detectEvidenceSignals(text);
    assert(actual.userPerspective === expectedUser && actual.technicalPrescription === expectedTechnical, `signal detection: ${text}`);
  }
  console.log("Synthetic self-test: 24 checks passed.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    selfTest();
    return;
  }
  const corpus = buildCorpus(options);
  fs.mkdirSync(options.out, { recursive: true });
  const summaryFile = path.join(options.out, "summary.json");
  fs.writeFileSync(summaryFile, `${JSON.stringify(buildSummary(options, corpus), null, 2)}\n`, "utf8");
  const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
  console.log(JSON.stringify({
    status: summary.status,
    included_sessions: summary.population.included_sessions,
    included_user_messages: summary.population.included_user_messages,
    meaning_units: summary.population.meaning_units,
    user_perspective_signals: summary.automated_evidence.user_perspective_signal.count,
    technical_prescription_signals: summary.automated_evidence.technical_prescription_signal.count,
    no_target_signals: summary.automated_evidence.no_target_signal_count,
    output: "anonymous automated signal summary written",
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
