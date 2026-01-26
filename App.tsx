import React from 'react';
import { FaviconEditor } from './components/FaviconEditor';
import './index.css';

import { ErrorBoundary } from './components/shared/ErrorBoundary';

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <div className="w-[400px] h-[600px] overflow-hidden">
                <FaviconEditor mode="popup" />
            </div>
        </ErrorBoundary>
    );
};

export default App;