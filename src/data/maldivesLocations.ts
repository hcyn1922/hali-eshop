// Maldives Geographic & Administrative Location Data
// Includes all 20 Administrative Atolls + Greater Malé Region
// HDC Hulhumalé Mapbook & Land Use Plan (LUP) Housing Schemes & Lot/Flat Numbers

export interface AtollInfo {
  code: string;
  name: string;
  officialName: string;
  capital: string;
  islands: string[];
}

export interface HulhumaleDevelopment {
  id: string;
  phase: 1 | 2;
  name: string;
  category: 'social_housing' | 'condominium' | 'institutional' | 'neighborhood_lot';
  lotNumber?: string;
  towers?: string[];
  totalFloors?: number;
  description?: string;
}

export const MALDIVES_REGIONS = [
  { id: 'greater_male', name: 'Greater Malé (Local Doorstep Delivery)' },
  { id: 'atolls', name: 'Atolls & Islands (Boat Cargo / Island Transfer)' },
] as const;

export const GREATER_MALE_AREAS = [
  {
    id: 'male',
    name: 'Malé City',
    districts: ['Henveiru (Henveyru)', 'Galolhu (Galolhu)', 'Machchangolhi (Machangoalhi)', 'Maafannu (Maafannu)'],
  },
  {
    id: 'hulhumale',
    name: "Hulhumalé",
    phases: ['P1', 'P2', 'P3'],
  },
  {
    id: 'vilimale',
    name: 'Vilimalé',
    districts: ['Vilimalé Ward 1', 'Vilimalé Ward 2', 'Ferry Area', 'Public Beach Area'],
  },
] as const;

export const MALE_CARGO_JETTIES = [
  { id: 'north_harbour_t_jetty', name: 'Malé North Harbour (T-Jetty)', description: 'Primary cargo boat terminal for northern and central atolls' },
  { id: 'local_market_jetty', name: 'Local Market Jetty (Fishermen Park Harbour)', description: 'Near Dhathuruveringe Park / Local fish & fruit market' },
  { id: 'commercial_harbour_mpl', name: 'Malé Commercial Harbor (MPL Terminal)', description: 'Container and general cargo docks' },
  { id: 'south_harbour_industrial', name: 'Malé South-West Harbour (Industrial Zone)', description: 'Southern atoll cargo boats and commercial transports' },
  { id: 'hulhumale_cargo_jetty', name: 'Hulhumalé Ferry Terminal / Cargo Jetty', description: 'Hulhumalé lagoon and harbor transfer point' },
  { id: 'vilimale_jetty', name: 'Vilimalé Cargo / Ferry Jetty', description: 'Vilimalé boat connections' },
  { id: 'other_custom_jetty', name: 'Other / Custom Pickup Jetty', description: 'Custom specified jetty or vessel berth' },
] as const;

// All 20 Administrative Atolls with complete inhabited islands
export const MALDIVES_ATOLLS: AtollInfo[] = [
  {
    code: 'HA',
    name: 'Haa Alif (HA)',
    officialName: 'Thiladhunmathi Uthuruburi',
    capital: 'Dhidhdhoo',
    islands: [
      'Dhidhdhoo', 'Baarah', 'Filladhoo', 'Hoarafushi', 'Ihavandhoo',
      'Kelaa', 'Maarandhoo', 'Mulhadhoo', 'Muraidhoo', 'Thakandhoo',
      'Thuraakunu', 'Uligamu', 'Utheemu', 'Vashafaru'
    ],
  },
  {
    code: 'HDh',
    name: 'Haa Dhaalu (HDh)',
    officialName: 'Thiladhunmathi Dhekunuburi',
    capital: 'Kulhudhuffushi City',
    islands: [
      'Kulhudhuffushi City', 'Finey', 'Hanimaadhoo', 'Hirimaradhoo',
      'Kornbee', 'Kumundhoo', 'Makunudhoo', 'Nellaidhoo', 'Neykurendhoo',
      'Nolhivaram', 'Nolhivaranfaru', 'Vaikaradhoo'
    ],
  },
  {
    code: 'Sh',
    name: 'Shaviyani (Sh)',
    officialName: 'Miladhunmadulu Uthuruburi',
    capital: 'Funadhoo',
    islands: [
      'Funadhoo', 'Bileffahi', 'Feevah', 'Feydhoo', 'Foakaidhoo',
      'Goidhoo', 'Kanditheemu', 'Komandoo', 'Lhaimagu', 'Maaungoodhoo',
      'Maroshi', 'Milandhoo', 'Narudhoo', 'Noomaraa'
    ],
  },
  {
    code: 'N',
    name: 'Noonu (N)',
    officialName: 'Miladhunmadulu Dhekunuburi',
    capital: 'Manadhoo',
    islands: [
      'Manadhoo', 'Fohdhoo', 'Henbandhoo', 'Holhudhoo', 'Kendhikulhudhoo',
      'Kudafari', 'Landhoo', 'Lhohi', 'Maafaru', 'Maalhendhoo',
      'Magoodhoo', 'Miladhoo', 'Velidhoo'
    ],
  },
  {
    code: 'R',
    name: 'Raa (R)',
    officialName: 'Maalhosmadulu Uthuruburi',
    capital: 'Ungoofaaru',
    islands: [
      'Ungoofaaru', 'Alifushi', 'Angolhitheemu', 'Dhuvaafaru', 'Fainu',
      'Hulhudhuffaaru', 'Inguraidhoo', 'Innamaadhoo', 'Kinolhas',
      'Maakurathu', 'Maduvvari', 'Meedhoo', 'Rasgetheemu', 'Rasmaadhoo', 'Vaadhoo'
    ],
  },
  {
    code: 'B',
    name: 'Baa (B)',
    officialName: 'Maalhosmadulu Dhekunuburi (UNESCO Biosphere)',
    capital: 'Eydhafushi',
    islands: [
      'Eydhafushi', 'Dharavandhoo', 'Dhonfanu', 'Fehendhoo', 'Fulhadhoo',
      'Goidhoo', 'Hithaadhoo', 'Kamadhoo', 'Kendhoo', 'Kihaadhoo',
      'Kudarikilu', 'Maalhos', 'Thulhaadhoo'
    ],
  },
  {
    code: 'Lh',
    name: 'Lhaviyani (Lh)',
    officialName: 'Faadhippolhu',
    capital: 'Naifaru',
    islands: ['Naifaru', 'Hinnavaru', 'Kurendhoo', 'Olhuvelifushi'],
  },
  {
    code: 'K',
    name: 'Kaafu (K)',
    officialName: 'Malé Atoll',
    capital: 'Thulusdhoo',
    islands: [
      'Hulhumalé', 'Malé City', 'Thulusdhoo', 'Dhiffushi', 'Gaafaru', 'Gulhi', 'Guraidhoo',
      'Himmafushi', 'Huraa', 'Kaashidhoo', 'Maafushi', 'Vilimalé'
    ],
  },
  {
    code: 'AA',
    name: 'Alif Alif (AA)',
    officialName: 'Ari Atoll Uthuruburi',
    capital: 'Rasdhoo',
    islands: [
      'Rasdhoo', 'Bodufolhudhoo', 'Feridhoo', 'Himandhoo',
      'Maalhos', 'Mathiveri', 'Thoddoo', 'Ukulhas'
    ],
  },
  {
    code: 'ADh',
    name: 'Alif Dhaalu (ADh)',
    officialName: 'Ari Atoll Dhekunuburi',
    capital: 'Mahibadhoo',
    islands: [
      'Mahibadhoo', 'Dhangethi', 'Dhigurah', 'Fenfushi',
      'Hangnaameedhoo', 'Kunburudhoo', 'Maamigili', 'Mandhoo', 'Omadhoo'
    ],
  },
  {
    code: 'V',
    name: 'Vaavu (V)',
    officialName: 'Felidhe Atoll',
    capital: 'Felidhoo',
    islands: ['Felidhoo', 'Fulidhoo', 'Keyodhoo', 'Rakeedhoo', 'Thinadhoo'],
  },
  {
    code: 'M',
    name: 'Meemu (M)',
    officialName: 'Mulaku Atoll',
    capital: 'Muli',
    islands: [
      'Muli', 'Dhiggaru', 'Kolhufushi', 'Maduvvari',
      'Mulah', 'Naalaafushi', 'Raimmandhoo', 'Veyvah'
    ],
  },
  {
    code: 'F',
    name: 'Faafu (F)',
    officialName: 'Nilandhe Atoll Uthuruburi',
    capital: 'Nilandhoo',
    islands: ['Nilandhoo', 'Bileddhoo', 'Dharanboodhoo', 'Feeali', 'Magoodhoo'],
  },
  {
    code: 'Dh',
    name: 'Dhaalu (Dh)',
    officialName: 'Nilandhe Atoll Dhekunuburi',
    capital: 'Kudahuvadhoo',
    islands: [
      'Kudahuvadhoo', 'Bandidhoo', 'Gemendhoo', 'Hulhudheli',
      'Maaenboodhoo', 'Meedhoo', 'Rinbudhoo', 'Vaanee'
    ],
  },
  {
    code: 'Th',
    name: 'Thaa (Th)',
    officialName: 'Kolhumadulu',
    capital: 'Veymandoo',
    islands: [
      'Veymandoo', 'Buruni', 'Dhiyamigili', 'Gaadhiffushi', 'Guraidhoo',
      'Hirilandhoo', 'Kandoodhoo', 'Kinbidhoo', 'Madifushi', 'Omadhoo',
      'Thimarafushi', 'Vandhoo', 'Vilufushi'
    ],
  },
  {
    code: 'L',
    name: 'Laamu (L)',
    officialName: 'Hadhdhunmathi',
    capital: 'Fonadhoo',
    islands: [
      'Fonadhoo', 'Dhanbidhoo', 'Gaadhoo', 'Gan', 'Hithadhoo',
      'Isdhoo', 'Kalaidhoo', 'Kunahandhoo', 'Maabaidhoo', 'Maavah', 'Mundoo'
    ],
  },
  {
    code: 'GA',
    name: 'Gaafu Alif (GA)',
    officialName: 'Huvadhu Atoll Uthuruburi',
    capital: 'Villingili',
    islands: [
      'Villingili', 'Dhaandhoo', 'Dhevvadhoo', 'Dhiyadhoo', 'Gemanafushi',
      'Kanduhulhudhoo', 'Kolamaafushi', 'Kondey', 'Maamendhoo', 'Nilandhoo'
    ],
  },
  {
    code: 'GDh',
    name: 'Gaafu Dhaalu (GDh)',
    officialName: 'Huvadhu Atoll Dhekunuburi',
    capital: 'Thinadhoo City',
    islands: [
      'Thinadhoo City', 'Faresmaathodaa', 'Fiyoaree', 'Gadhdhoo',
      'Hoandeddhoo', 'Madaveli', 'Nadellaa', 'Rathafandhoo', 'Vaadhoo'
    ],
  },
  {
    code: 'Gn',
    name: 'Gnaviyani (Gn)',
    officialName: 'Fuvahmulah',
    capital: 'Fuvahmulah City',
    islands: ['Fuvahmulah City'],
  },
  {
    code: 'S',
    name: 'Seenu (S)',
    officialName: 'Addu Atoll',
    capital: 'Hithadhoo (Addu City)',
    islands: [
      'Hithadhoo (Addu City)', 'Maradhoo', 'Maradhoo-Feydhoo',
      'Feydhoo', 'Hulhudhoo', 'Meedhoo'
    ],
  },
];

// HDC Hulhumalé Housing Schemes & Developments from gis.hdc.mv/mapbook/lup.html
export const HULHUMALE_DEVELOPMENTS: HulhumaleDevelopment[] = [
  // --- PHASE 2 MAJOR DEVELOPMENTS ---
  {
    id: 'hiyaa_flats',
    phase: 2,
    name: 'Hiyaa Housing Project',
    category: 'social_housing',
    lotNumber: 'Lots 20387 - 20402',
    towers: [
      'Tower H1', 'Tower H2', 'Tower H3', 'Tower H4',
      'Tower H5', 'Tower H6', 'Tower H7', 'Tower H8',
      'Tower H9', 'Tower H10', 'Tower H11', 'Tower H12',
      'Tower H13', 'Tower H14', 'Tower H15', 'Tower H16',
    ],
    totalFloors: 25,
    description: '16 high-rise towers of 25 storeys each, 6,720 residential apartments (Hulhumalé Phase 2)',
  },
  {
    id: 'vinares_flats',
    phase: 2,
    name: 'Vinares Housing Project',
    category: 'social_housing',
    lotNumber: 'Lot 20507 (V1 - V10)',
    towers: [
      'Tower V1', 'Tower V2', 'Tower V3', 'Tower V4', 'Tower V5',
      'Tower V6', 'Tower V7', 'Tower V8', 'Tower V9', 'Tower V10',
    ],
    totalFloors: 13,
    description: '10 modern 13-storey mid-range apartment towers in Hulhumalé Phase 2',
  },
  {
    id: 'stelco_kanbaa',
    phase: 2,
    name: 'STELCO Kanbaa / Blue Lagoon Flats',
    category: 'institutional',
    lotNumber: 'Lot 20380',
    towers: ['Tower 1', 'Tower 2'],
    totalFloors: 14,
    description: 'STELCO Staff Housing towers in Phase 2',
  },
  {
    id: 'mwsc_flats',
    phase: 2,
    name: 'MWSC Staff Housing',
    category: 'institutional',
    lotNumber: 'Lot 20382',
    towers: ['Tower A', 'Tower B'],
    totalFloors: 15,
    description: 'MWSC employees residential towers in Phase 2',
  },
  {
    id: 'macl_aero',
    phase: 2,
    name: 'MACL Aero Flats',
    category: 'institutional',
    lotNumber: 'Lot 20384',
    towers: ['Tower 1', 'Tower 2', 'Tower 3'],
    totalFloors: 15,
    description: 'Maldives Airports Company housing scheme in Phase 2',
  },
  {
    id: 'polco_housing',
    phase: 2,
    name: 'POLCO (Maldives Police Housing)',
    category: 'institutional',
    lotNumber: 'Lot 20370',
    towers: ['Tower 1', 'Tower 2', 'Tower 3'],
    totalFloors: 14,
    description: 'Maldives Police Service residential complex in Phase 2',
  },
  {
    id: 'sifco_housing',
    phase: 2,
    name: 'SIFCO (MNDF Military Housing)',
    category: 'institutional',
    lotNumber: 'Lot 20372',
    towers: ['Tower 1', 'Tower 2', 'Tower 3'],
    totalFloors: 14,
    description: 'Maldives National Defence Force family residential complex',
  },
  {
    id: 'ensis_flats',
    phase: 2,
    name: 'Ensis Residence',
    category: 'condominium',
    lotNumber: 'Lot 20390',
    totalFloors: 14,
    description: 'Private condominium apartments in Phase 2',
  },
  {
    id: 'jmc_flats',
    phase: 2,
    name: 'JMC Flats',
    category: 'social_housing',
    lotNumber: 'Lot 20378',
    totalFloors: 14,
    description: 'Social housing towers in Phase 2',
  },
  {
    id: 'p2_beachside_lots',
    phase: 2,
    name: 'Phase 2 Beachside & Beachfront Lots (20000 Series)',
    category: 'neighborhood_lot',
    lotNumber: 'Lots 20001 - 21350',
    description: 'Private residential land plots and multi-storey townhouses across Neighborhoods N1 - N7',
  },

  // --- PHASE 1 MAJOR DEVELOPMENTS ---
  {
    id: 'amin_avenue',
    phase: 1,
    name: 'Amin Avenue',
    category: 'condominium',
    lotNumber: 'Lot 10638 / 10639',
    towers: ['Teak Tower', 'Oak Tower', 'Maple Tower'],
    totalFloors: 14,
    description: 'Iconic multi-tower residential condominium adjacent to Central Park',
  },
  {
    id: 'platinum_residences',
    phase: 1,
    name: 'Platinum Residences',
    category: 'condominium',
    lotNumber: 'Lot 10630 / 10631',
    towers: ['Tower A', 'Tower B'],
    totalFloors: 12,
    description: 'Luxury condominium towers in central Hulhumalé Phase 1',
  },
  {
    id: 'renaatus_ithaa_muiy',
    phase: 1,
    name: 'Renaatus Ithaa Muiy',
    category: 'condominium',
    lotNumber: 'Lot 10640',
    towers: ['Block A', 'Block B'],
    totalFloors: 10,
    description: 'Premium beachfront luxury apartments in Phase 1',
  },
  {
    id: 'fw_residence',
    phase: 1,
    name: 'FW Residence / One Avenue',
    category: 'condominium',
    lotNumber: 'Lot 10645',
    totalFloors: 10,
    description: 'One Avenue modern residences',
  },
  {
    id: 'the_creek_view',
    phase: 1,
    name: 'The Creek View Residence',
    category: 'condominium',
    lotNumber: 'Lot 11445',
    totalFloors: 14,
    description: 'Channel-facing 114-unit condominium development',
  },
  {
    id: 'coral_ville',
    phase: 1,
    name: 'Coral Ville Housing',
    category: 'condominium',
    lotNumber: 'Lots 10450 - 10455',
    towers: ['Block 1', 'Block 2', 'Block 3', 'Block 4'],
    totalFloors: 8,
    description: 'Mid-rise residential community in Phase 1',
  },
  {
    id: 'apollo_towers',
    phase: 1,
    name: 'Apollo Towers',
    category: 'condominium',
    lotNumber: 'Lot 10635',
    towers: ['Apollo Pelican', 'Apollo Marine'],
    totalFloors: 10,
    description: 'Apollo residential towers overlooking Central Park',
  },
  {
    id: 'raincrest_residence',
    phase: 1,
    name: 'Raincrest Residence',
    category: 'condominium',
    lotNumber: 'Lot 10634',
    totalFloors: 14,
    description: 'High-end apartments in Hulhumalé Phase 1',
  },
  {
    id: 'oceanfront_residence',
    phase: 1,
    name: 'Oceanfront Beach Residence',
    category: 'condominium',
    lotNumber: 'Lot 10050 - 10100',
    description: 'Direct beachfront sea view apartments along Kaani Magu',
  },
  {
    id: 'china_flats_1000',
    phase: 1,
    name: 'China Flats (1,000 Housing Units)',
    category: 'social_housing',
    lotNumber: 'Blocks 01 - 120',
    totalFloors: 4,
    description: 'Hulhumalé Phase 1 foundation housing units (Blocks 1 to 120, Flats A/B/C/D)',
  },
  {
    id: 'housing_500_flats',
    phase: 1,
    name: '500 Housing Scheme Flats',
    category: 'social_housing',
    lotNumber: 'Blocks A - H',
    totalFloors: 5,
    description: 'Social housing blocks in central Phase 1',
  },
  {
    id: 'p1_residential_lots',
    phase: 1,
    name: 'Phase 1 Neighborhood Lots (10000 - 11850 Series)',
    category: 'neighborhood_lot',
    lotNumber: 'Lots 10001 - 11850',
    description: 'Established private landed properties and multi-floor residences in Hulhumalé Phase 1',
  },
];

// Common Lot number presets for quick selection
export const POPULAR_HULHUMALE_LOTS = [
  // Phase 2
  { lot: 'Lot 20387', name: 'Hiyaa Towers H1 - H4', phase: 2 },
  { lot: 'Lot 20390', name: 'Hiyaa Towers H5 - H8', phase: 2 },
  { lot: 'Lot 20395', name: 'Hiyaa Towers H9 - H12', phase: 2 },
  { lot: 'Lot 20400', name: 'Hiyaa Towers H13 - H16', phase: 2 },
  { lot: 'Lot 20507', name: 'Vinares Towers (V1 - V10)', phase: 2 },
  { lot: 'Lot 20370', name: 'Police POLCO Flats', phase: 2 },
  { lot: 'Lot 20372', name: 'SIFCO MNDF Flats', phase: 2 },
  { lot: 'Lot 20380', name: 'STELCO Kanbaa Flats', phase: 2 },
  { lot: 'Lot 20382', name: 'MWSC Staff Housing', phase: 2 },
  { lot: 'Lot 20384', name: 'MACL Aero Flats', phase: 2 },
  // Phase 1
  { lot: 'Lot 10638', name: 'Amin Avenue (Teak & Oak)', phase: 1 },
  { lot: 'Lot 10639', name: 'Amin Avenue (Maple)', phase: 1 },
  { lot: 'Lot 10630', name: 'Platinum Residence Tower A', phase: 1 },
  { lot: 'Lot 10631', name: 'Platinum Residence Tower B', phase: 1 },
  { lot: 'Lot 10640', name: 'Renaatus Ithaa Muiy', phase: 1 },
  { lot: 'Lot 10645', name: 'FW Residence / One Avenue', phase: 1 },
  { lot: 'Lot 11445', name: 'The Creek View Residence', phase: 1 },
  { lot: 'Lot 10634', name: 'Raincrest Residence', phase: 1 },
  { lot: 'Lot 10322', name: 'Phase 1 Central Commercial Lot', phase: 1 },
  { lot: 'Lot 11078', name: 'Nirolhu Magu Residence', phase: 1 },
  { lot: 'Lot 11809', name: 'Channel View Lot', phase: 1 },
  { lot: 'Lot 11828', name: 'Phase 1 Residential Plot', phase: 1 },
];
