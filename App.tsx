import React from 'react';
import { FaviconEditor } from './components/FaviconEditor';
import './index.css';

const App: React.FC = () => {
    return (
        <div className="w-[400px] h-[600px] overflow-hidden">
            <FaviconEditor mode="popup" />
        </div>
    );
};

export default App;