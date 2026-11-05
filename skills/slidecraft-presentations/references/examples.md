# Example decks

## A complete small deck

Opener, a content slide, a staged slide, a closer: the usual shape, with notes on every slide.

```mdx
import { Presentation, Slide, Title, Subtitle, Text, List, ListItem, TwoColumn, Card, Stat, Callout, Step, Notes } from '@components'

<Presentation theme="slidecraft" accent="yellow">

<Slide gradient="radial-accent">
  <Subtitle>Platform team · October</Subtitle>
  <Title>Builds in under ten minutes</Title>
  <Notes>0:00-0:30. Open with the goal, not the history.</Notes>
</Slide>

<Slide layout="document">
  <Subtitle>Today</Subtitle>
  <Title>A clean build takes 38 minutes</Title>
  <TwoColumn>
    <Stat value="38 min" label="clean build on main" />
    <Stat value="71%" label="of the work rebuilds unchanged code" />
  </TwoColumn>
  <Notes>0:30-1:30. Both numbers are from last month's CI logs (Source: CI dashboard, September).</Notes>
</Slide>

<Slide layout="document">
  <Subtitle>The plan</Subtitle>
  <Title>Share the cache across branches</Title>
  <List>
    <ListItem step={1}>Every build reads the shared cache first</ListItem>
    <ListItem step={2}>Only main writes to it</ListItem>
    <ListItem step={3}>Branches keep a local overlay</ListItem>
  </List>
  <Callout label="Decision:">Ship behind a flag in November.</Callout>
  <Notes>1:30-3:00. One step per sentence; the callout is the ask.</Notes>
</Slide>

<Slide>
  <Title>Questions</Title>
  <Text muted>platform-team on chat</Text>
  <Notes>3:00-. Leave the numbers slide up if the discussion goes there.</Notes>
</Slide>

</Presentation>
```

## A framed deck

With a theme that has frames (here `folio`), the masters carry the structure:

```mdx
<Presentation theme="folio">

<Slide frame="title">
  <Title>Remote build caching</Title>
  <Subtitle>Platform team · plan for the next quarter</Subtitle>
</Slide>

<Slide frame="section">
  <Title>Where the time goes</Title>
</Slide>

<Slide>
  <Subtitle>Today</Subtitle>
  <Title>A clean build takes 38 minutes on every branch</Title>
  <List>…</List>
</Slide>
```

## Decks to read

The Slidecraft repository's Examples vault holds decks that each show one thing:

| Deck | Shows |
|---|---|
| `welcome` | every feature, one finished slide each |
| `folio-tour` | the folio frames around a broad set of components |
| `folio-minimal` | the smallest framed deck |
| `motion` | every motion mechanism, with a colour legend and timed notes |
| `safe-retries` | a full research-based talk with notes and sources |
| `ion-tour` | the ion theme with SignalFlow, TracedPoints, Gauge and TraceTimeline |
| `studio-tour` | video-style cuts: Punchline, Chapter, Annotate, LowerThird, NumberPunch |
