/** University of Alberta faculties, for the leaderboard picker (plus non-faculty options). */
export const FACULTIES = [
  'Agricultural, Life & Environmental Sciences',
  'Arts',
  'Augustana',
  'Business',
  'Campus Saint-Jean',
  'Education',
  'Engineering',
  'Extension',
  'Graduate Studies',
  'Kinesiology, Sport & Recreation',
  'Law',
  'Medicine & Dentistry',
  'Native Studies',
  'Nursing',
  'Pharmacy & Pharmaceutical Sciences',
  'Public Health',
  'Rehabilitation Medicine',
  'Science',
  'Staff',
  'Visitor',
] as const;
export type Faculty = (typeof FACULTIES)[number];
