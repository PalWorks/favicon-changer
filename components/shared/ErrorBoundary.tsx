import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('Uncaught error:', error);
        logger.error('Component stack:', errorInfo.componentStack);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
                    <h2 className="text-lg font-bold text-red-800 mb-2">Something went wrong</h2>
                    <p className="text-sm text-red-600 mb-4">
                        The extension encountered an unexpected error.
                    </p>
                    <details className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-200">
                        <summary className="cursor-pointer mb-1">Error Details</summary>
                        <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                            {this.state.error?.toString()}
                        </pre>
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                    >
                        Reload Extension
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
