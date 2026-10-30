import React from 'react';
import { renderToString } from 'react-dom/server';
import { Site } from './Site.jsx';
export const render = (page) => renderToString(<Site initialPage={page} />);
