import type { HeritageRecordFields } from '../models/HeritageRecord.js';

/**
 * Development-only seed fixtures.
 *
 * EVERY record here is FICTIONAL DEMONSTRATION DATA. Names, places, stories,
 * songs, sayings, and community references are invented for testing the
 * platform — they are NOT genuine traditions, documented oral histories,
 * real community statements, or verified cultural facts. Each record is
 * additionally marked with `isFictionalSample: true` and labeled as fictional
 * in its title or summary.
 *
 * The set deliberately includes non-public fixtures (restricted, draft,
 * pending review, archived, and a public record without publish consent) so
 * visibility rules can be tested. Never seed production data from this file.
 */
export type SeedFixture = Omit<HeritageRecordFields, '_id' | 'createdAt' | 'updatedAt'>;

export const SEED_FIXTURES: readonly SeedFixture[] = [
  {
    slug: 'demo-fictional-lantern-of-willingtown',
    title: 'The Lantern of Willingtown (Fictional Demo Record)',
    summary:
      'A made-up village tale about a lantern that only lights for honest visitors. Invented for development testing.',
    content:
      'This is invented demonstration text, not a real tradition. Long ago — in the fictional village of Willingtown, which exists only for software testing — the market square held a brass lantern. Villagers in the story claimed it glowed a little brighter when someone spoke the truth. The End. (Fictional demo content.)',
    heritageType: 'folk_story',
    languages: ['English'],
    region: {
      country: 'India',
      state: 'Kerala',
      district: 'Ernakulam',
      locality: 'Willingtown (fictional)',
    },
    communityName: 'Fictional demo community',
    contributors: [
      { name: 'Demo Author (fictional)', role: 'contributor', isPublicAttribution: true },
      { name: 'Hidden Demo Editor (fictional)', role: 'recorder', isPublicAttribution: false },
    ],
    sources: [
      {
        sourceType: 'contributor_submitted',
        description: 'Invented for seed data; no real source exists.',
        reference: 'seed://demo-fictional-lantern-of-willingtown',
        collectedOn: '2026-01-15',
        context: 'Fictional village square',
        notes:
          'INTERNAL-SEED-NOTE: this provenance note must never appear in public API responses.',
      },
    ],
    tags: ['demo', 'fictional', 'lamp', 'village-tale'],
    status: 'published',
    visibility: 'public',
    consent: {
      permissionToPublish: true,
      allowAttribution: true,
      allowRedistribution: false,
      restrictions: 'Demo record — no real-world restrictions apply.',
      basis:
        'INTERNAL-SEED-BASIS: fabricated consent basis for testing; must never appear in public API responses.',
      verification: 'documented',
    },
    license: {
      rightsStatus: 'unknown',
      notes: 'INTERNAL-SEED-LICENSE-NOTE: must never appear in public API responses.',
    },
    isFictionalSample: true,
  },
  {
    slug: 'demo-fictional-lamp-song',
    title: 'വിളക്കൂരിലെ പാട്ട് (ഫിക്ഷണൽ ഡെമോ) — The Vilakkur Song (Fictional Demo)',
    summary:
      'ഒരു സാങ്കല്പ്പിക ഗ്രാമത്തിന്റെ കാൽപ്പണിക്കഥ. Invented demonstration lyrics in Malayalam for testing multilingual storage.',
    content:
      'ഇത് യഥാർത്ഥമല്ലാത്ത ഡെമോ ഉള്ളടക്കമാണ്. സാങ്കല്പ്പികമായ വിളക്കൂർ ഗ്രാമത്തിൽ ഒരു വിളക്ക് ഉണ്ടായിരുന്നു — അത് സന്ധ്യയിൽ പാട്ട് കേട്ടപ്പോൾ മാത്രം കത്തി. (ഈ വരികൾ പൂർണ്ണമായും കാൽപ്പികമാണ്; ഒരു യഥാർത്ഥ പാരമ്പര്യഗാനവുമായും ബന്ധമില്ല.)',
    heritageType: 'song',
    languages: ['Malayalam', 'English'],
    region: { country: 'India', state: 'Kerala', locality: 'Vilakkur (fictional)' },
    contributors: [
      { name: 'ഡെമോ രചയിതാവ് (fictional)', role: 'storyteller', isPublicAttribution: true },
    ],
    sources: [
      {
        sourceType: 'oral_account',
        description: 'Fictional — invented demonstration of an oral-account source entry.',
        context: 'Invented for multilingual seed data',
        notes: 'INTERNAL-SEED-NOTE: must never appear in public API responses.',
      },
    ],
    tags: ['demo', 'fictional', 'song', 'malayalam'],
    status: 'published',
    visibility: 'public',
    consent: {
      permissionToPublish: true,
      allowAttribution: true,
      allowRedistribution: true,
      verification: 'unverified',
    },
    license: {
      rightsStatus: 'pending',
      licenseName: 'To be decided (demo)',
    },
    isFictionalSample: true,
  },
  {
    slug: 'demo-fictional-hindi-proverb-examples',
    title: 'काल्पनिक प्रोवर्ब डेमो — Fictional Proverb Examples (Demo Record)',
    summary:
      'अविष्कृत उदाहरण — invented sayings created only to test proverb records. These are NOT real Hindi proverbs.',
    content:
      'ये मूल रूप से गढ़ी गई उदाहरण वाक्य-भंडार हैं, वास्तविक लोक-कहावतें नहीं। उदाहरण (काल्पनिक): "जो दीया खुद जलता है, वह हवा से नहीं डरता।" (Fictional demo content — not a real proverb.)',
    heritageType: 'proverb',
    languages: ['Hindi', 'English'],
    region: { country: 'India', state: 'Delhi' },
    contributors: [
      { name: 'Demo Proverb Writer (fictional)', role: 'contributor', isPublicAttribution: true },
    ],
    sources: [
      {
        sourceType: 'contributor_submitted',
        description: 'Invented for seed data; no real source exists.',
      },
    ],
    tags: ['demo', 'fictional', 'proverbs', 'hindi'],
    status: 'published',
    visibility: 'public',
    consent: {
      permissionToPublish: true,
      allowAttribution: true,
      allowRedistribution: false,
      verification: 'documented',
    },
    license: { rightsStatus: 'unknown' },
    isFictionalSample: true,
  },
  {
    slug: 'demo-fictional-restricted-ritual-narrative',
    title: 'Restricted Demo Narrative (Fictional, Not Public)',
    summary:
      'Fictional fixture with visibility=restricted. It must NEVER appear in public listings or detail responses.',
    content: 'Fictional restricted fixture for visibility-rule testing.',
    heritageType: 'custom',
    languages: ['Malayalam'],
    region: { country: 'India', state: 'Kerala' },
    contributors: [],
    sources: [
      {
        sourceType: 'community_archive',
        description: 'Fictional restricted fixture.',
        notes: 'INTERNAL-RESTRICTED-NOTE: must never leak.',
      },
    ],
    tags: ['demo', 'fictional', 'restricted'],
    status: 'published',
    visibility: 'restricted',
    consent: {
      permissionToPublish: true,
      allowAttribution: false,
      allowRedistribution: false,
      restrictions: 'Restricted demo fixture — not for public display.',
      verification: 'unverified',
    },
    license: { rightsStatus: 'unknown' },
    isFictionalSample: true,
  },
  {
    slug: 'demo-fictional-draft-recipe',
    title: 'Draft Demo Recipe (Fictional)',
    summary: 'Fictional fixture in draft status. Must never appear in public endpoints.',
    content: 'Fictional draft recipe fixture for lifecycle testing.',
    heritageType: 'recipe',
    languages: ['Malayalam', 'English'],
    region: { country: 'India', state: 'Kerala' },
    contributors: [
      { name: 'Demo Cook (fictional)', role: 'contributor', isPublicAttribution: true },
    ],
    sources: [],
    tags: ['demo', 'fictional', 'draft'],
    status: 'draft',
    visibility: 'private',
    consent: {
      permissionToPublish: false,
      allowAttribution: false,
      allowRedistribution: false,
      verification: 'unverified',
    },
    license: { rightsStatus: 'unknown' },
    isFictionalSample: true,
  },
  {
    slug: 'demo-fictional-pending-review-craft',
    title: 'Pending Review Demo Craft (Fictional)',
    summary: 'Fictional fixture awaiting review. Must never appear in public endpoints.',
    content: 'Fictional pending-review craft fixture for lifecycle testing.',
    heritageType: 'craft',
    languages: ['English'],
    region: { country: 'India', state: 'Kerala' },
    contributors: [],
    sources: [],
    tags: ['demo', 'fictional', 'pending'],
    status: 'pending_review',
    visibility: 'private',
    consent: {
      permissionToPublish: false,
      allowAttribution: false,
      allowRedistribution: false,
      verification: 'unverified',
    },
    license: { rightsStatus: 'unknown' },
    isFictionalSample: true,
  },
  {
    slug: 'demo-fictional-archived-dialect-notes',
    title: 'Archived Demo Dialect Notes (Fictional)',
    summary: 'Fictional archived fixture. Must never appear in public endpoints.',
    content: 'Fictional archived dialect fixture for lifecycle testing.',
    heritageType: 'dialect',
    languages: ['Tamil'],
    region: { country: 'India', state: 'Tamil Nadu' },
    contributors: [],
    sources: [],
    tags: ['demo', 'fictional', 'archived'],
    status: 'archived',
    visibility: 'public',
    consent: {
      permissionToPublish: true,
      allowAttribution: true,
      allowRedistribution: false,
      verification: 'documented',
    },
    license: { rightsStatus: 'unknown' },
    isFictionalSample: true,
  },
  {
    slug: 'demo-fictional-no-publish-consent',
    title: 'No-Publish-Consent Demo (Fictional)',
    summary:
      'Fictional fixture: public and published, but consent.permissionToPublish is false. Consent must never be assumed — this must never appear in public endpoints.',
    content: 'Fictional consent-gate fixture.',
    heritageType: 'oral_history',
    languages: ['English'],
    region: { country: 'India', state: 'Kerala' },
    contributors: [],
    sources: [],
    tags: ['demo', 'fictional', 'consent-gate'],
    status: 'published',
    visibility: 'public',
    consent: {
      permissionToPublish: false,
      allowAttribution: false,
      allowRedistribution: false,
      verification: 'unverified',
    },
    license: { rightsStatus: 'unknown' },
    isFictionalSample: true,
  },
];
