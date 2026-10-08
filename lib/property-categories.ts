import type { PropertyCategories, Report } from './types';

export const categoryChoices = {
  buildingProfile: {
    new_build: 'New construction or first occupancy in a newly built property.',
    renovated: 'An existing property explicitly described as renovated or comprehensively modernised.',
    move_in_ready_resale: 'An existing property presented in maintained or good condition without material renovation needs.',
    renovation_project: 'A property explicitly requiring renovation or substantial modernisation.',
    standard_resale: 'An existing property without enough evidence for another building profile.',
    uncertain: 'The reviewed facts do not reliably establish a building profile.',
  },
  buyerFit: {
    single_or_couple: 'The size, room count and layout are best suited to one person or a couple.',
    family: 'The size, room count and stated features make the home suitable for a family with children.',
    investor: 'The reviewed facts primarily describe a rented or explicitly investment-oriented property.',
    downsizer: 'The home is compact, manageable and plausibly suited to someone downsizing; accessibility must not be assumed.',
    broad_appeal: 'The property has no clearly dominant buyer group among the supplied options.',
    uncertain: 'The reviewed facts are insufficient to identify a likely buyer fit.',
  },
  locationStyle: {
    central_urban: 'A dense, central city location with strong access to urban amenities and public transport.',
    urban_neighborhood: 'A city neighbourhood or Kiez with local amenities, but not clearly the central business core.',
    suburban: 'A lower-density outer-city or suburban residential setting.',
    commuter_location: 'A location whose main advantage is practical access to a larger employment centre.',
    small_city_or_rural: 'A small-city, town or rural setting rather than a major urban neighbourhood.',
    uncertain: 'The reviewed location facts are insufficient to classify the setting.',
  },
  purchaseSituation: {
    vacant_now: 'Explicitly not rented with no stated future availability date. This does not establish an immediate move-in date.',
    available_later: 'Explicitly available for vacant possession on a stated future date.',
    rented_investment: 'Explicitly sold with a tenant or current rental arrangement.',
    under_construction: 'A project or property explicitly still under construction or awaiting completion.',
    renovation_required: 'Vacant possession may be possible, but renovation or major modernisation is explicitly required.',
    uncertain: 'The reviewed facts do not reliably establish the purchase or occupancy situation.',
  },
} as const;

type CategoryKey = keyof typeof categoryChoices;
type ChoiceAnswer = { type?: unknown; choice?: unknown; confidence?: unknown };

export function propertyCategoryState(report: Report) {
  const score = report.scoreBreakdown;
  return {
    propertyType: report.propertyType,
    location: {
      city: report.facts.city,
      district: report.facts.district,
      precision: report.facts.locationPrecision,
      transitStop: report.facts.transitStop,
      neighborhoodSignals: report.facts.neighborhood,
    },
    property: {
      price: report.facts.price || undefined,
      livingAreaSqm: report.facts.area || undefined,
      usableAreaSqm: report.facts.usableArea,
      rooms: report.facts.rooms,
      year: report.facts.year,
      floor: report.facts.floor,
      condition: report.facts.condition,
      tenancy: report.facts.tenancy,
      availabilityDate: report.facts.availabilityDate,
      energyClass: report.facts.energy,
      energyDemand: report.facts.energyDemand,
      heating: report.facts.heating,
      energySource: report.facts.energySource,
      orientation: report.sunOrientation,
      features: report.facts.features?.slice(0, 30),
    },
    reviewedScores: score ? {
      total: report.score,
      neighborhood: score.neighborhood,
      space: score.space,
      building: score.building,
      energy: score.energy,
      light: score.light,
      costs: score.costs,
    } : undefined,
  };
}

export function propertyCategoryRequest(report: Report, model = 'jev-latest') {
  return {
    model,
    state: propertyCategoryState(report),
    questions: {
      buildingProfile: {
        type: 'choice',
        instructions: 'Classify the building profile using only the reviewed facts. Choose uncertain when the evidence is incomplete or conflicting.',
        criteria: categoryChoices.buildingProfile,
      },
      buyerFit: {
        type: 'choice',
        instructions: 'Choose the most plausible primary buyer fit from size, rooms, tenancy and stated features. Do not assume accessibility, schools or household needs that are not supplied.',
        criteria: categoryChoices.buyerFit,
      },
      locationStyle: {
        type: 'choice',
        instructions: 'Classify the broad location style using only the supplied city, district, precision and neighbourhood signals. Choose uncertain rather than guessing.',
        criteria: categoryChoices.locationStyle,
      },
      purchaseSituation: {
        type: 'choice',
        instructions: 'Classify the purchase and occupancy situation from the explicit tenancy, availability, condition and construction facts. Do not infer vacant possession.',
        criteria: categoryChoices.purchaseSituation,
      },
    },
  } as const;
}

function decision(answer: ChoiceAnswer | undefined, key: CategoryKey) {
  if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string' || typeof answer.confidence !== 'number') return undefined;
  if (!Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) return undefined;
  const allowed = categoryChoices[key];
  const selected = answer.choice in allowed && answer.confidence >= 0.6 ? answer.choice : 'uncertain';
  return { value: selected, confidence: Number(answer.confidence.toFixed(3)) };
}

export function parsePropertyCategories(value: unknown): PropertyCategories | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const response = value as { model?: unknown; answers?: Record<string, ChoiceAnswer> };
  if (typeof response.model !== 'string' || !response.model || !response.answers) return undefined;
  const buildingProfile = decision(response.answers.buildingProfile, 'buildingProfile');
  const buyerFit = decision(response.answers.buyerFit, 'buyerFit');
  const locationStyle = decision(response.answers.locationStyle, 'locationStyle');
  const purchaseSituation = decision(response.answers.purchaseSituation, 'purchaseSituation');
  if (!buildingProfile || !buyerFit || !locationStyle || !purchaseSituation) return undefined;
  return { schemaVersion: 1, model: response.model, buildingProfile, buyerFit, locationStyle, purchaseSituation };
}

const labels = {
  en: {
    new_build: 'New build', renovated: 'Renovated', move_in_ready_resale: 'Move-in-ready resale', renovation_project: 'Renovation project', standard_resale: 'Resale home',
    single_or_couple: 'Best suited to one or two', family: 'Family-oriented', investor: 'Investment property', downsizer: 'Downsizer-friendly', broad_appeal: 'Broad buyer appeal',
    central_urban: 'Central urban', urban_neighborhood: 'Urban neighbourhood', suburban: 'Suburban', commuter_location: 'Commuter location', small_city_or_rural: 'Small-city or rural',
    vacant_now: 'Not rented', available_later: 'Available later', rented_investment: 'Sold rented', under_construction: 'Under construction', renovation_required: 'Renovation required',
  },
  de: {
    new_build: 'Neubau', renovated: 'Renoviert', move_in_ready_resale: 'Bezugsfertiger Bestand', renovation_project: 'Sanierungsprojekt', standard_resale: 'Bestandsimmobilie',
    single_or_couple: 'Für ein bis zwei Personen', family: 'Familienfreundlich', investor: 'Kapitalanlage', downsizer: 'Gut zum Verkleinern', broad_appeal: 'Für viele passend',
    central_urban: 'Zentral und urban', urban_neighborhood: 'Urbanes Viertel', suburban: 'Stadtrand', commuter_location: 'Gut zum Pendeln', small_city_or_rural: 'Kleinstadt oder ländlich',
    vacant_now: 'Nicht vermietet', available_later: 'Später bezugsfrei', rented_investment: 'Vermietet verkauft', under_construction: 'Im Bau', renovation_required: 'Sanierung nötig',
  },
} as const;

export function localizedPropertyCategories(categories: PropertyCategories | undefined, locale: 'en' | 'de') {
  if (!categories) return [];
  return ([categories.buildingProfile, categories.buyerFit, categories.locationStyle, categories.purchaseSituation] as const)
    .filter(item => item.value !== 'uncertain' && item.confidence >= 0.6)
    .map(item => labels[locale][item.value as keyof typeof labels.en]);
}
