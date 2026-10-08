import { Component, type ErrorInfo, type ReactNode } from 'react'

interface PreviewErrorBoundaryProps {
  children?: ReactNode
  onError?: (error: Error) => void
}

interface State {
  error: Error | null
  children?: ReactNode
}

/**
 * Catches render errors in previews and thumbnails (Part 3 §1.11). Resets automatically when
 * its children change, so fixing the code clears the error.
 */
export class PreviewErrorBoundary extends Component<PreviewErrorBoundaryProps, State> {
  state: State = { error: null, children: this.props.children }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: PreviewErrorBoundaryProps, state: State): Partial<State> | null {
    return props.children !== state.children ? { error: null, children: props.children } : null
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="preview-error" role="alert">
        <strong>Render Error</strong>
        <pre>{this.state.error.message}</pre>
        <p>Check for invalid prop values (e.g., unknown gradient, accent, or theme).</p>
      </div>
    )
  }
}
