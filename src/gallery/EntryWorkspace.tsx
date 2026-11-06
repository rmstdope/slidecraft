import { useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { AlertTriangle, Check, CircleDashed, RotateCcw, X } from 'lucide-react'
import { targetFolder, type ThreadTarget } from '@shared/agent.ts'
import { AgentChat } from '../agent/AgentChat'
import { StepContext } from '../animations/stepContext'
import { PreviewErrorBoundary } from '../components/ErrorBoundary'
import { getAllComponents, getAllTemplates, getSourceProblems, sourceOfEntry, type RegistryConfig } from '../components/slides/defineComponent'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../components/slides/Slide'
import { StageScaleContext } from '../components/slides/thumbnailContext'
import { useRegistryVersion } from '../hooks/useRegistryVersion'
import { useVaultComponents } from '../vault-api/vaultComponents'
import { Badge, Button, cn } from '../ui'
import { countPreviewSteps } from './previewSteps'
import { useLazyPreview } from './useLazyPreview'

/** The registry entry a target names in its vault, once the vault has registered it. */
function entryOf(vault: string, target: ThreadTarget): RegistryConfig | undefined {
  if (target.kind === 'component') return getAllComponents(vault).find((c) => c.registry.name === target.name && sourceOfEntry(c.registry) === vault)?.registry
  return getAllTemplates(vault).find((t) => t.id === `template-${target.name}` && sourceOfEntry(t) === vault)
}

function Preview({ source, width }: { source: string; width: number }) {
  const { Component, error, isCompiling } = useLazyPreview(source, true)
  const [step, setStep] = useState(0)
  const [replay, setReplay] = useState(0)
  const total = useMemo(() => (Component ? countPreviewSteps(Component) : 0), [Component])
  useEffect(() => setStep(0), [source])
  const scale = width / DESIGN_WIDTH
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:relative tw:overflow-hidden tw:rounded-md tw:bg-black tw:shadow-hairline" style={{ width, height: Math.round(DESIGN_HEIGHT * scale) }}>
        {Component ? (
          <div style={{ position: 'absolute', left: 0, top: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <StageScaleContext.Provider value={1}>
              <MotionConfig reducedMotion="user">
                <StepContext.Provider value={{ step, total }}>
                  <PreviewErrorBoundary key={replay}>
                    <Component />
                  </PreviewErrorBoundary>
                </StepContext.Provider>
              </MotionConfig>
            </StageScaleContext.Provider>
          </div>
        ) : (
          <span className={cn('tw:absolute tw:inset-0 tw:grid tw:place-items-center tw:p-4 tw:text-center tw:text-[13px]', error ? 'tw:text-removed' : 'tw:text-white/60')}>
            {error ?? (isCompiling ? 'Rendering…' : '')}
          </span>
        )}
      </div>
      <div className="tw:flex tw:items-center tw:gap-2">
        <Button size="sm" onClick={() => (setStep(0), setReplay((n) => n + 1))}>
          <RotateCcw aria-hidden />
          Replay
        </Button>
        {total > 0 && (
          <>
            <Button size="icon-sm" disabled={step === 0} onClick={() => setStep(step - 1)} aria-label="Previous step">
              ←
            </Button>
            <span className="tw:text-[13px] tw:text-fg-2">
              Step {step} of {total}
            </span>
            <Button size="icon-sm" disabled={step >= total} onClick={() => setStep(step + 1)} aria-label="Next step">
              →
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Status({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <li className="tw:flex tw:items-start tw:gap-2">
      {ok === null ? <CircleDashed className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-muted" aria-hidden /> : ok ? <Check className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-added" aria-hidden /> : <AlertTriangle className="tw:mt-0.5 tw:size-4 tw:shrink-0 tw:text-removed" aria-hidden />}
      <span className="tw:min-w-0 tw:whitespace-pre-wrap">{children}</span>
    </li>
  )
}

/**
 * Creating or changing a vault component or template with the agent (vault components plan, V4,
 * boards 2 and 4): the conversation about that folder on the left, the entry's live preview on the
 * right, updating each time the agent saves.
 */
export function EntryWorkspace({ vault, vaultName, target, isNew, onClose }: { vault: string; vaultName: string; target: ThreadTarget; isNew: boolean; onClose(): void }) {
  const version = useRegistryVersion()
  const state = useVaultComponents(vault)
  const entry = entryOf(vault, target)
  const problem = getSourceProblems(vault).find((p) => (target.kind === 'template' ? p.template && p.folder === target.name : !p.template && p.name === target.name))
  const folder = targetFolder(target)
  const what = target.kind === 'component' ? 'component' : 'template'
  const blocked = target.kind === 'component' && state && state.trust !== 'trusted'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement) && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sc-app tw:fixed tw:inset-0 tw:z-[1100] tw:flex tw:flex-col tw:bg-ground" role="dialog" aria-modal="true" aria-label={`${isNew ? 'New' : 'Edit'} ${what} ${target.name}`}>
      <header className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-b tw:border-line tw:px-5 tw:py-3">
        <div className="tw:flex tw:min-w-0 tw:flex-col">
          <h1 className="tw:font-display tw:text-[22px] tw:leading-tight tw:font-semibold">
            {isNew ? `New ${what}` : `Edit ${target.name}`}
          </h1>
          <span className="tw:text-[13px] tw:text-muted">
            {vaultName} vault · the agent writes to <code className="tw:font-mono tw:text-[12px]">{folder}/</code>
          </span>
        </div>
        <Badge className="tw:h-6">Skill: slidecraft-components</Badge>
        <span className="tw:flex-1" />
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
          <X aria-hidden />
        </Button>
      </header>
      <div className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-1 tw:lg:grid-cols-[minmax(380px,1fr)_minmax(0,1.3fr)]">
        <div className="tw:flex tw:min-h-0 tw:flex-col tw:border-line tw:lg:border-r">
          <AgentChat
            vault={vault}
            target={target}
            emptyHint={
              isNew
                ? `Describe the ${what}: what it shows, its props, how it builds step by step. The agent writes ${folder}/ and checks it; the preview on the right follows.`
                : `Ask for a change to ${target.name}. The agent edits ${folder}/ and checks it; the preview follows. Each turn can be undone.`
            }
          />
        </div>
        <aside className="tw:flex tw:min-h-0 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:p-5" aria-label="Preview">
          <div className="tw:flex tw:items-center tw:gap-2">
            <h2 className="tw:font-semibold">{entry?.name ?? target.name}</h2>
            <Badge tone="accent" className="tw:h-5">
              {vaultName}
            </Badge>
            <span className="tw:text-[13px] tw:text-muted">The preview reloads when the files change.</span>
          </div>
          {entry ? (
            // A preview that failed (the component was missing) is tried again on each registry change.
            <Preview key={`${entry.previewCode}:${version}`} source={entry.previewCode} width={640} />
          ) : (
            <div className="tw:grid tw:aspect-video tw:w-[640px] tw:max-w-full tw:place-items-center tw:rounded-md tw:bg-field tw:p-6 tw:text-center tw:text-muted">
              {problem ? `The ${what} does not load yet: see below.` : blocked ? `This vault's components are not allowed to run, so there is no preview.` : `No ${what} in ${folder}/ yet. Describe it in the conversation.`}
            </div>
          )}
          <ul className="tw:flex tw:flex-col tw:gap-1.5 tw:text-[13px]" aria-label="Status">
            {target.kind === 'component' && <Status ok={blocked ? false : entry || problem ? !problem : null}>{blocked ? 'Not run: the vault’s components are not allowed (Settings › Vaults)' : problem ? problem.message : entry ? 'Compiled and registered' : 'Not written yet'}</Status>}
            {target.kind === 'template' && <Status ok={entry || problem ? !problem : null}>{problem ? problem.message : entry ? 'Parsed and registered' : 'Not written yet'}</Status>}
            {entry && <Status ok>In this vault’s palette, Add slide and gallery</Status>}
          </ul>
          {entry && (
            <section className="tw:flex tw:flex-col tw:gap-2">
              <h3 className="tw:text-[13px] tw:font-semibold tw:tracking-wide tw:text-muted tw:uppercase">Snippet</h3>
              <pre className="tw:m-0 tw:overflow-x-auto tw:rounded-lg tw:bg-field tw:p-3 tw:font-mono tw:text-[12.5px] tw:whitespace-pre-wrap tw:text-fg-2">{entry.snippet}</pre>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
