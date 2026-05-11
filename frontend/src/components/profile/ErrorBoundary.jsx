// frontend/src/components/profile/ErrorBoundary.jsx
import { Component } from 'react';
export class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[profile boundary]', err, info); }
  render() {
    if (this.state.err) {
      return (
        <div className="cv-glass p-6 text-sm">
          <div className="font-semibold mb-1">This section failed to render.</div>
          <div className="opacity-70">{String(this.state.err.message || this.state.err)}</div>
          <button className="mt-3 px-3 py-1.5 rounded cv-grad-bg text-white text-xs"
                  onClick={() => this.setState({ err: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
