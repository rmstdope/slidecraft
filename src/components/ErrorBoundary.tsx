import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui'

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
      // Sized for the 1920 × 1080 slide frame it renders in, before the thumbnail scales it.
      <div className="sc-app tw:absolute tw:inset-0 tw:flex tw:flex-col tw:justify-center tw:gap-3 tw:overflow-auto tw:bg-panel tw:p-12 tw:text-[32px] tw:text-removed" role="alert">
        <strong className="tw:font-semibold">Render error</strong>
        <pre className="tw:m-0 tw:font-mono tw:text-[28px] tw:whitespace-pre-wrap tw:text-fg-2">{this.state.error.message}</pre>
        <p className="tw:text-[26px] tw:text-muted">Check for invalid prop values (e.g., unknown gradient, accent, or theme).</p>
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
    <div className="sc-app tw:flex tw:h-full tw:items-center tw:justify-center tw:overflow-auto tw:bg-ground tw:p-6">
      <div className="tw:flex tw:w-full tw:max-w-[720px] tw:flex-col tw:gap-4 tw:rounded-2xl tw:bg-panel tw:p-7 tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)]" role="alert">
        <div className="tw:flex tw:items-center tw:gap-3">
          <AlertTriangle className="tw:size-6 tw:shrink-0 tw:text-removed" aria-hidden />
          <h1 className="tw:font-display tw:text-[28px] tw:leading-tight tw:font-semibold">{isSyntax ? 'Syntax Error in Presentation' : 'Presentation Error'}</h1>
        </div>
        {presentationName && <span className="tw:font-mono tw:text-[13px] tw:text-muted">{presentationName}</span>}
        <pre className="tw:m-0 tw:max-h-[40vh] tw:overflow-auto tw:rounded-lg tw:bg-field tw:p-4 tw:font-mono tw:text-[13px] tw:whitespace-pre-wrap tw:text-removed">{message}</pre>
        {isSyntax && (
          <p className="tw:text-fg-2">
            Look for an unclosed tag, a closing tag that does not match its opening tag, unbalanced braces in a prop, or a stray
            <code className="tw:font-mono">{' < '}</code>or<code className="tw:font-mono">{' { '}</code>in text.
          </p>
        )}
        <div className="tw:flex tw:gap-2">
          {onGoToEditor && (
            <Button variant="primary" onClick={onGoToEditor}>
              Open in Editor
            </Button>
          )}
          {onGoHome && <Button onClick={onGoHome}>Go Home</Button>}
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
