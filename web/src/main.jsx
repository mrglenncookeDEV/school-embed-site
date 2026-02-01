import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#b91c1c', fontFamily: 'system-ui' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Something went wrong.</h1>
          <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Error Details:</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{this.state.error && this.state.error.toString()}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
