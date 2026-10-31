export interface Profile {
  id: string;
  label: string;
  href: `https://${string}`;
}

export interface FocusItem {
  title: string;
  body: string;
  cv: string;
  isAi?: boolean;
}

export interface PolicyDocument {
  title: string;
  intro: string;
  sections: {
    id: string;
    title: string;
    body: string[];
    link?: boolean;
    list?: { term: string; text: string }[];
    after?: string[];
  }[];
}

interface AiContent {
  heading: string;
  body: string;
  steps: [title: string, description: string][];
}

export const site = {
  name: 'Dan Westmorland',
  domain: 'westmorland.me',
  role: 'Software lead',
  location: 'Newcastle upon Tyne, UK',
};

export const profiles: Profile[] = [
  { id: 'linkedin', label: 'LinkedIn', href: 'https://uk.linkedin.com/in/danwestmorland' },
  { id: 'github', label: 'GitHub', href: 'https://github.com/Westmorland' },
  { id: 'medium', label: 'Medium', href: 'https://medium.com/@westmorland' },
];

export const home = {
  giant: ['software', 'lead'],
  strap: 'Software leadership, architecture and agentic AI delivery.',
  intro:
    'I lead developers, shape architecture and help turn ideas into practical, maintainable software. That includes hands-on work with AI agents across delivery, with review, testing and human judgement built in.',
};

export const focus: FocusItem[] = [
  { title: 'Architecture', body: 'Shaping systems that are clear to reason about and sensible to change.', cv: 'Technical leadership and architectural responsibility, shaping solutions that are robust, scalable and aligned to client needs.' },
  { title: 'Delivery', body: 'Moving ideas into working software in small, steady, verifiable steps.', cv: 'Projects from small bespoke builds to large, complex systems, across design, implementation, deployment and ongoing support.' },
  { title: 'People', body: 'Mentoring developers and helping teams do their best work together.', cv: 'Line management of software consultants from junior to senior, supporting their growth while keeping delivery quality high.' },
  { title: 'Agentic AI software delivery', body: 'Using AI agents across software delivery, with clear scope, review, testing and human oversight.', cv: 'AI-assisted workflows from brief to tested change, with human oversight throughout.', isAi: true },
];

export const ai: AiContent = {
  heading: 'Agentic AI delivery',
  body:
    'I design and use AI-assisted workflows across software delivery, from breaking down a brief and coordinating agents through to implementation, review and testing. My focus is making that work repeatable and verifiable, with clear responsibilities and human judgement at the points that matter.',
  steps: [
    ['Brief', 'Break the work into scoped, reviewable pieces.'],
    ['Build', 'Coordinate agents through implementation.'],
    ['Check', 'Review and test the result before it is accepted.'],
    ['Decide', 'People own priorities, acceptance and release.'],
  ],
};

export const cv = {
  headline: 'Software lead and architect',
  lede: 'Extensive experience in full-stack .NET development, leading projects from small bespoke builds to large, complex systems.',
  profile: [
    'I line-manage software consultants from junior to senior, supporting their growth while keeping delivery quality high. Alongside hands-on development, I take on technical leadership and architecture, and advise clients on the best use of technology for their business challenges.',
    'My work covers the full lifecycle, from design and implementation to deployment and ongoing support.',
  ],
  current: {
    title: 'Software Team Lead',
    org: 'Waterstons',
    short: '2022 to now',
    since: 'since 2019',
    workplace: 'Based in Newcastle upon Tyne, I work in Durham as a Software Team Lead at Waterstons, within the Digital Solutions software development team.',
    points: [
      'Supporting the growth and development of a highly skilled software team across projects, clients and industries.',
      'Helping clients develop ideas into release-ready software.',
    ],
  },
  waterstons: {
    progression: 'Earlier roles: Senior Software Consultant and Senior Software Consultant Lead.',
    description: 'My work at Waterstons spans hands-on development, technical leadership, architecture, client advice and mentoring.',
  },
  earlier: [
    {
      org: 'Oak Intranet',
      title: 'Developer and Lead Software Developer',
      description: 'Worked on the development of Oak’s intranet platform, helping organisations connect their people, share information and improve internal communication. Progressed from platform development to Lead Software Developer.',
    },
    {
      org: 'Creating Careers / vision2learn',
      title: 'Developer',
      description: 'Developed functionality for the vision2learn e-learning platform, supporting learners studying online and improving the efficiency of the operations team. Worked with ASP.NET to extend the platform’s capabilities.',
    },
    {
      org: 'Tata Steel',
      title: 'Training Facilitator',
      description: 'Responsible for on-site employee training at Tata Steel.',
    },
  ],
  stack: ['C# and .NET', 'Azure', 'React', 'SQL Server', 'Azure DevOps', 'Docker'],
  education: [{ award: 'BSc Computer Studies', place: 'Teesside University' }],
};

export const privacy: PolicyDocument = {
  title: 'Privacy',
  intro:
    'This notice explains how information is used by this website and its associated personal Google-connected application.',
  sections: [
    {
      id: 'website',
      title: 'Visiting this website',
      body: [
        'This website does not ask you to create an account, sign in or submit information. It does not use advertising, analytics or tracking cookies.',
        'The hosting provider may process technical request information, such as your IP address and browser details, to deliver and protect the website.',
      ],
    },
    {
      id: 'google',
      title: 'Google services',
      body: [
        'The separate personal application accesses Google data only when an account holder grants permission. There is no Google sign-in or access to account data through this website.',
      ],
      list: [
        { term: 'Gmail', text: 'Read-only access to email messages, attachments and related information. It cannot send, change or delete email.' },
        { term: 'Google Calendar', text: 'Permission to view and manage calendars and events, including creating, changing and deleting them.' },
      ],
      after: [
        'This information is used to provide requested functions, such as summarising messages, identifying dates and actions, and managing calendar events.',
      ],
    },
    {
      id: 'processing',
      title: 'Processing and sharing',
      body: [
        'Relevant Google data and instructions may be sent to AI service providers, including OpenAI, to produce responses and carry out requested functions. Processing may take place outside the UK. Providers handle that information under their applicable terms and data controls.',
        'Google data is not sold, used for advertising or used to train general-purpose AI models. Use and transfer of information received from Google APIs is subject to the Google API Services User Data Policy, including its Limited Use requirements.',
      ],
    },
    {
      id: 'storage',
      title: 'Storage and deletion',
      body: [
        'Authorisation tokens, selected content, generated summaries, conversation history and saved notes may be stored to support the requested functions and continuity between sessions. Stored information can remain after a session ends until it is deleted; this notice does not promise a fixed automatic expiry period.',
        "Removing Google access does not automatically delete information already stored, or events already created. Provider-held copies are subject to the provider's retention and deletion arrangements. To ask about stored information or request deletion, use the user-support contact shown on the application's Google consent screen.",
      ],
    },
    {
      id: 'control',
      title: 'Your control',
      body: [
        "You can remove the application's permission at any time through the connected-app settings of your Google Account. Once Google applies the revocation, the application can no longer use that permission to access your account.",
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this notice',
      body: ['This notice may be updated. The current version will always be published on this page.'],
    },
  ],
};

export const terms: PolicyDocument = {
  title: 'Terms',
  intro: 'These terms apply to this website and to its associated personal Google-connected application.',
  sections: [
    {
      id: 'site',
      title: 'This website',
      body: [
        'This is a personal website. Its content is provided for general information only, as it is, without any warranty.',
      ],
    },
    {
      id: 'app',
      title: 'The application',
      body: [
        'The separate Google-connected application is for personal use and is not offered as a public service.',
        'If you use it, you must use it lawfully and only with accounts you are entitled to use.',
      ],
    },
    {
      id: 'liability',
      title: 'Liability',
      body: [
        'To the extent the law allows, the site owner is not responsible for any loss arising from use of this website or the application.',
      ],
    },
    {
      id: 'privacy',
      title: 'Privacy',
      body: ['How information is used is described in the privacy notice.'],
      link: true,
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      body: ['These terms may be updated. The current version will always be published on this page.'],
    },
  ],
};
