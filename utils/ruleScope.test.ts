import { describe, it, expect } from 'vitest';
import {
  INITIAL_SCOPE_STATE,
  PATTERN_SCOPES,
  SCOPES,
  ScopeEvent,
  ScopeState,
  isPatternOverridden,
  isPatternScope,
  loadRuleEvent,
  matcherFor,
  patternErrorFor,
  patternValue,
  scopeHint,
  scopeLabel,
  scopeReducer,
  suggestionFor,
} from './ruleScope';
import { MATCH_TYPES } from '../types';

// Applies a sequence of events, which is how the real editor arrives at any
// given state. Asserting on a sequence rather than a hand-built object is the
// point: every bug this module exists to prevent was an interaction between two
// steps, not a wrong value in one.
const run = (events: ScopeEvent[], from: ScopeState = INITIAL_SCOPE_STATE): ScopeState =>
  events.reduce(scopeReducer, from);

const SHEET = 'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0';
const SHEET_PREFIX = 'https://docs.google.com/spreadsheets/d/ABC123';

describe('scope metadata', () => {
  it('offers exactly the four match types, pattern scopes last', () => {
    expect(SCOPES.map(s => s.type)).toEqual(['domain', 'exact_url', 'prefix', 'regex']);
  });

  it('covers every match type the rest of the app can store', () => {
    expect([...SCOPES.map(s => s.type)].sort()).toEqual([...MATCH_TYPES].sort());
  });

  it('gives every scope a label, a short label and a hint', () => {
    for (const scope of SCOPES) {
      expect(scope.label.length).toBeGreaterThan(0);
      expect(scope.short.length).toBeGreaterThan(0);
      expect(scope.hint.length).toBeGreaterThan(0);
    }
  });

  // The buttons sit in one row of four inside a 400px popup, so a long short
  // label is a layout regression waiting to happen.
  it('keeps short labels short enough for the popup row', () => {
    for (const scope of SCOPES) expect(scope.short.length).toBeLessThanOrEqual(12);
  });

  it('names only prefix and regex as pattern scopes', () => {
    expect(PATTERN_SCOPES).toEqual(['prefix', 'regex']);
    expect(MATCH_TYPES.filter(isPatternScope)).toEqual(['prefix', 'regex']);
  });

  it('falls back to the raw value for a scope it does not know', () => {
    expect(scopeLabel('nonsense' as any)).toBe('nonsense');
    expect(scopeHint('nonsense' as any)).toBe('');
  });
});

describe('suggestionFor', () => {
  it('suggests the document prefix, dropping the view and the fragment', () => {
    expect(suggestionFor('prefix', SHEET)).toBe(SHEET_PREFIX);
  });

  it('suggests an escaped, anchored regex', () => {
    expect(suggestionFor('regex', SHEET)).toBe('^https://docs\\.google\\.com/spreadsheets/d/ABC123');
  });

  it('is empty for the scopes with no pattern field', () => {
    expect(suggestionFor('domain', SHEET)).toBe('');
    expect(suggestionFor('exact_url', SHEET)).toBe('');
  });

  it('is empty with no target', () => {
    expect(suggestionFor('prefix', '')).toBe('');
    expect(suggestionFor('prefix', '   ')).toBe('');
  });

  // The settings page invites a bare domain, and a suggestion without a scheme
  // fails prefix validation with a message the user cannot act on.
  it('assumes https for an address typed without a scheme', () => {
    expect(suggestionFor('prefix', 'google.com')).toBe('https://google.com/');
    expect(suggestionFor('prefix', 'example.com/docs/page')).toBe('https://example.com/docs');
  });

  it('leaves a non-http scheme alone', () => {
    expect(suggestionFor('prefix', 'file:///home/me/notes/index.html')).toBe('file:///home/me/notes');
  });
});

describe('matcherFor', () => {
  it('uses the hostname for a domain rule', () => {
    const state = run([{ type: 'selectScope', scope: 'domain' }]);
    expect(matcherFor(state, SHEET, 'docs.google.com')).toBe('docs.google.com');
  });

  it('uses the whole address for an exact rule', () => {
    expect(matcherFor(INITIAL_SCOPE_STATE, SHEET, 'docs.google.com')).toBe(SHEET);
  });

  it('uses the suggestion for an untouched prefix rule', () => {
    const state = run([{ type: 'selectScope', scope: 'prefix' }]);
    expect(matcherFor(state, SHEET, 'docs.google.com')).toBe(SHEET_PREFIX);
  });

  it('trims the pattern the user typed', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: '  https://example.com/docs  ' },
    ]);
    expect(matcherFor(state, SHEET, 'docs.google.com')).toBe('https://example.com/docs');
  });
});

describe('the pattern follows the address until the user takes over', () => {
  // R-42. The old code built the suggestion in the scope-button handler, so
  // picking the scope first (the normal order on the settings page, where the
  // address field starts empty) left the field empty however much was then
  // typed, and the save failed with a message about prefixes.
  it('fills in once an address is typed after the scope was chosen', () => {
    const state = run([{ type: 'selectScope', scope: 'prefix' }]);

    expect(patternValue(state, '')).toBe('');
    expect(patternValue(state, SHEET)).toBe(SHEET_PREFIX);
  });

  it('follows the address as it changes', () => {
    const state = run([{ type: 'selectScope', scope: 'prefix' }]);

    expect(patternValue(state, 'https://a.example.com/one/two')).toBe('https://a.example.com/one');
    expect(patternValue(state, 'https://b.example.com/three/four')).toBe('https://b.example.com/three');
  });

  // R-42's second half, and the dangerous one: after saving a rule the field
  // kept the previous rule's text, so the next rule could be saved silently
  // against the wrong site.
  it('does not keep the previous rule text after a reset', () => {
    const state = run([
      { type: 'loadRule', matchType: 'prefix', matcher: 'https://wikipedia.org/wiki' },
      { type: 'reset' },
      { type: 'selectScope', scope: 'prefix' },
    ]);

    expect(patternValue(state, 'https://example.com/docs/page')).toBe('https://example.com/docs');
  });

  it('never overwrites what the user typed, however the address moves', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: 'https://example.com/mine' },
    ]);

    expect(patternValue(state, SHEET)).toBe('https://example.com/mine');
    expect(patternValue(state, 'https://somewhere.else/entirely')).toBe('https://example.com/mine');
    expect(isPatternOverridden(state)).toBe(true);
  });

  it('keeps an empty pattern the user cleared, rather than refilling it', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: '' },
    ]);

    expect(patternValue(state, SHEET)).toBe('');
    expect(isPatternOverridden(state)).toBe(true);
  });

  it('resumes following the address after "Suggest from this page"', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: 'something of my own' },
      { type: 'useSuggestion' },
    ]);

    expect(isPatternOverridden(state)).toBe(false);
    expect(patternValue(state, SHEET)).toBe(SHEET_PREFIX);
    expect(patternValue(state, 'https://other.example/a/b')).toBe('https://other.example/a');
  });
});

describe('switching scope', () => {
  it('regenerates in the new syntax when nothing was typed', () => {
    const asPrefix = run([{ type: 'selectScope', scope: 'prefix' }]);
    const asRegex = scopeReducer(asPrefix, { type: 'selectScope', scope: 'regex' });

    expect(patternValue(asPrefix, SHEET)).toBe(SHEET_PREFIX);
    expect(patternValue(asRegex, SHEET)).toBe('^https://docs\\.google\\.com/spreadsheets/d/ABC123');
  });

  // The old single-slot draft was rebuilt on every switch, so a round trip
  // silently discarded the user's text despite a comment promising otherwise.
  it('preserves each scope\'s own text across a round trip', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: 'https://example.com/my-prefix' },
      { type: 'selectScope', scope: 'regex' },
      { type: 'editPattern', text: '^https://example\\.com/my-regex' },
      { type: 'selectScope', scope: 'prefix' },
    ]);

    expect(patternValue(state, SHEET)).toBe('https://example.com/my-prefix');
    expect(patternValue(scopeReducer(state, { type: 'selectScope', scope: 'regex' }), SHEET))
      .toBe('^https://example\\.com/my-regex');
  });

  it('leaves the state untouched when the same scope is pressed again', () => {
    const state = run([{ type: 'selectScope', scope: 'prefix' }]);
    expect(scopeReducer(state, { type: 'selectScope', scope: 'prefix' })).toBe(state);
  });

  it('keeps pattern text through a detour via a non-pattern scope', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: 'https://example.com/kept' },
      { type: 'selectScope', scope: 'domain' },
      { type: 'selectScope', scope: 'prefix' },
    ]);

    expect(patternValue(state, SHEET)).toBe('https://example.com/kept');
  });
});

describe('pointing the editor at an existing rule', () => {
  // The conflict banner's "Edit that rule instead" button. With a stored
  // suggestion this corrupted the matcher: the button set the draft to the
  // rule's matcher, the address field followed, and the sync effect then
  // replaced the matcher with the suggestion derived from it. For a prefix
  // rule that is a strictly shorter pattern, so the user ended up editing a
  // wider rule than the one they clicked, under a new id.
  it('shows the rule\'s own matcher, not a suggestion derived from it', () => {
    const rule = { matchType: 'prefix' as const, matcher: 'https://example.com/docs/getting-started' };
    const state = scopeReducer(INITIAL_SCOPE_STATE, loadRuleEvent(rule));

    // The address field ends up holding the matcher, which is what used to
    // feed the corrupting re-derivation.
    expect(patternValue(state, rule.matcher)).toBe(rule.matcher);
    expect(suggestionFor('prefix', rule.matcher)).not.toBe(rule.matcher); // the trap
    expect(matcherFor(state, rule.matcher, 'example.com')).toBe(rule.matcher);
  });

  it('keeps a regex rule exactly as saved', () => {
    const matcher = '^https://example\\.com/(alpha|beta)/[0-9]+$';
    const state = scopeReducer(INITIAL_SCOPE_STATE, loadRuleEvent({ matchType: 'regex', matcher }));

    expect(state.scope).toBe('regex');
    expect(patternValue(state, 'https://example.com/alpha/1')).toBe(matcher);
    expect(patternErrorFor(state, 'https://example.com/alpha/1')).toBeNull();
  });

  it('clears any pattern left over from the rule edited before', () => {
    const state = run([
      { type: 'selectScope', scope: 'regex' },
      { type: 'editPattern', text: '^stale' },
      loadRuleEvent({ matchType: 'prefix', matcher: 'https://example.com/fresh' }),
    ]);

    expect(state.overrides).toEqual({ prefix: 'https://example.com/fresh' });
    expect(patternValue(scopeReducer(state, { type: 'selectScope', scope: 'regex' }), SHEET))
      .toBe('^https://docs\\.google\\.com/spreadsheets/d/ABC123');
  });

  it('drops every override for a domain or exact rule', () => {
    for (const matchType of ['domain', 'exact_url'] as const) {
      const state = run([
        { type: 'selectScope', scope: 'prefix' },
        { type: 'editPattern', text: 'https://example.com/stale' },
        loadRuleEvent({ matchType, matcher: 'example.com' }),
      ]);
      expect(state).toEqual({ scope: matchType, overrides: {} });
    }
  });

  it('resets to a blank exact-url rule', () => {
    const state = run([
      { type: 'selectScope', scope: 'regex' },
      { type: 'editPattern', text: '^whatever' },
      { type: 'reset' },
    ]);
    expect(state).toEqual(INITIAL_SCOPE_STATE);
  });
});

describe('patternErrorFor', () => {
  it('has nothing to say about the scopes with no pattern', () => {
    for (const scope of ['domain', 'exact_url'] as const) {
      const state = run([{ type: 'selectScope', scope }]);
      expect(patternErrorFor(state, SHEET)).toBeNull();
    }
  });

  it('treats an empty pattern as incomplete, not wrong', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: '   ' },
    ]);
    expect(patternErrorFor(state, SHEET)).toBeNull();
  });

  it('rejects a regex that will not compile', () => {
    const state = run([
      { type: 'selectScope', scope: 'regex' },
      { type: 'editPattern', text: '^([a-z' },
    ]);
    expect(patternErrorFor(state, SHEET)).toBe('That is not a valid regular expression.');
  });

  // The ReDoS length cap in validation.ts, surfaced through the editor rather
  // than only at match time.
  it('rejects a regex past the length cap', () => {
    const state = run([
      { type: 'selectScope', scope: 'regex' },
      { type: 'editPattern', text: 'a'.repeat(2001) },
    ]);
    expect(patternErrorFor(state, SHEET)).toBe('That is not a valid regular expression.');
  });

  it('rejects a prefix that does not start where the address starts', () => {
    const state = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: 'docs.google.com/spreadsheets' },
    ]);
    expect(patternErrorFor(state, SHEET)).toMatch(/^A prefix has to start from the beginning/);
  });

  it('accepts a prefix with any scheme', () => {
    for (const text of ['https://example.com/a', 'http://example.com/a', 'file:///home/me/a']) {
      const state = run([{ type: 'selectScope', scope: 'prefix' }, { type: 'editPattern', text }]);
      expect(patternErrorFor(state, SHEET)).toBeNull();
    }
  });

  // A suggestion the editor generated itself must never be one it then rejects.
  it('never rejects its own suggestion, for either pattern scope', () => {
    const urls = [
      SHEET,
      'https://example.com',
      'https://example.com/',
      'https://example.com/one',
      'https://example.com/one/two/three?q=1#f',
      'http://127.0.0.1:8899/spa.html',
      'file:///home/me/notes/index.html',
      'google.com',
      'sub.example.co.uk/a/b',
    ];
    for (const scope of PATTERN_SCOPES) {
      for (const url of urls) {
        const state = run([{ type: 'selectScope', scope }]);
        expect(patternErrorFor(state, url), `${scope} suggestion for ${url}`).toBeNull();
      }
    }
  });
});

describe('editPattern outside a pattern scope', () => {
  it('is ignored rather than stored', () => {
    for (const scope of ['domain', 'exact_url'] as const) {
      const state = run([{ type: 'selectScope', scope }]);
      const after = scopeReducer(state, { type: 'editPattern', text: 'nonsense' });
      expect(after).toBe(state);
      expect(isPatternOverridden(after)).toBe(false);
    }
  });

  it('reports no pattern value and no override', () => {
    const state = run([{ type: 'selectScope', scope: 'domain' }]);
    expect(patternValue(state, SHEET)).toBe('');
    expect(isPatternOverridden(state)).toBe(false);
  });

  it('ignores useSuggestion too', () => {
    const state = run([{ type: 'selectScope', scope: 'exact_url' }]);
    expect(scopeReducer(state, { type: 'useSuggestion' })).toBe(state);
  });
});

describe('the reducer never mutates what it was given', () => {
  it('leaves the previous state and its overrides intact', () => {
    const before = run([
      { type: 'selectScope', scope: 'prefix' },
      { type: 'editPattern', text: 'https://example.com/first' },
    ]);
    const snapshot = JSON.parse(JSON.stringify(before));

    scopeReducer(before, { type: 'editPattern', text: 'https://example.com/second' });
    scopeReducer(before, { type: 'useSuggestion' });
    scopeReducer(before, { type: 'reset' });
    scopeReducer(before, loadRuleEvent({ matchType: 'regex', matcher: '^x' }));

    expect(before).toEqual(snapshot);
  });

  it('ignores an event it does not know', () => {
    const state = run([{ type: 'selectScope', scope: 'prefix' }]);
    expect(scopeReducer(state, { type: 'not-a-real-event' } as any)).toBe(state);
  });
});

// The same host:port trap, seen through the editor: a developer typing a local
// address into the settings page must get a usable prefix, not `localhost:///3000`.
describe('suggestions for a bare host and port', () => {
  it('builds a real prefix from a local address', () => {
    expect(suggestionFor('prefix', 'localhost:3000/app/page')).toBe('https://localhost:3000/app');
    expect(suggestionFor('prefix', '127.0.0.1:8899/spa.html')).toBe('https://127.0.0.1:8899/spa.html');
  });

  it('builds a regex that compiles and is anchored', () => {
    expect(suggestionFor('regex', 'localhost:3000/app/page')).toBe('^https://localhost:3000/app');
  });

  it('produces a prefix the editor then accepts', () => {
    for (const url of ['localhost:3000', 'localhost:3000/app/page', '127.0.0.1:8899/spa.html', 'example.com:8080/x/y']) {
      const state = scopeReducer(INITIAL_SCOPE_STATE, { type: 'selectScope', scope: 'prefix' });
      expect(patternErrorFor(state, url), url).toBeNull();
      expect(patternValue(state, url).startsWith('https://'), url).toBe(true);
    }
  });
});

