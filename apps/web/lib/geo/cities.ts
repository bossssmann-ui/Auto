/**
 * География доставки — данные для программных страниц `/avto-iz-yaponii/[gorod]`.
 *
 * ⚠️ `deliveryDaysEstimate` и `deliveryPriceFromRub` — ОРИЕНТИРОВОЧНЫЕ оценки
 * автовоза из Владивостока (UI всегда подписывает их «ориентировочно» / «от»).
 * Владелец уточняет реальные тарифы прямо в этом файле — ничего больше править
 * не нужно, страницы пересоберутся сами.
 *
 * `deliveryPriceFromRub: 0` означает выдачу на терминале ТЛК во Владивостоке
 * без автовоза.
 */

export interface GeoCity {
  /** URL-slug: /avto-iz-yaponii/{slug} */
  slug: string;
  /** Именительный падеж: «Москва» */
  name: string;
  /** Предложный падеж с предлогом: «в Москве» */
  namePrepositional: string;
  region: string;
  federalDistrict: string;
  /** Ориентировочный срок автовоза из Владивостока, дней (диапазон строкой). */
  deliveryDaysEstimate: string;
  /** Ориентировочная цена автовоза «от», ₽. 0 = выдача на терминале. */
  deliveryPriceFromRub: number;
}

export const GEO_CITIES: readonly GeoCity[] = [
  { slug: "vladivostok", name: "Владивосток", namePrepositional: "во Владивостоке", region: "Приморский край", federalDistrict: "Дальневосточный ФО", deliveryDaysEstimate: "0–2", deliveryPriceFromRub: 0 },
  { slug: "khabarovsk", name: "Хабаровск", namePrepositional: "в Хабаровске", region: "Хабаровский край", federalDistrict: "Дальневосточный ФО", deliveryDaysEstimate: "2–4", deliveryPriceFromRub: 25_000 },
  { slug: "blagoveshchensk", name: "Благовещенск", namePrepositional: "в Благовещенске", region: "Амурская область", federalDistrict: "Дальневосточный ФО", deliveryDaysEstimate: "3–5", deliveryPriceFromRub: 35_000 },
  { slug: "chita", name: "Чита", namePrepositional: "в Чите", region: "Забайкальский край", federalDistrict: "Дальневосточный ФО", deliveryDaysEstimate: "4–7", deliveryPriceFromRub: 50_000 },
  { slug: "ulan-ude", name: "Улан-Удэ", namePrepositional: "в Улан-Удэ", region: "Республика Бурятия", federalDistrict: "Дальневосточный ФО", deliveryDaysEstimate: "5–8", deliveryPriceFromRub: 55_000 },
  { slug: "yakutsk", name: "Якутск", namePrepositional: "в Якутске", region: "Республика Саха (Якутия)", federalDistrict: "Дальневосточный ФО", deliveryDaysEstimate: "7–14", deliveryPriceFromRub: 90_000 },
  { slug: "irkutsk", name: "Иркутск", namePrepositional: "в Иркутске", region: "Иркутская область", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "5–9", deliveryPriceFromRub: 60_000 },
  { slug: "krasnoyarsk", name: "Красноярск", namePrepositional: "в Красноярске", region: "Красноярский край", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "6–10", deliveryPriceFromRub: 70_000 },
  { slug: "kemerovo", name: "Кемерово", namePrepositional: "в Кемерове", region: "Кемеровская область", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "7–11", deliveryPriceFromRub: 75_000 },
  { slug: "novokuznetsk", name: "Новокузнецк", namePrepositional: "в Новокузнецке", region: "Кемеровская область", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "7–11", deliveryPriceFromRub: 75_000 },
  { slug: "tomsk", name: "Томск", namePrepositional: "в Томске", region: "Томская область", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "7–11", deliveryPriceFromRub: 80_000 },
  { slug: "novosibirsk", name: "Новосибирск", namePrepositional: "в Новосибирске", region: "Новосибирская область", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "7–11", deliveryPriceFromRub: 80_000 },
  { slug: "barnaul", name: "Барнаул", namePrepositional: "в Барнауле", region: "Алтайский край", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "7–12", deliveryPriceFromRub: 80_000 },
  { slug: "omsk", name: "Омск", namePrepositional: "в Омске", region: "Омская область", federalDistrict: "Сибирский ФО", deliveryDaysEstimate: "8–12", deliveryPriceFromRub: 85_000 },
  { slug: "tyumen", name: "Тюмень", namePrepositional: "в Тюмени", region: "Тюменская область", federalDistrict: "Уральский ФО", deliveryDaysEstimate: "9–13", deliveryPriceFromRub: 95_000 },
  { slug: "ekaterinburg", name: "Екатеринбург", namePrepositional: "в Екатеринбурге", region: "Свердловская область", federalDistrict: "Уральский ФО", deliveryDaysEstimate: "9–14", deliveryPriceFromRub: 100_000 },
  { slug: "chelyabinsk", name: "Челябинск", namePrepositional: "в Челябинске", region: "Челябинская область", federalDistrict: "Уральский ФО", deliveryDaysEstimate: "9–14", deliveryPriceFromRub: 100_000 },
  { slug: "perm", name: "Пермь", namePrepositional: "в Перми", region: "Пермский край", federalDistrict: "Приволжский ФО", deliveryDaysEstimate: "10–14", deliveryPriceFromRub: 105_000 },
  { slug: "izhevsk", name: "Ижевск", namePrepositional: "в Ижевске", region: "Удмуртская Республика", federalDistrict: "Приволжский ФО", deliveryDaysEstimate: "10–15", deliveryPriceFromRub: 110_000 },
  { slug: "ufa", name: "Уфа", namePrepositional: "в Уфе", region: "Республика Башкортостан", federalDistrict: "Приволжский ФО", deliveryDaysEstimate: "10–15", deliveryPriceFromRub: 110_000 },
  { slug: "samara", name: "Самара", namePrepositional: "в Самаре", region: "Самарская область", federalDistrict: "Приволжский ФО", deliveryDaysEstimate: "10–15", deliveryPriceFromRub: 115_000 },
  { slug: "kazan", name: "Казань", namePrepositional: "в Казани", region: "Республика Татарстан", federalDistrict: "Приволжский ФО", deliveryDaysEstimate: "10–15", deliveryPriceFromRub: 115_000 },
  { slug: "nizhniy-novgorod", name: "Нижний Новгород", namePrepositional: "в Нижнем Новгороде", region: "Нижегородская область", federalDistrict: "Приволжский ФО", deliveryDaysEstimate: "11–16", deliveryPriceFromRub: 120_000 },
  { slug: "saratov", name: "Саратов", namePrepositional: "в Саратове", region: "Саратовская область", federalDistrict: "Приволжский ФО", deliveryDaysEstimate: "11–16", deliveryPriceFromRub: 120_000 },
  { slug: "volgograd", name: "Волгоград", namePrepositional: "в Волгограде", region: "Волгоградская область", federalDistrict: "Южный ФО", deliveryDaysEstimate: "11–16", deliveryPriceFromRub: 120_000 },
  { slug: "voronezh", name: "Воронеж", namePrepositional: "в Воронеже", region: "Воронежская область", federalDistrict: "Центральный ФО", deliveryDaysEstimate: "11–16", deliveryPriceFromRub: 125_000 },
  { slug: "moskva", name: "Москва", namePrepositional: "в Москве", region: "Москва и Московская область", federalDistrict: "Центральный ФО", deliveryDaysEstimate: "11–16", deliveryPriceFromRub: 125_000 },
  { slug: "sankt-peterburg", name: "Санкт-Петербург", namePrepositional: "в Санкт-Петербурге", region: "Санкт-Петербург и Ленинградская область", federalDistrict: "Северо-Западный ФО", deliveryDaysEstimate: "12–17", deliveryPriceFromRub: 135_000 },
  { slug: "rostov-na-donu", name: "Ростов-на-Дону", namePrepositional: "в Ростове-на-Дону", region: "Ростовская область", federalDistrict: "Южный ФО", deliveryDaysEstimate: "12–17", deliveryPriceFromRub: 130_000 },
  { slug: "krasnodar", name: "Краснодар", namePrepositional: "в Краснодаре", region: "Краснодарский край", federalDistrict: "Южный ФО", deliveryDaysEstimate: "12–17", deliveryPriceFromRub: 135_000 },
] as const;

export function getCity(slug: string): GeoCity | undefined {
  return GEO_CITIES.find((c) => c.slug === slug);
}
