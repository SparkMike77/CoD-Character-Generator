import { renderMarkdown } from './markdown.js';
import { GETTING_STARTED_CONTENT } from './default-getting-started.js';

document.getElementById('getting-started-content').innerHTML = renderMarkdown(GETTING_STARTED_CONTENT);
