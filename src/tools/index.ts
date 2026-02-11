import bash from './bash';
import utils from './utils';
import webSearch from './web-search';
import githubFetch from './github-fetch';

export default [
  ...bash,
  ...utils,
  ...webSearch,
  ...githubFetch,
];