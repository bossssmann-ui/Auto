/**
 * Auto-slang normalization layer.
 *
 * Handles Russian car-market jargon, abbreviations, seller claims,
 * and colloquial phrases — normalising them into canonical state fields.
 *
 * Design:
 *  - normalizeAutoSlang(text)   → cleaned text with slang replaced
 *  - extractSlangSignals(text)  → Partial<SlangSignals> for state merge
 *  - Trust classification: hard_fact / soft_claim / negative_flag
 */

// ── Cyrillic-aware word boundary (duplicated from bot.ts for module independence) ──
function cyrb(re: RegExp): RegExp {
  let isFirst = true;
  const fixed = re.source.replace(/\\b/g, () => {
    if (isFirst) {
      isFirst = false;
      return '(?<![а-яёА-ЯЁa-zA-Z0-9])';
    }
    return '(?![а-яёА-ЯЁa-zA-Z0-9])';
  });
  return new RegExp(fixed, re.flags);
}

// ── Trust classification ──
export type TrustLevel = "hard_fact" | "soft_claim" | "negative_flag";

export interface SellerClaim {
  original: string;
  meaning: string;
  trust: TrustLevel;
}

// ── Slang signals extracted from text ──
export interface SlangSignals {
  transmission: "manual" | "automatic" | "cvt" | null;
  drivetrain: "fwd" | "rwd" | "4wd" | null;
  trimLevel: "base" | "top" | null;
  fuelType: "diesel" | "gasoline" | "hybrid" | "ev" | null;
  turbo: boolean;
  hasSunroof: boolean;
  hasClimate: boolean;
  manualWindows: boolean;
  body: string | null;
  condition: "poor" | "decent" | null;
  steering: "rhd" | "lhd" | null;
  engineVolume: number | null;  // in liters, e.g. 1.5, 2.0
  isForResale: boolean | null;
  isLegalEntity: boolean | null;
  priority: "cheapest" | "better_condition" | null;
  useCase: "personal" | "resale" | "legal_entity" | null;
  noRussiaMileage: boolean;
  sellerClaims: SellerClaim[];
  negativeFlags: string[];
  budgetGuidance: boolean;
  color: string | null;
  resellerContext: boolean; // detected reseller/market language (перекуп, торг у капота, etc.)
}

// ── Category alias dictionaries ──

/** Transmission aliases */
const transmissionAliases: Array<{ pattern: RegExp; value: "manual" | "automatic" | "cvt" }> = [
  { pattern: cyrb(/\b(?:на\s+палке|палка|кочерга|мешалка|мотыга|ручка|коробчатый|мкпп|мт|механика|механическ[а-яё]*|ручная\s+коробка|на\s+ручке|д[её]ргалка|весло(?:вая)?|мешал[а-яё]*)\b/i), value: "manual" },
  { pattern: cyrb(/\b(?:автомат[а-яё]*|тяпка|акпп|ат|коробка[\s-]автомат|гидро(?:автомат|мат)?|на\s+автомате)\b/i), value: "automatic" },
  { pattern: cyrb(/\b(?:варик|вариатор[а-яё]*|вибратор|cvt|бесступенчат[а-яё]*|на\s+вариаторе)\b/i), value: "cvt" },
  // Robot(ic) transmissions are treated as automatic for customs duty calculation purposes
  { pattern: cyrb(/\b(?:робот[а-яё]*|ркпп|роботизированн[а-яё]*)\b/i), value: "automatic" },
];

/** Drivetrain aliases */
const drivetrainAliases: Array<{ pattern: RegExp; value: "fwd" | "rwd" | "4wd" }> = [
  { pattern: cyrb(/\b(?:передок|передн|моноприводн[а-яё]*|переднеприводн[а-яё]*)\b/i), value: "fwd" },
  { pattern: cyrb(/\b(?:задок|задн|заднеприводн[а-яё]*|задний\s+привод)\b/i), value: "rwd" },
  { pattern: cyrb(/\b(?:вэдовая|вдовая|вэдэшка|4\s*везде|вд|4\s*вд|4\s*wd|awd|полн(?:ый|ая)?\s*привод|полноприводн[а-яё]*|фулл?\s*тайм|парт\s*тайм|4х4|4x4)\b/i), value: "4wd" },
];

/** Trim / equipment level aliases */
const trimAliases: Array<{ pattern: RegExp; value: "base" | "top"; extras?: Partial<SlangSignals> }> = [
  // Base / poor equipment
  {
    pattern: cyrb(/\b(?:весла|вёсла|на\s+в[её]слах|мясорубк|рукопашн)\b/i),
    value: "base",
    extras: { manualWindows: true },
  },
  { pattern: cyrb(/\b(?:деревянн(?:ая|ый)|деревянн(?:ый)?\s+салон|овощной\s+салон|пустая\s+(?:машин|комплектац)[а-яё]*|мыльница|голая|лысая|стоков[а-яё]*|комплектац[а-яё]*\s+пустая|нищебродск[а-яё]*|бомж(?:овая|атская|пакет)?|без\s+наворотов|минималк[а-яё]*|начальн(?:ая|ый)\s+комплектац|стандарт)\b/i), value: "base" },
  // Top / rich equipment
  { pattern: cyrb(/\b(?:фарш|полный\s+фарш|со\s+всеми\s+пирогами|кожа[\s-]рожа|жирн(?:ая|ый|ое)?(?:\s+комплектац)?|навороченн[а-яё]*|упакованн[а-яё]*|люксов[а-яё]*|топов[а-яё]*(?:\s+комплектац)?|максималк[а-яё]*|нафарширован[а-яё]*|вс[её]\s+включено|загружен[а-яё]*|с\s+полным\s+пакетом)\b/i), value: "top" },
];

/** Sunroof aliases */
const sunroofAliases: RegExp = cyrb(/\b(?:люкатая|с\s+люком|с\s+люк(?:ом)?|лючок|панорамн[а-яё]*(?:\s+крыш)?)\b/i);

/** Climate / AC aliases */
const climateAliases: RegExp = cyrb(/\b(?:клима|климат|кондей|кондёр|конд[её]р|двух\s*зонн[а-яё]*\s+климат)\b/i);

/** Fuel type aliases */
const fuelAliases: Array<{ pattern: RegExp; value: "diesel" | "gasoline" | "hybrid" | "ev" }> = [
  { pattern: cyrb(/\b(?:саляра|дизель|дт|тракторн[а-яё]*\s+топливо|солярк[а-яё]*|дизелёк|дизелек)\b/i), value: "diesel" },
  { pattern: cyrb(/\b(?:зажигалка|бенз(?:ин)?|бензинк[а-яё]*)\b/i), value: "gasoline" },
  { pattern: cyrb(/\b(?:гибрид|гибра|гибридка|гибридн[а-яё]*)\b/i), value: "hybrid" },
  { pattern: cyrb(/\b(?:электричка|электро|ev|электромобиль|электрокар)\b/i), value: "ev" },
];

/** Turbo alias */
const turboAliases: RegExp = cyrb(/\b(?:турбовая|турбо|турбир|наддув|с\s+наддувом|турбированн[а-яё]*|надувн[а-яё]*)\b/i);

/** Body type aliases */
const bodyAliases: Array<{ pattern: RegExp; value: string }> = [
  { pattern: cyrb(/\b(?:сарай|универсал|универс)\b/i), value: "wagon" },
  { pattern: cyrb(/\b(?:микрик|микроб(?:ус)?|басик|балабаска|минивэн|минивен|вагон|табуретка\s+на\s+колёсах|табуретка\s+на\s+колесах)\b/i), value: "minivan" },
  { pattern: cyrb(/\b(?:паркетник|кроссовер|кросс)\b/i), value: "crossover" },
  { pattern: cyrb(/\b(?:джип|козёл|козел|внедорожник|рамник|рамн[а-яё]*)\b/i), value: "suv" },
  { pattern: cyrb(/\b(?:купарь|купе|купешк[а-яё]*)\b/i), value: "coupe" },
  { pattern: cyrb(/\b(?:кабр|кабриолет|кабрик)\b/i), value: "cabrio" },
  { pattern: cyrb(/\b(?:буханка|фургон|каблук|каблучок)\b/i), value: "van" },
  { pattern: cyrb(/\b(?:седан|бочка|четырёхдверк[а-яё]*|четырехдверк[а-яё]*)\b/i), value: "sedan" },
  { pattern: cyrb(/\b(?:хэтчбек|хетчбек|хэтч|хетч|пятидверк[а-яё]*)\b/i), value: "hatchback" },
  { pattern: cyrb(/\b(?:лифтбек|лифтбэк)\b/i), value: "liftback" },
  { pattern: cyrb(/\b(?:пикап|пик[а-яё]*)\b/i), value: "pickup" },
];

/** Condition aliases — negative lookbehind to avoid "не дрова" matching as poor */
const conditionAliases: Array<{ pattern: RegExp; value: "poor" | "decent" }> = [
  { pattern: /(?<!не\s)(?<![а-яёА-ЯЁa-zA-Z0-9])(?:корч[а-яё]*|корыт[а-яё]*|ведр[а-яё]*(?:\s+с\s+гайками)?|дров[а-яё]*|ушатанн[а-яё]*|ушат(?![а-яА-Я])|убит[а-яё]*|уставш[а-яё]*|хламиди[а-яё]*|трахом[а-яё]*|гнил[а-яё]*|ржав[а-яё]*|труп|мертв[а-яё]*|раздолбанн[а-яё]*|разложен[а-яё]*|сыпучк[а-яё]*|помойк[а-яё]*|сквозн[а-яё]*|тотал|после\s+дтп|аварийн[а-яё]*|битая|битый|битьё|восстановлен[а-яё]*\s+после\s+дтп)(?![а-яёА-ЯЁa-zA-Z0-9])/i, value: "poor" },
  { pattern: /(?<![а-яёА-ЯЁa-zA-Z0-9])(?:живая|живой(?:\s+вариант)?|бодр[а-яё]*|огонь|конфетк[а-яё]*|свеж[а-яё]*|в\s+идеале|без\s+нареканий|на\s+ходу|целая|ухоженн[а-яё]*)(?![а-яёА-ЯЁa-zA-Z0-9])/i, value: "decent" },
];

/** Steering aliases */
const steeringAliases: Array<{ pattern: RegExp; value: "rhd" | "lhd" }> = [
  { pattern: cyrb(/\b(?:прав(?:ый|ая)?\s*руль|праворукая|правильная|косорукая|праворульн[а-яё]*)\b/i), value: "rhd" },
  { pattern: cyrb(/\b(?:европеец|лев(?:ый|ая)?\s*руль|леворульн[а-яё]*|европейк[а-яё]*)\b/i), value: "lhd" },
];

/** Engine volume aliases (returns liters) */
const engineVolumeAliases: Array<{ pattern: RegExp; value: number }> = [
  { pattern: cyrb(/\b(?:литрушк[а-яё]*|один[а-яё]*\s+литр[а-яё]*|литр[а-яё]*\s+один|однолитров[а-яё]*|1[.,]0\s*л)\b/i), value: 1.0 },
  { pattern: cyrb(/\b(?:один\s+(?:и\s+)?три|1[.,]3\s*л)\b/i), value: 1.3 },
  { pattern: cyrb(/\b(?:полторашк[а-яё]*|полтора|1[.,]5\s*л|один\s+(?:и\s+)?пять)\b/i), value: 1.5 },
  { pattern: cyrb(/\b(?:один\s+(?:и\s+)?восемь|1[.,]8\s*л)\b/i), value: 1.8 },
  { pattern: cyrb(/\b(?:двушк[а-яё]*|двалитр[а-яё]*|двухлитров[а-яё]*|2[.,]0\s*л|2\s+литр)\b/i), value: 2.0 },
  { pattern: cyrb(/\b(?:два\s+(?:и\s+)?четыре|два\s+четыре|2[.,]4\s*л)\b/i), value: 2.4 },
  { pattern: cyrb(/\b(?:два\s+(?:и\s+)?пять|два\s+пять|2[.,]5\s*л)\b/i), value: 2.5 },
  { pattern: cyrb(/\b(?:трешк[а-яё]*|трёшк[а-яё]*|трёхлитров[а-яё]*|трехлитров[а-яё]*|3[.,]0\s*л|3\s+литр)\b/i), value: 3.0 },
  { pattern: cyrb(/\b(?:три\s+(?:и\s+)?пять|три\s+пять|3[.,]5\s*л)\b/i), value: 3.5 },
  { pattern: cyrb(/\b(?:четвёрк[а-яё]*|четверк[а-яё]*|четырёхлитров[а-яё]*|четырехлитров[а-яё]*|4[.,]0\s*л|4\s+литр)\b/i), value: 4.0 },
];

/** Ownership / use-case aliases */
const ownershipAliases = {
  personal: cyrb(/\b(?:для\s+себя|машина\s+для\s+себя|себе\s+(?:ищу|хочу|беру)|лично\s+для\s+себя|сам\s+буду\s+ездить)\b/i),
  resale: cyrb(/\b(?:под\s+перепродажу|для\s+перепродаж|на\s+перепродажу|перепродать|для\s+перекупа)\b/i),
  legalEntity: cyrb(/\b(?:на\s+юрлицо|на\s+фирму|на\s+компанию|на\s+ооо|на\s+ип|на\s+организацию|для\s+юрлица|юридическ[а-яё]*\s+лицо|корпоративн[а-яё]*)\b/i),
};

/** Priority aliases */
const priorityAliases = {
  cheapest: cyrb(/\b(?:подешевле|дешман|по\s+низу\s+рынка|подешевше|бюджетн[а-яё]*|самую\s+дешёвую|самую\s+дешевую|подешевей|за\s+копейки|недорог[а-яё]*|эконом[а-яё]*)\b/i),
  betterCondition: cyrb(/\b(?:живую|не\s+дрова|не\s+ведро|получше\s+состояни|хорош(?:ее|ую)\s+состояни|в\s+хорошем\s+состоянии|не\s+убитую)\b/i),
};

/** Color slang aliases */
const colorAliases: Array<{ pattern: RegExp; value: string }> = [
  { pattern: cyrb(/\b(?:снежка|серебрянка|серебристая|серебро)\b/i), value: "серебристый" },
  { pattern: cyrb(/\b(?:бутылка|бутылочн)\b/i), value: "тёмно-зелёный" },
  { pattern: cyrb(/\b(?:бесцветная|белоснежн[а-яё]*)\b/i), value: "белый" },
  { pattern: cyrb(/\b(?:мокрый\s+асфальт|мокро[а-яё]*\s+асфальт)\b/i), value: "тёмно-серый" },
  { pattern: cyrb(/\b(?:баклажан|баклажанов[а-яё]*)\b/i), value: "тёмно-фиолетовый" },
  { pattern: cyrb(/\b(?:вишнёв[а-яё]*|вишнев[а-яё]*|вишня)\b/i), value: "тёмно-красный" },
  { pattern: cyrb(/\b(?:шампань|шампанск[а-яё]*)\b/i), value: "бежевый" },
];

/** Negative flags — risk indicators */
const negativeFlagPatterns: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: cyrb(/\b(?:топляк|утопленн[а-яё]*|утопленник)\b/i), flag: "flood_damage" },
  { pattern: cyrb(/\b(?:перевертыш|перевёрт[а-яё]*|кувыркалась|кувыркнулась)\b/i), flag: "rollover_history" },
  { pattern: cyrb(/\b(?:кривая|кривой)\b/i), flag: "geometry_or_docs_problem" },
  { pattern: cyrb(/\b(?:жучки|жуки|цветёт|цветет|ржавчин[а-яё]*)\b/i), flag: "rust_spots" },
  { pattern: cyrb(/\b(?:маслит|жрёт\s+масло|жрет\s+масло|масложор)\b/i), flag: "oil_leak" },
  { pattern: cyrb(/\b(?:конструктор)\b/i), flag: "constructor_import" },
  { pattern: cyrb(/\b(?:распил|пил[а-яё]*)\b/i), flag: "cut_import" },
  { pattern: cyrb(/\b(?:половинк[а-яё]*)\b/i), flag: "half_cut" },
  { pattern: cyrb(/\b(?:скрученн[а-яё]*\s+пробег|скрутк[а-яё]*|скручен)\b/i), flag: "odometer_tampered" },
  { pattern: cyrb(/\b(?:двойник)\b/i), flag: "cloned_vin" },
  { pattern: cyrb(/\b(?:залог[а-яё]*|кредитн[а-яё]*|в\s+залоге|под\s+залогом)\b/i), flag: "lien_or_loan" },
  { pattern: cyrb(/\b(?:арест[а-яё]*|в\s+аресте|под\s+арестом)\b/i), flag: "seized" },
  { pattern: cyrb(/\b(?:запрет\s+(?:на\s+)?рег|ограничени[а-яё]*\s+(?:на\s+)?рег)\b/i), flag: "registration_ban" },
];

/** Seller claims — soft trust */
const sellerClaimPatterns: Array<{ pattern: RegExp; meaning: string }> = [
  { pattern: /(?:в\s+родне|кузов\s+в\s+родне|родная\s+краска)/i, meaning: "seller_claims_original_paint" },
  { pattern: /(?:мотор\s+масло\s+не\s+бер[её]т|масло\s+не\s+жр[её]т|масло\s+не\s+ест)/i, meaning: "seller_claims_no_oil_consumption" },
  { pattern: /(?:коробка\s+не\s+пинается|коробка\s+без\s+нарекани)/i, meaning: "seller_claims_transmission_ok" },
  { pattern: /(?:работает\s+как\s+часы|как\s+часики)/i, meaning: "seller_claims_perfect_condition" },
  { pattern: /(?:доедет\s+куда\s+угодно|доедет\s+сво[а-яё]*\s+ходом)/i, meaning: "seller_claims_reliable" },
  { pattern: /(?:я\s+хозяин|не\s+перекуп|один\s+хозяин|первый\s+хозяин|в\s+одних\s+руках)/i, meaning: "seller_claims_owner" },
  { pattern: /(?:не\s+распил|не\s+надгрыз|не\s+надкус|легально\s+ввезён|легально\s+ввезен)/i, meaning: "seller_claims_legal_import" },
  { pattern: /(?:сквозной\s+коррозии\s+нет|без\s+сквозн)/i, meaning: "seller_claims_no_deep_rust" },
  { pattern: /(?:пробег\s+(?:родной|оригинальн)|не\s+скручен)/i, meaning: "seller_claims_original_mileage" },
  { pattern: /(?:все\s+расходники\s+заменен|свежее?\s+то\s+(?:сделано|пройдено)|только\s+(?:прошла|прошел)\s+то)/i, meaning: "seller_claims_recent_service" },
  { pattern: /(?:без\s+подкрас|не\s+крашен[а-яё]*|не\s+красилась)/i, meaning: "seller_claims_no_repaint" },
  { pattern: /(?:не\s+бит[а-яё]*|не\s+крашен[а-яё]*,?\s+не\s+бит[а-яё]*|без\s+дтп)/i, meaning: "seller_claims_no_accident" },
  { pattern: /(?:гараж(?:ное|ного)?\s+хранени|хранилась\s+в\s+гараже)/i, meaning: "seller_claims_garage_kept" },
];

/** Reseller / market language — indicates reseller context or market jargon */
const resellerContextPattern: RegExp = /(?:перекуп[а-яё]*|перепуки|перепук[а-яё]*|покупан[а-яё]*|торг\s+у\s+капота|торг\s+(?:при\s+)?(?:осмотре|встрече)|авторынок|авторынк[а-яё]*|с\s+рук[и]?|на\s+рынке|барыг[а-яё]*|купец|купц[а-яё]*|маклер[а-яё]*|объезжен[а-яё]*\s+перекуп|подобрать\s+через\s+перекуп)/i;

/** No-Russia-mileage aliases */
const noRussiaMileagePattern: RegExp = cyrb(/\b(?:беспробежн(?:ая|ый|ое)?|беспробежк[а-яё]*|б\/п|с\s+аукциона|без\s+пробега\s+по\s+(?:рф|россии|ру)|свеже(?:пригнанн[а-яё]*|привоз[а-яё]*))\b/i);

/** Budget guidance phrases */
const budgetGuidancePattern: RegExp = /(?:засвети\s+(?:стоимост|бюджет|цен)|дай\s+вилку|сориентируй\s+по\s+(?:бюджет|цен|стоимост)|примерн(?:ый|ая|ое)?\s+(?:бюджет|стоимост|цен)|цен[а-яё]*\s+в\s+иенах\s+не\s+знаю|бюджет\s+не\s+знаю|не\s+знаю\s+(?:бюджет|цен|стоимост)|сколько\s+(?:стоит|будет\s+стоить|выйдет)|поч[её]м\s+(?:нынче|сейчас|выходит)|что\s+по\s+(?:ценам|деньгам|стоимости)|во\s+что\s+обойд[её]тся|во\s+что\s+обойдется|назови\s+(?:цену|сумму|стоимость)|прикинь\s+(?:бюджет|стоимост|цен))/i;

// ══════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════

/**
 * Normalize Russian auto-slang in the input text.
 * Replaces slang terms with canonical equivalents so downstream regex
 * patterns in the deterministic parser can match them.
 */
export function normalizeAutoSlang(text: string): string {
  let t = text;

  // Numeric slang normalization
  t = t
    .replace(/(?<![а-яА-Яa-zA-Z])двушк[а-яё]*/gi, "2.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])двалитр[а-яё]*/gi, "2.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])один\s+(?:и\s+)?пять(?![а-яА-Яa-zA-Z])/gi, "1.5")
    .replace(/(?<![а-яА-Яa-zA-Z])трешк[а-яё]*/gi, "3.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])трёшк[а-яё]*/gi, "3.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])литрушк[а-яё]*/gi, "1.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])четвёрк[а-яё]*/gi, "4.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])четверк[а-яё]*/gi, "4.0 л");

  // Transmission slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:на\s+палке|палка|кочерга|мешалка|мотыга|дёргалка|дергалка)(?![а-яА-Яa-zA-Z])/gi, "механика");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])тяпка(?![а-яА-Яa-zA-Z])/gi, "автомат");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:варик|вибратор)(?![а-яА-Яa-zA-Z])/gi, "вариатор");

  // Drivetrain slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:передок)(?![а-яА-Яa-zA-Z])/gi, "передний привод");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:задок)(?![а-яА-Яa-zA-Z])/gi, "задний привод");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:вэдовая|вдовая|вэдэшка)(?![а-яА-Яa-zA-Z])/gi, "полный привод");
  t = t.replace(/(?<![а-яА-Яa-zA-Z0-9])(?:4вд|4wd|4х4|4x4)(?![а-яА-Яa-zA-Z])/gi, "полный привод");

  // Fuel slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])саляра(?![а-яА-Яa-zA-Z])/gi, "дизель");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:солярк[а-яё]*)(?![а-яА-Яa-zA-Z])/gi, "дизель");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])зажигалка(?![а-яА-Яa-zA-Z])/gi, "бензин");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:гибра|гибридка)(?![а-яА-Яa-zA-Z])/gi, "гибрид");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])электричка(?![а-яА-Яa-zA-Z])/gi, "электро");

  // Steering slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:праворукая|правильная|косорукая|праворульн[а-яё]*)(?![а-яА-Яa-zA-Z])/gi, "правый руль");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:европеец|европейк[а-яё]*)(?![а-яА-Яa-zA-Z])/gi, "левый руль");

  // Body slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:микрик|микроб(?:ус)?|басик|балабаска)(?![а-яА-Яa-zA-Z])/gi, "минивэн");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:сарай)(?![а-яА-Яa-zA-Z])/gi, "универсал");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:паркетник)(?![а-яА-Яa-zA-Z])/gi, "кроссовер");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:козёл|козел)(?![а-яА-Яa-zA-Z])/gi, "внедорожник");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:купарь)(?![а-яА-Яa-zA-Z])/gi, "купе");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:каблук|каблучок)(?![а-яА-Яa-zA-Z])/gi, "фургон");

  // Reseller slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:перепуки|перепук[а-яё]*)(?![а-яА-Яa-zA-Z])/gi, "перекуп");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:покупан[а-яё]*)(?![а-яА-Яa-zA-Z])/gi, "покупатель");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:барыг[а-яё]*)(?![а-яА-Яa-zA-Z])/gi, "перекуп");

  // Origin → canonical for model detection
  t = t.replace(/(?<![а-яА-Яa-zA-Z])японка(?![а-яА-Яa-zA-Z])/gi, "японский автомобиль");

  return t;
}

/**
 * Extract structured slang signals from text.
 * Returns a partial SlangSignals with only detected fields filled in.
 */
export function extractSlangSignals(text: string): Partial<SlangSignals> {
  const low = text.toLowerCase().replace(/ё/g, "е");
  const signals: Partial<SlangSignals> = {};

  // Transmission
  for (const { pattern, value } of transmissionAliases) {
    if (pattern.test(low)) {
      signals.transmission = value;
      break;
    }
  }

  // Drivetrain
  for (const { pattern, value } of drivetrainAliases) {
    if (pattern.test(low)) {
      signals.drivetrain = value;
      break;
    }
  }

  // Trim level
  for (const { pattern, value, extras } of trimAliases) {
    if (pattern.test(low)) {
      signals.trimLevel = value;
      if (extras?.manualWindows) signals.manualWindows = true;
      break;
    }
  }

  // Sunroof
  if (sunroofAliases.test(low)) {
    signals.hasSunroof = true;
  }

  // Climate
  if (climateAliases.test(low)) {
    signals.hasClimate = true;
  }

  // Fuel type
  for (const { pattern, value } of fuelAliases) {
    if (pattern.test(low)) {
      signals.fuelType = value;
      break;
    }
  }

  // Turbo
  if (turboAliases.test(low)) {
    signals.turbo = true;
  }

  // Body
  for (const { pattern, value } of bodyAliases) {
    if (pattern.test(low)) {
      signals.body = value;
      break;
    }
  }

  // Condition
  for (const { pattern, value } of conditionAliases) {
    if (pattern.test(low)) {
      signals.condition = value;
      break;
    }
  }

  // Steering
  for (const { pattern, value } of steeringAliases) {
    if (pattern.test(low)) {
      signals.steering = value;
      break;
    }
  }

  // Engine volume
  for (const { pattern, value } of engineVolumeAliases) {
    if (pattern.test(low)) {
      signals.engineVolume = value;
      break;
    }
  }

  // Ownership / use-case
  if (ownershipAliases.personal.test(low)) {
    signals.useCase = "personal";
    signals.isForResale = false;
    signals.isLegalEntity = false;
  } else if (ownershipAliases.resale.test(low)) {
    signals.useCase = "resale";
    signals.isForResale = true;
  } else if (ownershipAliases.legalEntity.test(low)) {
    signals.useCase = "legal_entity";
    signals.isLegalEntity = true;
  }

  // Priority
  if (priorityAliases.cheapest.test(low)) {
    signals.priority = "cheapest";
  } else if (priorityAliases.betterCondition.test(low)) {
    signals.priority = "better_condition";
  }

  // Color
  for (const { pattern, value } of colorAliases) {
    if (pattern.test(low)) {
      signals.color = value;
      break;
    }
  }

  // No-Russia mileage
  if (noRussiaMileagePattern.test(low)) {
    signals.noRussiaMileage = true;
  }

  // Reseller / market context
  if (resellerContextPattern.test(low)) {
    signals.resellerContext = true;
  }

  // Budget guidance
  if (budgetGuidancePattern.test(low)) {
    signals.budgetGuidance = true;
  }

  // Negative flags
  const negFlags: string[] = [];
  for (const { pattern, flag } of negativeFlagPatterns) {
    if (pattern.test(low)) {
      negFlags.push(flag);
    }
  }
  // Also check for negation: "не топляк", "не распил" → user is EXCLUDING these
  // These are user preferences, not negative facts about a car they're buying
  if (negFlags.length > 0) {
    signals.negativeFlags = negFlags;
  }

  // Seller claims — only trigger when there's seller context
  // "не распил, не надгрыз" without seller context is a buyer preference (exclusion), not a seller claim
  const hasSellerContext = /(?:продавец|хозяин|владелец|собственник)\s+(?:пишет|говорит|заявляет|утверждает|сказал)/i.test(low)
    || /(?:в\s+объявлении|в\s+описании)/i.test(low);
  const claims: SellerClaim[] = [];
  for (const { pattern, meaning } of sellerClaimPatterns) {
    const m = low.match(pattern);
    if (m) {
      // "не распил/не надгрыз/не надкус" and "не перекуп/я хозяин" require seller context
      const needsContext = meaning === "seller_claims_legal_import" || meaning === "seller_claims_owner";
      if (!needsContext || hasSellerContext) {
        claims.push({
          original: m[0],
          meaning,
          trust: "soft_claim",
        });
      }
    }
  }
  if (claims.length > 0) {
    signals.sellerClaims = claims;
  }

  return signals;
}

/**
 * Detect exclusion patterns: "не дрова", "не распил", "не топляк"
 * Returns list of excluded negative flags (things the user does NOT want).
 */
export function extractExcludedNegativeFlags(text: string): string[] {
  const low = text.toLowerCase().replace(/ё/g, "е");
  const excluded: string[] = [];

  const exclusionPatterns: Array<{ pattern: RegExp; flag: string }> = [
    { pattern: /не\s+(?:топляк|утопленн[а-яё]*|утопленник)/i, flag: "flood_damage" },
    { pattern: /не\s+(?:перевертыш|перевёрт[а-яё]*)/i, flag: "rollover_history" },
    { pattern: /не\s+(?:распил|пил[а-яё]*)/i, flag: "cut_import" },
    { pattern: /не\s+(?:конструктор)/i, flag: "constructor_import" },
    { pattern: /не\s+(?:дрова|ведро|ушат|корч|убит[а-яё]*|хлам)/i, flag: "poor_condition" },
    { pattern: /не\s+(?:кредитн[а-яё]*|залогов[а-яё]*)/i, flag: "lien_or_loan" },
    { pattern: /без\s+(?:ограничений|запретов|арест[а-яё]*)/i, flag: "registration_clean" },
    { pattern: /не\s+(?:скручен[а-яё]*|крученн[а-яё]*)/i, flag: "odometer_not_tampered" },
    { pattern: /не\s+(?:двойник)/i, flag: "not_cloned" },
    { pattern: /не\s+(?:битая|битый|бит[а-яё]*)/i, flag: "not_crashed" },
  ];

  for (const { pattern, flag } of exclusionPatterns) {
    if (pattern.test(low)) {
      excluded.push(flag);
    }
  }
  return excluded;
}

/**
 * Extract seller claim signals from text.
 * Returns only soft_claim items — things a seller says that should not
 * be treated as facts in bot responses.
 */
export function extractSellerClaimSignals(text: string): SellerClaim[] {
  const low = text.toLowerCase().replace(/ё/g, "е");
  const claims: SellerClaim[] = [];

  const hasSellerContext = /(?:продавец|хозяин|владелец|собственник)\s+(?:пишет|говорит|заявляет|утверждает|сказал)/i.test(low)
    || /(?:в\s+объявлении|в\s+описании)/i.test(low);

  for (const { pattern, meaning } of sellerClaimPatterns) {
    const m = low.match(pattern);
    if (m) {
      const needsContext = meaning === "seller_claims_legal_import" || meaning === "seller_claims_owner";
      if (!needsContext || hasSellerContext) {
        claims.push({
          original: m[0],
          meaning,
          trust: "soft_claim",
        });
      }
    }
  }
  return claims;
}

/**
 * Detect if user is requesting approximate budget guidance.
 */
export function extractApproxBudgetIntent(text: string): boolean {
  const low = text.toLowerCase().replace(/ё/g, "е");
  return budgetGuidancePattern.test(low);
}

/**
 * Normalize numeric slang in Russian text.
 * Extends the basic normalization already in extractStateUpdate.
 */
export function normalizeNumericSlang(text: string): string {
  let t = text;
  t = t.replace(/(?<![а-яА-Яa-zA-Z])двушк[а-яё]*/gi, "2.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])двалитр[а-яё]*/gi, "2.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])один\s+(?:и\s+)?пять(?![а-яА-Яa-zA-Z])/gi, "1.5");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])трешк[а-яё]*/gi, "3.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])трёшк[а-яё]*/gi, "3.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])литрушк[а-яё]*/gi, "1.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])четвёрк[а-яё]*/gi, "4.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])четверк[а-яё]*/gi, "4.0 л");
  return t;
}
