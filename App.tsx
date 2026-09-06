import React, { useEffect, useState } from 'react';
import { FaviconEditor } from './components/FaviconEditor';
import { RatingPrompt } from './components/RatingPrompt';
import { getStorageData } from './utils/storage';
import './index.css';

import { ErrorBoundary } from './components/shared/ErrorBoundary';

// `index.html?expanded=1` is opened as a standalone window by the action popup
// so that file uploads survive the native file-picker dialog (the action popup
// itself closes on blur and would abort the upload, see openExpandedEditor()).
const isExpanded = (() => {
    try {
        return new URLSearchParams(window.location.search).get('expanded') === '1';
    } catch {
        return false;
    }
})();

const App: React.FC = () => {
    const [ruleCount, setRuleCount] = useState(0);

    useEffect(() => {
        getStorageData().then(data => setRuleCount(Object.keys(data.rules).length));
    }, []);

    useEffect(() => {
        if (isExpanded) {
            // The popup body is hard-sized to 400x600 for the toolbar bubble.
            // In the standalone upload window we let it fill the window instead.
            document.title = 'Favicon Changer Ultimate';
            document.body.style.width = '100%';
            document.body.style.height = 'auto';
            document.body.style.minHeight = '100vh';
        }
    }, []);

    return (
        <ErrorBoundary>
            <div className={isExpanded ? 'w-full min-h-screen' : 'w-[400px] h-[600px] overflow-hidden flex flex-col'}>
                {/* Never in the expanded window: that one exists to complete an
                    upload, and interrupting it to ask for a favour is rude. */}
                {!isExpanded && <RatingPrompt ruleCount={ruleCount} surface="popup" />}
                <div className={isExpanded ? '' : 'flex-1 min-h-0'}>
                    <FaviconEditor mode="popup" context={isExpanded ? 'expanded' : 'action'} />
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default App;
