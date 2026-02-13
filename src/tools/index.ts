import bash from './bash';
import utils from './utils';
import githubFetch from './github-fetch';
import { tencentWsaSearchTool } from './tencent-wsa';
import hybridCodeReader from './hybrid-code-reader';

export default [
  ...bash,
  ...utils,
  ...githubFetch,
  tencentWsaSearchTool,
  ...hybridCodeReader,
];