import { FaviconRule } from '../types';

export const findBestRule = (currentUrl: string, currentDomain: string, rules: FaviconRule[]): FaviconRule | null => {
    // 1. Exact URL Match (Highest Priority)
    const exactMatch = rules.find(r => r.matchType === 'exact_url' && r.matcher === currentUrl);
    if (exactMatch) return exactMatch;

    // 2. Regex Match (Medium Priority)
    const regexMatch = rules.find(r => {
        if (r.matchType !== 'regex') return false;
        try {
            const regex = new RegExp(r.matcher);
            return regex.test(currentUrl);
        } catch (e) {
            console.warn('[Favicon Matcher] Invalid Regex:', r.matcher);
            return false;
        }
    });
    if (regexMatch) return regexMatch;

    // 3. Domain Match (Lowest Priority)
    const domainMatch = rules.find(r => {
        if (r.matchType !== 'domain') return false;
        return currentDomain === r.matcher || currentDomain.endsWith('.' + r.matcher);
    });

    return domainMatch || null;
};

export const findConflictingRule = (targetUrl: string, currentScope: 'domain' | 'exact_url', rules: FaviconRule[]): FaviconRule | null => {
    // If we are editing 'domain' scope, check if 'exact' or 'regex' rules exist for this URL
    if (currentScope === 'domain') {
        const exactMatch = rules.find(r => r.matchType === 'exact_url' && r.matcher === targetUrl);
        if (exactMatch) return exactMatch;

        const regexMatch = rules.find(r => {
            if (r.matchType !== 'regex') return false;
            try { return new RegExp(r.matcher).test(targetUrl); } catch { return false; }
        });
        if (regexMatch) return regexMatch;
    }
    return null;
};
