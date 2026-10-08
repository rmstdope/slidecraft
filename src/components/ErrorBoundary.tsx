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

export interface PresentationErrorUIProps {
  error?: Error
  errorMessage?: string
  presentationName?: string
  onGoHome?: () => void
  onGoToEditor?: () => void
}

/** Shown when a deck fails to compile or render (Part 3 §1.11). */
export function PresentationErrorUI({ error, errorMessage, presentationName, onGoHome, onGoToEditor }: PresentationErrorUIProps) {
  const message = errorMessage ?? error?.message ?? 'Unknown error'
  const isSyntax = /Expected|Unexpected/.test(message)
  return (
    <div className="error-screen">
      <div className="error-panel" role="alert">
        <h1>{isSyntax ? 'Syntax Error in Presentation' : 'Presentation Error'}</h1>
        {presentationName && <span className="error-panel__deck">{presentationName}</span>}
        <pre className="error-panel__message">{message}</pre>
        {isSyntax && (
          <p className="error-panel__help">
            Look for an unclosed tag, a closing tag that does not match its opening tag, unbalanced braces in a prop, or a stray
            <code>{' < '}</code>or<code>{' { '}</code>in text.
          </p>
        )}
        <div className="error-panel__actions">
          {onGoToEditor && (
            <button type="button" className="tool-button is-primary" onClick={onGoToEditor}>
              Open in Editor
            </button>
          )}
          {onGoHome && (
            <button type="button" className="tool-button" onClick={onGoHome}>
              Go Home
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ErrorBoundaryProps {
  children?: ReactNode
  presentationName?: string
  onGoHome?: () => void
  onGoToEditor?: () => void
}

/** Catches render errors in a whole deck and shows PresentationErrorUI (Part 3 §1.11). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Presentation render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const { presentationName, onGoHome, onGoToEditor } = this.props
    return <PresentationErrorUI error={this.state.error} presentationName={presentationName} onGoHome={onGoHome} onGoToEditor={onGoToEditor} />
  }
}
