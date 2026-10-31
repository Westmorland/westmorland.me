import { profiles } from './content.ts';
import type { Profile } from './content.ts';

type ProfileContext = 'home' | 'cv' | 'foot';

export function ProfileLink({ profile, context }: { profile: Profile; context: ProfileContext }) {
  return <a href={profile.href} rel="noopener" className={context} data-testid={`${context}-${profile.id}`}>{profile.label}<span className="ext" aria-hidden="true">↗</span></a>;
}

export function ProfileLinks({ context }: { context: ProfileContext }) {
  return <ul className={`pl ${context}`} aria-label="Profiles">{profiles.map((profile) => <li key={profile.id}><ProfileLink profile={profile} context={context} /></li>)}</ul>;
}
