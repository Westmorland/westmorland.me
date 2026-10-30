import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/bricolage-grotesque/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './site.css';
import { Site } from './Site.jsx';
import { readPage } from './routing.js';

// Static policy HTML is readable without JS. Mount with the browser's actual
// route so legacy hash links also work without hydration mismatches.
createRoot(document.getElementById('root')).render(<Site initialPage={readPage(window.location)} />);
