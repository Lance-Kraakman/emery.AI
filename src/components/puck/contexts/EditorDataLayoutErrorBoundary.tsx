'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary for EditorDataLayoutProvider.
 *
 * Catches errors from Puck's internal state when zones become stale
 * (e.g., when deleting the last block from a page). The error boundary
 * resets automatically, allowing Puck to stabilize on the next render.
 */
export class EditorDataLayoutErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Log only non-zone errors (zone errors are expected during deletion)
    if (!error.message?.includes('zones') && !error.message?.includes('contentIds')) {
      console.error('[EditorDataLayoutProvider] Error:', error);
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state when children change (Puck state stabilizes)
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      // Reset error on next tick to allow Puck state to stabilize
      setTimeout(() => this.setState({ hasError: false }), 0);
      // Still render children - they'll re-render with corrected state
      return this.props.children;
    }
    return this.props.children;
  }
}
