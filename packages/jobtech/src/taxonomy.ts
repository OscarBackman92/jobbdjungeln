/**
 * The fixed parts of JobTech's taxonomy.
 *
 * Regions and occupation fields never change in practice, so they are inlined:
 * the filter dropdowns then render instantly and keep working even when the
 * taxonomy API is down. Municipalities and occupation groups are fetched lazily,
 * because they only matter once the user has narrowed things down.
 */

export interface TaxonomyOption {
  id: string;
  label: string;
}

export interface Municipality extends TaxonomyOption {
  regionId: string;
}

export interface OccupationGroup extends TaxonomyOption {
  fieldId: string;
}

/** Sweden's 21 regions, alphabetical by label. */
export const REGIONS: readonly TaxonomyOption[] = [
  { id: 'DQZd_uYs_oKb', label: 'Blekinge län' },
  { id: 'oDpK_oZ2_WYt', label: 'Dalarnas län' },
  { id: 'K8iD_VQv_2BA', label: 'Gotlands län' },
  { id: 'zupA_8Nt_xcD', label: 'Gävleborgs län' },
  { id: 'wjee_qH2_yb6', label: 'Hallands län' },
  { id: '65Ms_7r1_RTG', label: 'Jämtlands län' },
  { id: 'MtbE_xWT_eMi', label: 'Jönköpings län' },
  { id: '9QUH_2bb_6Np', label: 'Kalmar län' },
  { id: 'tF3y_MF9_h5G', label: 'Kronobergs län' },
  { id: '9hXe_F4g_eTG', label: 'Norrbottens län' },
  { id: 'CaRE_1nn_cSU', label: 'Skåne län' },
  { id: 'CifL_Rzy_Mku', label: 'Stockholms län' },
  { id: 's93u_BEb_sx2', label: 'Södermanlands län' },
  { id: 'zBon_eET_fFU', label: 'Uppsala län' },
  { id: 'EVVp_h6U_GSZ', label: 'Värmlands län' },
  { id: 'g5Tt_CAV_zBd', label: 'Västerbottens län' },
  { id: 'NvUF_SP1_1zo', label: 'Västernorrlands län' },
  { id: 'G6DV_fKE_Viz', label: 'Västmanlands län' },
  { id: 'zdoY_6u5_Krt', label: 'Västra Götalands län' },
  { id: 'xTCk_nT5_Zjm', label: 'Örebro län' },
  { id: 'oLT3_Q9p_3nn', label: 'Östergötlands län' },
];

/** JobTech's 21 occupation fields, alphabetical by label. */
export const OCCUPATION_FIELDS: readonly TaxonomyOption[] = [
  { id: 'X82t_awd_Qyc', label: 'Administration, ekonomi, juridik' },
  { id: 'j7Cq_ZJe_GkT', label: 'Bygg och anläggning' },
  { id: 'bh3H_Y3h_5eD', label: 'Chefer och verksamhetsledare' },
  { id: 'apaJ_2ja_LuF', label: 'Data/IT' },
  { id: 'RPTn_bxG_ExZ', label: 'Försäljning, inköp, marknadsföring' },
  { id: 'PaxQ_o1G_wWH', label: 'Hantverk' },
  { id: 'ScKy_FHB_7wT', label: 'Hotell, restaurang, storhushåll' },
  { id: 'NYW6_mP6_vwf', label: 'Hälso- och sjukvård' },
  { id: 'wTEr_CBC_bqh', label: 'Industriell tillverkning' },
  { id: 'yhCP_AqT_tns', label: 'Installation, drift, underhåll' },
  { id: 'Uuf1_GMh_Uvw', label: 'Kropps- och skönhetsvård' },
  { id: '9puE_nYg_crq', label: 'Kultur, media, design' },
  { id: 'bH5L_uXD_ZAX', label: 'Militära yrken' },
  { id: 'VuuL_7CH_adj', label: 'Naturbruk' },
  { id: 'kJeN_wmw_9wX', label: 'Naturvetenskap' },
  { id: 'MVqp_eS8_kDZ', label: 'Pedagogik' },
  { id: 'whao_Q6A_ScE', label: 'Sanering och renhållning' },
  { id: 'E7hm_BLq_fqZ', label: 'Säkerhet och bevakning' },
  { id: 'ASGV_zcE_bWf', label: 'Transport, distribution, lager' },
  { id: 'GazW_2TU_kJw', label: 'Yrken med social inriktning' },
  { id: '6Hq3_tKo_V57', label: 'Yrken med teknisk inriktning' },
];

const REGION_IDS = new Set(REGIONS.map((region) => region.id));
const FIELD_IDS = new Set(OCCUPATION_FIELDS.map((field) => field.id));

/** JobTech concept ids are short opaque tokens. */
const CONCEPT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_]{0,63}$/;

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function validRegionIds(ids: readonly string[]): string[] {
  return unique(ids.filter((id) => REGION_IDS.has(id)));
}

export function validFieldIds(ids: readonly string[]): string[] {
  return unique(ids.filter((id) => FIELD_IDS.has(id)));
}

/**
 * Municipality and occupation-group ids come from our own lazily-loaded lists,
 * so they are only shape-checked: JobTech answers an unknown id with zero hits
 * rather than an error, and re-validating each one upstream on every search was
 * slow enough to time out when many filters were selected.
 */
export function validConceptIds(ids: readonly string[]): string[] {
  return unique(ids.filter((id) => CONCEPT_ID_RE.test(id)));
}

export function regionLabel(id: string): string {
  return REGIONS.find((region) => region.id === id)?.label ?? '';
}

export function fieldLabel(id: string): string {
  return OCCUPATION_FIELDS.find((field) => field.id === id)?.label ?? '';
}
