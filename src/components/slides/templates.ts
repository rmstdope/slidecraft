import { defineTemplate } from './defineComponent'

/**
 * Whole-slide starting points for the command palette and "Add slide" (Part 2 §9). They are
 * registered like components so palette, gallery, docs and prompts all see the same list.
 */
const t = (id: string, name: string, description: string, snippet: string, keywords: string[], useCases: string[] = []) =>
  defineTemplate({ id: `template-${id}`, name, description, snippet, previewCode: snippet, keywords, useCases })

t('title', 'Title Slide', 'Opening slide with context subtitle, main title, and tagline.', `<Slide theme="dark" accent="yellow" gradient="radial-accent">
  <Subtitle>Team · Date</Subtitle>
  <Title>Presentation title</Title>
  <Text muted>A one-line tagline</Text>
</Slide>`, ['title', 'opening', 'cover', 'start'], ['The first slide'])

t('corporate-title', 'Corporate Title Slide', 'Corporate opener.', `<Slide chrome="title">
  <Title>Presentation title</Title>
  <Subtitle>Team, date</Subtitle>
</Slide>`, ['corporate', 'official', 'brand', 'chrome', 'title'], ['Opening or closing an official deck'])

t('corporate-section', 'Corporate Section Slide', 'Corporate divider.', `<Slide chrome="section">
  <Title>Section title</Title>
</Slide>`, ['corporate', 'official', 'brand', 'chrome', 'section', 'divider'], ['Between parts of an official deck'])

t('corporate-content', 'Corporate Content Slide', 'Corporate content frame.', `<Slide chrome="content">
  <Subtitle>Eyebrow</Subtitle>
  <Title>A single-line assertion</Title>
  <List>
    <ListItem>First point</ListItem>
    <ListItem>Second point</ListItem>
  </List>
</Slide>`, ['corporate', 'official', 'brand', 'chrome', 'content'], ['Content in an official deck'])

t('content', 'Content Slide', 'Title and explanatory paragraph.', `<Slide theme="dark" accent="yellow">
  <Title>Slide title</Title>
  <Text>One paragraph that explains the point.</Text>
</Slide>`, ['content', 'paragraph', 'text'])

t('bullets', 'Bullet List Slide', 'Title with animated bullets.', `<Slide theme="dark" accent="teal">
  <Title>Four points</Title>
  <List>
    <ListItem>First point</ListItem>
    <ListItem>Second point</ListItem>
    <ListItem>Third point</ListItem>
    <ListItem>Fourth point</ListItem>
  </List>
</Slide>`, ['bullets', 'list', 'points'])

t('twocolumn', 'Two Column Comparison', 'Side-by-side cards.', `<Slide theme="dark">
  <Title>Two options</Title>
  <TwoColumn>
    <Card title="Option A" accent="yellow">What A gives you</Card>
    <Card title="Option B" accent="red">What B gives you</Card>
  </TwoColumn>
</Slide>`, ['comparison', 'two', 'columns', 'versus'])

t('fourcolumn', 'Four Column Grid', 'Four compact cards.', `<Slide theme="dark" gradient="radial">
  <Title>Four parts</Title>
  <FourColumn>
    <Card compact title="One">First part</Card>
    <Card compact title="Two">Second part</Card>
    <Card compact title="Three">Third part</Card>
    <Card compact title="Four">Fourth part</Card>
  </FourColumn>
</Slide>`, ['grid', 'four', 'columns'])

t('quote', 'Quote Slide', 'Quotation with attribution.', `<Slide theme="light" accent="red" gradient="radial-accent">
  <Subtitle>In their words</Subtitle>
  <Quote author="Author Name">The quotation goes here.</Quote>
</Slide>`, ['quote', 'testimonial', 'citation'])

t('spectrum', 'Spectrum Slide', 'Proportional range.', `<Slide theme="light" accent="yellow">
  <Title>Where it sits</Title>
  <Spectrum segments={[{ label: "Low", flex: 1 }, { label: "Medium", flex: 1.2 }, { label: "High", flex: 1.4 }]} />
</Slide>`, ['spectrum', 'range', 'scale'])

t('progressbar', 'Progress Bar Slide', 'Distribution bar.', `<Slide theme="dark" accent="yellow" gradient="diagonal">
  <Title>How it splits</Title>
  <ProgressBar segments={[{ label: "Done 70%", flex: 7, color: "teal" }, { label: "Left 30%", flex: 3, color: "red" }]} />
</Slide>`, ['progress', 'bar', 'split', 'percentage'])

t('stat', 'Statistic Highlight', 'Large number with context.', `<Slide theme="light" accent="teal" gradient="radial">
  <Title>One number</Title>
  <TwoColumn>
    <Text align="left">What the number means and why it matters.</Text>
    <Stat value="42%" label="faster" />
  </TwoColumn>
</Slide>`, ['stat', 'number', 'metric', 'kpi'])

t('phaserow', 'Phase Row Slide', 'Sequential phases.', `<Slide theme="dark">
  <Title>Three phases</Title>
  <PhaseRow phases={[{ title: "Research", items: ["Read"], color: "navy" }, { title: "Plan", items: ["Decide"], color: "teal" }, { title: "Build", items: ["Ship"], color: "red" }]} />
</Slide>`, ['phases', 'process', 'steps'])

t('timeline', 'Timeline Slide', 'Milestones with a deadline.', `<Slide theme="dark" accent="teal">
  <Title>The road to launch</Title>
  <Timeline color="teal" events={[{ date: "Jan", title: "Start" }, { date: "Mar", title: "Beta" }, { date: "May", title: "Freeze" }, { date: "Jun", title: "Launch", isDeadline: true }]} />
</Slide>`, ['timeline', 'milestones', 'roadmap', 'deadline'])

t('closing', 'Closing Slide', 'Questions or thank you.', `<Slide theme="dark" accent="yellow" gradient="spotlight">
  <Title accent>Questions?</Title>
  <Text muted>Where to find the slides</Text>
</Slide>`, ['closing', 'questions', 'thanks', 'end'])

t('discussion', 'Discussion Slide', 'Two discussion prompts.', `<Slide theme="dark" gradient="spotlight">
  <Title accent>Discuss</Title>
  <TwoColumn>
    <Card title="Question one">What would change?</Card>
    <Card title="Question two">What would you keep?</Card>
  </TwoColumn>
</Slide>`, ['discussion', 'questions', 'workshop'])

t('sequence', 'Sequence Diagram', 'Client and server request-response.', `<Slide theme="dark">
  <Title>Request and response</Title>
  <SequenceDiagram actors={[{ id: "client", label: "Client", color: "teal" }, { id: "server", label: "Server", color: "navy" }]} messages={[{ from: "client", to: "server", label: "Request" }, { from: "server", to: "client", label: "Response", type: "dashed" }]} />
</Slide>`, ['sequence', 'diagram', 'request', 'api'])

t('datamodel', 'Data Model Diagram', 'Two entities and a one-to-many relation.', `<Slide theme="dark">
  <Title>Data model</Title>
  <DataModel entities={[{ id: "a", name: "Deck", fields: [{ name: "id", type: "string", primary: true }] }, { id: "b", name: "Slide", color: "navy", fields: [{ name: "deckId", type: "string", required: true }] }]} relations={[{ from: "a", to: "b", type: "one-to-many" }]} />
</Slide>`, ['data', 'model', 'entity', 'erd'])
