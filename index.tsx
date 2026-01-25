import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { logger } from './utils/logger';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  public state = { hasError: false };
  public props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Uncaught error:", error);
    logger.error("Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600">
          <h1>Something went wrong.</h1>
          <p>Please check the extension logs.</p>
          <button onClick={() => window.location.reload()} className="mt-2 px-3 py-1 bg-red-100 rounded">Reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);