export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'To Do' | 'In Progress' | 'Done' | 'At Risk';

export type Project = {
  id: string;
  name: string;
  badgeClass: string; // one of the .badge-* utility classes from index.css
};

export type Task = {
  id: string;
  name: string;
  project: Project;
  priority: Priority;
  deadline: string;
  progress: number;
  status: Status;
  isCompleted?: boolean;
  assignees?: User[];
  /** Set when this task is a subtask of another task (M2 checklist hierarchy). */
  parentId?: string;
  /** Set when this task has a Finish-to-Start dependency on another task (M2). */
  dependsOn?: string;
};

export type User = {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  role?: string;
};

export const currentUser: User = {
  id: 'u1',
  name: 'Alex Morgan',
  initials: 'AM',
  role: 'Account & working hours',
};

export const projects: Record<string, Project> = {
  marketing: { id: 'p1', name: 'Marketing', badgeClass: 'badge badge-primary' },
  discovery: { id: 'p2', name: 'Discovery', badgeClass: 'badge badge-muted' },
  product:   { id: 'p3', name: 'Product',   badgeClass: 'badge badge-success' },
  strategy:  { id: 'p4', name: 'Strategy',  badgeClass: 'badge badge-warning' },
  growth:    { id: 'p5', name: 'Growth',    badgeClass: 'badge badge-primary' },
};

export const mockTasks: Task[] = [
  {
    id: 't1',
    name: 'Finalize launch campaign brief',
    project: projects.marketing,
    priority: 'High',
    deadline: 'Sep 26, 2026',
    progress: 72,
    status: 'In Progress',
    isCompleted: false,
  },
  {
    id: 't2',
    name: 'Review landing page copy',
    project: projects.marketing,
    priority: 'Medium',
    deadline: 'Sep 26, 2026',
    progress: 100,
    status: 'Done',
    isCompleted: true,
    parentId: 't1', // subtask of "Finalize launch campaign brief"
  },
  {
    id: 't3',
    name: 'Export social media assets',
    project: projects.marketing,
    priority: 'Medium',
    deadline: 'Sep 27, 2026',
    progress: 45,
    status: 'In Progress',
    isCompleted: false,
    parentId: 't1', // subtask of "Finalize launch campaign brief"
  },
  {
    id: 't4',
    name: 'Synthesize customer research notes',
    project: projects.discovery,
    priority: 'High',
    deadline: 'Sep 28, 2026',
    progress: 30,
    status: 'At Risk',
    isCompleted: false,
  },
  {
    id: 't5',
    name: 'Prepare mobile design handoff',
    project: projects.product,
    priority: 'High',
    deadline: 'Sep 30, 2026',
    progress: 60,
    status: 'In Progress',
    isCompleted: false,
    dependsOn: 't1', // can't start until the campaign brief is finalized
  },
  {
    id: 't6',
    name: 'Define Q4 success metrics',
    project: projects.strategy,
    priority: 'Medium',
    deadline: 'Oct 2, 2026',
    progress: 15,
    status: 'To Do',
    isCompleted: false,
  },
  {
    id: 't7',
    name: 'Audit onboarding email sequence',
    project: projects.growth,
    priority: 'Low',
    deadline: 'Oct 4, 2026',
    progress: 0,
    status: 'To Do',
    isCompleted: false,
  },
  {
    id: 't8',
    name: 'Share sprint retrospective summary',
    project: projects.product,
    priority: 'Low',
    deadline: 'Oct 5, 2026',
    progress: 100,
    status: 'Done',
    isCompleted: true,
  },
];

export function getTaskById(id: string): Task | undefined {
  return mockTasks.find((t) => t.id === id);
}
