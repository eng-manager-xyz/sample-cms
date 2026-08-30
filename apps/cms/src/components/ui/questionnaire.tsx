import { Questionnaire as QuestionnairePrimitive } from '@shadcn/react/questionnaire';
import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import {
  type ButtonSize,
  type ButtonVariant,
  buttonClassName,
} from '@/components/ui/button-styles';
import { cn } from '@/lib/cn';

/**
 * Auteur-styled adapter for the official shadcn Questionnaire primitive.
 * The headless package owns form, fieldset/legend, validation, focus, shortcut,
 * and progress semantics; this file owns only the repository's visual language.
 */
export function Questionnaire({
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Root>) {
  return (
    <QuestionnairePrimitive.Root
      data-slot="questionnaire"
      className={cn('flex w-full min-w-0 flex-col', className)}
      {...props}
    />
  );
}

export function QuestionnaireProgress({
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Progress>) {
  return (
    <QuestionnairePrimitive.Progress
      data-slot="questionnaire-progress"
      className={cn(
        'min-h-[1lh] w-fit min-w-[14ch] font-mono text-xs font-semibold tabular-nums text-accent-strong',
        className
      )}
      {...props}
    />
  );
}

export function QuestionnaireItem({
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Item>) {
  return (
    <QuestionnairePrimitive.Item
      data-slot="questionnaire-item"
      className={cn(
        'min-w-0 border-0 p-0 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-focus',
        className
      )}
      {...props}
    />
  );
}

export function QuestionnaireTitle({
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Title>) {
  return (
    <QuestionnairePrimitive.Title
      data-slot="questionnaire-title"
      className={cn(
        'font-display text-balance text-xl font-bold leading-tight text-ink',
        className
      )}
      {...props}
    />
  );
}

export function QuestionnaireDescription({
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Description>) {
  return (
    <QuestionnairePrimitive.Description
      data-slot="questionnaire-description"
      className={cn('mt-2 text-pretty text-sm leading-6 text-ink-muted', className)}
      {...props}
    />
  );
}

export function QuestionnaireChoices({
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Choices>) {
  return (
    <QuestionnairePrimitive.Choices
      data-slot="questionnaire-choices"
      className={cn('group/questionnaire-choices mt-5 grid min-w-0 gap-2.5', className)}
      {...props}
    />
  );
}

export function QuestionnaireChoice({
  children,
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Choice>) {
  return (
    <QuestionnairePrimitive.Choice
      data-slot="questionnaire-choice"
      className={cn(
        'group/questionnaire-choice relative flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas px-3.5 py-3 text-start outline-none transition-[border-color,background-color,box-shadow] select-none',
        'hover:border-line-strong hover:bg-surface-subtle focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-canvas',
        'data-checked:border-accent/45 data-checked:bg-accent-soft/55 data-invalid:border-danger/50',
        'data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className
      )}
      {...props}
    >
      <QuestionnairePrimitive.ChoiceInput
        data-slot="questionnaire-choice-input"
        className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        data-slot="questionnaire-choice-indicator"
        className="pointer-events-none relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-line-strong bg-canvas text-accent-strong group-data-[type=radio]/questionnaire-choice:rounded-full group-data-checked/questionnaire-choice:border-accent"
      >
        <span
          data-slot="questionnaire-choice-indicator-dot"
          className="hidden size-2 rounded-full bg-accent group-data-[type=checkbox]/questionnaire-choice:hidden group-data-checked/questionnaire-choice:block"
        />
        <Check
          aria-hidden="true"
          data-slot="questionnaire-choice-indicator-check"
          className="hidden size-3.5 group-data-[type=radio]/questionnaire-choice:hidden group-data-checked/questionnaire-choice:block"
        />
      </span>
      <QuestionnairePrimitive.ChoiceLabel
        data-slot="questionnaire-choice-label"
        className="flex min-w-0 flex-1 flex-col text-sm font-medium leading-5 text-ink"
      >
        {children}
      </QuestionnairePrimitive.ChoiceLabel>
      <QuestionnairePrimitive.ChoiceShortcut
        data-slot="questionnaire-choice-shortcut"
        className="pointer-events-none ms-auto hidden shrink-0 rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-ink-muted group-data-[shortcut]/questionnaire-choice:inline-flex"
      />
    </QuestionnairePrimitive.Choice>
  );
}

export function QuestionnaireError({
  className,
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Error>) {
  return (
    <QuestionnairePrimitive.Error
      data-slot="questionnaire-error"
      className={cn('mt-3 min-h-5 text-xs font-medium text-danger-strong', className)}
      {...props}
    />
  );
}

export function QuestionnaireActions({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="questionnaire-actions"
      className={cn(
        'mt-6 grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-t border-line pt-4',
        className
      )}
      {...props}
    />
  );
}

type NavigationStyleProps = {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function QuestionnairePrevious({
  children,
  className,
  size = 'default',
  variant = 'outline',
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Previous> & NavigationStyleProps) {
  return (
    <QuestionnairePrimitive.Previous
      data-slot="questionnaire-previous"
      className={buttonClassName({
        size,
        variant,
        className: cn('col-start-1 row-start-1 min-h-11 justify-self-start', className),
      })}
      {...props}
    >
      {children ?? 'Previous'}
    </QuestionnairePrimitive.Previous>
  );
}

export function QuestionnaireNext({
  children,
  className,
  size = 'default',
  variant = 'default',
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Next> & NavigationStyleProps) {
  return (
    <QuestionnairePrimitive.Next
      data-slot="questionnaire-next"
      className={buttonClassName({
        size,
        variant,
        className: cn('col-start-3 row-start-1 min-h-11 justify-self-end', className),
      })}
      {...props}
    >
      {children ?? 'Next'}
    </QuestionnairePrimitive.Next>
  );
}

export function QuestionnaireSubmit({
  children,
  className,
  size = 'default',
  variant = 'default',
  ...props
}: ComponentProps<typeof QuestionnairePrimitive.Submit> & NavigationStyleProps) {
  return (
    <QuestionnairePrimitive.Submit
      data-slot="questionnaire-submit"
      className={buttonClassName({
        size,
        variant,
        className: cn('col-start-3 row-start-1 min-h-11 justify-self-end', className),
      })}
      {...props}
    >
      {children ?? 'Check understanding'}
    </QuestionnairePrimitive.Submit>
  );
}
