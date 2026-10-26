// The parts of a course page. Used by the course toolbox and by the walkthrough, so both say the same thing.
import { ic, type IconName } from '@/components/ui';

export type Section = 'materials' | 'deadlines' | 'revision' | 'chats' | 'memory' | 'settings';

export const SECTIONS: { key: Section; label: string; blurb: string; icon: IconName; color: string }[] = [
  { key: 'materials', label: 'Files', blurb: 'Slides, notes, lecture recordings and assignment files', icon: ic('folder.fill', 'folder'), color: '#3442F5' },
  { key: 'deadlines', label: 'Deadlines', blurb: 'Exams, assignments and due dates', icon: ic('flag.fill', 'flag'), color: '#F0457E' },
  { key: 'revision', label: 'Exam prep', blurb: 'Cheat sheets, revision sheets and practice papers', icon: ic('pencil.and.list.clipboard', 'quiz'), color: '#0F9F74' },
  { key: 'chats', label: 'Tutor', blurb: 'Ask, learn a topic, practise or get assignment help', icon: ic('bubble.left.and.bubble.right.fill', 'forum'), color: '#8B4DF0' },
  { key: 'memory', label: 'Memory', blurb: 'What the tutor remembers and topics to revisit', icon: ic('brain.head.profile', 'psychology'), color: '#F07A12' },
  { key: 'settings', label: 'Settings', blurb: 'Course name, colour and details', icon: ic('gearshape.fill', 'settings'), color: '#0B93D6' },
];
