export const site = {
  name: 'Dan Westmorland',
  domain: 'westmorland.me',
  role: 'Software lead',
};

export const home = {
  giant: ['software', 'lead'],
  strap: 'Architecture, delivery and people.',
  intro:
    'I work across software architecture, delivery and mentoring, helping turn ideas into practical, maintainable software.',
  focus: [
    {
      title: 'Architecture',
      body: 'Shaping systems that are clear to reason about and sensible to change.',
    },
    {
      title: 'Delivery',
      body: 'Moving ideas into working software in small, steady, verifiable steps.',
    },
    {
      title: 'People',
      body: 'Mentoring developers and helping teams do their best work together.',
    },
  ],
};

export const privacy = {
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

export const terms = {
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
