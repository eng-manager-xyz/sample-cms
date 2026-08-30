import chaptersOneThroughThree from './chapters-1-3.md?raw';
import chaptersFourThroughSix from './chapters-4-6.md?raw';
import { parseTutorialCurriculum } from './tutorial-curriculum';
import tutorialPlan from './tutorial-plan.json';

export const tutorialCurriculum = parseTutorialCurriculum(tutorialPlan, [
  { id: 'chapters-1-3', markdown: chaptersOneThroughThree },
  { id: 'chapters-4-6', markdown: chaptersFourThroughSix },
]);
