/**
 * Regression tests for follow-up slot extraction and pending-question logic.
 *
 * Run with: BOT_TEST_MODE=1 npx tsx server/bot.test.ts
 *
 * Tests the exact dialogue from the bug report:
 * Turn 1: "можешь посчитать везела, не проходного, передний привод, самый простой, оценка R тоже можно"
 * Turn 2: "До трех лет. полторашка, машина для себя. Бюджет не знаю, засвети стоимости"
 */

import {
  _test_extractStateUpdate as extractStateUpdate,
  _test_applyStateUpdate as applyStateUpdate,
  _test_buildSafeFallbackReply as buildSafeFallbackReply,
  _test_planReply as planReply,
  _test_DEFAULT_CONVERSATION_STATE as DEFAULT_CONVERSATION_STATE,
  type _test_ConversationState as ConversationState,
} from "./bot.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── Turn 1 ──────────────────────────────────────────────
console.log("\n═══ Turn 1: Initial request ═══");
const turn1Msg = "можешь посчитать везела, не проходного, передний привод, самый простой, оценка R тоже можно";

const turn1Update = extractStateUpdate(turn1Msg, { ...DEFAULT_CONVERSATION_STATE });
const stateAfterTurn1 = applyStateUpdate(
  { ...DEFAULT_CONVERSATION_STATE },
  turn1Update,
  "regex",
);

assertEqual(stateAfterTurn1.model, "Vezel", "Turn 1: model = Vezel");
assertEqual(stateAfterTurn1.make, "Honda", "Turn 1: make = Honda");
assertEqual(stateAfterTurn1.ageWindow, "non_passable", "Turn 1: ageWindow = non_passable");
assertEqual(stateAfterTurn1.nonPassableType, null, "Turn 1: nonPassableType = null (needs clarification)");
assertEqual(stateAfterTurn1.drivetrain, "fwd", "Turn 1: drivetrain = fwd");
assertEqual(stateAfterTurn1.trimLevel, "base", "Turn 1: trimLevel = base");
assert(
  stateAfterTurn1.auctionGradesAllowed.includes("R"),
  "Turn 1: auctionGradesAllowed includes R",
);
assertEqual(stateAfterTurn1.activeIntent, "price_calc", "Turn 1: activeIntent = price_calc");

// Verify Turn 1 reply asks about nonPassableType (and other missing fields)
const turn1Plan = planReply(stateAfterTurn1, turn1Msg);
const turn1Reply = buildSafeFallbackReply(stateAfterTurn1, turn1Plan);
console.log(`\n  Turn 1 reply: "${turn1Reply}"`);
assert(turn1Reply.includes("понял"), "Turn 1 reply: confirms understood info");
assert(
  turn1Reply.includes("до 3 лет") || turn1Reply.includes("старше 5 лет"),
  "Turn 1 reply: asks about nonPassableType",
);

// ─── Turn 2 ──────────────────────────────────────────────
console.log("\n═══ Turn 2: Follow-up answers ═══");
const turn2Msg = "До трех лет. полторашка, машина для себя. Бюджет не знаю, засвети стоимости";

const turn2Update = extractStateUpdate(turn2Msg, stateAfterTurn1);
const stateAfterTurn2 = applyStateUpdate(
  stateAfterTurn1,
  turn2Update,
  "regex",
);

// Verify slot extraction
assertEqual(stateAfterTurn2.nonPassableType, "under_3_years", "Turn 2: nonPassableType = under_3_years");
assertEqual(stateAfterTurn2.volumeCm3, 1500, "Turn 2: volumeCm3 = 1500 (полторашка → 1.5л → 1500)");
assertEqual(stateAfterTurn2.isForResale, false, "Turn 2: isForResale = false (для себя)");
assertEqual(stateAfterTurn2.isLegalEntity, false, "Turn 2: isLegalEntity = false (для себя)");
assertEqual(stateAfterTurn2.budgetText, "approximate_guidance", "Turn 2: budgetText = approximate_guidance");

// Verify model is preserved from Turn 1
assertEqual(stateAfterTurn2.model, "Vezel", "Turn 2: model still Vezel");
assertEqual(stateAfterTurn2.make, "Honda", "Turn 2: make still Honda");
assertEqual(stateAfterTurn2.ageWindow, "non_passable", "Turn 2: ageWindow still non_passable");
assertEqual(stateAfterTurn2.drivetrain, "fwd", "Turn 2: drivetrain still fwd");
assertEqual(stateAfterTurn2.trimLevel, "base", "Turn 2: trimLevel still base");

// Verify Turn 2 reply does NOT re-ask for filled slots
const turn2Plan = planReply(stateAfterTurn2, turn2Msg);
const turn2Reply = buildSafeFallbackReply(stateAfterTurn2, turn2Plan);
console.log(`\n  Turn 2 reply: "${turn2Reply}"`);

assert(!turn2Reply.includes("до 3 лет или старше 5 лет"), "Turn 2 reply: does NOT re-ask about nonPassableType");
assert(!turn2Reply.includes("какой объём двигателя"), "Turn 2 reply: does NOT re-ask about engine volume");
assert(
  !turn2Reply.includes("физлицо, юрлицо или под перепродажу") &&
  !turn2Reply.includes("физлицо или юрлицо"),
  "Turn 2 reply: does NOT re-ask about ownership",
);
assert(
  turn2Reply.includes("сориентировать") || turn2Reply.includes("бюджет") || turn2Reply.includes("рынку"),
  "Turn 2 reply: provides budget guidance instead of asking for exact price",
);

// ─── Additional unit tests for Russian numeric normalization ───
console.log("\n═══ Russian Numeric Normalization Tests ═══");

// "до трёх лет" (with ё)
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("до трёх лет", prevState);
  assertEqual(update.set.nonPassableType, "under_3_years", "Normalization: 'до трёх лет' → under_3_years");
}

// "до 3-х лет"
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("до 3-х лет", prevState);
  assertEqual(update.set.nonPassableType, "under_3_years", "Normalization: 'до 3-х лет' → under_3_years");
}

// "трехлетка"
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("трехлетка", prevState);
  assertEqual(update.set.nonPassableType, "under_3_years", "Normalization: 'трехлетка' → under_3_years");
  assertEqual(update.set.ageWindow, "non_passable", "Normalization: 'трехлетка' → ageWindow = non_passable");
}

// "полторашка" as volume
{
  const update = extractStateUpdate("полторашка", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.volumeCm3, 1500, "Volume: 'полторашка' → 1500 cm³");
}

// "полтора литра" as volume
{
  const update = extractStateUpdate("полтора литра", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.volumeCm3, 1500, "Volume: 'полтора литра' → 1500 cm³");
}

// "1.5" as volume (fallback)
{
  const update = extractStateUpdate("1.5 л", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.volumeCm3, 1500, "Volume: '1.5 л' → 1500 cm³");
}

// "от 5 лет" standalone
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("от 5 лет", prevState);
  assertEqual(update.set.nonPassableType, "over_5_years", "Age: 'от 5 лет' → over_5_years");
}

// "старше 5 лет"
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("старше 5 лет", prevState);
  assertEqual(update.set.nonPassableType, "over_5_years", "Age: 'старше 5 лет' → over_5_years");
}

// "5+ лет" standalone
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("5+ лет", prevState);
  assertEqual(update.set.nonPassableType, "over_5_years", "Age: '5+ лет' → over_5_years");
}

// "для себя" ownership
{
  const update = extractStateUpdate("машина для себя", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.isForResale, false, "Ownership: 'машина для себя' → isForResale = false");
  assertEqual(update.set.isLegalEntity, false, "Ownership: 'машина для себя' → isLegalEntity = false");
}

// Budget unknown phrases
{
  const update = extractStateUpdate("бюджет не знаю", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.budgetText, "approximate_guidance", "Budget: 'бюджет не знаю' → approximate_guidance");
}
{
  const update = extractStateUpdate("засвети стоимости", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.budgetText, "approximate_guidance", "Budget: 'засвети стоимости' → approximate_guidance");
}
{
  const update = extractStateUpdate("дай примерный бюджет", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.budgetText, "approximate_guidance", "Budget: 'дай примерный бюджет' → approximate_guidance");
}

// "до 3 лет" should NOT be matched as budgetText
{
  const update = extractStateUpdate("до 3 лет", { ...DEFAULT_CONVERSATION_STATE });
  assert(
    update.set.budgetText !== "до 3 лет" && update.set.budgetText !== "до 3",
    "Budget guard: 'до 3 лет' is NOT parsed as budget",
  );
}

// ─── Summary ─────────────────────────────────────────────
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);
if (failed > 0) {
  process.exit(1);
}
