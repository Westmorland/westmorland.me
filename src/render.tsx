import { renderToString } from 'react-dom/server';
import { Site } from './Site.tsx';
import type { PageId } from './routing.ts';
export const render = (page: PageId) => renderToString(<Site initialPage={page} />);
