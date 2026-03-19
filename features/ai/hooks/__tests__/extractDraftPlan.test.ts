import { describe, it, expect, jest } from '@jest/globals';

jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn(),
  useAnimatedStyle: jest.fn(),
  withTiming: jest.fn(),
  withSequence: jest.fn(),
  Easing: { out: jest.fn(), in: jest.fn(), quad: {} },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('react', () => ({
  useState: jest.fn().mockReturnValue([null, jest.fn()]),
  useEffect: jest.fn(),
  useRef: jest.fn().mockReturnValue({ current: null }),
  useCallback: jest.fn((fn: unknown) => fn),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn().mockReturnValue({ data: null }),
  useQueryClient: jest.fn(),
}));
jest.mock('@/lib/api', () => ({
  getConversation: jest.fn(),
  getPlaceDetails: jest.fn(),
}));

import { extractDraftPlan, toDateOnly, draftPlanToPlan } from '../useAIConversation';

describe('extractDraftPlan', () => {
  it('extracts draft plan from message content', () => {
    const plan = {
      date: '2025-06-15',
      title: 'Sortie Paris',
      notes: null,
      activities: [
        { placeName: 'Café X', placeId: 'abc-123', order: 1, startTime: '10:00' },
      ],
    };
    const content = `Voici votre plan !\n\n<!-- DRAFT_PLAN:${JSON.stringify(plan)} -->`;

    const result = extractDraftPlan(content);

    expect(result.cleanContent).toBe('Voici votre plan !');
    expect(result.draftPlan).toBeDefined();
    expect(result.draftPlan?.title).toBe('Sortie Paris');
    expect(result.draftPlan?.activities).toHaveLength(1);
    expect(result.draftPlan?.activities[0].placeName).toBe('Café X');
  });

  it('returns content unchanged when no draft plan marker', () => {
    const result = extractDraftPlan('Simple message without plan');
    expect(result.cleanContent).toBe('Simple message without plan');
    expect(result.draftPlan).toBeUndefined();
  });

  it('handles malformed JSON in draft plan marker', () => {
    const content = 'Message <!-- DRAFT_PLAN:{invalid json} -->';
    const result = extractDraftPlan(content);
    expect(result.cleanContent).toBe(content);
    expect(result.draftPlan).toBeUndefined();
  });

  it('trims whitespace after removing marker', () => {
    const plan = { date: '2025-01-01', title: null, notes: null, activities: [] };
    const content = `Hello   \n\n<!-- DRAFT_PLAN:${JSON.stringify(plan)} -->`;
    const result = extractDraftPlan(content);
    expect(result.cleanContent).toBe('Hello');
  });
});

describe('toDateOnly', () => {
  it('extracts date from ISO string', () => {
    expect(toDateOnly('2025-06-15T10:30:00.000Z')).toBe('2025-06-15');
  });

  it('keeps date-only string unchanged', () => {
    expect(toDateOnly('2025-06-15')).toBe('2025-06-15');
  });

  it('returns original string for non-matching format', () => {
    expect(toDateOnly('invalid')).toBe('invalid');
  });

  it('handles date with T but no valid date part', () => {
    expect(toDateOnly('Tinvalid')).toBe('Tinvalid');
  });
});

describe('draftPlanToPlan', () => {
  it('converts a draft plan to a Plan object', () => {
    const draft = {
      date: '2025-06-15T00:00:00Z',
      title: 'Sortie',
      notes: 'Des notes',
      activities: [
        { placeName: 'Café X', placeId: 'abc-123', order: 1, startTime: '10:00', endTime: '11:00' },
        { placeName: 'Resto Y', placeId: 'def-456', order: 2 },
      ],
    };

    const plan = draftPlanToPlan(draft);

    expect(plan.date).toBe('2025-06-15');
    expect(plan.title).toBe('Sortie');
    expect(plan.notes).toBe('Des notes');
    expect(plan.activities).toHaveLength(2);
    expect(plan.activities[0].place.placeName).toBe('Café X');
    expect(plan.activities[0].startTime).toBe('10:00');
    expect(plan.activities[0].endTime).toBe('11:00');
    expect(plan.activities[1].place.placeName).toBe('Resto Y');
    expect(plan.activities[1].startTime).toBeNull();
    expect(plan.activities[1].endTime).toBeNull();
  });

  it('generates an id starting with draft-', () => {
    const plan = draftPlanToPlan({
      date: '2025-01-01',
      title: null,
      notes: null,
      activities: [],
    });
    expect(plan.id).toMatch(/^draft-\d+$/);
  });

  it('handles null title and notes', () => {
    const plan = draftPlanToPlan({
      date: '2025-01-01',
      title: null,
      notes: null,
      activities: [],
    });
    expect(plan.title).toBeNull();
    expect(plan.notes).toBeNull();
  });
});
