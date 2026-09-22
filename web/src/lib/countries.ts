/**
 * Global country list (ISO 3166-1 alpha-2) for market selection.
 *
 * WingCaster operates globally — market pickers must offer every country, not a
 * regional subset. Display names are resolved at module load via
 * `Intl.DisplayNames` (en + ar), falling back to the raw code if unavailable.
 */

export type CountryCode = string

/** ISO 3166-1 alpha-2 codes. */
export const COUNTRY_CODES: readonly string[] = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS',
  'BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN',
  'CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE',
  'EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF',
  'GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM',
  'HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM',
  'JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC',
  'LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK',
  'ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA',
  'NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG',
  'PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS',
  'ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO',
  'TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI',
  'VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
] as const

export type CountryOption = {
  code: string
  label: { en: string; ar: string }
}

function displayName(code: string, locale: 'en' | 'ar'): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'region' })
    return dn.of(code) ?? code
  } catch {
    return code
  }
}

/** All countries, each with localized names, sorted by English name. */
export const COUNTRY_OPTIONS: readonly CountryOption[] = COUNTRY_CODES.map((code) => ({
  code,
  label: { en: displayName(code, 'en'), ar: displayName(code, 'ar') },
})).sort((a, b) => a.label.en.localeCompare(b.label.en))

const CODE_TO_OPTION = new Map(COUNTRY_OPTIONS.map((o) => [o.code, o]))

export function countryLabel(code: string, locale: 'en' | 'ar' = 'en'): string {
  return CODE_TO_OPTION.get(code)?.label[locale] ?? code
}

export function isCountryCode(code: string): boolean {
  return CODE_TO_OPTION.has(code)
}
