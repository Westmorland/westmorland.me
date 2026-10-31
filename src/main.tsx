import { createRoot } from 'react-dom/client';
import '@fontsource/bricolage-grotesque/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './site.css';
import { Site } from './Site.tsx';
import { readPage } from './routing.ts';
import { requireRoot } from './dom.ts';

// Static policy HTML is readable without JS. Mount with the browser's actual
// route so legacy hash links also work without hydration mismatches.
createRoot(requireRoot(document)).render(<Site initialPage={readPage(window.location)} />);
