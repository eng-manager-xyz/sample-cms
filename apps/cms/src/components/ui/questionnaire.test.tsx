import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from './questionnaire';

const items = [
  {
    name: 'authority',
    required: true,
    choices: [{ value: 'router' }, { value: 'auteur' }],
  },
  {
    name: 'serve-path',
    required: true,
    choices: [{ value: 'selectors' }, { value: 'publication' }],
  },
] as const;

describe('Auteur shadcn questionnaire adapter', () => {
  test('server-renders native questionnaire semantics and stable progress', () => {
    const markup = renderToStaticMarkup(
      <Questionnaire items={items} shortcuts="letters">
        <QuestionnaireProgress />
        <QuestionnaireItem name="authority" required>
          <QuestionnaireTitle>Who owns canonical route status?</QuestionnaireTitle>
          <QuestionnaireDescription>Choose the authoritative system.</QuestionnaireDescription>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="router">RouterService</QuestionnaireChoice>
            <QuestionnaireChoice value="auteur">Auteur</QuestionnaireChoice>
          </QuestionnaireChoices>
          <QuestionnaireError>Please choose one answer.</QuestionnaireError>
        </QuestionnaireItem>
        <QuestionnaireItem name="serve-path" required>
          <QuestionnaireTitle>What does public serving read?</QuestionnaireTitle>
          <QuestionnaireChoices>
            <QuestionnaireChoice value="selectors">Selector rows</QuestionnaireChoice>
            <QuestionnaireChoice value="publication">The active publication</QuestionnaireChoice>
          </QuestionnaireChoices>
        </QuestionnaireItem>
        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireNext />
          <QuestionnaireSubmit />
        </QuestionnaireActions>
      </Questionnaire>
    );

    expect(markup).toContain('<form');
    expect(markup).toContain('data-slot="questionnaire"');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('Question 1 of 2');
    expect(markup).toContain('<fieldset');
    expect(markup).toContain('<legend');
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('name="authority"');
    expect(markup).toContain('data-slot="questionnaire-choice-indicator"');
    expect(markup).toContain('aria-keyshortcuts="A"');
  });
});
